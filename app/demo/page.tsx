/**
 * The public demo — no sign-up, no session, no database. Both language variants are
 * computed here, server-side, from the real engine; `DemoWorkspace` picks between them
 * on the client to match whichever language the visitor's chrome is in.
 *
 * `Inspector`'s mutating forms (edit, review, answer/resolve, change requests) are all
 * rendered here too, via the unmodified `AnalysisWorkspace` — verified safe to expose
 * publicly by reading `analyses/[runId]/actions.ts` and every service it calls: each
 * one re-derives auth through `createClient()` + RLS, so a submission with no session
 * is refused server-side regardless of what the page renders, and every mutating
 * `<form>` in the tree is itself only rendered when `canReview`/`canAct` is true, which
 * this page always passes as `false`. See the Phase 2 entry in HANDOFF.md for the
 * full audit trail.
 */

import { buildDemoRun } from "@/lib/demo/build";
import { toDemoHistory, toDemoSourceDetail, toDemoWorkspaceRun } from "@/lib/demo/view";
import { DemoWorkspace, type DemoDataset } from "./_components/demo-workspace";

export const metadata = {
  title: "Demo — ReqWise AI",
  description:
    "See ReqWise AI turn a real meeting note into traceable, human-reviewable requirements — no sign-up required.",
};

async function dataset(lang: "th" | "en"): Promise<DemoDataset> {
  const analysis = await buildDemoRun(lang);
  return {
    run: toDemoWorkspaceRun(analysis),
    source: toDemoSourceDetail(lang),
    history: toDemoHistory(analysis),
  };
}

export default async function DemoPage({
  searchParams,
}: {
  /**
   * `?item=` — a **display id** (`Q-001`, not a database uuid), so a link from the
   * landing page can read `/demo?item=Q-001` and mean something to a human. Resolved
   * against whichever language dataset is active client-side, in `DemoWorkspace`,
   * because display-id allocation order is identical between the two language runs
   * (the mock strategy pushes items in a fixed order regardless of language) but the
   * underlying item ids are not shared between them.
   */
  searchParams: Promise<{ item?: string }>;
}) {
  const [{ item }, th, en] = await Promise.all([searchParams, dataset("th"), dataset("en")]);
  return <DemoWorkspace th={th} en={en} initialDisplayId={item ?? null} />;
}
