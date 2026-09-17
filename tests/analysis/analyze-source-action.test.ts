/**
 * `analyzeSourceAction` — the re-run screen's server action. Exercises only the
 * own-Gemini-key bypass gate Phase 1 Slice 3 added (mirrors
 * `tests/projects/start-project-action.test.ts`'s approach for the same gate on the
 * combined intake screen). Every collaborator below already has its own coverage
 * elsewhere — this file mocks all of them so it proves only the call order and gating
 * logic in `app/workspace/projects/[projectId]/sources/[sourceId]/analyze/actions.ts`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authGetUserMock = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
const createClientMock = vi.fn(async () => ({
  __fake: "supabase-client",
  auth: { getUser: authGetUserMock },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const buildAnalysisInputMock = vi.fn();
vi.mock("@/lib/analysis/input", () => ({ buildAnalysisInput: buildAnalysisInputMock }));

const productionPortsMock = vi.fn(() => ({ ports: true }));
vi.mock("@/lib/analysis/production-ports", () => ({ productionPorts: productionPortsMock }));

const persistAnalysisResultMock = vi.fn();
vi.mock("@/lib/analysis/persist", () => ({ persistAnalysisResult: persistAnalysisResultMock }));

const runAnalysisMock = vi.fn();
vi.mock("@/lib/analysis/run-analysis", () => ({ runAnalysis: runAnalysisMock }));

const incrementDailyUsageMock = vi.fn();
const decrementDailyUsageMock = vi.fn();
vi.mock("@/lib/analysis/daily-usage", () => ({
  incrementDailyUsage: incrementDailyUsageMock,
  decrementDailyUsage: decrementDailyUsageMock,
}));

const getOwnGeminiApiKeyMock = vi.fn();
vi.mock("@/lib/analysis/own-gemini-key", () => ({
  getOwnGeminiApiKey: getOwnGeminiApiKeyMock,
  OWN_KEY_UNUSABLE_MESSAGE: "Your saved Gemini key could not be used. Check it in Settings.",
}));

const readServerEnvironmentMock = vi.fn(() => ({
  __fake: "env",
  geminiKeyEncryption: { available: false, secret: null },
}));
vi.mock("@/lib/config/env", () => ({ readServerEnvironment: readServerEnvironmentMock }));

const unavailableProviderMessageMock = vi.fn(() => "Provider unavailable.");
vi.mock("@/lib/providers/errors", () => ({
  unavailableProviderMessage: unavailableProviderMessageMock,
}));

const createProviderMock = vi.fn(() => ({ __fake: "provider" }));
vi.mock("@/lib/providers/factory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/factory")>();
  return { ...actual, createProvider: createProviderMock };
});

const { analyzeSourceAction } = await import(
  "../../app/workspace/projects/[projectId]/sources/[sourceId]/analyze/actions"
);
const { DAILY_ANALYSIS_LIMIT } = await import("../../lib/config/limits");

function form(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("projectId", "project-1");
  formData.set("sourceId", "source-1");
  formData.set("requestKey", "a-valid-request-key-12345");
  formData.set("provider", "gemini");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  createClientMock.mockResolvedValue({
    __fake: "supabase-client",
    auth: { getUser: authGetUserMock },
  });
  buildAnalysisInputMock.mockResolvedValue({ ok: true, input: { __fake: "input" } });
  productionPortsMock.mockReturnValue({ ports: true });
  readServerEnvironmentMock.mockReturnValue({
    __fake: "env",
    geminiKeyEncryption: { available: false, secret: null },
  });
  unavailableProviderMessageMock.mockReturnValue("Provider unavailable.");
  createProviderMock.mockImplementation(() => ({ __fake: "provider" }));
  getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: null });
});

describe("analyzeSourceAction — own-Gemini-key bypass (Phase 1, Slice 3)", () => {
  it("never looks up an own key for a mock run, and the shared limit still applies", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    runAnalysisMock.mockResolvedValue({ status: "valid" });
    persistAnalysisResultMock.mockResolvedValue({ ok: true, runId: "run-1" });

    await analyzeSourceAction({}, form({ provider: "mock" }));

    expect(getOwnGeminiApiKeyMock).not.toHaveBeenCalled();
    expect(incrementDailyUsageMock).toHaveBeenCalledTimes(1);
  });

  it("skips the shared daily-usage RPC entirely when the caller has a usable own key", async () => {
    getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: "decrypted-own-key" });
    runAnalysisMock.mockResolvedValue({ status: "valid" });
    persistAnalysisResultMock.mockResolvedValue({ ok: true, runId: "run-1" });

    await analyzeSourceAction({}, form());

    expect(incrementDailyUsageMock).not.toHaveBeenCalled();
    expect(decrementDailyUsageMock).not.toHaveBeenCalled();
    expect(createProviderMock).toHaveBeenCalledWith(
      "gemini",
      expect.anything(),
      undefined,
      "decrypted-own-key",
    );
  });

  it("returns the own-key lookup's error verbatim and spends nothing", async () => {
    getOwnGeminiApiKeyMock.mockResolvedValue({
      ok: false,
      error: "Your saved Gemini key could not be used. Check it in Settings.",
    });

    const result = await analyzeSourceAction({}, form());

    expect(result).toEqual({ error: "Your saved Gemini key could not be used. Check it in Settings." });
    expect(incrementDailyUsageMock).not.toHaveBeenCalled();
    expect(buildAnalysisInputMock).toHaveBeenCalled();
  });

  it("falls through to the shared daily limit when no own key is saved", async () => {
    getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: null });
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: false, remaining: 0 } });

    const result = await analyzeSourceAction({}, form());

    expect(incrementDailyUsageMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatch(new RegExp(`limit of ${DAILY_ANALYSIS_LIMIT}`));
  });

  it("surfaces the own-key-specific message, not the generic one, when the provider fails to construct with an own key", async () => {
    getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: "decrypted-own-key" });
    createProviderMock.mockImplementation(() => {
      throw new Error("factory refused");
    });

    const result = await analyzeSourceAction({}, form());

    expect(result).toEqual({ error: "Your saved Gemini key could not be used. Check it in Settings." });
    expect(decrementDailyUsageMock).not.toHaveBeenCalled();
  });

  it("still refunds the shared slot on a provider failure for a non-own-key run", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    createProviderMock.mockImplementation(() => {
      throw new Error("factory refused");
    });

    const result = await analyzeSourceAction({}, form());

    expect(result).toEqual({ error: "Provider unavailable." });
    expect(decrementDailyUsageMock).toHaveBeenCalledTimes(1);
  });
});
