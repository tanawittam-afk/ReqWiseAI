/**
 * Settings — what this workspace is configured with, and what each domain profile
 * contributes to an analysis.
 *
 * **Read-only, deliberately — except one thing.** The UX/UI plan's Phase 5 said Settings
 * would "hold the provider choice", and that turned out to need a preference to store
 * and nowhere to store it: there is no user- or organization-settings table, and adding
 * a migration to a live database to persist a dropdown is a schema change bought for a
 * convenience. Two things follow, and both are stated on the page rather than hidden:
 *
 *   1. **The provider is disclosed, not chosen, here.** Which provider is configured
 *      is an environment fact (`AI_PROVIDER`, plus whether a Gemini key and model
 *      chain exist), so it is reported as one. The per-run choice stays on the Analyze
 *      screen, which is where it has always been and where it is actually needed —
 *      Phase 4 kept it there for the same reason.
 *   2. **Domain Profiles are absorbed here as a reading surface**, replacing the
 *      separate sidebar entry. A profile is data, not configuration
 *      (`lib/domain/types.ts`): showing what it contributes is the useful thing; an
 *      editor for it is a different feature nobody has asked for.
 *
 * The server's own API key is never read into this page, never rendered and never sent
 * to the browser — only the boolean `available`, which `readServerEnvironment()` already
 * derives. That rule is absolute (CLAUDE.md → Stack).
 *
 * **The one write this page owns (Phase 1, Slice 3):** a user's own Gemini key
 * (`GeminiKeySection`, `./gemini-key`). That genuinely IS a per-user preference with
 * somewhere real to store it — `user_gemini_keys`
 * (`supabase/migrations/20260918000025_user_gemini_keys.sql`), accessed only through
 * SECURITY DEFINER RPCs. Once saved, the decrypted key is never read back into any page
 * or response body either — only `has_key`/`last_four`/`updated_at`
 * (`get_my_gemini_key_status()`).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readServerEnvironment, toProviderOptions } from "@/lib/config/env";
import { getGeminiKeyStatus } from "@/lib/analysis/own-gemini-key";
import { ALL_PROFILES } from "@/lib/domain/profiles";
import { isDomainSupported } from "@/lib/domain/availability";
import type { DomainProfile } from "@/lib/domain/types";
import { T } from "../../_components/t";
import { GeminiKeySection } from "./gemini-key/gemini-key-section";

export const metadata = { title: "Settings — ReqWise AI" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const env = readServerEnvironment();
  const providers = toProviderOptions(env);
  const effective = env.defaultProvider === "gemini" && !env.gemini.available;
  const geminiKeyStatus = await getGeminiKeyStatus(supabase);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T en="Settings" th="ตั้งค่า" />
        </h1>
        <p className="text-sm text-text-muted">
          <T
            en="What this workspace runs on, and what each domain profile contributes to an
            analysis. Everything here is read-only, except your own Gemini key below."
            th="เวิร์กสเปซนี้ทำงานด้วยอะไร และแต่ละโปรไฟล์โดเมนมีส่วนช่วยการวิเคราะห์อย่างไร
            ทุกอย่างในหน้านี้เป็นแบบอ่านอย่างเดียว ยกเว้น Gemini key ของคุณเองด้านล่าง"
          />
        </p>
      </header>

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-sm font-semibold text-text">
          <T en="Account" th="บัญชี" />
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft sm:grid-cols-2">
          <Row en="Signed in as" th="เข้าสู่ระบบในชื่อ" value={user.email ?? "—"} />
          <Row
            en="Interface language"
            th="ภาษาที่ใช้แสดงผล"
            valueNode={
              <T
                en="Switch with the EN / TH toggle in the sidebar"
                th="สลับด้วยปุ่ม EN / TH ในแถบด้านข้าง"
              />
            }
          />
        </dl>
        <p className="text-xs leading-relaxed text-text-faint">
          <T
            en="Interface language and the language an analysis writes in are two separate
            controls. The output language belongs to the project — editable any time from the
            project's own page, including a &ldquo;match source&rdquo; option that picks Thai or
            English per analysis based on the source's own text — and changing this chrome never
            rewrites a requirement."
            th="ภาษาที่ใช้แสดงผลกับภาษาที่การวิเคราะห์เขียนออกมาเป็นตัวควบคุมคนละตัวกัน
            ภาษาผลลัพธ์เป็นของโปรเจกต์ — แก้ไขได้ทุกเมื่อจากหน้าของโปรเจกต์เอง รวมถึงตัวเลือก
            &ldquo;ตามต้นฉบับ&rdquo; ที่จะเลือกไทยหรืออังกฤษต่อการวิเคราะห์ตามเนื้อหาต้นฉบับ —
            และการเปลี่ยนภาษาหน้าจอไม่มีทางเขียนทับข้อกำหนดใหม่"
          />
        </p>
      </section>

      <section aria-labelledby="provider-heading" className="flex flex-col gap-3">
        <h2 id="provider-heading" className="text-sm font-semibold text-text">
          <T en="Analysis provider" th="ผู้ให้บริการวิเคราะห์" />
        </h2>

        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {providers.map((provider) => {
            const isDefault = provider.key === env.defaultProvider;
            return (
              <li
                key={provider.key}
                className="flex flex-wrap items-center gap-2 bg-surface px-4 py-3"
              >
                <span className="text-sm font-medium text-text">{provider.label}</span>
                {isDefault ? (
                  <span className="rounded-[var(--radius-card)] border border-accent-border bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                    <T en="Default" th="ค่าเริ่มต้น" />
                  </span>
                ) : null}
                <span
                  className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
                    provider.available
                      ? "border-ok-border bg-ok-soft text-ok"
                      : "border-border-soft bg-surface-muted text-text-muted"
                  }`}
                >
                  {provider.available ? (
                    <T en="Configured" th="ตั้งค่าแล้ว" />
                  ) : (
                    <T en="Not configured" th="ยังไม่ได้ตั้งค่า" />
                  )}
                </span>
                <span className="ml-auto text-[11px] text-text-faint">
                  {provider.key === "mock" ? (
                    <T
                      en="Deterministic — same input, same output, no network"
                      th="ผลลัพธ์แน่นอน — อินพุตเดิมได้เอาต์พุตเดิม ไม่มีการเชื่อมต่อเครือข่าย"
                    />
                  ) : env.gemini.models.length > 0 ? (
                    <T
                      en={`Model chain: ${env.gemini.models.join(" → ")}`}
                      th={`ลำดับโมเดล: ${env.gemini.models.join(" → ")}`}
                    />
                  ) : (
                    <T en="No model chain set" th="ยังไม่ได้ตั้งลำดับโมเดล" />
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {effective ? (
          <p
            role="status"
            className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
          >
            <T
              en="Gemini is the configured default but has no API key or model chain, so analyses
              fall back to the deterministic mock. Runs say which provider actually produced
              them — the run header is never vague about that."
              th="Gemini ถูกตั้งเป็นค่าเริ่มต้นแต่ยังไม่มี API key หรือลำดับโมเดล การวิเคราะห์จึงย้อนกลับไปใช้
              โมเดลจำลองที่ให้ผลลัพธ์แน่นอน หัวข้อของรอบวิเคราะห์จะระบุผู้ให้บริการที่ใช้จริงเสมอ ไม่มีความคลุมเครือ"
            />
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-text-faint">
          <T
            en={
              <>
                Which provider a single run uses is chosen on that source&rsquo;s{" "}
                <span className="font-medium text-text-muted">Analyze</span> screen; this page
                reports how the server is configured. An API key is never read into a page,
                never rendered, and never sent to the browser.
              </>
            }
            th={
              <>
                ผู้ให้บริการของแต่ละรอบวิเคราะห์ถูกเลือกที่หน้า
                <span className="font-medium text-text-muted">วิเคราะห์</span>
                ของแหล่งข้อมูลนั้น ๆ หน้านี้เพียงรายงานว่าเซิร์ฟเวอร์ตั้งค่าไว้อย่างไร API key จะไม่ถูกอ่านเข้าหน้านี้
                ไม่ถูกแสดงผล และไม่ถูกส่งไปยังเบราว์เซอร์
              </>
            }
          />
        </p>
      </section>

      <GeminiKeySection
        hasKey={geminiKeyStatus.hasKey}
        lastFour={geminiKeyStatus.lastFour}
        updatedAt={geminiKeyStatus.updatedAt}
      />

      <section aria-labelledby="profiles-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="profiles-heading" className="text-sm font-semibold text-text">
            <T en="Domain profiles" th="โปรไฟล์โดเมน" />
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-text-faint">
            <T
              en={
                <>
                  A profile supplies business context <em>around</em> the analysis engine, never
                  inside it — terminology to recognise, questions worth asking, risks worth
                  raising. It is never evidence: knowing that booking systems usually have a
                  refund policy does not make it a fact about <em>this</em> one.
                </>
              }
              th={
                <>
                  โปรไฟล์ให้บริบททางธุรกิจ<em>รอบ ๆ</em> เครื่องมือวิเคราะห์ ไม่ใช่ภายในมัน — คำศัพท์ที่ควรรู้จัก
                  คำถามที่ควรถาม ความเสี่ยงที่ควรยกขึ้นมา มันไม่ใช่หลักฐาน: การรู้ว่าระบบจองมักมีนโยบายคืนเงิน
                  ไม่ได้ทำให้เป็นข้อเท็จจริงของ<em>โปรเจกต์นี้</em>
                </>
              }
            />
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ALL_PROFILES.map((profile) => (
            <ProfileCard key={profile.key} profile={profile} />
          ))}
        </div>
      </section>

      <p className="text-xs text-text-faint">
        <T en="Looking for a project&rsquo;s own settings?" th="กำลังมองหาการตั้งค่าของโปรเจกต์?" />{" "}
        <Link
          href="/workspace/projects"
          className="font-medium text-accent underline underline-offset-2"
        >
          <T en="Open the project" th="เปิดโปรเจกต์" />
        </Link>{" "}
        <T
          en="— domain, output language and archiving belong to it, not to the workspace."
          th="— โดเมน ภาษาผลลัพธ์ และการเก็บถาวรเป็นของโปรเจกต์ ไม่ใช่ของเวิร์กสเปซ"
        />
      </p>
    </main>
  );
}

function Row({
  en,
  th,
  value,
  valueNode,
}: {
  en: string;
  th: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="text-[11px] text-text-faint">
        <T en={en} th={th} />
      </dt>
      <dd className="text-sm break-words text-text">{valueNode ?? value}</dd>
    </div>
  );
}

function ProfileCard({ profile }: { profile: DomainProfile }) {
  const supported = isDomainSupported(profile.key);

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{profile.name}</h3>
        <span
          className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
            supported
              ? "border-ok-border bg-ok-soft text-ok"
              : "border-border-soft bg-surface-muted text-text-muted"
          }`}
        >
          {supported ? (
            <T en="Available" th="พร้อมใช้งาน" />
          ) : (
            <T en="Not yet available" th="ยังไม่พร้อมใช้งาน" />
          )}
        </span>
        <span className="font-mono text-[11px] text-text-faint">{profile.key}</span>
      </div>

      <p className="text-sm leading-relaxed text-text-muted">{profile.description}</p>

      {/* Counts, not contents: a profile is long, and the number is the honest summary
          of what it actually contributes. Zero reads as zero — an unenriched profile
          should look unenriched. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <Count en="Terms" th="คำศัพท์" value={profile.terminology.length} />
        <Count en="Stakeholders" th="ผู้มีส่วนได้ส่วนเสีย" value={profile.typicalStakeholders.length} />
        <Count en="Workflows" th="เวิร์กโฟลว์" value={profile.commonWorkflows.length} />
        <Count en="Business rules" th="กฎทางธุรกิจ" value={profile.commonBusinessRules.length} />
        <Count
          en="Clarifications"
          th="คำถามชี้แจง"
          value={profile.requiredClarificationCategories.length}
        />
        <Count en="Risks" th="ความเสี่ยง" value={profile.commonRisks.length} />
        <Count
          en="Suggested NFRs"
          th="NFR ที่แนะนำ"
          value={profile.suggestedNonFunctionalRequirements.length}
        />
        <Count en="Validation rules" th="กฎตรวจสอบความถูกต้อง" value={profile.validationRules.length} />
      </dl>

      {profile.requiredClarificationCategories.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border-soft pt-3">
          <h4 className="text-xs font-semibold text-text-muted">
            <T en="Always asks about" th="สอบถามเสมอเรื่อง" />
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {profile.requiredClarificationCategories.map((category) => (
              <li
                key={category}
                className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 text-[11px] text-text-muted"
              >
                {category}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Count({ en, th, value }: { en: string; th: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-start">
      <dt className="text-text-faint">
        <T en={en} th={th} />
      </dt>
      <dd className={`font-mono font-semibold ${value === 0 ? "text-text-faint" : "text-text"}`}>
        {value}
      </dd>
    </div>
  );
}
