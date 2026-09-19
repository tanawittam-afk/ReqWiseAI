/**
 * The create-project boundary.
 *
 * Two things are being proven: that a human typo produces a helpful message, and that
 * a client cannot decide anything the server owns — organization, creator, or status.
 */

import { describe, expect, it } from "vitest";
import {
  createProjectInputSchema,
  fieldErrors,
  readCreateProjectForm,
  readSetOutputLanguageForm,
  setOutputLanguageInputSchema,
  PROJECT_NAME_MAX,
  PROJECT_STAKEHOLDERS_MAX_COUNT,
} from "../../lib/contracts/project";

const PROFILE_ID = "3f1a9b0e-7c2d-4a55-9c31-8b0c1d2e3f44";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: "Smart Space booking",
    domainProfileId: PROFILE_ID,
    outputLang: "th",
    description: "",
    businessObjective: "",
    knownStakeholders: [],
    ...overrides,
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("createProjectInputSchema", () => {
  it("accepts a minimal valid project", () => {
    const parsed = createProjectInputSchema.parse(valid());
    expect(parsed.name).toBe("Smart Space booking");
    expect(parsed.outputLang).toBe("th");
    expect(parsed.description).toBeNull();
    expect(parsed.knownStakeholders).toEqual([]);
  });

  it("rejects an empty project name", () => {
    const result = createProjectInputSchema.safeParse(valid({ name: "" }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).name).toBe("Project name is required");
  });

  it("rejects a whitespace-only project name", () => {
    const result = createProjectInputSchema.safeParse(valid({ name: "   \t  " }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).name).toBe("Project name is required");
  });

  it("trims the project name", () => {
    expect(createProjectInputSchema.parse(valid({ name: "  Booking  " })).name).toBe("Booking");
  });

  it("rejects a name past the length ceiling", () => {
    const result = createProjectInputSchema.safeParse(valid({ name: "x".repeat(PROJECT_NAME_MAX + 1) }));
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported output language", () => {
    expect(createProjectInputSchema.safeParse(valid({ outputLang: "jp" })).success).toBe(false);
  });

  it("accepts 'match_source' as a creation-time preference (Phase 2, Slice 7)", () => {
    const parsed = createProjectInputSchema.parse(valid({ outputLang: "match_source" }));
    expect(parsed.outputLang).toBe("match_source");
  });

  it("rejects a domain profile id that is not a uuid", () => {
    const result = createProjectInputSchema.safeParse(valid({ domainProfileId: "booking_smart_space" }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).domainProfileId).toBe("Choose a business domain");
  });

  it("rejects a client-supplied status", () => {
    expect(createProjectInputSchema.safeParse(valid({ status: "archived" })).success).toBe(false);
  });

  it("rejects a client-supplied organization id", () => {
    expect(
      createProjectInputSchema.safeParse(valid({ organization_id: PROFILE_ID })).success,
    ).toBe(false);
  });

  it("rejects a client-supplied creator and archive actor", () => {
    expect(createProjectInputSchema.safeParse(valid({ created_by: PROFILE_ID })).success).toBe(false);
    expect(createProjectInputSchema.safeParse(valid({ archived_by: PROFILE_ID })).success).toBe(false);
  });

  it("turns blank optional text into null rather than an empty string", () => {
    const parsed = createProjectInputSchema.parse(valid({ description: "   " }));
    expect(parsed.description).toBeNull();
  });

  it("caps the stakeholder list", () => {
    const many = Array.from({ length: PROJECT_STAKEHOLDERS_MAX_COUNT + 1 }, (_, i) => `Role ${i}`);
    expect(createProjectInputSchema.safeParse(valid({ knownStakeholders: many })).success).toBe(false);
  });
});

describe("readCreateProjectForm", () => {
  it("splits stakeholders on newlines and drops blank lines", () => {
    const parsed = createProjectInputSchema.parse(
      readCreateProjectForm(
        form({
          name: "Booking",
          domainProfileId: PROFILE_ID,
          outputLang: "en",
          knownStakeholders: "Front Desk Staff\n\n  Operations Manager  \n",
        }),
      ),
    );
    expect(parsed.knownStakeholders).toEqual(["Front Desk Staff", "Operations Manager"]);
  });

  it("ignores fields the form does not own, so injected values never reach the schema", () => {
    const read = readCreateProjectForm(
      form({
        name: "Booking",
        domainProfileId: PROFILE_ID,
        outputLang: "th",
        status: "archived",
        organization_id: PROFILE_ID,
        created_by: PROFILE_ID,
      }),
    ) as Record<string, unknown>;

    expect(read).not.toHaveProperty("status");
    expect(read).not.toHaveProperty("organization_id");
    expect(read).not.toHaveProperty("created_by");
    expect(createProjectInputSchema.safeParse(read).success).toBe(true);
  });
});

describe("setOutputLanguageInputSchema (Phase 2, Slice 7)", () => {
  const PROJECT_ID = "3f1a9b0e-7c2d-4a55-9c31-8b0c1d2e3f55";

  it("accepts a fixed language or 'match_source'", () => {
    expect(
      setOutputLanguageInputSchema.safeParse({ projectId: PROJECT_ID, outputLang: "th" }).success,
    ).toBe(true);
    expect(
      setOutputLanguageInputSchema.safeParse({ projectId: PROJECT_ID, outputLang: "match_source" })
        .success,
    ).toBe(true);
  });

  it("rejects an unsupported value", () => {
    expect(
      setOutputLanguageInputSchema.safeParse({ projectId: PROJECT_ID, outputLang: "jp" }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid project id", () => {
    expect(
      setOutputLanguageInputSchema.safeParse({ projectId: "not-a-uuid", outputLang: "th" }).success,
    ).toBe(false);
  });

  it("rejects an injected field (strict object)", () => {
    expect(
      setOutputLanguageInputSchema.safeParse({
        projectId: PROJECT_ID,
        outputLang: "th",
        status: "archived",
      }).success,
    ).toBe(false);
  });
});

describe("readSetOutputLanguageForm", () => {
  it("reads only the two fields it owns", () => {
    const formData = new FormData();
    formData.set("projectId", "project-1");
    formData.set("outputLang", "match_source");
    formData.set("status", "archived");

    expect(readSetOutputLanguageForm(formData)).toEqual({
      projectId: "project-1",
      outputLang: "match_source",
    });
  });
});
