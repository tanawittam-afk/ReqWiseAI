import { describe, expect, it, vi } from "vitest";
import { createGeminiClient } from "../../lib/providers/gemini/client";

const candidateResponse = (text: string, init: ResponseInit = {}) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200, ...init },
  );

const clientWith = (fetchImpl: typeof fetch, models: readonly [string, ...string[]] = ["configured-model-a"]) =>
  createGeminiClient({
    apiKey: "server-key",
    models,
    timeoutMs: 1_000,
    fetchImpl,
  });

describe("Gemini client", () => {
  it("keeps the key in a server request header and returns candidate text", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        void input;
        void init;
        return candidateResponse('{"schema_version":"1.0.0"}', {
          headers: { "x-request-id": "request-safe-id" },
        });
      },
    );
    const client = clientWith(fetchImpl as typeof fetch);

    await expect(client.generate("prompt")).resolves.toEqual({
      text: '{"schema_version":"1.0.0"}',
      model: "configured-model-a",
      requestId: "request-safe-id",
    });

    const [input, init] = fetchImpl.mock.calls[0];
    expect(String(input)).toContain("/v1beta/models/configured-model-a:generateContent");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-goog-api-key": "server-key",
    });
    expect(JSON.stringify(init)).not.toContain("NEXT_PUBLIC");
  });

  it("does not retry an authentication failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("unauthorized", { status: 401 }));

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "authentication_failed",
      message: "The analysis provider could not authenticate.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops a rate-limited model after two transport attempts", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 429 }));

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "rate_limited",
      message: "The analysis provider is busy. Try again later.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to the next model after retryable service failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(candidateResponse('{"schema_version":"1.0.0"}'));

    await expect(
      clientWith(fetchImpl as typeof fetch, ["configured-model-a", "configured-model-b"]).generate("prompt"),
    ).resolves.toMatchObject({ model: "configured-model-b" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[2][0])).toContain("configured-model-b");
  });

  it("maps an aborted request to timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "timeout",
      message: "The analysis provider took too long. Try again.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps the timeout active through body consumption and retries a body AbortError", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal === null || signal === undefined) throw new Error("expected an AbortSignal");
      signals.push(signal);
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("body aborted", "AbortError"));
            });
          }),
      } as unknown as Response;
    });

    try {
      const pending = createGeminiClient({
        apiKey: "server-key",
        models: ["configured-model-a"],
        timeoutMs: 10,
        fetchImpl: fetchImpl as typeof fetch,
      }).generate("prompt");
      const outcome = pending.then(
        () => ({ type: "success" as const }),
        (error: unknown) => ({ type: "error" as const, error }),
      );

      await vi.advanceTimersByTimeAsync(10);
      expect(signals[0]?.aborted).toBe(true);
      await vi.runAllTimersAsync();
      await expect(outcome).resolves.toMatchObject({ type: "error", error: { category: "timeout" } });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [400, "unknown", "The analysis provider could not produce a result. Try again."],
    [403, "authentication_failed", "The analysis provider could not authenticate."],
  ] as const)("does not retry terminal status %i", async (status, category, message) => {
    const fetchImpl = vi.fn(async () => new Response("terminal", { status }));

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category,
      message,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502, 504])("retries retryable status %i exactly once", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("retry", { status }));

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "unavailable",
      message: "This analysis provider is not configured.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a non-abort network rejection", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "unavailable",
      message: "This analysis provider is not configured.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses a safety-blocked response without retrying", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }),
    );

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "safety_refusal",
      message: "The analysis provider declined this request.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps a malformed successful response to unknown without retrying", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ candidates: [{}] }), { status: 200 }));

    await expect(clientWith(fetchImpl as typeof fetch).generate("prompt")).rejects.toMatchObject({
      category: "unknown",
      message: "The analysis provider could not produce a result. Try again.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
