/**
 * The landing page — "Evidence Trail" direction, shipped 2026-09-03.
 *
 * Replaces the Phase 3 (2026-08-03) redesign, which reused the app's own restrained
 * "tech workspace" language and read as forgettable on a page meant to make a first
 * impression ("ไม่สวย ไม่น่าสนใจ ดูธรรมดาเกินไป"). This version has its own art
 * direction — near-black canvas, one signature acid-lime accent, hero-scale display
 * type — approved via a design canvas before any of this was written. Scoped entirely
 * to `.landing-evidence` in `app/globals.css`; it never touches `:root` or
 * `[data-theme]`, and has no effect on `/workspace` or `/demo`.
 *
 * Deliberately static: no `getUser()` call, same reasoning as the previous version —
 * a signed-in visitor who clicks "Sign in" anyway lands on `/workspace` via
 * `proxy.ts`'s existing redirect.
 *
 * The signature "evidence trail" moment (raw source sentence -> the requirement it
 * produced) uses FR-001 from the real `/demo` scenario, not an invented example —
 * confirmed by running the actual mock engine against the actual demo source text
 * before writing this page: displayId FR-001, confidence 84%, excerpt "Front desk
 * staff must be able to view the full booking schedule and assist a walk-in customer
 * who arrives without a reservation." (see lib/demo/scenario.ts, lib/demo/build.ts).
 * The section links to `/demo?item=FR-001`, the same real item.
 *
 * All other copy is carried over verbatim from the previous version — only the visual
 * language changed. Every screenshot is still captured from `/demo` (Phase 2), which by
 * construction contains no real user's data.
 */

import Image from "next/image";
import Link from "next/link";
import { T } from "./_components/t";
import { Icon, type IconName } from "./_components/icon";
import { SkipLink } from "./_components/skip-link";
import { LandingLangToggle } from "./_components/landing-lang-toggle";

export const metadata = {
  title: "ReqWise AI — traceable, reviewable requirements from unstructured notes",
  description:
    "Meeting notes go in. Traceable, human-reviewable software requirements come out — every one carrying the exact sentence it came from.",
};

const STEPS: Array<{ icon: IconName; en: string; th: string; bodyEn: string; bodyTh: string }> = [
  {
    icon: "paste",
    en: "Paste",
    th: "วาง",
    bodyEn: "Meeting notes, an interview transcript, a client message — plain text, nothing to format.",
    bodyTh: "บันทึกการประชุม บทสัมภาษณ์ หรือข้อความจากลูกค้า — เป็นข้อความล้วน ไม่ต้องจัดรูปแบบ",
  },
  {
    icon: "analyze",
    en: "Analyse",
    th: "วิเคราะห์",
    bodyEn:
      "The engine extracts requirements, stakeholders, risks and open questions — citing the exact evidence for every claim it makes.",
    bodyTh: "เอนจินดึงความต้องการ ผู้มีส่วนได้เสีย ความเสี่ยง และคำถามที่ต้องถาม พร้อมอ้างอิงหลักฐานจริงทุกข้อ",
  },
  {
    icon: "review",
    en: "Review",
    th: "ตรวจสอบ",
    bodyEn: "A person approves, rejects, or asks for clarification. Nothing ships without a human decision.",
    bodyTh: "คนเป็นผู้อนุมัติ ปฏิเสธ หรือขอความชัดเจน ไม่มีอะไรถูกนำไปใช้โดยไม่มีคนตัดสินใจ",
  },
];

const CLAIMS: Array<{
  icon: IconName;
  en: string;
  th: string;
  bodyEn: string;
  bodyTh: string;
  item: string;
}> = [
  {
    icon: "quote",
    en: "Evidence, not guesses",
    th: "หลักฐานจริง ไม่ใช่การเดา",
    bodyEn: "Every requirement cites the exact excerpt it came from — verified against the source, not paraphrased.",
    bodyTh: "ทุกความต้องการอ้างอิงข้อความต้นฉบับที่แท้จริง ตรวจสอบตรงกับต้นฉบับ ไม่ใช่การถอดความ",
    item: "BR-001",
  },
  {
    icon: "warning",
    en: "Facts and assumptions, always marked",
    th: "ข้อเท็จจริงกับข้อสันนิษฐาน แยกให้เห็นชัดเสมอ",
    bodyEn:
      "An item the domain profile suggested but the source never said is labelled assumed, with no invented citation.",
    bodyTh: "รายการที่มาจากความรู้โดเมนแต่ต้นฉบับไม่ได้พูดถึง จะถูกระบุว่า assumed และไม่มีการสร้างการอ้างอิงปลอมขึ้นมา",
    item: "Q-002",
  },
  {
    icon: "search",
    en: "Missing information becomes a question",
    th: "ข้อมูลที่ขาดหายจะกลายเป็นคำถาม",
    bodyEn: "A policy nobody stated is raised for a stakeholder to answer — never silently filled in with a guess.",
    bodyTh: "นโยบายที่ไม่มีใครระบุไว้จะถูกตั้งเป็นคำถามให้ผู้มีส่วนได้เสียตอบ ไม่ใช่การเติมคำตอบขึ้นมาเงียบ ๆ",
    item: "Q-001",
  },
  {
    icon: "check",
    en: "Nothing is ever auto-approved",
    th: "ไม่มีอะไรถูกอนุมัติเองโดยอัตโนมัติ",
    bodyEn: "Every generated item starts as a draft. The analysis even flags gaps in its own output for a reviewer.",
    bodyTh: "ทุกรายการที่สร้างขึ้นเริ่มต้นเป็นฉบับร่างเสมอ ระบบยังชี้จุดที่ผลลัพธ์ของตัวเองยังไม่สมบูรณ์ให้ผู้ตรวจเห็นด้วย",
    item: "QF-001",
  },
];

