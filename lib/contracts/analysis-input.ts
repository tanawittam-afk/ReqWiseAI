/**
 * What an analysis is run *over*. Shared by the provider interface and by
 * validation — validation needs the real source text to check citations, and a
 * provider needs it to produce them.
 */

import type { DomainProfile } from "../domain/types";

export type OutputLang = "th" | "en";

export type SourceDocumentInput = {
  /** Provider-facing key. Stable within one analysis input. */
  key: string;
  /** Application id, if the document is already persisted. */
  id: string;
  title: string;
  /** The verbatim text. Offsets in every citation index into exactly this string. */
  text: string;
};

export type AnalysisInput = {
  domainProfile: DomainProfile;
  sourceDocuments: SourceDocumentInput[];
  outputLang: OutputLang;
  projectContext?: {
    name?: string;
    description?: string;
  };
};
