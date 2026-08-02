import { z } from "zod";

export type VerifierMode = "clean" | "linked-legacy";

const LEGACY_UNKNOWN_RUN_ID = "08edaef7-5c4f-45a0-be0a-eec3a7c2818f";

const payloadStructureSchema = z
  .object({
    raw: z.enum(["sql-null", "object", "array", "string", "number", "boolean"]),
    validated: z.enum([
      "sql-null",
      "object",
      "array",
      "string",
      "number",
      "boolean",
    ]),
    error: z.enum(["sql-null", "object", "array", "string", "number", "boolean"]),
    validatedTopLevelKeys: z.array(z.string()),
  })
  .strict();

const downstreamCountsSchema = z
  .object({
    items: z.number().int().nonnegative(),
    userStories: z.number().int().nonnegative(),
    acceptanceCriteria: z.number().int().nonnegative(),
    assumptions: z.number().int().nonnegative(),
    risks: z.number().int().nonnegative(),
    questions: z.number().int().nonnegative(),
    qualityFindings: z.number().int().nonnegative(),
    sourceReferences: z.number().int().nonnegative(),
    relations: z.number().int().nonnegative(),
    versions: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
    workflowChanged: z.number().int().nonnegative(),
  })
  .strict();

const projectDependenciesSchema = z
  .object({
    runs: z.number().int().nonnegative(),
    sources: z.number().int().nonnegative(),
    items: z.number().int().nonnegative(),
    sourceReferences: z.number().int().nonnegative(),
    relations: z.number().int().nonnegative(),
    versions: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
  })
  .strict();

const safeFingerprintSchema = z
  .object({
    classification: z.enum([
      "Verification/Test Data",
      "Unknown / Insufficient Evidence",
    ]),
    classificationConfidence: z.enum(["high", "low"]),
    status: z.literal("valid"),
    provider: z.literal("mock"),
    model: z.null(),
    promptVersion: z.null(),
    schemaVersion: z.literal("1.0.0"),
    outputLang: z.literal("th"),
    payloadStructure: payloadStructureSchema,
    mismatchCodes: z.array(z.string()).min(1),
    downstreamCounts: downstreamCountsSchema,
    projectDependencies: projectDependenciesSchema,
    provenanceFingerprint: z.string().min(1),
  })
  .strict();

const manifestGroupSchema = z
  .object({
    outcome: z.enum(["known-legacy-fixture", "known-legacy-unknown"]),
    origin: z.enum(["verify-db.mts", "verify-sources.mts", "unknown"]),
    ids: z.array(z.string().uuid()).min(1),
    expectedFingerprint: safeFingerprintSchema,
    preservationReason: z.string().min(1),
  })
  .strict();

const manifestSchema = z
  .object({
    version: z.literal(1),
    expectedLegacyCount: z.number().int().nonnegative(),
    linkedProjectRef: z.literal("rgfwtflsvnlgfiuoxowm").optional(),
    authorizesMutation: z.literal(false).optional(),
    groups: z.array(manifestGroupSchema).max(3),
  })
  .strict();

const inventoryRowSchema = safeFingerprintSchema
  .extend({ id: z.string().uuid() })
  .strip();

const inventorySchema = z
  .object({
    totalRunCount: z.number().int().nonnegative(),
    contractValidCount: z.number().int().nonnegative(),
    incompatibleRows: z.array(inventoryRowSchema),
  })
  .strip();

export type SafeLegacyFingerprint = z.infer<typeof safeFingerprintSchema>;
export type LegacyManifest = z.infer<typeof manifestSchema>;
export type LegacyInventory = z.infer<typeof inventorySchema>;
export type LegacyOutcome =
  | "contract-valid"
  | "known-legacy-fixture"
  | "known-legacy-unknown"
  | "unexpected-invalid";

export type LegacyInventoryResult = {
  mode: VerifierMode;
  totalRunCount: number;
  outcomeCounts: Record<LegacyOutcome, number>;
  rows: Array<{
    id: string;
    outcome: LegacyOutcome;
  }>;
};

export function parseVerifierMode(value: string | undefined): VerifierMode {
  if (value === undefined || value === "clean") return "clean";
  if (value === "linked-legacy") return "linked-legacy";
  throw new Error(
    `Invalid verifier mode. Expected "clean" or "linked-legacy", received ${JSON.stringify(value)}.`,
  );
}

function normalizeFingerprint(
  fingerprint: SafeLegacyFingerprint,
): SafeLegacyFingerprint {
  return {
    ...fingerprint,
    payloadStructure: {
      ...fingerprint.payloadStructure,
      validatedTopLevelKeys: [...fingerprint.payloadStructure.validatedTopLevelKeys].sort(),
    },
    mismatchCodes: [...fingerprint.mismatchCodes].sort(),
  };
}

