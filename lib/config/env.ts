export type ServerEnvironment = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  applicationUrl: string | null;
  runtimeEnvironment: "development" | "test" | "production";
  defaultProvider: "mock" | "gemini";
  gemini: {
    available: boolean;
    apiKey: string | null;
    models: string[];
  };
};

export type ProviderOption = {
  key: "mock" | "gemini";
  label: string;
  available: boolean;
};

function required(source: Record<string, string | undefined>, name: string): string {
  const value = source[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function runtimeEnvironment(value: string | undefined): ServerEnvironment["runtimeEnvironment"] {
  const normalized = value?.trim() || "development";
  if (normalized === "development" || normalized === "test" || normalized === "production") {
    return normalized;
  }
  throw new Error("NODE_ENV must be development, test, or production");
}

function defaultProvider(value: string | undefined): ServerEnvironment["defaultProvider"] {
  const normalized = value?.trim() || "mock";
  if (normalized === "mock" || normalized === "gemini") return normalized;
  throw new Error("AI_PROVIDER must be mock or gemini");
}

function modelChain(source: Record<string, string | undefined>): string[] {
  const candidates = [source.GEMINI_MODEL, ...(source.GEMINI_FALLBACK_MODELS?.split(",") ?? [])]
    .map((model) => model?.trim())
    .filter((model): model is string => model !== undefined && model.length > 0);

  return candidates.filter((model, index) => candidates.indexOf(model) === index);
}

export function readServerEnvironment(
  source: Record<string, string | undefined> = process.env,
): ServerEnvironment {
  const apiKey = source.GEMINI_API_KEY?.trim() || null;
  const models = modelChain(source);

  return {
    supabaseUrl: required(source, "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: required(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    applicationUrl: source.APPLICATION_URL?.trim() || null,
    runtimeEnvironment: runtimeEnvironment(source.NODE_ENV),
    defaultProvider: defaultProvider(source.AI_PROVIDER),
    gemini: {
      available: apiKey !== null && models.length > 0,
      apiKey,
      models,
    },
  };
}

export function toProviderOptions(env: ServerEnvironment): ProviderOption[] {
  return [
    { key: "mock", label: "Deterministic Mock", available: true },
    { key: "gemini", label: "Gemini", available: env.gemini.available },
  ];
}

export function availableDefaultProvider(
  env: ServerEnvironment,
): ServerEnvironment["defaultProvider"] {
  return env.defaultProvider === "gemini" && !env.gemini.available
    ? "mock"
    : env.defaultProvider;
}
