/**
 * Offline Gemini provider verification.
 *
 * Every transport used here is an injected mock. This script never reads an env
 * file, never sends a network request, and never prints provider inputs, keys, or
 * response bodies. A live call is a separate protected manual gate.
 */

import { createServer } from "vite";

import type { AnalysisInput } from "../lib/contracts/analysis-input.ts";
import type { NormalizationPorts } from "../lib/normalization/ports.ts";

const workerFlag = "REQWISE_GEMINI_OFFLINE_WORKER";

if (process.env[workerFlag] !== "1") {
  process.env[workerFlag] = "1";
  const server = await createServer({
    appType: "custom",
    configFile: false,
    envFile: false,
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  let exitCode = 0;
  try {
    await server.ssrLoadModule("/scripts/verify-gemini.mts");
  } catch {
    console.error("Gemini offline verifier could not execute");
    exitCode = 1;
  } finally {
    await server.close();
  }
  process.exit(exitCode);
}

const [
  { bookingSmartSpaceProfile },
  {
    createDisplayIdAllocator,
    createFixedClock,
    createSequentialIdFactory,
  },
  { runAnalysis },
  { ProviderExecutionError },
  { createGeminiClient },
  { buildGeminiPrompt },
  { createGeminiProvider },
  { bookingSourceDocument },
  { bookingValidOutput },
] = await Promise.all([
  import("../lib/domain/profiles/booking-smart-space.ts"),
  import("../lib/normalization/ports.ts"),
  import("../lib/analysis/run-analysis.ts"),
  import("../lib/providers/errors.ts"),
  import("../lib/providers/gemini/client.ts"),
  import("../lib/providers/gemini/prompt.ts"),
  import("../lib/providers/gemini/provider.ts"),
  import("../lib/providers/mock/fixtures/booking-smart-space.source.ts"),
  import("../lib/providers/mock/fixtures/booking-smart-space.valid.ts"),
]);

type CheckResult = { name: string; ok: boolean };

const results: CheckResult[] = [];

function assert(condition: unknown): asserts condition {
  if (!condition) throw new Error("offline verification assertion failed");
}

async function check(name: string, verify: () => void | Promise<void>): Promise<void> {
  try {
    await verify();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch {
    results.push({ name, ok: false });
    console.error(`FAIL ${name}`);
  }
}

function testPorts(): NormalizationPorts {
  return {
    ids: createSequentialIdFactory(),
    clock: createFixedClock("2026-07-27T00:00:00.000Z"),
    displayIds: createDisplayIdAllocator(),
  };
}

function inputFor(text: string): AnalysisInput {
  return {
    domainProfile: bookingSmartSpaceProfile,
    sourceDocuments: [
      {
        key: "offline-source",
        id: "offline-source-id",
        title: "Offline verification source",
        text,
      },
    ],
    outputLang: "th",
  };
}

function bookingInput(): AnalysisInput {
  return {
    domainProfile: bookingSmartSpaceProfile,
    sourceDocuments: [bookingSourceDocument],
    outputLang: "th",
  };
}

function candidateResponse(text: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "x-request-id": "offline-request",
      },
    },
  );
}

function staticFetch(response: Response): typeof fetch {
  return (async () => response.clone()) as typeof fetch;
}

function providerReturning(raw: unknown) {
  return createGeminiProvider({
    apiKey: "offline-placeholder",
    models: ["offline-model"],
    timeoutMs: 100,
    fetchImpl: staticFetch(candidateResponse(JSON.stringify(raw))),
  });
}

function cloneValidOutput(): {
  items: Array<{
    source_references?: Array<{ excerpt: string; start_offset: number; end_offset: number }>;
  }>;
  relations: Array<{ type: string }>;
} {
  return JSON.parse(JSON.stringify(bookingValidOutput)) as {
    items: Array<{
      source_references?: Array<{ excerpt: string; start_offset: number; end_offset: number }>;
    }>;
    relations: Array<{ type: string }>;
  };
}

await check("1. prompt contains Thai source verbatim", () => {
  const source = "ลูกค้าต้องการจองห้องประชุม";
  assert(buildGeminiPrompt(inputFor(source)).includes(source));
});

await check("2. prompt contains English source verbatim", () => {
  const source = "The customer must book a meeting room.";
  assert(buildGeminiPrompt(inputFor(source)).includes(source));
});

await check("3. prompt preserves mixed Thai/English source", () => {
  const source = "ลูกค้า confirms the booking ผ่าน mobile app.";
  assert(buildGeminiPrompt(inputFor(source)).includes(source));
});

