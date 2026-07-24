/**
 * Environment access for the Supabase clients.
 *
 * Reading env through here rather than inline keeps one truth about which variables
 * are browser-safe: only the two `NEXT_PUBLIC_` values may ever be inlined into a
 * client bundle. The service-role key is read in `admin.ts` alone.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
