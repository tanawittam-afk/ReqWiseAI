/**
 * Server Supabase client — anon key plus the request's session cookies, RLS enforced.
 *
 * Used by Server Components, Route Handlers, and Server Actions. It acts *as the user*:
 * a query here returns exactly what the user is allowed to see. Anything that must
 * bypass RLS goes through `admin.ts` instead, deliberately and visibly.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which may not write cookies. The
          // proxy refreshes the session on every request, so this is safe to
          // ignore — see proxy.ts.
        }
      },
    },
  });
}
