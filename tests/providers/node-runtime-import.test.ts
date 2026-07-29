import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("analysis Node runtime import", () => {
  it.each([
    "lib/analysis/run-analysis.ts",
    "lib/analysis/legacy-verifier.ts",
  ])("loads %s without a bundler", (modulePath) => {
    const moduleUrl = pathToFileURL(resolve(modulePath)).href;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", `await import(${JSON.stringify(moduleUrl)})`],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
  });
});
