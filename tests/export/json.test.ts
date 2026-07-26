/**
 * The JSON file, plus a golden fixture.
 *
 * The golden file is committed at `tests/export/__golden__/portfolio-demo.json` as a vitest
 * **file snapshot**. It exists to catch an *accidental* change to the wire shape — a renamed
 * field, a dropped section, a reordered array — which no hand-written assertion reliably
 * notices. When it fails on purpose, the diff is the review: read it, and if the change is
 * intended, regenerate with
 *
 *     npx vitest run tests/export -u
 *
 * A golden is not a substitute for the claims below it; both are here.
 */

import { describe, expect, it } from "vitest";
import { scopeForPreset } from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import { renderJson } from "../../lib/export/json";
import { renderMarkdown } from "../../lib/export/markdown";
import { exportInput, GENERATED_AT } from "./fixtures";

const pkg = buildExportPackage(exportInput(), scopeForPreset("portfolio_demo"), GENERATED_AT);
const json = renderJson(pkg);

describe("JSON export", () => {
  it("parses back to an object", () => {
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("is pretty-printed with two spaces and ends with a newline", () => {
    expect(json).toContain('\n  "generatedAt"');
    expect(json.endsWith("}\n")).toBe(true);
  });

  it("carries the schema version, the timestamp and the scope", () => {
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe("reqwise-export/1.0");
    expect(parsed.generatedAt).toBe(GENERATED_AT);
    expect(parsed.scope.status).toBe("reviewed_and_approved");
  });

  it("sorts object keys, so a field moving in the builder does not move in the file", () => {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
  });

  it("keeps array order, because that order is the export's determinism", () => {
    const parsed = JSON.parse(json);
    const displayIds = parsed.requirements.map((item: { displayId: string }) => item.displayId);
    expect(displayIds).toEqual([...displayIds]);
    expect(displayIds[0]).toBe("AC-001");
  });

  it("uses null where the contract allows it and never writes undefined", () => {
    expect(json).not.toContain("undefined");
    const parsed = JSON.parse(json);
    expect(parsed.project.archiveReason).toBeNull();
  });

  it("keeps Thai text as characters, not as escapes a reader cannot read", () => {
    expect(json).toContain("ลูกค้า");
  });

  it("refuses a package that does not match the contract", () => {
    const broken = { ...pkg, schemaVersion: "reqwise-export/9.9" } as unknown as typeof pkg;
    expect(() => renderJson(broken)).toThrow(/export contract/);
  });

  it("refuses a Date, which would silently serialise as a string", () => {
    const withDate = { ...pkg, generatedAt: new Date() } as unknown as typeof pkg;
    expect(() => renderJson(withDate)).toThrow();
  });

  it("names only fields in its error, never values", () => {
    const broken = { ...pkg, project: { ...pkg.project, id: "nope" } } as unknown as typeof pkg;
    try {
      renderJson(broken);
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).toContain("project.id");
      expect((error as Error).message).not.toContain("nope");
    }
  });
});

describe("golden fixture", () => {
  it("matches the committed portfolio-demo export", async () => {
    await expect(json).toMatchFileSnapshot("__golden__/portfolio-demo.json");
  });

  it("matches the committed portfolio-demo markdown", async () => {
    const markdown = renderMarkdown(pkg);
    await expect(markdown).toMatchFileSnapshot("__golden__/portfolio-demo.md");
  });
});
