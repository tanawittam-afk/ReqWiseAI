import Link from "next/link";
import { T } from "@/app/_components/t";

/**
 * One page for "no such project" and "not yours". Saying anything more precise would
 * confirm the existence of another tenant's project.
 */
export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">
        <T en="Project not found" th="ไม่พบโปรเจกต์" />
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        <T
          en="This project does not exist, or it is not part of your workspace."
          th="ไม่มีโปรเจกต์นี้อยู่ หรือไม่ได้เป็นส่วนหนึ่งของพื้นที่ทำงานของคุณ"
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
