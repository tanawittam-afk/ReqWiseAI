import { z } from "zod";
import { providerSelectionSchema } from "../providers/factory";

export const analysisActionInputSchema = z.strictObject({
  projectId: z.string().trim().min(1).max(128),
  sourceId: z.string().trim().min(1).max(128),
  requestKey: z.string().trim().min(8).max(128),
  provider: providerSelectionSchema,
});

export type AnalysisActionInput = z.infer<typeof analysisActionInputSchema>;

export type AnalysisActionInputResult =
  | { ok: true; value: AnalysisActionInput }
  | { ok: false; error: string };

export function readAnalysisActionInput(formData: FormData): AnalysisActionInputResult {
  const provider = providerSelectionSchema.safeParse(formData.get("provider"));
  if (!provider.success) {
    return {
      ok: false,
      error: "Choose an available analysis provider and try again.",
    };
  }

  const parsed = analysisActionInputSchema.safeParse({
    projectId: formData.get("projectId"),
    sourceId: formData.get("sourceId"),
    requestKey: formData.get("requestKey"),
    provider: provider.data,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "This confirmation has expired. Reload the page and try again.",
    };
  }

  return { ok: true, value: parsed.data };
}
