"use client";

/**
 * The analyze confirmation.
 *
 * `requestKey` is generated once, on mount — not per render — so a double click on
 * the submit button, or a browser retrying a slow POST, resubmits the exact same key
 * and `persist_analysis_result()` answers with the run that already exists rather
 * than creating a second one. Reloading this page mints a new key, which is correct:
 * that is a new confirmation, not a retry of the old one.
 */

import { useActionState, useState } from "react";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import type { ProviderOption } from "@/lib/config/env";
import type { ProviderKey } from "@/lib/providers/types";
import { analyzeSourceAction } from "./actions";
import { emptyAnalyzeFormState } from "./form-state";
import { AnalysisProviderControls } from "./provider-controls";

export function AnalyzeConfirmForm({
  projectId,
  sourceId,
  revisionNumber,
  alreadyLocked,
  providerOptions,
  defaultProvider,
}: {
  projectId: string;
  sourceId: string;
  revisionNumber: number;
  alreadyLocked: boolean;
  providerOptions: ProviderOption[];
  defaultProvider: ProviderKey;
}) {
  const [state, formAction, pending] = useActionState(
    analyzeSourceAction,
    emptyAnalyzeFormState,
  );
  const [requestKey] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="requestKey" value={requestKey} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-5 text-sm leading-relaxed text-text-muted">
        <ConfirmPoint>
          <T
            en={
              <>
                The system will analyse <strong className="text-text">revision {revisionNumber}</strong> of
                this document, exactly as it currently reads.
              </>
            }
            th={
              <>
                ระบบจะวิเคราะห์ <strong className="text-text">ฉบับที่ {revisionNumber}</strong> ของเอกสารนี้
                ตามที่ปรากฏอยู่ในขณะนี้
              </>
            }
          />
        </ConfirmPoint>
        <ConfirmPoint>
          {alreadyLocked ? (
            <T
              en="This revision is already locked by an earlier analysis. Running it again creates a new, separate run — the earlier run and its results are untouched."
              th="ฉบับนี้ถูกล็อกไว้แล้วจากการวิเคราะห์ครั้งก่อน การรันอีกครั้งจะสร้างรอบใหม่แยกต่างหาก — รอบเดิมและผลลัพธ์ของมันจะไม่ถูกแตะต้อง"
            />
          ) : (
            <T
              en="This revision will be locked once the run is created. To change the text afterwards, create a new revision."
              th="ฉบับนี้จะถูกล็อกทันทีที่สร้างรอบการวิเคราะห์ หากต้องการแก้ไขข้อความภายหลัง ให้สร้างฉบับใหม่"
            />
          )}
        </ConfirmPoint>
        <ConfirmPoint>
          <T
            en={
              <>
                Every requirement this produces starts as a <strong className="text-text">draft</strong> —
                nothing is approved automatically.
              </>
            }
            th={
              <>
                ทุกข้อกำหนดที่สร้างขึ้นจะเริ่มต้นเป็น <strong className="text-text">แบบร่าง</strong> —
                ไม่มีอะไรได้รับการอนุมัติโดยอัตโนมัติ
              </>
            }
          />
        </ConfirmPoint>
        <ConfirmPoint>
          <T
            en="The domain profile guides the analysis; it is never treated as evidence about this specific source."
            th="โปรไฟล์โดเมนใช้ชี้นำการวิเคราะห์เท่านั้น ไม่เคยถูกนำมาใช้เป็นหลักฐานเกี่ยวกับเอกสารนี้โดยเฉพาะ"
          />
        </ConfirmPoint>
        <ConfirmPoint>
          <T
            en="Choose the analysis provider for this run. The saved run records which provider produced it."
            th="เลือกผู้ให้บริการวิเคราะห์สำหรับรอบนี้ รอบที่บันทึกไว้จะระบุว่าผู้ให้บริการรายใดเป็นผู้สร้างผลลัพธ์"
          />
        </ConfirmPoint>
      </ul>

      <AnalysisProviderControls
        providerOptions={providerOptions}
        defaultProvider={defaultProvider}
        pending={pending}
      />
    </form>
  );
}

function ConfirmPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1 text-signal">
        <Icon name="check" size={13} />
      </span>
      <span>{children}</span>
    </li>
  );
}
