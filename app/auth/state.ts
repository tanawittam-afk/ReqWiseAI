/**
 * The shape a form gets back from an auth action.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export async
 * functions — a plain constant there is a build error, not a style preference.
 */

export type AuthState = {
  error: string | null;
  notice: string | null;
};

export const emptyAuthState: AuthState = { error: null, notice: null };
