import { describe, expect, it } from "vitest";

import {
  formatLegacyInventoryResult,
  parseLegacyManifest,
  parseVerifierMode,
  verifyLegacyInventory,
} from "../../lib/analysis/legacy-verifier.ts";

const UNKNOWN_RUN_ID = "08edaef7-5c4f-45a0-be0a-eec3a7c2818f";
const EXTRA_INVALID_ID = "30000000-0000-4000-8000-000000000001";

const DB_IDS = Array.from(
  { length: 15 },
  (_, index) =>
    `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const SOURCE_IDS = Array.from(
  { length: 15 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

type SafeFingerprint = {
  classification: "Verification/Test Data" | "Unknown / Insufficient Evidence";
  classificationConfidence: "high" | "low";
  status: "valid";
  provider: "mock";
  model: null;
  promptVersion: null;
  schemaVersion: "1.0.0";
  outputLang: "th";
  payloadStructure: {
    raw: "sql-null";
    validated: "sql-null" | "object";
    error: "sql-null";
    validatedTopLevelKeys: string[];
  };
  mismatchCodes: string[];
  downstreamCounts: {
    items: number;
    userStories: number;
    acceptanceCriteria: number;
    assumptions: number;
    risks: number;
    questions: number;
    qualityFindings: number;
    sourceReferences: number;
    relations: number;
    versions: number;
    reviews: number;
    workflowChanged: number;
  };
  projectDependencies: {
    runs: number;
    sources: number;
    items: number;
    sourceReferences: number;
    relations: number;
    versions: number;
    reviews: number;
  };
  provenanceFingerprint: string;
};

type ManifestInput = {
  version: number;
  expectedLegacyCount: number;
  groups: Array<{
    outcome: string;
    origin: string;
    ids: string[];
    expectedFingerprint: SafeFingerprint;
    preservationReason: string;
    unexpectedField?: string;
  }>;
  unexpectedField?: string;
};

type InventoryRow = { id: string } & SafeFingerprint & Record<string, unknown>;

type InventoryInput = {
  totalRunCount: number;
  contractValidCount: number;
  incompatibleRows: InventoryRow[];
};

const ZERO_DOWNSTREAM = {
  items: 0,
  userStories: 0,
  acceptanceCriteria: 0,
  assumptions: 0,
  risks: 0,
  questions: 0,
  qualityFindings: 0,
  sourceReferences: 0,
  relations: 0,
  versions: 0,
  reviews: 0,
  workflowChanged: 0,
} as const;

const DB_FINGERPRINT: SafeFingerprint = {
  classification: "Verification/Test Data",
  classificationConfidence: "high",
  status: "valid",
  provider: "mock",
  model: null,
  promptVersion: null,
  schemaVersion: "1.0.0",
  outputLang: "th",
  payloadStructure: {
    raw: "sql-null",
    validated: "sql-null",
    error: "sql-null",
    validatedTopLevelKeys: [],
  },
  mismatchCodes: ["valid_missing_raw", "valid_missing_validated"],
  downstreamCounts: {
    ...ZERO_DOWNSTREAM,
    items: 2,
    versions: 1,
    reviews: 2,
  },
  projectDependencies: {
    runs: 1,
    sources: 1,
    items: 2,
    sourceReferences: 0,
    relations: 0,
    versions: 1,
    reviews: 2,
  },
  provenanceFingerprint: "safe-test-verify-db-v1",
};

const SOURCE_FINGERPRINT: SafeFingerprint = {
  classification: "Verification/Test Data",
  classificationConfidence: "high",
  status: "valid",
  provider: "mock",
  model: null,
  promptVersion: null,
  schemaVersion: "1.0.0",
  outputLang: "th",
  payloadStructure: {
    raw: "sql-null",
    validated: "object",
    error: "sql-null",
    validatedTopLevelKeys: ["items"],
  },
  mismatchCodes: ["valid_has_zero_items", "valid_missing_raw"],
  downstreamCounts: { ...ZERO_DOWNSTREAM },
  projectDependencies: {
    runs: 1,
    sources: 3,
    items: 0,
    sourceReferences: 0,
    relations: 0,
    versions: 0,
    reviews: 0,
  },
  provenanceFingerprint: "safe-test-verify-sources-v1",
};

const UNKNOWN_FINGERPRINT: SafeFingerprint = {
  ...SOURCE_FINGERPRINT,
  classification: "Unknown / Insufficient Evidence",
  classificationConfidence: "low",
  projectDependencies: {
    runs: 6,
    sources: 4,
    items: 81,
    sourceReferences: 59,
    relations: 28,
    versions: 3,
    reviews: 10,
  },
  provenanceFingerprint: "safe-test-preserved-unknown-v1",
};

function rowsFor(
  ids: readonly string[],
  fingerprint: SafeFingerprint,
): InventoryRow[] {
  return ids.map((id) => ({
    id,
    ...structuredClone(fingerprint),
  }));
}

function manifestInput(): ManifestInput {
  return {
    version: 1,
    expectedLegacyCount: 31,
    groups: [
      {
        outcome: "known-legacy-fixture",
        origin: "verify-db.mts",
        ids: [...DB_IDS],
        expectedFingerprint: structuredClone(DB_FINGERPRINT),
        preservationReason: "Preserve the exact historical database verifier rows.",
      },
      {
        outcome: "known-legacy-fixture",
        origin: "verify-sources.mts",
        ids: [...SOURCE_IDS],
        expectedFingerprint: structuredClone(SOURCE_FINGERPRINT),
        preservationReason: "Preserve the exact historical source verifier rows.",
      },
      {
        outcome: "known-legacy-unknown",
        origin: "unknown",
        ids: [UNKNOWN_RUN_ID],
        expectedFingerprint: structuredClone(UNKNOWN_FINGERPRINT),
        preservationReason: "Unknown data defaults to preservation.",
      },
    ],
  };
}

function linkedInventory(): InventoryInput {
  return {
    totalRunCount: 34,
    contractValidCount: 3,
    incompatibleRows: [
      ...rowsFor(DB_IDS, DB_FINGERPRINT),
      ...rowsFor(SOURCE_IDS, SOURCE_FINGERPRINT),
      ...rowsFor([UNKNOWN_RUN_ID], UNKNOWN_FINGERPRINT),
    ],
  };
}

function verifyLinked(input: InventoryInput = linkedInventory()) {
  return verifyLegacyInventory(
    "linked-legacy",
    parseLegacyManifest(manifestInput()),
    input,
  );
}

describe("legacy analysis-run verifier", () => {
  it("preserves the represented contract-valid count", () => {
    const result = verifyLegacyInventory(
      "clean",
      parseLegacyManifest(manifestInput()),
      {
        totalRunCount: 4,
        contractValidCount: 4,
        incompatibleRows: [],
      },
    );

    expect(result.outcomeCounts["contract-valid"]).toBe(4);
    expect(result.totalRunCount).toBe(4);
  });

  it("recognizes exactly thirty matching verifier fixtures", () => {
    const result = verifyLinked();

    expect(result.outcomeCounts["known-legacy-fixture"]).toBe(30);
    expect(
      result.rows.filter(
        (row) => row.outcome === "known-legacy-fixture",
      ),
    ).toHaveLength(30);
  });

  it("keeps the exact preserved unknown separate from fixtures", () => {
    const result = verifyLinked();

    expect(
      result.rows.find((row) => row.id === UNKNOWN_RUN_ID),
    ).toMatchObject({
      id: UNKNOWN_RUN_ID,
      outcome: "known-legacy-unknown",
    });
  });

  it("never counts a grandfathered legacy row as contract-valid", () => {
    const result = verifyLinked();

    expect(result.outcomeCounts["contract-valid"]).toBe(3);
    expect(
      result.rows.every((row) => row.outcome !== "contract-valid"),
    ).toBe(true);
  });

  it("rejects an incompatible row that is absent from the manifest", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      ...rowsFor([EXTRA_INVALID_ID], UNKNOWN_FINGERPRINT),
    );

    expect(() => verifyLinked(input)).toThrow(/unexpected|invalid/i);
  });

  it("auto-recognizes a fresh verify-db.mts fixture absent from the manifest by its structural provenance fingerprint", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      ...rowsFor([EXTRA_INVALID_ID], {
        ...structuredClone(DB_FINGERPRINT),
        provenanceFingerprint: "verify-db-exact-v1",
      }),
    );

    const result = verifyLinked(input);

    expect(
      result.rows.find((row) => row.id === EXTRA_INVALID_ID),
    ).toMatchObject({ id: EXTRA_INVALID_ID, outcome: "known-legacy-fixture" });
    expect(result.outcomeCounts["known-legacy-fixture"]).toBe(31);
  });

  it("auto-recognizes a fresh verify-sources.mts fixture absent from the manifest by its structural provenance fingerprint", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      ...rowsFor([EXTRA_INVALID_ID], {
        ...structuredClone(SOURCE_FINGERPRINT),
        provenanceFingerprint: "verify-sources-exact-v1",
      }),
    );

    const result = verifyLinked(input);

    expect(
      result.rows.find((row) => row.id === EXTRA_INVALID_ID),
    ).toMatchObject({ id: EXTRA_INVALID_ID, outcome: "known-legacy-fixture" });
    expect(result.outcomeCounts["known-legacy-fixture"]).toBe(31);
  });

  it("does not auto-recognize a row merely claiming a fixture provenance string without the matching classification", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      ...rowsFor([EXTRA_INVALID_ID], {
        ...structuredClone(UNKNOWN_FINGERPRINT),
        provenanceFingerprint: "verify-db-exact-v1",
      }),
    );

    expect(() => verifyLinked(input)).toThrow(/unexpected|invalid/i);
  });

  it("does not auto-recognize an absent row whose provenance fingerprint is the preserved-unknown shape", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      ...rowsFor([EXTRA_INVALID_ID], UNKNOWN_FINGERPRINT),
    );

    expect(() => verifyLinked(input)).toThrow(/unexpected|invalid/i);
  });

  it("rejects a linked inventory that omits an expected legacy row", () => {
    const input = linkedInventory();
    input.totalRunCount -= 1;
    input.incompatibleRows = input.incompatibleRows.filter(
      (row) => row.id !== DB_IDS[0],
    );

    expect(() => verifyLinked(input)).toThrow(/missing|legacy/i);
  });

  it("rejects a known ID whose safe fingerprint changed", () => {
    const input = linkedInventory();
    input.incompatibleRows[0].provenanceFingerprint =
      "safe-test-drifted-provenance";

    expect(() => verifyLinked(input)).toThrow(/fingerprint/i);
  });

  it("rejects a known ID whose mismatch category changed", () => {
    const input = linkedInventory();
    input.incompatibleRows[0].mismatchCodes = ["valid_missing_raw"];

    expect(() => verifyLinked(input)).toThrow(/mismatch|fingerprint/i);
  });

  it("rejects duplicate IDs across manifest groups", () => {
    const input = manifestInput();
    input.groups[1].ids[0] = input.groups[0].ids[0];

    expect(() => parseLegacyManifest(input)).toThrow(/duplicate/i);
  });

  it("rejects duplicate IDs in the database result", () => {
    const input = linkedInventory();
    input.totalRunCount += 1;
    input.incompatibleRows.push(
      structuredClone(input.incompatibleRows[0]),
    );

    expect(() => verifyLinked(input)).toThrow(/duplicate/i);
  });

  it("rejects reclassification of the preserved unknown as a fixture", () => {
    const input = manifestInput();
    input.groups[2].outcome = "known-legacy-fixture";
    input.groups[2].origin = "verify-sources.mts";

    expect(() => parseLegacyManifest(input)).toThrow(/unknown|fixture/i);
  });

  it("rejects downstream-count drift for a known legacy row", () => {
    const input = linkedInventory();
    input.incompatibleRows[0].downstreamCounts.reviews = 3;

    expect(() => verifyLinked(input)).toThrow(/downstream|fingerprint/i);
  });

  it("defaults to clean mode and accepts zero incompatible rows", () => {
    const mode = parseVerifierMode(undefined);
    const result = verifyLegacyInventory(
      mode,
      parseLegacyManifest(manifestInput()),
      {
        totalRunCount: 7,
        contractValidCount: 7,
        incompatibleRows: [],
      },
    );

    expect(mode).toBe("clean");
    expect(result.outcomeCounts["unexpected-invalid"]).toBe(0);
  });

  it("rejects every incompatible row in clean mode", () => {
    const input: InventoryInput = {
      totalRunCount: 1,
      contractValidCount: 0,
      incompatibleRows: rowsFor([DB_IDS[0]], DB_FINGERPRINT),
    };

    expect(() =>
      verifyLegacyInventory(
        "clean",
        parseLegacyManifest(manifestInput()),
        input,
      ),
    ).toThrow(/clean|incompatible|invalid/i);
  });

  it("strips sensitive extra values from results and formatted output", () => {
    const sensitive = "SENSITIVE-PAYLOAD-SENTINEL";
    const input = linkedInventory();
    Object.assign(input.incompatibleRows[0], {
      rawProviderOutput: { secret: sensitive },
      validatedOutput: { generatedBody: sensitive },
      sourceText: sensitive,
      prompt: sensitive,
      creator: sensitive,
      errorBody: sensitive,
    });

    const result = verifyLinked(input);
    const serialized = JSON.stringify(result);
    const formatted = formatLegacyInventoryResult(result);

    expect(serialized).not.toContain(sensitive);
    expect(formatted).not.toContain(sensitive);
  });

  it("formats only IDs and privacy-safe aggregate summaries", () => {
    const formatted = formatLegacyInventoryResult(verifyLinked());

    expect(formatted).toContain(DB_IDS[0]);
    expect(formatted).toContain(SOURCE_IDS[0]);
    expect(formatted).toContain(UNKNOWN_RUN_ID);
    expect(formatted).toMatch(/contract-valid[^0-9]*3/i);
    expect(formatted).toMatch(/known-legacy-fixture[^0-9]*30/i);
    expect(formatted).toMatch(/known-legacy-unknown[^0-9]*1/i);
    expect(formatted).not.toMatch(
      /payloadStructure|projectDependencies|provenanceFingerprint/i,
    );
  });

  it("strictly rejects a malformed manifest", () => {
    const input = manifestInput();
    input.version = 2;
    input.unexpectedField = "must not be accepted";

    expect(() => parseLegacyManifest(input)).toThrow();
  });

  it("fails closed for an invalid verifier mode", () => {
    expect(() => parseVerifierMode("linked")).toThrow(/mode|clean|linked/i);
  });
});
