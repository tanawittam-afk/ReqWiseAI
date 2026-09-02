"use client";

/**
 * The database-error state for everything under /sources. The thrown error is logged,
 * never rendered — a Postgres message carries table and policy names that are nobody's
 * business on screen.
 */

import { useEffect } from "react";
import { T } from "@/app/_components/t";

export default function SourcesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sources] render failed", error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">
        <T en="Sources could not be loaded" th="โหลดเอกสารต้นฉบับไม่สำเร็จ" />
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        <T
          en="Something went wrong reading this project's documents. Nothing was changed — this is a display problem, not a data one."
          th="เกิดข้อผิดพลาดขณะอ่านเอกสารของโปรเจกต์นี้ ไม่มีอะไรถูกเปลี่ยนแปลง — นี่เป็นปัญหาการแสดงผล ไม่ใช่ปัญหาข้อมูล"
        />
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-3 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:min-h-9"
      >
        <T en="Try again" th="ลองอีกครั้ง" />
      </button>
    </main>
  );
}
