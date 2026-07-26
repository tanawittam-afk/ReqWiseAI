/**
 * What a downloaded file is called, and how the response says so.
 *
 * The slug is deliberately **ascii-only**. Most projects here are named in Thai, and a
 * Thai filename in `Content-Disposition` needs RFC 5987 encoding that browsers,
 * spreadsheet apps and shells all handle slightly differently — a mangled filename is a
 * support question, and a mangled *download* is a lost file. An ascii stem with the
 * project name inside the document is the trade that keeps the file openable everywhere.
 *
 * When a name transliterates to nothing (a wholly Thai title), the stem falls back to
 * `project` rather than to an empty string, because `-requirements.md` is not a filename.
 */

const SLUG_MAX = 48;
export const SLUG_FALLBACK = "project";

export function projectSlug(name: string): string {
  const slug = name
    .toLowerCase()
    // Latin letters, digits and spaces survive; everything else — Thai, punctuation,
    // emoji — becomes a separator rather than being silently dropped mid-word.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");

  return slug === "" ? SLUG_FALLBACK : slug;
}

/** The six downloadable artefacts, keyed by the route segment that produces them. */
export const EXPORT_FORMATS = [
  "markdown",
  "json",
  "requirements-csv",
  "questions-csv",
  "findings-csv",
  "traceability-csv",
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

const SUFFIX: Record<ExportFormat, string> = {
  markdown: "requirements.md",
  json: "requirements.json",
  "requirements-csv": "requirements.csv",
  "questions-csv": "open-questions.csv",
  "findings-csv": "quality-findings.csv",
  "traceability-csv": "traceability.csv",
};

/**
 * Content types carry an explicit `charset=utf-8`. Thai text in a CSV opened by a
 * spreadsheet is the case that punishes leaving it to a default.
 */
const CONTENT_TYPE: Record<ExportFormat, string> = {
  markdown: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  "requirements-csv": "text/csv; charset=utf-8",
  "questions-csv": "text/csv; charset=utf-8",
  "findings-csv": "text/csv; charset=utf-8",
  "traceability-csv": "text/csv; charset=utf-8",
};

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  markdown: "Markdown",
  json: "JSON",
  "requirements-csv": "Requirements CSV",
  "questions-csv": "Open questions CSV",
  "findings-csv": "Quality findings CSV",
  "traceability-csv": "Traceability CSV",
};

export function exportFilename(slug: string, format: ExportFormat): string {
  return `${slug}-${SUFFIX[format]}`;
}

export function exportContentType(format: ExportFormat): string {
  return CONTENT_TYPE[format];
}