export default function Home() {
  return (
    <div className="landing-evidence flex min-h-dvh flex-col">
      <SkipLink />
      <LandingHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 focus-visible:outline-2 focus-visible:outline-[var(--le-accent)] focus-visible:-outline-offset-2"
      >
        {/* ---------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden px-4 pb-10 pt-20 sm:px-8 sm:pt-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 size-[700px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(200,255,77,0.10) 0%, transparent 70%)" }}
          />
          <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--le-accent)]">
              <T en="Nothing here is invented" th="ไม่มีอะไรในนี้ถูกแต่งขึ้น" />
            </p>
            <h1 className="font-display text-[42px] font-bold leading-[0.98] tracking-tight text-[var(--le-text)] sm:text-[64px] md:text-[80px]">
              <T
                en={
                  <>
                    Meeting notes become
                    <br />
                    <span className="text-[var(--le-accent)]">provable</span> requirements.
                  </>
                }
                th={
                  <>
                    บันทึกการประชุมกลายเป็น
                    <br />
                    ความต้องการที่ <span className="text-[var(--le-accent)]">พิสูจน์ได้จริง</span>
                  </>
                }
              />
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--le-text-muted)] sm:text-lg">
              <T
                en="Every requirement carries the exact sentence it came from. Scroll down and watch one get made — this is the actual engine, not a mockup."
                th="ทุกความต้องการมีประโยคต้นฉบับกำกับไว้เสมอ เลื่อนลงไปดูขั้นตอนการสร้างจริง — นี่คือเอนจินตัวจริง ไม่ใช่ภาพจำลอง"
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="flex min-h-12 items-center gap-2 rounded-[4px] bg-[var(--le-accent)] px-6 text-sm font-bold text-[#08090b]
                           transition-opacity hover:opacity-90"
              >
                <T en="See the demo — no sign-up" th="ดู Demo — ไม่ต้องสมัคร" />
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/sign-in"
                className="flex min-h-12 items-center rounded-[4px] border border-[var(--le-border-strong)] px-5 text-sm font-medium
                           text-[var(--le-text)] transition-colors hover:bg-white/5"
              >
                <T en="Sign in" th="เข้าสู่ระบบ" />
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- evidence trail */}
        <section aria-label="How a requirement gets its evidence" className="et-trail-scroll relative">
          <div className="et-trail-pin flex min-h-[100vh] items-center px-4 py-16 sm:px-8">
            <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-0 lg:grid-cols-[1fr_auto_1fr]">
              {/* source excerpt */}
              <div>
                <p className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--le-text-faint)]">
                  <T en="01 — from the source" th="01 — จากต้นฉบับ" />
                </p>
                <div className="rounded-[6px] border border-[var(--le-border)] bg-white/[0.03] p-5 text-[13.5px] leading-[1.85] text-[var(--le-text-muted)]">
                  <span className="font-mono text-[11px] text-[var(--le-text-faint)]">
                    <T en="Meeting notes — Smart Space intake" th="บันทึกการประชุม — Smart Space" />
                  </span>
                  <p className="mt-2.5">
                    <T
                      en={
                        <>
                          Customers must be able to search available meeting rooms and complete a
                          booking through the app immediately.{" "}
                          <span className="et-highlight px-[3px] py-px text-[var(--le-text)]">
                            Front desk staff must be able to view the full booking schedule and
                            assist a walk-in customer who arrives without a reservation.
                          </span>
                        </>
                      }
                      th={
                        <>
                          ลูกค้าต้องสามารถค้นหาห้องประชุมที่ว่างและทำการจองผ่านแอปได้ทันที{" "}
                          <span className="et-highlight px-[3px] py-px text-[var(--le-text)]">
                            พนักงานหน้าเคาน์เตอร์ต้องสามารถเปิดดูตารางการจองทั้งหมด
                            และช่วยเหลือลูกค้าที่ walk-in เข้ามาโดยไม่ได้จองล่วงหน้า
                          </span>
                        </>
                      }
                    />
                  </p>
                </div>
              </div>

              {/* connector */}
              <div className="flex flex-col items-center justify-center gap-2 px-0 py-6 lg:px-3 lg:py-0">
                <div
                  aria-hidden="true"
                  className="et-connector-line h-24 w-0.5 border-l-2 border-dashed border-[var(--le-accent)] lg:h-0.5 lg:w-24 lg:border-l-0 lg:border-t-2"
                />
                <span className="font-mono text-[9.5px] whitespace-nowrap text-[var(--le-accent)]">
                  <T en="draws on scroll" th="ลากเมื่อเลื่อน" />
                </span>
              </div>

              {/* produced requirement — the real FR-001 from /demo */}
              <div>
                <p className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--le-text-faint)]">
                  <T en="02 — becomes a requirement" th="02 — กลายเป็นข้อกำหนด" />
                </p>
                <Link
                  href="/demo?item=FR-001"
                  className="et-req-card block rounded-[6px] border border-[var(--le-accent-border)] bg-[var(--le-accent-soft)] p-5
                             transition-colors hover:bg-white/[0.03]"
                  style={{ boxShadow: "0 0 40px rgba(200,255,77,0.08)" }}
                >
                  <div className="mb-2.5 flex items-baseline gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--le-accent)]">FR-001</span>
                    <span className="text-[10.5px] text-[var(--le-text-faint)]">
                      <T en="84% confidence" th="ความมั่นใจ 84%" />
                    </span>
                  </div>
                  <p className="font-display text-[17px] font-semibold leading-snug text-[var(--le-text)]">
                    <T
                      en="Front desk staff can view the full booking schedule and assist walk-ins"
                      th="พนักงานหน้าเคาน์เตอร์เปิดดูตารางการจองและช่วยลูกค้า walk-in ได้"
                    />
                  </p>
                  <div className="mt-3.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--le-accent)]">
                    <Icon name="check" size={13} />
                    <T en="Cited, not paraphrased — see it live" th="อ้างอิงจริง ไม่ใช่การถอดความ — ดูของจริง" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- screenshots */}
        <section className="border-t border-[var(--le-border)] px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="font-display text-2xl font-semibold text-[var(--le-text)]">
              <T en="See it working" th="ดูการทำงานจริง" />
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <Screenshot
                src="/screenshots/demo-requirement.jpg"
                item="BR-001"
                captionEn="Every requirement cites the exact sentence it came from."
                captionTh="ทุกความต้องการอ้างอิงประโยคต้นฉบับที่แท้จริง"
              />
              <Screenshot
                src="/screenshots/demo-open-question.jpg"
                item="Q-001"
                captionEn="A missing policy becomes a question — never a guess."
                captionTh="นโยบายที่ขาดหายไปกลายเป็นคำถาม ไม่ใช่การเดา"
              />
            </div>
            <p className="text-xs text-[var(--le-text-faint)]">
              <T
                en="Real output of the live analysis engine, from the public demo — not a mockup."
                th="ผลลัพธ์จริงจากเอนจินวิเคราะห์ที่ใช้งานได้จริง จากหน้า Demo สาธารณะ ไม่ใช่ภาพจำลอง"
              />
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- how it works */}
        <section className="border-t border-[var(--le-border)] px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="font-display text-2xl font-semibold text-[var(--le-text)]">
              <T en="How it works" th="ขั้นตอนการทำงาน" />
            </h2>
            <ol className="grid gap-5 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.en}
                  className="flex flex-col gap-3 rounded-[6px] border border-[var(--le-border)] bg-white/[0.02] p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-[var(--le-accent-soft)] text-[var(--le-accent)]"
                    >
                      <Icon name={step.icon} size={16} />
                    </span>
                    <span className="font-mono text-[11px] text-[var(--le-text-faint)]">{`0${index + 1}`}</span>
                    <h3 className="font-display text-sm font-semibold text-[var(--le-text)]">
                      <T en={step.en} th={step.th} />
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--le-text-muted)]">
                    <T en={step.bodyEn} th={step.bodyTh} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------- what makes it a BA tool */}
        <section className="border-t border-[var(--le-border)] px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-semibold text-[var(--le-text)]">
                <T en="A tool for a Business Analyst, not a chatbot" th="เครื่องมือสำหรับ Business Analyst ไม่ใช่แชตบอต" />
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-[var(--le-text-muted)]">
                <T
                  en="Every claim below is real and demonstrable — click one to open the exact item that proves it."
                  th="ทุกข้อด้านล่างเป็นเรื่องจริงและพิสูจน์ได้ — กดเพื่อเปิดรายการจริงที่ยืนยันข้อความนั้น"
                />
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {CLAIMS.map((claim) => (
                <li key={claim.item}>
                  <Link
                    href={`/demo?item=${claim.item}`}
                    className="group flex h-full flex-col gap-2.5 rounded-[6px] border border-[var(--le-border)] bg-white/[0.02] p-5
                               transition-colors hover:border-[var(--le-accent-border)] hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-[var(--le-accent-soft)] text-[var(--le-accent)]"
                      >
                        <Icon name={claim.icon} size={16} />
                      </span>
                      <h3 className="font-display text-sm font-semibold text-[var(--le-text)]">
                        <T en={claim.en} th={claim.th} />
                      </h3>
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--le-text-muted)]">
                      <T en={claim.bodyEn} th={claim.bodyTh} />
                    </p>
                    <span className="mt-auto flex items-center gap-1 pt-1 font-mono text-[11px] font-semibold text-[var(--le-accent)]">
                      <T en="See it in the demo" th="ดูตัวอย่างจริง" /> · {claim.item}
                      <Icon name="chevron-right" size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------------ stack */}
        <section className="border-t border-[var(--le-border)] px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--le-text)]">
              <T en="Built on" th="สร้างด้วย" />
            </h2>
            <p className="max-w-prose text-[13px] leading-relaxed text-[var(--le-text-muted)]">
              Next.js, TypeScript, Supabase (Postgres, Auth, Row-Level Security), and a
              validated AI-provider contract with a deterministic offline mode — the same
              engine this demo runs on, with no key and no network call.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- footer CTA */}
        <section
          className="border-t border-[var(--le-border)] px-4 py-20 sm:px-8"
          style={{ background: "linear-gradient(180deg, rgba(200,255,77,0.03), transparent)" }}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5">
            <h2 className="font-display text-[28px] font-semibold text-[var(--le-text)] sm:text-4xl">
              <T en="See the demo" th="ลองดู Demo" />
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="flex min-h-12 items-center gap-2 rounded-[4px] bg-[var(--le-accent)] px-6 text-sm font-bold text-[#08090b]
                           transition-opacity hover:opacity-90"
              >
                <T en="See the demo — no sign-up" th="ดู Demo — ไม่ต้องสมัคร" />
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/sign-up"
                className="flex min-h-12 items-center rounded-[4px] border border-[var(--le-border-strong)] px-5 text-sm font-medium
                           text-[var(--le-text)] transition-colors hover:bg-white/5"
              >
                <T en="Create an account" th="สร้างบัญชี" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * The landing page's own header — not `SiteHeader` (`app/_components/site-header.tsx`),
 * which `/demo` still uses unchanged. `SiteHeader` follows the app's light/dark toggle
 * via `--chrome`/`--text-faint` etc.; this page has one fixed dark look regardless of
 * that toggle, so reusing it would mean threading the app's theme system through a page
 * that deliberately doesn't use it. Same brand mark, same destinations, new paint.
 */
