import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  analysisActionInputSchema,
  readAnalysisActionInput,
} from "../../lib/analysis/action-input";
import {
  availableDefaultProvider,
  readServerEnvironment,
  toProviderOptions,
} from "../../lib/config/env";
import { providerSelectionSchema } from "../../lib/providers/factory";
import {
  ProviderExecutionError,
  unavailableProviderMessage,
} from "../../lib/providers/errors";
import { providerLabel } from "../../lib/providers/labels";
import { AnalysisProviderControls } from "../../app/workspace/projects/[projectId]/sources/[sourceId]/analyze/provider-controls";

const requiredEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("analysis provider selection", () => {
  it("accepts only application-owned provider keys", () => {
    expect(providerSelectionSchema.safeParse("mock").success).toBe(true);
    expect(providerSelectionSchema.safeParse("gemini").success).toBe(true);
    expect(providerSelectionSchema.safeParse("service-role").success).toBe(false);
    expect(providerSelectionSchema.safeParse("").success).toBe(false);
  });

  it("falls back to the available mock when Gemini is the unavailable configured default", () => {
    const environment = readServerEnvironment({
      ...requiredEnvironment,
      AI_PROVIDER: "gemini",
    });

    expect(availableDefaultProvider(environment)).toBe("mock");
  });

  it("keeps Gemini as the default only when its server configuration is available", () => {
    const environment = readServerEnvironment({
      ...requiredEnvironment,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "server-secret",
      GEMINI_MODEL: "configured-model-a",
    });

    expect(availableDefaultProvider(environment)).toBe("gemini");
    expect(JSON.stringify(toProviderOptions(environment))).not.toMatch(
      /server-secret|configured-model-a/,
    );
  });

  it("uses the two approved provider labels", () => {
    expect(providerLabel("mock")).toBe("Deterministic Mock");
    expect(providerLabel("gemini")).toBe("Gemini");
  });

  it("maps only an unavailable provider creation error to the fixed safe sentence", () => {
    const error = new ProviderExecutionError(
      "unavailable",
      "PRIVATE_PROVIDER_CONFIGURATION",
      { provider: "gemini", model: null, promptVersion: null },
    );

    expect(unavailableProviderMessage(error)).toBe(
      "This analysis provider is not configured.",
    );
  });

  it.each([
    new Error("PROGRAMMING_ERROR"),
    new ProviderExecutionError(
      "authentication_failed",
      "PRIVATE_AUTHENTICATION_DETAIL",
      { provider: "gemini", model: null, promptVersion: null },
    ),
  ])("rethrows every provider creation error that is not unavailable", (error) => {
    expect(() => unavailableProviderMessage(error)).toThrow(error);
  });

  it("rejects unknown providers before the server action can run the pipeline", () => {
    const formData = new FormData();
    formData.set("projectId", "project-1");
    formData.set("sourceId", "source-1");
    formData.set("requestKey", "request-key-123");
    formData.set("provider", "service-role");

    expect(readAnalysisActionInput(formData)).toEqual({
      ok: false,
      error: "Choose an available analysis provider and try again.",
    });
  });

  it("reads only the four action-owned fields and keeps the object schema strict", () => {
    const formData = new FormData();
    formData.set("projectId", "project-1");
    formData.set("sourceId", "source-1");
    formData.set("requestKey", "request-key-123");
    formData.set("provider", "mock");
    formData.set("rawText", "PRIVATE_SOURCE_TEXT");
    formData.set("model", "PRIVATE_MODEL");
    formData.set("apiKey", "PRIVATE_API_KEY");
    formData.set("actorId", "PRIVATE_ACTOR");

    expect(readAnalysisActionInput(formData)).toEqual({
      ok: true,
      value: {
        projectId: "project-1",
        sourceId: "source-1",
        requestKey: "request-key-123",
        provider: "mock",
      },
    });
    expect(
      analysisActionInputSchema.safeParse({
        projectId: "project-1",
        sourceId: "source-1",
        requestKey: "request-key-123",
        provider: "mock",
        rawText: "PRIVATE_SOURCE_TEXT",
      }).success,
    ).toBe(false);
  });

  it("renders an available checked default and a safe disabled Gemini explanation", () => {
    const environment = readServerEnvironment({
      ...requiredEnvironment,
      AI_PROVIDER: "gemini",
    });
    const html = renderToStaticMarkup(
      createElement(AnalysisProviderControls, {
        providerOptions: toProviderOptions(environment),
        defaultProvider: availableDefaultProvider(environment),
        pending: false,
      }),
    );

    expect(html).toContain("<legend");
    expect(html).toContain("Analysis provider");
    expect(html).toMatch(
      /<input(?=[^>]*name="provider")(?=[^>]*value="mock")(?=[^>]*checked)[^>]*>/,
    );
    expect(html).toMatch(
      /<input(?=[^>]*name="provider")(?=[^>]*value="gemini")(?=[^>]*disabled)[^>]*>/,
    );
    expect(html).toContain("min-h-11");
    expect(html).toContain(
      "Gemini is not available in this workspace. Choose Deterministic Mock or try again later.",
    );
  });

  it("disables every provider and submit control with a polite pending status", () => {
    const environment = readServerEnvironment({
      ...requiredEnvironment,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "server-secret",
      GEMINI_MODEL: "configured-model-a",
    });
    const html = renderToStaticMarkup(
      createElement(AnalysisProviderControls, {
        providerOptions: toProviderOptions(environment),
        defaultProvider: "gemini",
        pending: true,
      }),
    );

    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(html.match(/type="radio"[^>]*disabled/g)).toHaveLength(2);
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-busy="true"/);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Analysis in progress. Keep this page open.");
  });
});
