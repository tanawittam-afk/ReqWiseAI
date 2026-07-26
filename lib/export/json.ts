/**
 * The JSON document.
 *
 * Pure `ExportPackage → string`, and thinner than it looks, because the package *is* the
 * JSON shape — that is the point of having a contract rather than serialising rows.
 *
 * What this file guarantees beyond `JSON.stringify`:
 *
 *  * **The package is validated first.** A file somebody will parse must match the schema
 *    it advertises. `renderJson` refuses rather than writing a `reqwise-export/1.0` file
 *    that is not one.
 *  * **Stable key order.** `JSON.stringify` follows insertion order, which is the
 *    builder's construction order — an implementation detail. A golden fixture that broke
 *    because a field moved would be a test failing for no reason, so keys are emitted in
 *    a declared order, recursively.
 *  * **No `undefined`.** `null` appears only where the contract says it may; `undefined`
 *    is dropped by `JSON.stringify` silently, which turns "we have no value" into "the
 *    field does not exist" — a difference a consumer will trip over.
 */

import { exportPackageSchema, type ExportPackage } from "../contracts/export.ts";

/**
 * Recursively sorts object keys.
 *
 * Arrays keep their order — that is the export's deterministic item ordering and must not
 * be touched. Only *object keys* are sorted, which is the part with no meaning.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) {
    // A Date would serialise to an ISO string and look fine, which is exactly why it is
    // refused: the contract says timestamps are strings, and a Date in the package means
    // some layer stopped converting them.
    throw new Error("export package contains a Date; timestamps must already be ISO strings");
  }

  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const child = record[key];
    if (child === undefined) {
      throw new Error(`export package contains undefined at key "${key}"`);
    }
    if (typeof child === "function") {
      throw new Error(`export package contains a function at key "${key}"`);
    }
    sorted[key] = sortKeys(child);
  }
  return sorted;
}

export function renderJson(pkg: ExportPackage): string {
  const parsed = exportPackageSchema.safeParse(pkg);
  if (!parsed.success) {
    // The issue paths name fields, never values — an error message about an export is not
    // a place to put the export's content.
    const where = parsed.error.issues
      .slice(0, 5)
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`export package does not match the export contract (${where})`);
  }

  return `${JSON.stringify(sortKeys(parsed.data), null, 2)}\n`;
}
