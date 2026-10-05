import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A previous patch script left `\${...}` inside template literals, which prints
 * the placeholder text instead of the value (card labels, HP icon paths, logs).
 */
const ESCAPED_PLACEHOLDER = /\\$\{/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("source hygiene", () => {
  it("has no escaped template placeholders in src", () => {
    const offenders = sourceFiles("src").flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          ESCAPED_PLACEHOLDER.test(line) ? [`${file}:${index + 1}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
