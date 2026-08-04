/**
 * What a human may say about a source document — and nothing else.
 *
 * Strict objects again: a payload carrying `projectId`, `organizationId`,
 * `revisionNumber`, `supersedesSourceDocumentId`, `createdBy` or any lock field fails
 * to parse. Those are decided by the route and the database, and a client that offers
 * them is either broken or probing.
 *
 * The one rule here that is not like the project contract: **raw_text is never
 * trimmed.** `.trim()` appears exactly once, inside a refinement that asks whether the
 * text is blank — the value that leaves this module is the value that was typed, byte
 * for byte, because every future excerpt offset is measured against it.
 */

import { z } from "zod";

/** Mirrors the `source_kind` enum (migrations 20260724000001 and ...0009). */
export const SOURCE_KINDS = [
  "meeting_notes",
  "interview",
  "client_message",
  "project_brief",
  "operational_notes",
  "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  meeting_notes: "Meeting notes",
  interview: "Stakeholder interview",
  client_message: "Customer message",
  project_brief: "Project brief",
  operational_notes: "Operational notes",
  other: "Other",
};

export const SOURCE_TITLE_MAX = 200;
export const SOURCE_TEXT_MAX = 100_000;
export const SOURCE_STAKEHOLDER_MAX = 160;
export const SOURCE_NOTES_MAX = 2000;

/** Trim first, then require content — "  " is an empty field, not a two-space one. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

/**
 * A calendar date, not a timestamp: "when was this meeting" has no time zone. Checked
 * for real existence as well as shape, so 2026-02-31 is rejected rather than rounded.
 */
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || (/^\d{4}-\d{2}-\d{2}$/.test(value) && isRealDate(value)),
    "Enter a valid date",
  );

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Verbatim by construction. `.min(1)` catches the empty string; the refinement catches
 * "   \n\n  ". Neither of them rewrites the value, and there is no `.trim()` in the
 * chain that produces it.
 */
const rawText = z
  .string()
  .min(1, "Paste or type the source text")
  .max(SOURCE_TEXT_MAX, `Source text is limited to ${SOURCE_TEXT_MAX.toLocaleString()} characters`)
  .refine((value) => value.trim() !== "", "Source text cannot be only whitespace");

export const sourceContentSchema = z.strictObject({
  title: z.string().trim().min(1, "Give this source a title").max(SOURCE_TITLE_MAX),
  kind: z.enum(SOURCE_KINDS, { message: "Choose a source type" }),
  rawText,
  sourceDate: optionalDate,
  stakeholder: optionalText(SOURCE_STAKEHOLDER_MAX),
  notes: optionalText(SOURCE_NOTES_MAX),
});

export type SourceContentInput = z.infer<typeof sourceContentSchema>;

/**
 * Create, edit and "create the next revision" all carry exactly the same content.
 * What differs is which row the server writes it to, and that is decided from the
 * route and the database — never from the payload.
 */
export const createSourceInputSchema = sourceContentSchema;
export const updateSourceInputSchema = sourceContentSchema;

/** The optional intake fields as the database stores them: absent, not null. */
export function toMetadata(input: SourceContentInput): Record<string, string> {
  const metadata: Record<string, string> = {};
  if (input.sourceDate) metadata.sourceDate = input.sourceDate;
  if (input.stakeholder) metadata.stakeholder = input.stakeholder;
  if (input.notes) metadata.notes = input.notes;
  return metadata;
}

export type SourceMetadata = {
  sourceDate: string | null;
  stakeholder: string | null;
  notes: string | null;
};

export function fromMetadata(value: unknown): SourceMetadata {
  const record = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : null);
  return {
    sourceDate: text("sourceDate"),
    stakeholder: text("stakeholder"),
    notes: text("notes"),
  };
}

/**
 * Reads the source form. Only these six fields are looked at, so an injected
 * `revisionNumber` or `projectId` never reaches the schema at all.
 *
 * `formData.get` returns the value with `\r\n` line endings as the browser submitted
 * them; they are passed through untouched. Normalising them here would be a silent
 * edit of evidence and would shift every offset after the first newline.
 */
export function readSourceForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    title: text("title"),
    kind: text("kind"),
    rawText: text("rawText"),
    sourceDate: text("sourceDate"),
    stakeholder: text("stakeholder"),
    notes: text("notes"),
  };
}

/** Shown when the pasted text has no line that could serve as a title. */
export const DERIVED_SOURCE_TITLE_FALLBACK = "Pasted source";

/**
 * A title for text the user did not bother to name.
 *
 * Reads the first line that has any content — a pasted document often starts with a
 * blank line or two — and cleans *the copy*, never the input. `rawText` is not passed
 * on, not returned, and not mutated here: every excerpt offset in this project is
 * measured against the original bytes, so this function exists only to produce a
 * separate short string for the `title` column.
 *
 * Internal whitespace is collapsed because a heading pasted out of a document often
 * carries tab alignment; the result is sliced to the same ceiling the schema enforces
 * so a derived title can never be the thing that fails validation.
 */
export function deriveSourceTitle(rawText: string): string {
  for (const line of rawText.split(/\r?\n/)) {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (cleaned !== "") return cleaned.slice(0, SOURCE_TITLE_MAX);
  }
  return DERIVED_SOURCE_TITLE_FALLBACK;
}

/** Field-keyed messages, so the form can render each one next to its input. */
export function sourceFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
