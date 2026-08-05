/**
 * Requirements — every item in every project the signed-in person can see.
 *
 * The analysis workspace answers "what did this run find". This answers "what does
 * this workspace hold", which is the question a BA has once there is more than one
 * project. Nothing here can *act* on an item: every row links to the analysis
 * workspace, which is the only surface that may edit or review one.
 *
 * RLS scopes the query. This page never filters by owner itself.
 */

import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_ITEM_LIMIT, listWorkspaceItems } from "@/lib/workspace/queries";
import { RequirementsView } from "./requirements-view";
import { T } from "../../_components/t";

export const metadata = { title: "Requirements — ReqWise AI" };

export default async function RequirementsPage({
  searchParams,
}: {
  /** `?project=` — where the project sub-nav's Requirements tab lands. */
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const supabase = await createClient();
  const { items, truncated } = await listWorkspaceItems(supabase);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T en="Requirements" th="ข้อกำหนด" />
        </h1>
        <p className="text-sm text-text-muted">
          <T
            en="Every requirement, question and finding across your projects. Open one to review or
            edit it in its analysis workspace."
            th="ข้อกำหนด คำถาม และข้อค้นพบทั้งหมดในทุกโปรเจกต์ของคุณ เปิดรายการใดรายการหนึ่งเพื่อตรวจสอบ
            หรือแก้ไขในพื้นที่ทำงานวิเคราะห์"
          />
        </p>
      </header>

      {truncated ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          <T
            en={`Showing the ${WORKSPACE_ITEM_LIMIT} most recently updated requirements. Filters below search only these — open a project to see all of its requirements.`}
            th={`แสดงข้อกำหนดที่อัปเดตล่าสุด ${WORKSPACE_ITEM_LIMIT} รายการ ตัวกรองด้านล่างค้นหาเฉพาะรายการเหล่านี้ — เปิดโปรเจกต์เพื่อดูข้อกำหนดทั้งหมด`}
          />
        </p>
      ) : null}

      <RequirementsView items={items} initialProjectId={project} />
    </main>
  );
}
