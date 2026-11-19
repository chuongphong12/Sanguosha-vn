import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repository =
  "https://github.com/chuongphong12/Sanguosha-vn-knowledge.git";
const prefix = "knowledge";
const lockName = "knowledge.lock.json";
const fullSha = /^[a-f0-9]{40}$/;

function git(root, ...args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(
      `git ${args[0]} failed: ${error.stderr?.toString().trim() || error.message}`,
    );
  }
}

function readLock(root) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(join(root, lockName), "utf8"));
  } catch {
    throw new Error(
      `Missing or invalid ${lockName}. Restore the lock for this game revision.`,
    );
  }
  if (
    lock.version !== 1 ||
    lock.repository !== repository ||
    !fullSha.test(lock.commit) ||
    !fullSha.test(lock.tree)
  ) {
    throw new Error(
      `Invalid ${lockName}: expected canonical repository and full commit/tree SHAs.`,
    );
  }
  return lock;
}

function assertSnapshot(root, lock) {
  const actualTree = git(root, "rev-parse", "--verify", `HEAD:${prefix}`);
  if (actualTree !== lock.tree) {
    throw new Error(
      "Knowledge tree differs from the lock. Restore the matching snapshot and lock.",
    );
  }
  if (
    git(root, "diff", "HEAD", "--name-only", "--", prefix) ||
    git(root, "ls-files", "--others", "--", prefix)
  ) {
    throw new Error(
      "Knowledge has local changes. Commit/export or restore your work before synchronization.",
    );
  }
}

function fetchTree(root, source, commit) {
  git(root, "fetch", "--no-tags", "--", source, commit);
  const actualCommit = git(
    root,
    "rev-parse",
    "--verify",
    "FETCH_HEAD^{commit}",
  );
  if (actualCommit !== commit)
    throw new Error("Fetched commit does not match the requested full SHA.");
  return git(root, "rev-parse", "--verify", `${commit}^{tree}`);
}

function assertDocumentationLinks(root) {
  const files = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "ARCHITECTURE.md",
    "CONTEXT.md",
  ]
    .map((path) => join(root, path))
    .filter(existsSync);
  function collect(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.name.endsWith(".md")) files.push(path);
    }
  }
  for (const directory of [prefix, "docs/agents", "docs/adr"])
    collect(join(root, directory));
  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1].split(/\s+"/)[0].replace(/^<|>$/g, "");
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const target = resolve(
        dirname(file),
        decodeURIComponent(href.split("#")[0]),
      );
      if (/^[a-z]+:/i.test(href) || !existsSync(target)) {
        throw new Error(`Broken documentation link in ${file}: ${href}`);
      }
    }
  }
}

function verify(root, source) {
  const lock = readLock(root);
  assertSnapshot(root, lock);
  assertDocumentationLinks(root);
  if (source && fetchTree(root, source, lock.commit) !== lock.tree) {
    throw new Error("Upstream commit tree differs from the lock.");
  }
  console.log(
    `Knowledge verified: ${lock.commit}${source ? " (upstream checked)" : " (offline tree check)"}`,
  );
}

function sync(root, commit, source) {
  if (!fullSha.test(commit || ""))
    throw new Error(
      "sync requires a full 40-character commit SHA, not a branch or tag.",
    );
  git(root, "symbolic-ref", "--quiet", "HEAD");
  if (git(root, "status", "--porcelain", "--untracked-files=no")) {
    throw new Error(
      "Tracked files have local changes. Commit or stash them before synchronization.",
    );
  }
  const hasSnapshot = existsSync(join(root, prefix));
  const hasLock = existsSync(join(root, lockName));
  if (hasSnapshot !== hasLock)
    throw new Error(
      "Incomplete knowledge import: restore both snapshot and lock.",
    );
  const previous = hasLock ? readLock(root) : undefined;
  if (previous) assertSnapshot(root, previous);
  const tree = fetchTree(root, source, commit);
  if (previous?.commit === commit) {
    if (previous.tree !== tree)
      throw new Error("Upstream commit tree differs from the lock.");
    console.log("Knowledge is already synchronized.");
    return;
  }
  git(
    root,
    "subtree",
    hasSnapshot ? "merge" : "add",
    `--prefix=${prefix}`,
    "--squash",
    commit,
  );
  if (git(root, "rev-parse", `HEAD:${prefix}`) !== tree) {
    throw new Error(
      "Imported subtree differs from upstream. Resolve the merge before updating the lock.",
    );
  }
  writeFileSync(
    join(root, lockName),
    `${JSON.stringify({ version: 1, repository, commit, tree }, null, 2)}\n`,
  );
  console.log(
    `Imported ${commit}. Review and commit ${lockName} before publishing the game change.`,
  );
}

try {
  const [command, ...args] = process.argv.slice(2);
  let source;
  if (args.at(-2) === "--from" && args.at(-1)) {
    source = args.pop();
    args.pop();
  } else if (args.at(-1) === "--upstream") {
    source = repository;
    args.pop();
  }
  if (!(
    (command === "verify" && args.length === 0) ||
    (command === "sync" && args.length === 1)
  )) {
    throw new Error(
      "Usage: node scripts/knowledge.mjs verify [--upstream | --from <repo>] | sync <full-SHA> [--from <repo>]",
    );
  }
  const root = git(process.cwd(), "rev-parse", "--show-toplevel");
  if (command === "verify") verify(root, source);
  else sync(root, args[0], source || repository);
} catch (error) {
  console.error(`Knowledge: ${error.message}`);
  process.exitCode = 1;
}
