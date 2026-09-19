/**
 * The sign-up toggle form's state. A plain data module — a `"use server"` module may
 * only export async functions (Next 16), same reason `gemini-key/form-state.ts` and
 * `auth/state.ts` are split out.
 */

export type ToggleSignUpFormState = { error?: string; success?: string };

export const emptyToggleSignUpFormState: ToggleSignUpFormState = {};
