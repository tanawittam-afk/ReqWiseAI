/**
 * The combined intake form — one submission that describes a project *and* its first
 * source.
 *
 * No third schema is defined here. The two halves are read and validated by the exact
 * contracts that already govern them separately (`createProjectInputSchema`,
 * `sourceContentSchema`), so the combined screen cannot accept anything the two
 * separate screens would have refused. This module only composes them, and does the
 * one thing neither of them can do alone: fill a blank source title from the pasted
 * text before that text is validated.
 *
 * The two field sets are disjoint by inspection — the project owns `name`,
 * `domainProfileId`, `outputLang`, `description`, `businessObjective`,
 * `knownStakeholders`; the source owns `title`, `kind`, `rawText`, `sourceDate`,
 * `stakeholder`, `notes` — and each reader looks only at its own names, so a value
 * meant for one half can never be read as the other's.
 */

import {
  createProjectInputSchema,
  fieldErrors,
  readCreateProjectForm,
  type CreateProjectInput,
} from "./project";
import {
  deriveSourceTitle,
  readSourceForm,
  sourceContentSchema,
  sourceFieldErrors,
  type SourceContentInput,
} from "./source";

export type StartFormResult =
  | { ok: true; project: CreateProjectInput; source: SourceContentInput }
  | { ok: false; fieldErrors: Record<string, string> };

export function readStartForm(formData: FormData): StartFormResult {
  const project = createProjectInputSchema.safeParse(readCreateProjectForm(formData));

  // Derivation happens *before* validation so a blank title is never an error the user
  // has to go and fix. It reads `rawText` and returns a separate string — `rawText`
  // itself is passed on untouched, because every future excerpt offset is measured
  // against these exact bytes.
  const read = readSourceForm(formData) as Record<string, unknown>;
  const rawText = typeof read.rawText === "string" ? read.rawText : "";
  const typedTitle = String(read.title ?? "").trim();
  const source = sourceContentSchema.safeParse({
    ...read,
    title: typedTitle === "" ? deriveSourceTitle(rawText) : read.title,
  });

  // Both halves are reported at once. Fixing one field only to be shown the next is
  // exactly the friction this screen exists to remove.
  if (!project.success || !source.success) {
    return {
      ok: false,
      fieldErrors: {
        ...(project.success ? {} : fieldErrors(project.error)),
        ...(source.success ? {} : sourceFieldErrors(source.error)),
      },
    };
  }

  return { ok: true, project: project.data, source: source.data };
}
