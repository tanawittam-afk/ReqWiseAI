import type { ProviderMetadata } from "./types";

export const PROVIDER_ERROR_CATEGORIES = [
  "unavailable",
  "authentication_failed",
  "rate_limited",
  "timeout",
  "safety_refusal",
  "unknown",
] as const;

export type ProviderErrorCategory = (typeof PROVIDER_ERROR_CATEGORIES)[number];

export class ProviderExecutionError extends Error {
  readonly category: ProviderErrorCategory;
  readonly metadata: ProviderMetadata;

  constructor(
    category: ProviderErrorCategory,
    message: string,
    metadata: ProviderMetadata,
  ) {
    super(message);
    this.name = "ProviderExecutionError";
    this.category = category;
    this.metadata = metadata;
  }
}

export function safeProviderMessage(category: ProviderErrorCategory): string {
  switch (category) {
    case "unavailable":
      return "This analysis provider is not configured.";
    case "authentication_failed":
      return "The analysis provider could not authenticate.";
    case "rate_limited":
      return "The analysis provider is busy. Try again later.";
    case "timeout":
      return "The analysis provider took too long. Try again.";
    case "safety_refusal":
      return "The analysis provider declined this request.";
    case "unknown":
      return "The analysis provider could not produce a result. Try again.";
  }
}

export function unavailableProviderMessage(error: unknown): string {
  if (error instanceof ProviderExecutionError && error.category === "unavailable") {
    return safeProviderMessage("unavailable");
  }
  throw error;
}
