/**
 * `startProjectAction` — the combined intake screen's server action.
 *
 * Exercises only the orchestration this slice added: the daily-usage gate now sits
 * *before* `createProject`, and every failure from that point on refunds the slot it
 * spent. Every collaborator below (`createProject`, `createSource`,
 * `buildAnalysisInput`, `runAnalysis`, `persistAnalysisResult`, `incrementDailyUsage`/
 * `decrementDailyUsage`, `readStartForm`) already has its own unit coverage elsewhere
 * (`tests/projects`, `tests/sources`, `tests/analysis`, `tests/contracts`) — this file
 * mocks all of them so it proves only the call order and gating logic in
 * `app/workspace/projects/actions.ts`, not their internals again.
 *
 * `redirect()` and `revalidatePath()` are mocked too: `redirect` throws (as the real
 * Next.js one does, so the action's own "past this line, redirect — never return"
 * control flow is exercised honestly), and the thrown marker carries the destination
 * so a test can assert on it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(public readonly destination: string) {
    super(`REDIRECT:${destination}`);
  }
}

const redirectMock = vi.fn((destination: string) => {
  throw new RedirectSignal(destination);
});
const revalidatePathMock = vi.fn();

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const createClientMock = vi.fn(async () => ({ __fake: "supabase-client" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const readStartFormMock = vi.fn();
vi.mock("@/lib/contracts/start", () => ({ readStartForm: readStartFormMock }));

const createProjectMock = vi.fn();
const archiveProjectMock = vi.fn();
const restoreProjectMock = vi.fn();
vi.mock("@/lib/projects/service", () => ({
  createProject: createProjectMock,
  archiveProject: archiveProjectMock,
  restoreProject: restoreProjectMock,
}));

const createSourceMock = vi.fn();
vi.mock("@/lib/sources/service", () => ({ createSource: createSourceMock }));

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

const availableDefaultProviderMock = vi.fn((): "mock" | "gemini" => "mock");
const readServerEnvironmentMock = vi.fn(() => ({
  __fake: "env",
  geminiKeyEncryption: { available: false, secret: null },
}));
vi.mock("@/lib/config/env", () => ({
  availableDefaultProvider: availableDefaultProviderMock,
  readServerEnvironment: readServerEnvironmentMock,
}));

const unavailableProviderMessageMock = vi.fn(() => "Provider unavailable.");
vi.mock("@/lib/providers/errors", () => ({
  unavailableProviderMessage: unavailableProviderMessageMock,
}));

const createProviderMock = vi.fn(() => ({ __fake: "provider" }));
vi.mock("@/lib/providers/factory", () => ({ createProvider: createProviderMock }));

const listDomainProfileOptionsMock = vi.fn();
vi.mock("@/lib/domain/load-profile", () => ({
  listDomainProfileOptions: listDomainProfileOptionsMock,
}));

vi.mock("@/lib/providers/mock/fixtures/booking-smart-space.source", () => ({
  bookingSourceDocument: { title: "Example booking notes" },
  bookingMeetingNotes: "Example meeting notes text.",
}));

const { startProjectAction } = await import("../../app/workspace/projects/actions");
const { DAILY_ANALYSIS_LIMIT } = await import("../../lib/config/limits");

function startForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("name", "Booking discovery");
  formData.set("rawText", "Some meeting notes.");
  formData.set("requestKey", "a-valid-request-key-12345");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

const VALID_PARSED = {
  ok: true as const,
  project: { name: "Booking discovery", domainProfileId: "domain-1" } as never,
  source: { title: "t", rawText: "Some meeting notes." } as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  readStartFormMock.mockReturnValue(VALID_PARSED);
  // `vi.clearAllMocks()` clears call history but not an implementation installed by a
  // previous test via `mockImplementation`/`mockResolvedValue` — restore the baseline
  // "everything downstream succeeds" implementation here so each test only has to
  // override the one collaborator it cares about.
  createClientMock.mockResolvedValue({ __fake: "supabase-client" });
  createProviderMock.mockImplementation(() => ({ __fake: "provider" }));
  productionPortsMock.mockReturnValue({ ports: true });
  availableDefaultProviderMock.mockReturnValue("mock");
  readServerEnvironmentMock.mockReturnValue({
    __fake: "env",
    geminiKeyEncryption: { available: false, secret: null },
  });
  getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: null });
  unavailableProviderMessageMock.mockReturnValue("Provider unavailable.");
  redirectMock.mockImplementation((destination: string) => {
    throw new RedirectSignal(destination);
  });
});

describe("startProjectAction — daily usage gate", () => {
  it("refuses before creating anything when the limit is already spent, and creates no project", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: false, remaining: 0 } });

    const result = await startProjectAction(
      { error: null, fieldErrors: {}, values: {} },
      startForm(),
    );

    expect(incrementDailyUsageMock).toHaveBeenCalledWith(expect.anything(), DAILY_ANALYSIS_LIMIT);
    expect(createProjectMock).not.toHaveBeenCalled();
    expect(createSourceMock).not.toHaveBeenCalled();
    expect(decrementDailyUsageMock).not.toHaveBeenCalled();
    expect(result.error).toMatch(new RegExp(`limit of ${DAILY_ANALYSIS_LIMIT}`));
  });

  it("returns the usage-check's own error verbatim when the RPC call itself fails", async () => {
    incrementDailyUsageMock.mockResolvedValue({
      ok: false,
      error: "Your session has expired. Sign in again.",
    });

    const result = await startProjectAction(
      { error: null, fieldErrors: {}, values: {} },
      startForm(),
    );

    expect(result.error).toBe("Your session has expired. Sign in again.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("refunds the slot when the project creation itself fails after a successful increment", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    createProjectMock.mockResolvedValue({ ok: false, error: "Your personal workspace could not be found." });

    const result = await startProjectAction(
      { error: null, fieldErrors: {}, values: {} },
      startForm(),
    );

    expect(decrementDailyUsageMock).toHaveBeenCalledTimes(1);
    expect(createSourceMock).not.toHaveBeenCalled();
    expect(result.error).toBe("Your personal workspace could not be found.");
  });

  it("refunds the slot and redirects to a source error when attaching the source fails", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    createProjectMock.mockResolvedValue({ ok: true, data: { projectId: "project-1" } });
    createSourceMock.mockResolvedValue({ ok: false, error: "Some fields need attention." });

    let caught: RedirectSignal | null = null;
    try {
      await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());
    } catch (error) {
      caught = error as RedirectSignal;
    }

    expect(caught).toBeInstanceOf(RedirectSignal);
    expect(caught?.destination).toBe("/workspace/projects/project-1?error=source");
    expect(decrementDailyUsageMock).toHaveBeenCalledTimes(1);
  });

  it("refunds the slot when the analysis run itself fails after the source was attached", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    createProjectMock.mockResolvedValue({ ok: true, data: { projectId: "project-1" } });
    createSourceMock.mockResolvedValue({ ok: true, data: { sourceId: "source-1" } });
    buildAnalysisInputMock.mockResolvedValue({ ok: true, input: { __fake: "input" } });
    createProviderMock.mockImplementation(() => {
      throw new Error("gemini unavailable");
    });

    let caught: RedirectSignal | null = null;
    try {
      await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());
    } catch (error) {
      caught = error as RedirectSignal;
    }

    expect(caught?.destination).toBe("/workspace/projects/project-1/sources/source-1?error=analysis");
    expect(decrementDailyUsageMock).toHaveBeenCalledTimes(1);
    expect(persistAnalysisResultMock).not.toHaveBeenCalled();
  });

  it("spends exactly one slot and never refunds on a full, successful run", async () => {
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });
    createProjectMock.mockResolvedValue({ ok: true, data: { projectId: "project-1" } });
    createSourceMock.mockResolvedValue({ ok: true, data: { sourceId: "source-1" } });
    buildAnalysisInputMock.mockResolvedValue({ ok: true, input: { __fake: "input" } });
    runAnalysisMock.mockResolvedValue({ status: "valid", analysis: { __fake: "analysis" } });
    persistAnalysisResultMock.mockResolvedValue({
      ok: true,
      runId: "run-1",
      validationStatus: "valid",
      duplicate: false,
    });

    let caught: RedirectSignal | null = null;
    try {
      await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());
    } catch (error) {
      caught = error as RedirectSignal;
    }

    expect(caught?.destination).toBe("/workspace/projects/project-1/analyses/run-1");
    expect(incrementDailyUsageMock).toHaveBeenCalledTimes(1);
    expect(decrementDailyUsageMock).not.toHaveBeenCalled();
  });
});

describe("startProjectAction — own-Gemini-key bypass (Phase 1, Slice 3)", () => {
  it("never looks up an own key when the resolved provider is mock", async () => {
    availableDefaultProviderMock.mockReturnValue("mock");
    createProjectMock.mockResolvedValue({ ok: true, data: { projectId: "project-1" } });
    createSourceMock.mockResolvedValue({ ok: true, data: { sourceId: "source-1" } });
    buildAnalysisInputMock.mockResolvedValue({ ok: true, input: { __fake: "input" } });
    runAnalysisMock.mockResolvedValue({ status: "valid", analysis: { __fake: "analysis" } });
    persistAnalysisResultMock.mockResolvedValue({ ok: true, runId: "run-1" });
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: true, remaining: 9 } });

    try {
      await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());
    } catch {
      // redirect
    }

    expect(getOwnGeminiApiKeyMock).not.toHaveBeenCalled();
    expect(incrementDailyUsageMock).toHaveBeenCalledTimes(1);
  });

  it("skips the daily-usage RPC entirely when the caller has a usable own key", async () => {
    availableDefaultProviderMock.mockReturnValue("gemini");
    getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: "decrypted-own-key" });
    createProjectMock.mockResolvedValue({ ok: true, data: { projectId: "project-1" } });
    createSourceMock.mockResolvedValue({ ok: true, data: { sourceId: "source-1" } });
    buildAnalysisInputMock.mockResolvedValue({ ok: true, input: { __fake: "input" } });
    runAnalysisMock.mockResolvedValue({ status: "valid", analysis: { __fake: "analysis" } });
    persistAnalysisResultMock.mockResolvedValue({ ok: true, runId: "run-1" });

    let caught: RedirectSignal | null = null;
    try {
      await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());
    } catch (error) {
      caught = error as RedirectSignal;
    }

    expect(caught?.destination).toBe("/workspace/projects/project-1/analyses/run-1");
    expect(incrementDailyUsageMock).not.toHaveBeenCalled();
    expect(decrementDailyUsageMock).not.toHaveBeenCalled();
    expect(createProviderMock).toHaveBeenCalledWith(
      "gemini",
      expect.anything(),
      undefined,
      "decrypted-own-key",
    );
  });

  it("returns the own-key lookup's own error verbatim, spending nothing and creating nothing", async () => {
    availableDefaultProviderMock.mockReturnValue("gemini");
    getOwnGeminiApiKeyMock.mockResolvedValue({
      ok: false,
      error: "Your saved Gemini key could not be used. Check it in Settings.",
    });

    const result = await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());

    expect(result.error).toBe("Your saved Gemini key could not be used. Check it in Settings.");
    expect(incrementDailyUsageMock).not.toHaveBeenCalled();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("falls through to the shared daily limit when no own key is saved", async () => {
    availableDefaultProviderMock.mockReturnValue("gemini");
    getOwnGeminiApiKeyMock.mockResolvedValue({ ok: true, apiKey: null });
    incrementDailyUsageMock.mockResolvedValue({ ok: true, data: { allowed: false, remaining: 0 } });

    const result = await startProjectAction({ error: null, fieldErrors: {}, values: {} }, startForm());

    expect(incrementDailyUsageMock).toHaveBeenCalledTimes(1);
    expect(result.error).toMatch(new RegExp(`limit of ${DAILY_ANALYSIS_LIMIT}`));
  });
});
