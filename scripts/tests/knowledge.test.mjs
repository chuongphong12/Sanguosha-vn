import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../knowledge.mjs", import.meta.url));

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "commit.gpgSign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "tqs-knowledge-"));
  t.after(() => {
    assert.equal(dirname(root), realpathSync(tmpdir()));
    assert.ok(basename(root).startsWith("tqs-knowledge-"));
    rmSync(root, { recursive: true, force: true });
  });
  const game = join(root, "game");
  const docs = join(root, "docs");
  for (const repo of [game, docs]) {
    mkdirSync(repo);
    git(repo, "init", "-b", "main");
    git(repo, "config", "user.name", "Knowledge fixture");
    git(repo, "config", "user.email", "fixture@example.invalid");
    git(repo, "config", "core.autocrlf", "false");
    git(repo, "config", "core.hooksPath", ".git/no-hooks");
    writeFileSync(
      join(repo, "README.md"),
      repo === docs ? "# Knowledge one\n" : "# Game\n",
    );
    git(repo, "add", ".");
    git(repo, "commit", "-m", "Initial fixture");
  }
  return { root, game, docs, first: git(docs, "rev-parse", "HEAD") };
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}

function succeeds(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test("an explicit full commit imports a snapshot that can be verified offline", (t) => {
  const { game, docs, first } = fixture(t);
  succeeds(run(game, "sync", first, "--from", docs));
  assert.equal(
    readFileSync(join(game, "knowledge/README.md"), "utf8"),
    "# Knowledge one\n",
  );
  const lock = JSON.parse(
    readFileSync(join(game, "knowledge.lock.json"), "utf8"),
  );
  assert.equal(
    lock.repository,
    "https://github.com/chuongphong12/Sanguosha-vn-knowledge.git",
  );
  assert.equal(lock.commit, first);
  assert.equal(lock.tree, git(docs, "rev-parse", "HEAD^{tree}"));
  succeeds(run(game, "verify"));
});

test("plain clone, branch switch and worktree creation restore their own documentation versions", (t) => {
  const { root, game, docs, first } = fixture(t);
  succeeds(run(game, "sync", first, "--from", docs));
  git(game, "add", "knowledge.lock.json");
  git(game, "commit", "-m", "Pin knowledge one");
  git(game, "branch", "version-one");
  writeFileSync(join(docs, "README.md"), "# Knowledge two\n");
  git(docs, "add", ".");
  git(docs, "commit", "-m", "Knowledge two");
  const second = git(docs, "rev-parse", "HEAD");
  succeeds(run(game, "sync", second, "--from", docs));
  git(game, "add", "knowledge.lock.json");
  git(game, "commit", "-m", "Pin knowledge two");
  const clone = join(root, "clone");
  git(root, "clone", "--no-local", game, clone);
  assert.equal(
    readFileSync(join(clone, "knowledge/README.md"), "utf8"),
    "# Knowledge two\n",
  );
  // The original documentation commit need not be in a squashed game clone.
  assert.notEqual(
    spawnSync("git", ["cat-file", "-e", second], { cwd: clone }).status,
    0,
  );
  succeeds(run(clone, "verify"));
  git(clone, "switch", "--create", "version-one", "origin/version-one");
  assert.equal(
    readFileSync(join(clone, "knowledge/README.md"), "utf8"),
    "# Knowledge one\n",
  );
  succeeds(run(clone, "verify"));
  const worktree = join(root, "worktree");
  git(clone, "worktree", "add", "--detach", worktree, "origin/main");
  assert.equal(
    readFileSync(join(worktree, "knowledge/README.md"), "utf8"),
    "# Knowledge two\n",
  );
  succeeds(run(worktree, "verify"));
  succeeds(run(worktree, "verify", "--from", docs));
});

test("verification rejects missing or stale locks, changed bytes and false upstream provenance", (t) => {
  const { game, docs, first } = fixture(t);
  const missing = run(game, "verify");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing or invalid/);
  succeeds(run(game, "sync", first, "--from", docs));
  const lockPath = join(game, "knowledge.lock.json");
  const originalLock = readFileSync(lockPath, "utf8");
  for (const changed of [
    "{}",
    JSON.stringify({ ...JSON.parse(originalLock), tree: "0".repeat(40) }),
  ]) {
    writeFileSync(lockPath, changed);
    assert.equal(run(game, "verify").status, 1);
  }
  writeFileSync(lockPath, originalLock);
  writeFileSync(join(game, "knowledge/README.md"), "Local draft\n");
  assert.equal(run(game, "verify").status, 1);
  writeFileSync(join(game, "knowledge/README.md"), "# Knowledge one\n");
  writeFileSync(join(game, "knowledge/new.md"), "Untracked local draft\n");
  assert.equal(run(game, "verify").status, 1);
  rmSync(join(game, "knowledge/new.md"));
  writeFileSync(join(docs, "README.md"), "A different upstream tree\n");
  git(docs, "add", ".");
  git(docs, "commit", "-m", "Different tree");
  writeFileSync(
    lockPath,
    JSON.stringify({
      ...JSON.parse(originalLock),
      commit: git(docs, "rev-parse", "HEAD"),
    }),
  );
  const falseProvenance = run(game, "verify", "--from", docs);
  assert.equal(falseProvenance.status, 1);
  assert.match(falseProvenance.stderr, /Upstream commit tree differs/);
  writeFileSync(lockPath, originalLock);
  succeeds(run(game, "verify", "--from", docs));
});

test("failed synchronization preserves local edits and the recorded game revision", (t) => {
  const { game, docs, first } = fixture(t);
  succeeds(run(game, "sync", first, "--from", docs));
  git(game, "add", "knowledge.lock.json");
  git(game, "commit", "-m", "Pin knowledge");
  const originalHead = git(game, "rev-parse", "HEAD");
  const originalLock = readFileSync(join(game, "knowledge.lock.json"), "utf8");
  writeFileSync(
    join(game, "knowledge/README.md"),
    "Keep my uncommitted draft\n",
  );
  assert.equal(run(game, "sync", first, "--from", docs).status, 1);
  assert.equal(
    readFileSync(join(game, "knowledge/README.md"), "utf8"),
    "Keep my uncommitted draft\n",
  );
  writeFileSync(join(game, "knowledge/README.md"), "# Knowledge one\n");
  assert.equal(run(game, "sync", "main", "--from", docs).status, 1);
  assert.equal(run(game, "sync", "0".repeat(40), "--from", docs).status, 1);
  writeFileSync(join(game, "knowledge/local.md"), "Keep my new draft\n");
  assert.equal(run(game, "sync", first, "--from", docs).status, 1);
  assert.equal(
    readFileSync(join(game, "knowledge/local.md"), "utf8"),
    "Keep my new draft\n",
  );
  assert.equal(git(game, "rev-parse", "HEAD"), originalHead);
  assert.equal(
    readFileSync(join(game, "knowledge.lock.json"), "utf8"),
    originalLock,
  );
});

test("a pinned snapshot with a broken internal documentation link fails verification", (t) => {
  const { game, docs } = fixture(t);
  writeFileSync(
    join(docs, "README.md"),
    "# Knowledge\n\n[Missing contract](engine/missing.md)\n",
  );
  git(docs, "add", ".");
  git(docs, "commit", "-m", "Broken navigation");
  succeeds(run(game, "sync", git(docs, "rev-parse", "HEAD"), "--from", docs));
  const result = run(game, "verify");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Broken documentation link/);
});
