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
  /**
   * The own-Gemini-key encryption secret (Phase 1, Slice 3). Optional at read time,
   * the same way `gemini.apiKey` is: most of the app never touches it, and a
   * deployment that hasn't set up the own-key feature yet must not fail every page
   * render over an unrelated missing var. It IS validated eagerly the moment it is
   * *present* — a malformed value (present but not exactly 32 bytes once base64-decoded)
   * throws here, loudly, rather than failing silently the first time someone tries to
   * save a key. `available: false` with the var unset is the expected "not configured
   * yet" state; the own-key call sites (`lib/analysis/own-gemini-key.ts`,
   * `app/workspace/settings/gemini-key/actions.ts`) are where a *missing* secret
   * becomes a loud, specific user-facing failure — at the point of use, not at every
   * unrelated `readServerEnvironment()` call.
   */
  geminiKeyEncryption: {
    available: boolean;
    secret: string | null;
  };
  /**
   * The one admin's email (Phase 1, Slice 4). Unlike every other optional-but-strict
   * field here, absence is NOT "feature unavailable" — it is "the /admin page is closed
   * to everyone", because there is no safe default identity to fall back on. Normalized
   * with trim + lowercase at read time so lib/admin/guard.ts's comparison against
   * `user.email` is case-insensitive by construction, not by accident at every call
   * site. A present-but-clearly-invalid value (no `@`) throws immediately — the same
   * "fail loudly at read time" contract as `geminiKeyEncryption`.
   */
  adminEmail: {
    available: boolean;
    email: string | null;
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

const GEMINI_KEY_ENCRYPTION_SECRET_BYTES = 32;

/**
 * Optional-but-strict: absent entirely → feature not configured (available: false, no
 * throw — mirrors `gemini.apiKey`). Present but not a valid 32-byte base64 value →
 * throws immediately, because that is a real misconfiguration, not an unconfigured
 * feature, and the whole point of Slice 3's "fail loudly" requirement is to never let
 * a broken secret look like a working one.
 */
function geminiKeyEncryption(
  source: Record<string, string | undefined>,
): ServerEnvironment["geminiKeyEncryption"] {
  const raw = source.GEMINI_KEY_ENCRYPTION_SECRET?.trim() || null;
  if (raw === null) return { available: false, secret: null };

  let decodedLength: number;
  try {
    decodedLength = Buffer.from(raw, "base64").length;
  } catch {
    decodedLength = 0;
  }

  if (decodedLength !== GEMINI_KEY_ENCRYPTION_SECRET_BYTES) {
    throw new Error(
      `GEMINI_KEY_ENCRYPTION_SECRET must decode to exactly ${GEMINI_KEY_ENCRYPTION_SECRET_BYTES} bytes`,
    );
  }

  return { available: true, secret: raw };
}

/**
 * Optional-but-strict, like `geminiKeyEncryption`, but with the opposite failure
 * posture: absent entirely → `/admin` is closed to everyone (there is no safe default
 * admin identity), not "feature not configured yet". Present but not a plausible email
 * (no `@`) → throws immediately, a real misconfiguration.
 */
function adminEmail(source: Record<string, string | undefined>): ServerEnvironment["adminEmail"] {
  const raw = source.ADMIN_EMAIL?.trim() || null;
  if (raw === null) return { available: false, email: null };

  const normalized = raw.toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }

  return { available: true, email: normalized };
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
    geminiKeyEncryption: geminiKeyEncryption(source),
    adminEmail: adminEmail(source),
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
