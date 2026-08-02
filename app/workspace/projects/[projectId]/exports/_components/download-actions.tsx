"use client";

/**
 * The download and print actions.
 *
 * Each download is an ordinary link to the route handler, which is what makes the file
 * arrive through the browser's own download machinery — no blob, no `fetch`, no copy of
 * the document held in memory in a tab.
 *
 * About the "Preparing…" state: a browser gives a page **no event** when a download
 * initiated by a link finishes, so the busy state is deliberately time-based. It exists to
 * stop a double-click producing two requests for the same large document, and it says so
 * rather than pretending to track progress. Nothing about the file depends on it — the
 * request is already on its way.
 *
 * Every action shows the exact filename it will produce. A downloads folder is where
 * exports get lost, and a name previewed before the click is the cheapest fix.
 */

import Link from "next/link";
import { useState } from "react";
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABEL,
  exportFilename,
  type ExportFormat,
} from "@/lib/export/filenames";

const BUSY_MS = 2500;

export function DownloadActions({
  projectId,
  slug,
  query,
  disabled,
}: {
  projectId: string;
  slug: string;
  /** The scope, already serialised — the same string the printable page receives. */
  query: string;
  /** True when readiness blocks the export. The links are not rendered at all. */
  disabled: boolean;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const base = `/workspace/projects/${projectId}/exports`;

  if (disabled) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2.5 text-[13px] text-text-muted">
        Downloads are unavailable until the blocking problems above are resolved. The
        printable view is unavailable for the same reason.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {EXPORT_FORMATS.map((format) => {
        const filename = exportFilename(slug, format);
        const isBusy = busy === format;
        return (
          <a
            key={format}
            href={`${base}/download/${format}?${query}`}
            // `download` asks the browser to save rather than navigate; the route handler
            // sets Content-Disposition as well, so the two agree.
            download={filename}
            onClick={() => {
              if (isBusy) return;
              setBusy(format);
              window.setTimeout(() => setBusy((current) => (current === format ? null : current)), BUSY_MS);
            }}
            aria-disabled={isBusy}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border-soft
                        bg-surface px-3 py-2 transition-colors hover:bg-surface-hover
                        ${isBusy ? "pointer-events-none opacity-60" : ""}`}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-text">{EXPORT_FORMAT_LABEL[format]}</span>
              <span className="truncate font-mono text-xs text-text-faint">{filename}</span>
            </span>
            <span className="shrink-0 text-xs text-text-faint">
              {isBusy ? "Preparing…" : "Download"}
            </span>
          </a>
        );
      })}

      <Link
        href={`${base}/print?${query}`}
        target="_blank"
        rel="noopener"
        className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-accent-border
                   bg-accent-soft px-3 py-2 transition-colors hover:bg-surface-hover"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-text">Printable version</span>
          <span className="text-xs text-text-faint">
            Opens in a new tab · print or save as PDF from the browser
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-text-faint">
          ↗
        </span>
      </Link>

      <p className="text-xs leading-relaxed text-text-faint">
        Nothing is saved when you export. Each download is generated from the project as it
        is right now.
      </p>
    </div>
  );
}
