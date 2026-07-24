/**
 * Shared shape for the project form's action result.
 *
 * Separate module because a `"use server"` file may only export async functions —
 * the same reason `app/auth/state.ts` exists.
 */

export type ProjectFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Echoed back so a rejected submission does not empty the form. */
  values: Record<string, string>;
};

export const emptyProjectFormState: ProjectFormState = {
  error: null,
  fieldErrors: {},
  values: {},
};
