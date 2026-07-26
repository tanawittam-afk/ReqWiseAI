/**
 * The export scope, carried in the URL.
 *
 * Pure, and the reason the export screen needs no database state: a scope is a *reading*
 * choice, not a fact about the project, so it belongs in the address bar rather than in a
 * table. Refreshing keeps it, a link shares it, the printable page and every download
 * inherit it, and the back button undoes it — none of which a saved preference would give,
 * and all without a migration.
 *
 * Robustness rule: **an unreadable parameter is ignored, never rejected.** A stale link
 * with a section name that no longer exists is a link somebody bookmarked, not an attack;
 * falling back to the default scope shows them a document, while a 400 shows them nothing.
 * What is *not* tolerated is a value that would silently change meaning — hence the
 * explicit `sections` list rather than a diff against a default that may move.
 */

import {
  DEFAULT_SCOPE,
  EXPORT_SECTIONS,
  isExportPreset,
  isExportStatusScope,
  scopeForPreset,
  type ExportPreset,
  type ExportScope,
  type ExportSection,
} from "../contracts/export";

export type ScopeParams = {
  preset?: string;
  status?: string;
  sections?: string;
  confidence?: string;
};

export type ResolvedScope = {
  scope: ExportScope;
  /** The preset the reader picked, when they picked one — for highlighting it. */
  preset: ExportPreset | null;
};

function isSection(value: string): value is ExportSection {
  return (EXPORT_SECTIONS as readonly string[]).includes(value);
}

export function parseScope(params: ScopeParams): ResolvedScope {
  const preset = params.preset && isExportPreset(params.preset) ? params.preset : null;
  const base = preset ? scopeForPreset(preset) : { ...DEFAULT_SCOPE, sections: { ...DEFAULT_SCOPE.sections } };

  if (params.status && isExportStatusScope(params.status)) base.status = params.status;

  if (typeof params.sections === "string") {
    const wanted = new Set(
      params.sections
        .split(",")
        .map((name) => name.trim())
        .filter(isSection),
    );
    // The list is authoritative: every section not named is off. An absent parameter
    // means "use the base scope"; an empty one means "everything off", which is a
    // choice the readiness check will then refuse as an empty export.
    for (const section of EXPORT_SECTIONS) base.sections[section] = wanted.has(section);
  }

  if (params.confidence === "0" || params.confidence === "false") base.includeConfidence = false;
  if (params.confidence === "1" || params.confidence === "true") base.includeConfidence = true;

  return { scope: base, preset };
}

/**
 * The query string that reproduces a scope exactly.
 *
 * The preset is deliberately **not** written back: once a reader changes a toggle the
 * document is no longer that preset, and a URL still claiming `preset=audit_package`
 * would name a thing the document is not. The explicit values are the truth.
 */
export function scopeToParams(scope: ExportScope): URLSearchParams {
  const params = new URLSearchParams();
  params.set("status", scope.status);
  params.set(
    "sections",
    EXPORT_SECTIONS.filter((section) => scope.sections[section]).join(","),
  );
  params.set("confidence", scope.includeConfidence ? "1" : "0");
  return params;
}

export function scopeQuery(scope: ExportScope): string {
  return scopeToParams(scope).toString();
}

/** Whether the version-summary section is on — the one read the loader can skip. */
export function needsVersionHistory(scope: ExportScope): boolean {
  return scope.sections.version_summary;
}
