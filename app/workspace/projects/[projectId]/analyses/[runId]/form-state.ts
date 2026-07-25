/**
 * The edit and review forms' state. A plain data module, not a `"use server"` file —
 * a server action module may only export async functions (Next 16), so the shape and
 * its empty value live here.
 *
 * This is not a style preference. Exporting the initial state from `actions.ts` type-
 * checks, lints and builds cleanly, and then arrives at the client as `undefined`,
 * because the bundler only exposes the async exports of a `"use server"` module. The
 * first thing the form does with it is read `state.fieldErrors`, so the failure lands
 * in an error boundary the moment somebody presses Edit — and only then.
 */

export type ReviewFormState = {
  ok: boolean;
  /** Non-null only after a completed action, so the UI can announce what happened. */
  message: string | null;
  error: string | null;
  fieldErrors: Record<string, string>;
};

export const EMPTY_REVIEW_STATE: ReviewFormState = {
  ok: false,
  message: null,
  error: null,
  fieldErrors: {},
};
