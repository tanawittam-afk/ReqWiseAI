"use client";

/**
 * Own-Gemini-key settings (Phase 1, Slice 3). A client island for the same reason
 * `AnalyzeConfirmForm` is one: `useActionState` needs a client component.
 *
 * `hasKey`/`lastFour`/`updatedAt` come from the server page's own
 * `get_my_gemini_key_status()` read — never from this component fetching anything
 * itself, and the decrypted key never travels through here at all: `saveGeminiKeyAction`
 * returns only a generic success message, and the fresh status after a save/delete
 * arrives by `revalidatePath` re-rendering the parent server page, not by this
 * component holding state of its own.
 */

import { useActionState } from "react";
import { T } from "@/app/_components/t";
import { Notice } from "@/app/_components/ui/notice";
import { Button, SubmitButton } from "@/app/_components/ui/button";
import { deleteGeminiKeyAction, saveGeminiKeyAction } from "./actions";
import { emptyGeminiKeyFormState } from "./form-state";

const control =
  "w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2.5 text-sm text-text " +
  "placeholder:text-text-faint transition-colors hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export function GeminiKeySection({
  hasKey,
  lastFour,
  updatedAt,
}: {
  hasKey: boolean;
  lastFour: string | null;
  updatedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveGeminiKeyAction, emptyGeminiKeyFormState);

  return (
    <section aria-labelledby="own-key-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="own-key-heading" className="text-sm font-semibold text-text">
          <T en="Your own Gemini key" th="Gemini key ของคุณเอง" />
        </h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-faint">
          <T
            en="Save your own Gemini API key and your analyses run on it instead of the shared daily limit. Stored encrypted; once saved, the key itself is never shown again — only the last four characters."
            th="บันทึก Gemini API key ของคุณเอง แล้วการวิเคราะห์ของคุณจะใช้คีย์นี้แทนโควตารวมรายวัน ระบบเข้ารหัสคีย์ไว้ และเมื่อบันทึกแล้วจะไม่แสดงคีย์เต็มอีก — แสดงเพียง 4 ตัวท้าย"
          />
        </p>
      </div>

      {hasKey ? (
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft sm:grid-cols-2">
          <div className="flex flex-col gap-1 bg-surface p-4">
            <dt className="text-[11px] text-text-faint">
              <T en="Saved key" th="คีย์ที่บันทึกไว้" />
            </dt>
            <dd className="font-mono text-sm text-text">•••• {lastFour}</dd>
          </div>
          <div className="flex flex-col gap-1 bg-surface p-4">
            <dt className="text-[11px] text-text-faint">
              <T en="Last updated" th="อัปเดตล่าสุด" />
            </dt>
            <dd className="text-sm text-text">
              {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          <T
            en="No key saved — every analysis you run uses the shared daily limit."
            th="ยังไม่มีคีย์ที่บันทึกไว้ — การวิเคราะห์ทุกครั้งของคุณจะใช้โควตารวมรายวัน"
          />
        </p>
      )}

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.success ? <Notice tone="success">{state.success}</Notice> : null}

      <form action={formAction} aria-busy={pending} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-text-faint">
            <T
              en={hasKey ? "Replace with a new key" : "Gemini API key"}
              th={hasKey ? "แทนที่ด้วยคีย์ใหม่" : "Gemini API key"}
            />
          </span>
          <input
            type="password"
            name="apiKey"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza..."
            className={control}
          />
        </label>
        <SubmitButton variant="primary" pendingLabel="Saving…">
          <T en={hasKey ? "Replace" : "Save"} th={hasKey ? "แทนที่" : "บันทึก"} />
        </SubmitButton>
      </form>

      {hasKey ? (
        <form action={deleteGeminiKeyAction} className="self-start">
          <Button type="submit" variant="danger" size="sm">
            <T en="Delete saved key" th="ลบคีย์ที่บันทึกไว้" />
          </Button>
        </form>
      ) : null}
    </section>
  );
}
