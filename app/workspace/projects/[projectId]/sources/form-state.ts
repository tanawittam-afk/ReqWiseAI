/**
 * The source form's state. A plain data module, not a `"use server"` file — a server
 * action module may only export async functions (Next 16), so the shape and its empty
 * value live here.
 */

export type SourceFormState = {
  error?: string;
  fieldErrors: Record<string, string>;
  /** Echoed back so a rejected submission never loses what was typed. */
  values: Record<string, string>;
};

export const emptySourceFormState: SourceFormState = { fieldErrors: {}, values: {} };
