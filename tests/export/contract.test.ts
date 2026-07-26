/**
 * The export contract, tested where it is load-bearing: the version it advertises, the
 * fields it refuses, and the fields it must never carry.
 *
 * The last group is the one worth having. `strictObject` means a field added upstream
 * cannot ride along silently — but only a test can say *which* fields must never appear,
 * because the schema's job is to describe what is allowed and this is a claim about what is
 * forbidden.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPE,
  EXPORT_SCHEMA_VERSION,
  exportPackageSchema,
  exportScopeSchema,
  scopeForPreset,
} from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import { exportInput, GENERATED_AT } from "./fixtures";

const pkg = buildExportPackage(exportInput(), DEFAULT_SCOPE, GENERATED_AT);

describe("export schema version", () => {
  it("is the versioned identifier a consumer can branch on", () => {
    expect(EXPORT_SCHEMA_VERSION).toBe("reqwise-export/1.0");
    expect(pkg.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  });

  it("refuses a package claiming a different version", () => {
    const parsed = exportPackageSchema.safeParse({ ...pkg, schemaVersion: "reqwise-export/2.0" });
    expect(parsed.success).toBe(false);
  });
});

describe("a valid package", () => {
  it("passes its own schema", () => {
    const parsed = exportPackageSchema.safeParse(pkg);
    expect(parsed.success).toBe(true);
  });

  it("refuses an unknown top-level field", () => {
    const parsed = exportPackageSchema.safeParse({ ...pkg, rawProviderOutput: { items: [] } });
    expect(parsed.success).toBe(false);
  });

  it("refuses an unknown field on a requirement", () => {
    const withExtra = {
      ...pkg,
      requirements: [{ ...pkg.requirements[0], createdBy: "5f2c1e0a-0000-4000-8000-000000000000" }],
    };
    expect(exportPackageSchema.safeParse(withExtra).success).toBe(false);
  });

  it("requires a project name and id", () => {
    expect(
      exportPackageSchema.safeParse({ ...pkg, project: { ...pkg.project, id: "not-a-uuid" } }).success,
    ).toBe(false);
  });
});

describe("nothing internal leaks", () => {
  const serialised = JSON.stringify(pkg);

  // Column and field names that must never appear anywhere in a package, at any depth.
  const forbidden = [
    "organization_id",
    "organizationId",
    "created_by",
    "createdBy",
    "actor_id",
    "actorId",
    "resolved_by",
    "resolvedBy",
    "raw_provider_output",
    "rawProviderOutput",
    "validated_output",
    "validatedOutput",
    "idempotency_key",
    "idempotencyKey",
    "provider_key",
    "providerKey",
    "deleted_at",
    "raw_text",
    "rawText",
    "auth.uid",
    "service_role",
  ];

  for (const field of forbidden) {
    it(`does not carry ${field}`, () => {
      expect(serialised).not.toContain(field);
    });
  }

  it("references items by display id, not by row id", () => {
    // The fixture's internal ids all start with "i-"; none of them may reach the package.
    expect(serialised).not.toContain('"i-br-1"');
    expect(pkg.requirements.map((item) => item.displayId)).toContain("BR-001");
  });

  it("carries only the three ids that mean something outside the database", () => {
    expect(pkg.project.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(pkg.requirements[0].analysisRunId).toBe("22222222-2222-4222-8222-222222222222");
    expect(pkg.sources[0].revisionId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("never reproduces the whole source document", () => {
    // Excerpts appear; the document does not. The third line is cited by nothing.
    expect(serialised).not.toContain("ยังไม่ได้ข้อสรุปเรื่องการยกเลิกและการคืนเงิน");
  });
});

describe("scope validation", () => {
  it("accepts the default scope", () => {
    expect(exportScopeSchema.safeParse(DEFAULT_SCOPE).success).toBe(true);
  });

  it("refuses an unknown status scope", () => {
    expect(
      exportScopeSchema.safeParse({ ...DEFAULT_SCOPE, status: "everything_ever" }).success,
    ).toBe(false);
  });

  it("refuses a missing section", () => {
    const rest: Record<string, boolean> = { ...DEFAULT_SCOPE.sections };
    delete rest.traceability;
    expect(
      exportScopeSchema.safeParse({ ...DEFAULT_SCOPE, sections: rest }).success,
    ).toBe(false);
  });

  it("refuses an invented section", () => {
    expect(
      exportScopeSchema.safeParse({
        ...DEFAULT_SCOPE,
        sections: { ...DEFAULT_SCOPE.sections, gantt_chart: true },
      }).success,
    ).toBe(false);
  });

  it("gives every preset a scope that validates", () => {
    for (const preset of ["portfolio_demo", "developer_handoff", "stakeholder_review", "audit_package", "full_project_archive"] as const) {
      expect(exportScopeSchema.safeParse(scopeForPreset(preset)).success).toBe(true);
    }
  });
});
