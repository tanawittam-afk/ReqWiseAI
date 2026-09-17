/**
 * The own-Gemini-key form's state. A plain data module — a server action module may
 * only export async functions (Next 16), same reason `analyze/form-state.ts` and
 * `projects/form-state.ts` are split out.
 */

export type GeminiKeyFormState = { error?: string; success?: string };

export const emptyGeminiKeyFormState: GeminiKeyFormState = {};
