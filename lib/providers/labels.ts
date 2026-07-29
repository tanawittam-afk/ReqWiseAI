import type { ProviderKey } from "./types";

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  mock: "Deterministic Mock",
  gemini: "Gemini",
};

export function providerLabel(provider: ProviderKey): string {
  return PROVIDER_LABEL[provider];
}
