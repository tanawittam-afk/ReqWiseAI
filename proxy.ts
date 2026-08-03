/**
 * Session refresh + route protection.
 *
 * Two jobs, in this order:
 *   1. Refresh the Supabase session cookie on every request, so Server Components can
 *      read a valid session without being able to write cookies themselves.
 *   2. Keep signed-out traffic out of the workspace, and signed-in traffic out of the
 *      auth pages.
 *
 * `getUser()` — not `getSession()` — because only the former revalidates the JWT with
 * the auth server. A route guard that trusts an unverified cookie is not a guard.
 *
 * Runs on the Node.js runtime (the Vercel default); nothing here needs Edge.
 *
 * Named `proxy.ts` because Next 16 deprecated the `middleware.ts` convention — the
 * same request-interception hook, under a new filename and export name.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/workspace"];
const AUTH_PATHS = ["/sign-in", "/sign-up"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets, and /demo — the session cookie
    // must be refreshed on real navigations, not on image requests, and /demo is a
    // public, no-auth page (Phase 2 of the 2026-08-03 UX/UI plan): it needs no session
    // refresh and PROTECTED_PREFIXES never covered it anyway, so excluding it here
    // keeps it a genuinely static request instead of one that calls Supabase auth on
    // every load for no reason.
    "/((?!_next/static|_next/image|favicon.ico|demo|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
