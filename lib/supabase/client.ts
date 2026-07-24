/**
 * Browser Supabase client — anon key, user's JWT, RLS enforced.
 *
 * This is the only client a Client Component may use. Everything it can reach is
 * everything RLS lets the signed-in user reach, which is the point.
 */

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