await check("4. mocked valid JSON passes the full validation pipeline", async () => {
  const result = await runAnalysis(providerReturning(bookingValidOutput), bookingInput(), testPorts());
  assert(result.status === "valid");
  assert(result.analysis.items.length > 0);
});

await check("5. malformed JSON becomes an invalid result with zero normalized items", async () => {
  const provider = createGeminiProvider({
    apiKey: "offline-placeholder",
    models: ["offline-model"],
    timeoutMs: 100,
    fetchImpl: staticFetch(candidateResponse("{malformed-json")),
  });
  const result = await runAnalysis(provider, bookingInput(), testPorts());
  const normalizedItemCount = result.status === "valid" ? result.analysis.items.length : 0;
  assert(result.status === "invalid");
  assert(normalizedItemCount === 0);
});

await check("6. unknown relation becomes invalid", async () => {
  const output = cloneValidOutput();
  output.relations[0].type = "unknown_relation";
  const result = await runAnalysis(providerReturning(output), bookingInput(), testPorts());
  assert(result.status === "invalid");
});

await check("7. exact-evidence mismatch becomes invalid", async () => {
  const output = cloneValidOutput();
  const citedItem = output.items.find((item) => (item.source_references?.length ?? 0) > 0);
  assert(citedItem?.source_references?.[0]);
  citedItem.source_references[0].excerpt = "evidence not present at the declared offsets";
  const result = await runAnalysis(providerReturning(output), bookingInput(), testPorts());
  assert(result.status === "invalid");
});

await check("8. 429 is bounded and translated to rate_limited", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response("offline rate-limit body", { status: 429 });
  }) as typeof fetch;
  const client = createGeminiClient({
    apiKey: "offline-placeholder",
    models: ["offline-model"],
    timeoutMs: 100,
    fetchImpl,
  });

  let caught: unknown;
  try {
    await client.generate("offline prompt");
  } catch (error) {
    caught = error;
  }

  assert(calls === 2);
  assert(caught instanceof ProviderExecutionError);
  assert(caught.category === "rate_limited");
});

await check("9. 503 advances through the configured model chain", async () => {
  const requestedUrls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    requestedUrls.push(String(input));
    if (requestedUrls.length <= 2) {
      return new Response("offline unavailable body", { status: 503 });
    }
    return candidateResponse(JSON.stringify(bookingValidOutput));
  }) as typeof fetch;
  const client = createGeminiClient({
    apiKey: "offline-placeholder",
    models: ["offline-model-a", "offline-model-b"],
    timeoutMs: 100,
    fetchImpl,
  });

  const generated = await client.generate("offline prompt");
  assert(requestedUrls.length === 3);
  assert(requestedUrls[0].includes("offline-model-a"));
  assert(requestedUrls[1].includes("offline-model-a"));
  assert(requestedUrls[2].includes("offline-model-b"));
  assert(generated.model === "offline-model-b");
});

await check("10. no key, prompt, full source or raw response is present in safe errors", async () => {
  const apiKey = "SECRET_KEY_OFFLINE_SENTINEL";
  const fullSource = "PRIVATE_FULL_SOURCE_OFFLINE_SENTINEL";
  const rawResponse = "PRIVATE_RAW_RESPONSE_OFFLINE_SENTINEL";
  const promptSentinel = "PRIVATE_PROMPT_OFFLINE_SENTINEL";
  const provider = createGeminiProvider({
    apiKey,
    models: ["offline-model"],
    timeoutMs: 100,
    fetchImpl: (async () => new Response(rawResponse, { status: 401 })) as typeof fetch,
  });
  const input = inputFor(`${fullSource}\n${promptSentinel}`);
  const result = await runAnalysis(provider, input, testPorts());
  const serialized = JSON.stringify(result);

  assert(result.status === "provider_error");
  assert(!serialized.includes(apiKey));
  assert(!serialized.includes(promptSentinel));
  assert(!serialized.includes(fullSource));
  assert(!serialized.includes(rawResponse));
});

const passed = results.filter((result) => result.ok).length;
console.log(`${passed}/${results.length} offline checks passed`);

if (process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) {
  console.log("Live Gemini verification requires the protected manual gate documented in HANDOFF.md");
} else {
  console.log("Live Gemini verification pending — credential unavailable");
}

if (passed !== results.length || results.length !== 10) {
  throw new Error("Gemini offline verification failed");
}
