/**
 * What a human may say when creating a project — and nothing else.
 *
 * The schema is **strict**: a request that carries `status`, `organization_id`,
 * `created_by` or `archived_by` fails to parse rather than being quietly stripped.
 * Those four are decided by the server from the session, and a client that tries to
 * supply them is either broken or hostile; either way it should hear about it.
 *
 * Client-side validation exists for UX only. This is the boundary that counts, and it
 * is duplicated one level lower as CHECK constraints in
 * `supabase/migrations/20260724000007_project_lifecycle.sql`.
 */

import { z } from "zod";
import { OUTPUT_LANGS } from "./analysis-input";

export const PROJECT_NAME_MAX = 120;
export const PROJECT_TEXT_MAX = 2000;
export const PROJECT_STAKEHOLDER_MAX = 120;
export const PROJECT_STAKEHOLDERS_MAX_COUNT = 20;

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** What the list view may be asked for. `all` is a view, never a stored state. */
export const PROJECT_FILTERS = ["active", "archived", "all"] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

/** Trim first, then require content — " " is an empty name, not a one-character one. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

export const createProjectInputSchema = z.strictObject({
  name: z.string().trim().min(1, "Project name is required").max(PROJECT_NAME_MAX),
  domainProfileId: z.uuid("Choose a business domain"),
  outputLang: z.enum(OUTPUT_LANGS),
  description: optionalText(PROJECT_TEXT_MAX),
  businessObjective: optionalText(PROJECT_TEXT_MAX),
  knownStakeholders: z
    .array(z.string().trim().min(1).max(PROJECT_STAKEHOLDER_MAX))
    .max(PROJECT_STAKEHOLDERS_MAX_COUNT)
    .default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const archiveProjectInputSchema = z.strictObject({
  projectId: z.uuid(),
  reason: optionalText(PROJECT_TEXT_MAX),
});

export type ArchiveProjectInput = z.infer<typeof archiveProjectInputSchema>;

/**
 * Reads the create form. Only the fields named here are looked at, so an injected
 * `status` or `organization_id` field never even reaches the schema — defence in
 * depth rather than one clever check.
 *
 * Stakeholders arrive as one textarea, one per line: a structured array in the
 * database, a natural thing to type in the UI.
 */
export function readCreateProjectForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");

  return {
    name: text("name"),
    domainProfileId: text("domainProfileId"),
    outputLang: text("outputLang"),
    description: text("description"),
    businessObjective: text("businessObjective"),
    knownStakeholders: text("knownStakeholders")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ""),
  };
}

/** Field-keyed messages, so the form can render each one next to its input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
