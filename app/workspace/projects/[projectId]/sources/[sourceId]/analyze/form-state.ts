/**
 * The analyze confirmation's state. A plain data module — a server action module may
 * only export async functions (Next 16).
 */

export type AnalyzeFormState = { error?: string };

export const emptyAnalyzeFormState: AnalyzeFormState = {};
