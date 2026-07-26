/**
 * What the printable document needs that is not markup.
 *
 * Pure. The printable page is a React component, but *which* class carries a page break
 * and *what* a status reads as in black and white are decisions with rules behind them,
 * and rules belong somewhere they can be asserted without a browser.
 *
 * The controlling constraint: **paper has no hover, no colour guarantee and no scroll.**
 *
 *  * Every status appears as a **word**. A printed document may be photocopied in
 *    greyscale, and CLAUDE.md's accessibility rule (never colour alone) is stricter still
 *    on paper than on screen.
 *  * A requirement block must not be split across a page. `break-inside: avoid` is applied
 *    per block, not per section — a section can legitimately span pages, a single
 *    requirement's facts and its citation should not.
 *  * The application shell is not part of the document. The print stylesheet hides
 *    anything marked screen-only, so a printed page starts with the project's name rather
 *    than with a sidebar.
 */

import type { ExportPackage } from "../contracts/export";

/** Applied to each requirement, question and finding block. */
export const PRINT_BLOCK_CLASS = "export-block";

/** Applied to each major section, which starts on a fresh page after the first. */
export const PRINT_SECTION_CLASS = "export-section";

/** Hidden when printing: toolbars, buttons, links back into the application. */
export const SCREEN_ONLY_CLASS = "screen-only";

/** Shown only when printing: the footer that records what produced the document. */
export const PRINT_ONLY_CLASS = "print-only";

/**
 * The document's own title, used for `<title>` — and therefore for the default filename a
 * browser proposes in *Save as PDF*, which is the only place a print dialog lets us
 * influence the file name.
 */
export function printDocumentTitle(pkg: ExportPackage): string {
  return `${pkg.project.name} — requirements (${pkg.generatedAt.slice(0, 10)})`;
}

/**
 * The one-line provenance a printed page carries in its footer.
 *
 * On screen a reader can check the scope selector; on paper the page is all there is, so
 * it says what it contains and what produced it.
 */
export function printFooter(pkg: ExportPackage): string {
  const scope = pkg.scope.status.replace(/_/g, " ");
  return `ReqWise AI · ${pkg.project.name} · scope: ${scope} · export schema ${pkg.schemaVersion} · generated ${pkg.generatedAt}`;
}

/** Facts printed as `label: value` pairs under a requirement's heading. */
export function factPairs(
  pairs: Array<[string, string | null]>,
): Array<{ label: string; value: string }> {
  return pairs
    .filter((pair): pair is [string, string] => pair[1] !== null && pair[1] !== "")
    .map(([label, value]) => ({ label, value }));
}