function assertManifestShape(manifest: LegacyManifest): void {
  const dbGroups = manifest.groups.filter((group) => group.origin === "verify-db.mts");
  const sourceGroups = manifest.groups.filter(
    (group) => group.origin === "verify-sources.mts",
  );
  const unknownGroups = manifest.groups.filter((group) => group.origin === "unknown");
  const allIds = manifest.groups.flatMap((group) => group.ids);

  if (new Set(allIds).size !== allIds.length) {
    throw new Error("Legacy manifest contains a duplicate analysis-run ID.");
  }
  if (allIds.length !== manifest.expectedLegacyCount) {
    throw new Error("Legacy manifest ID count does not match expectedLegacyCount.");
  }
  // A group is optional (the verify-db.mts and verify-sources.mts fixture groups, 15
  // rows each, were irrecoverably deleted from the linked project on 2026-07-30 by
  // scripts/verify-db-cleanup.sql's project-name patterns matching the projects that
  // owned them — no PITR/backup existed to restore them, see HANDOFF.md), but if present
  // it must still have exactly the 15 rows it always did.
  if (dbGroups.length > 1 || dbGroups.some((group) => group.ids.length !== 15)) {
    throw new Error("A verify-db fixture group, if present, must contain exactly 15 IDs.");
  }
  if (sourceGroups.length > 1 || sourceGroups.some((group) => group.ids.length !== 15)) {
    throw new Error("A verify-sources fixture group, if present, must contain exactly 15 IDs.");
  }
  if (
    unknownGroups.length !== 1 ||
    unknownGroups[0].ids.length !== 1 ||
    unknownGroups[0].ids[0] !== LEGACY_UNKNOWN_RUN_ID ||
    unknownGroups[0].outcome !== "known-legacy-unknown" ||
    unknownGroups[0].expectedFingerprint.classification !==
      "Unknown / Insufficient Evidence" ||
    unknownGroups[0].expectedFingerprint.classificationConfidence !== "low"
  ) {
    throw new Error(
      "The exact preserved unknown must remain separate from legacy fixtures.",
    );
  }
}

export function parseLegacyManifest(input: unknown): LegacyManifest {
  const manifest = manifestSchema.parse(input);
  assertManifestShape(manifest);
  return {
    ...manifest,
    groups: manifest.groups.map((group) => ({
      ...group,
      ids: [...group.ids],
      expectedFingerprint: normalizeFingerprint(group.expectedFingerprint),
    })),
  };
}

function fingerprintOf(
  row: z.infer<typeof inventoryRowSchema>,
): SafeLegacyFingerprint {
  const { id: _id, ...fingerprint } = row;
  return normalizeFingerprint(fingerprint);
}