function LandingHeader() {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[var(--le-border)] px-4 py-3 sm:px-8">
      <Link href="/" className="flex min-h-11 items-center gap-2.5 lg:min-h-0">
        <span aria-hidden="true" className="size-5 shrink-0 rounded-[4px] bg-[var(--le-accent)]" />
        <span className="font-display text-[15px] font-semibold tracking-tight text-[var(--le-text)]">
          ReqWise AI
        </span>
      </Link>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <LandingLangToggle />
        <Link
          href="/sign-in"
          className="flex min-h-9 items-center rounded-[4px] border border-[var(--le-border-strong)] px-4 text-[13px] font-medium
                     text-[var(--le-text)] transition-colors hover:bg-white/5"
        >
          <T en="Sign in" th="เข้าสู่ระบบ" />
        </Link>
        <Link
          href="/demo"
          className="flex min-h-9 items-center rounded-[4px] border border-[var(--le-accent)] bg-[var(--le-accent)] px-4 text-[13px] font-bold
                     text-[#08090b] transition-opacity hover:opacity-90"
        >
          <T en="See the demo" th="ดู Demo" />
        </Link>
      </div>
    </header>
  );
}

function Screenshot({
  src,
  item,
  captionEn,
  captionTh,
}: {
  src: string;
  item: string;
  captionEn: string;
  captionTh: string;
}) {
  return (
    <Link href={`/demo?item=${item}`} className="group flex flex-col gap-2.5">
      <span className="overflow-hidden rounded-[6px] border border-[var(--le-border)] transition-colors group-hover:border-[var(--le-accent-border)]">
        <Image
          src={src}
          alt={captionEn}
          width={1568}
          height={759}
          className="w-full"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
      </span>
      <p className="text-[13px] leading-relaxed text-[var(--le-text-muted)]">
        <T en={captionEn} th={captionTh} />
      </p>
    </Link>
  );
}
