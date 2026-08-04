/**
 * Start a project.
 *
 * One screen: name, text, submit — the project, its first source and its first
 * analysis are all created by the one action behind `StartProjectForm`. There is no
 * "next step" any more, which is why this page no longer promises one.
 *
 * The domain options come from the database — `domain_profiles` is the runtime source
 * of truth, and the TypeScript profiles under `lib/domain/profiles/` are the authoring
 * source that generates the seed. Importing them here would quietly reintroduce the
 * second source of truth this project just spent a slice removing.
 */

import Link from "next/link";
import { T } from "@/app/_components/t";
import { createClient } from "@/lib/supabase/server";
import { listDomainProfileOptions } from "@/lib/domain/load-profile";
import { CUSTOM_DOMAIN_PLACEHOLDER, isDomainSupported } from "@/lib/domain/availability";
import { TryExampleButton } from "../example-button";
import { StartProjectForm, type DomainOption } from "./start-form";

export const metadata = { title: "Start a project — ReqWise AI" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const profiles = await listDomainProfileOptions(supabase);

  const domains: DomainOption[] = [
    ...profiles.map((profile) => ({
      id: profile.id,
      key: profile.key,
      name: profile.name,
      description: profile.description,
      supported: isDomainSupported(profile.key),
    })),
    {
      // No row exists for this one, and the custom-domain editor is out of scope —
      // it is listed so the domain layer is visible, and disabled so it cannot be used.
      id: CUSTOM_DOMAIN_PLACEHOLDER.key,
      key: CUSTOM_DOMAIN_PLACEHOLDER.key,
      name: CUSTOM_DOMAIN_PLACEHOLDER.name,
      description: CUSTOM_DOMAIN_PLACEHOLDER.description,
      supported: false,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/workspace/projects"
          className="w-fit text-xs text-text-faint transition-colors hover:text-text-muted"
        >
          ← <T en="Projects" th="โปรเจกต์" />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T en="Start a project" th="เริ่มโปรเจกต์" />
        </h1>
        <p className="max-w-prose text-sm text-text-muted">
          <T
            en="Name the work and paste the raw business information. Submitting creates the project, stores the text and runs the first analysis — one screen, one click."
            th="ตั้งชื่องานแล้ววางข้อมูลธุรกิจดิบ ๆ ลงไป เมื่อกดส่ง ระบบจะสร้างโปรเจกต์ เก็บข้อความ และวิเคราะห์รอบแรกให้ทันที — หนึ่งหน้าจอ หนึ่งคลิก"
          />
        </p>

        {error === "example" ? (
          <p
            role="alert"
            className="max-w-prose rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            <T
              en="The example could not be created — its domain profile is missing from this workspace."
              th="สร้างตัวอย่างไม่สำเร็จ — ไม่พบโดเมนโปรไฟล์ของตัวอย่างใน workspace นี้"
            />
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border-soft pt-3 sm:flex-row sm:items-center sm:gap-3">
          <p className="text-xs text-text-muted">
            <T
              en="Nothing to paste yet?"
              th="ยังไม่มีข้อความจะวาง?"
            />
          </p>
          <TryExampleButton />
        </div>
      </header>

      <StartProjectForm domains={domains} />
    </main>
  );
}