function sameFingerprint(
  expected: SafeLegacyFingerprint,
  actual: SafeLegacyFingerprint,
): boolean {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

/**
 * `scripts/forensics/legacy-analysis-runs-readonly.sql` already computes these two
 * booleans itself (`verify_db_exact_fingerprint` / `verify_sources_exact_fingerprint`)
 * from ~15 structural equalities per script — exact project name, exact source title,
 * exact mock/schema/lang metadata, null payload shape, exact item/version/review-
 * transition counts for verify-db.mts, and exact project-local isolation (the run is
 * the project's only run, the project's only downstream rows are this run's own) for
 * verify-sources.mts — and reports the result as `provenanceFingerprint`. Every one of
 * those conditions is already proven safe by the SQL that only reads structural shape,
 * never content; nothing here re-derives them from row content.
 *
 * A row carrying one of these two values needs no manifest entry to be recognized as a
 * known verification fixture — which is what makes `verify:db` / `verify:sources`
 * repeatable: each run mints one new fixture row with a new ID, and this classifies it
 * without anyone updating a manifest by hand. Contrast the one `known-legacy-unknown`
 * row, whose provenance was never proven (`preserved-unknown-exact-v1`) and which stays
 * on the manifest's exact-ID allowlist for that reason.
 */
const AUTO_RECOGNIZED_FIXTURE_PROVENANCE = new Set([
  "verify-db-exact-v1",
  "verify-sources-exact-v1",
]);

function isAutoRecognizedFixture(row: z.infer<typeof inventoryRowSchema>): boolean {
  return (
    AUTO_RECOGNIZED_FIXTURE_PROVENANCE.has(row.provenanceFingerprint) &&
    row.classification === "Verification/Test Data" &&
    row.classificationConfidence === "high"
  );
}

export function verifyLegacyInventory(
  mode: VerifierMode,
  manifest: LegacyManifest,
  rawInventory: unknown,
): LegacyInventoryResult {
  const inventory = inventorySchema.parse(rawInventory);
  const ids = inventory.incompatibleRows.map((row) => row.id);

  if (new Set(ids).size !== ids.length) {
    throw new Error("Database inventory contains a duplicate analysis-run ID.");
  }
  if (
    inventory.totalRunCount !==
    inventory.contractValidCount + inventory.incompatibleRows.length
  ) {
    throw new Error("Inventory totals are inconsistent; verification fails closed.");
  }

  if (mode === "clean") {
    if (inventory.incompatibleRows.length > 0) {
      throw new Error(
        `Clean-mode verification found ${inventory.incompatibleRows.length} incompatible analysis run(s).`,
      );
    }
    return {
      mode,
      totalRunCount: inventory.totalRunCount,
      outcomeCounts: {
        "contract-valid": inventory.contractValidCount,
        "known-legacy-fixture": 0,
        "known-legacy-unknown": 0,
        "unexpected-invalid": 0,
      },
      rows: [],
    };
  }

  const expected = new Map<
    string,
    {
      outcome: "known-legacy-fixture" | "known-legacy-unknown";
      fingerprint: SafeLegacyFingerprint;
    }
  >();
  for (const group of manifest.groups) {
    for (const id of group.ids) {
      expected.set(id, {
        outcome: group.outcome,
        fingerprint: group.expectedFingerprint,
      });
    }
  }

  const actualIds = new Set(ids);
  const missingIds = [...expected.keys()].filter((id) => !actualIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `Linked legacy inventory is missing ${missingIds.length} expected legacy row(s): ${missingIds.join(", ")}`,
    );
  }

  // A row absent from the manifest is not automatically unexpected: it may be a fresh
  // verify-db.mts / verify-sources.mts fixture the read-only forensics SQL itself
  // already recognized by structural fingerprint (see isAutoRecognizedFixture above).
  // Only a row that is neither on the manifest nor auto-recognized fails closed.
  const stillUnexpectedIds = ids.filter((id) => {
    if (expected.has(id)) return false;
    const row = inventory.incompatibleRows.find((r) => r.id === id);
    return !row || !isAutoRecognizedFixture(row);
  });
  if (stillUnexpectedIds.length > 0) {
    throw new Error(
      `Linked legacy inventory contains ${stillUnexpectedIds.length} unexpected invalid row(s): ${stillUnexpectedIds.join(", ")}`,
    );
  }

  const rows: LegacyInventoryResult["rows"] = [];
  for (const row of inventory.incompatibleRows) {
    const expectedRow = expected.get(row.id);
    if (expectedRow) {
      const actualFingerprint = fingerprintOf(row);
      if (!sameFingerprint(expectedRow.fingerprint, actualFingerprint)) {
        throw new Error(
          `Safe fingerprint mismatch or downstream drift for legacy row ${row.id}.`,
        );
      }
      rows.push({ id: row.id, outcome: expectedRow.outcome });
      continue;
    }

    if (!isAutoRecognizedFixture(row)) {
      // Unreachable: stillUnexpectedIds above already fails closed on this row. Kept
      // as a second gate so a future edit to one check alone cannot silently open it.
      throw new Error(`Unexpected invalid row ${row.id}.`);
    }
    rows.push({ id: row.id, outcome: "known-legacy-fixture" });
  }

  const fixtureCount = rows.filter(
    (row) => row.outcome === "known-legacy-fixture",
  ).length;
  const unknownCount = rows.filter(
    (row) => row.outcome === "known-legacy-unknown",
  ).length;

  return {
    mode,
    totalRunCount: inventory.totalRunCount,
    outcomeCounts: {
      "contract-valid": inventory.contractValidCount,
      "known-legacy-fixture": fixtureCount,
      "known-legacy-unknown": unknownCount,
      "unexpected-invalid": 0,
    },
    rows,
  };
}

export function formatLegacyInventoryResult(
  result: LegacyInventoryResult,
): string {
  const lines = [
    `mode: ${result.mode}`,
    `total runs: ${result.totalRunCount}`,
    `contract-valid: ${result.outcomeCounts["contract-valid"]}`,
    `known-legacy-fixture: ${result.outcomeCounts["known-legacy-fixture"]}`,
    `known-legacy-unknown: ${result.outcomeCounts["known-legacy-unknown"]}`,
    `unexpected-invalid: ${result.outcomeCounts["unexpected-invalid"]}`,
  ];
  for (const row of result.rows) {
    lines.push(`${row.outcome}: ${row.id}`);
  }
  return lines.join("\n");
}
