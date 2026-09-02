import Link from "next/link";
import { T } from "@/app/_components/t";

/**
 * One page for "no such source", "not in this project" and "not yours". Distinguishing
 * them would confirm that another tenant's document exists.
 */
export default function SourceNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">
        <T en="Source not found" th="ไม่พบเอกสารต้นฉบับ" />
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        <T
          en="This document does not exist, or it is not part of this project."
          th="ไม่มีเอกสารนี้อยู่ หรือเอกสารนี้ไม่ได้เป็นส่วนหนึ่งของโปรเจกต์นี้"
        />
      </p>
      <Link
        href="/workspace/projects"
        className="rounded-[var(--radius-card)] border border-border-soft px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <T en="Back to projects" th="กลับไปที่โปรเจกต์" />
      </Link>
    </main>
  );
}
