/**
 * The landing page. Rewritten in Phase 3 of the 2026-08-03 UX/UI plan from a heading,
 * three lines and one button into a real introduction — the first thing a recruiter or
 * a non-technical visitor sees, and previously said nothing.
 *
 * Deliberately static: no `getUser()` call. The previous version read the session only
 * to choose one button's label ("Open workspace" vs "Sign in"); dropping that keeps
 * this page free of any Supabase round trip, and a signed-in visitor who clicks "Sign
 * in" anyway lands on `/workspace` regardless — `proxy.ts` already redirects a
 * signed-in visitor away from `/sign-in`. This is a deliberate behaviour change, not an
 * oversight.
 *
 * Every screenshot here is captured from `/demo` (Phase 2), which by construction
 * contains no real user's data — never a screenshot of an authenticated session.
 * Every claim in the "not a chatbot" section links to the exact demo item that proves
 * it, via `/demo?item=<display id>`.
 *
 * Tech tone continuous with the rest of the app — same tokens, same fonts, hairline
 * borders, no shadow, no gradient, no glassmorphism, no invented metric
 * (docs/design/INTERFACE.md §9's avoid-list applies here too, not only inside
 * `/workspace`).
 */

import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "./_components/site-header";
import { T } from "./_components/t";
import { Icon, type IconName } from "./_components/icon";

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
    <div className="flex min-h-dvh flex-col bg-app">
      <SiteHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2">
        {/* ---------------------------------------------------------------- hero */}
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-faint">
            <T en="AI-assisted requirements analysis" th="การวิเคราะห์ความต้องการด้วย AI" />
          </p>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-text sm:text-[34px]">
            <T
              en="Meeting notes go in. Traceable, reviewable requirements come out."
              th="ป้อนบันทึกการประชุมเข้าไป แล้วได้ความต้องการที่ตรวจสอบย้อนกลับได้และพร้อมให้รีวิว"
            />
          </h1>
          <p className="max-w-prose text-[15px] leading-relaxed text-text-muted">
            <T
              en="Every requirement carries the exact sentence it came from. Facts and assumptions are always marked apart. Nothing is approved without a person."
              th="ทุกความต้องการมีประโยคต้นฉบับกำกับไว้เสมอ ข้อเท็จจริงกับข้อสันนิษฐานถูกแยกให้เห็นชัดตลอด และไม่มีอะไรได้รับการอนุมัติโดยไม่ผ่านคน"
            />
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent
                         transition-colors hover:bg-accent-hover"
            >
              <T en="See the demo — no sign-up" th="ดู Demo — ไม่ต้องสมัคร" />
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link
              href="/sign-in"
              className="flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-4 text-sm font-medium
                         text-text transition-colors hover:bg-surface-hover"
            >
              <T en="Sign in" th="เข้าสู่ระบบ" />
            </Link>
          </div>
        </section>

        {/* --------------------------------------------------------- screenshots */}
        <section className="border-t border-border-soft bg-chrome px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="font-display text-lg font-semibold text-text">
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
            <p className="text-xs text-text-faint">
              <T
                en="Real output of the live analysis engine, from the public demo — not a mockup."
                th="ผลลัพธ์จริงจากเอนจินวิเคราะห์ที่ใช้งานได้จริง จากหน้า Demo สาธารณะ ไม่ใช่ภาพจำลอง"
              />
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- how it works */}
        <section className="border-t border-border-soft px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="font-display text-lg font-semibold text-text">
              <T en="How it works" th="ขั้นตอนการทำงาน" />
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.en}
                  className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)] bg-accent-soft text-accent"
                    >
                      <Icon name={step.icon} size={16} />
                    </span>
                    <span className="font-mono text-[11px] text-text-faint">{`0${index + 1}`}</span>
                    <h3 className="font-display text-sm font-semibold text-text">
                      <T en={step.en} th={step.th} />
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-text-muted">
                    <T en={step.bodyEn} th={step.bodyTh} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------- what makes it a BA tool */}
        <section className="border-t border-border-soft bg-chrome px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-semibold text-text">
                <T en="A tool for a Business Analyst, not a chatbot" th="เครื่องมือสำหรับ Business Analyst ไม่ใช่แชตบอต" />
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-text-muted">
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
                    className="group flex h-full flex-col gap-2.5 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-5
                               transition-colors hover:border-accent-border hover:bg-accent-soft"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)] bg-accent-soft text-accent
                                   transition-colors group-hover:bg-surface"
                      >
                        <Icon name={claim.icon} size={16} />
                      </span>
                      <h3 className="font-display text-sm font-semibold text-text">
                        <T en={claim.en} th={claim.th} />
                      </h3>
                    </div>
                    <p className="text-[13px] leading-relaxed text-text-muted">
                      <T en={claim.bodyEn} th={claim.bodyTh} />
                    </p>
                    <span className="mt-auto flex items-center gap-1 pt-1 font-mono text-[11px] font-medium text-accent">
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
        <section className="border-t border-border-soft px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-text">
              <T en="Built on" th="สร้างด้วย" />
            </h2>
            <p className="max-w-prose text-[13px] leading-relaxed text-text-muted">
              Next.js, TypeScript, Supabase (Postgres, Auth, Row-Level Security), and a
              validated AI-provider contract with a deterministic offline mode — the same
              engine this demo runs on, with no key and no network call.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- footer CTA */}
        <section className="border-t border-border-soft bg-chrome px-4 py-14 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4">
            <h2 className="font-display text-xl font-semibold text-text">
              <T en="See the demo" th="ลองดู Demo" />
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent
                           transition-colors hover:bg-accent-hover"
              >
                <T en="See the demo — no sign-up" th="ดู Demo — ไม่ต้องสมัคร" />
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/sign-up"
                className="flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-4 text-sm font-medium
                           text-text transition-colors hover:bg-surface-hover"
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
      <span className="overflow-hidden rounded-[var(--radius-panel)] border border-border-soft transition-colors group-hover:border-accent-border">
        <Image
          src={src}
          alt={captionEn}
          width={1568}
          height={759}
          className="w-full"
          sizes="(min-width: 640px) 50vw, 100vw"
        />
      </span>
      <p className="text-[13px] leading-relaxed text-text-muted">
        <T en={captionEn} th={captionTh} />
      </p>
    </Link>
  );
}
