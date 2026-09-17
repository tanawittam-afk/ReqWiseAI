/**
 * `StartProjectForm` — static-markup checks for the privacy notice shown before every
 * analysis (Phase 1, Slice 2). Mirrors `tests/providers/selection.test.ts`'s approach:
 * `renderToStaticMarkup` against the real component, no snapshot.
 *
 * `StartProjectForm` imports the server action `startProjectAction` from
 * `app/workspace/projects/actions.ts` (a `"use server"` file) purely to wire the
 * `<form action=...>` prop — this render never invokes it, but the module import chain
 * still runs, so the same collaborators `start-project-action.test.ts` mocks
 * (`next/navigation`, `next/cache`, `@/lib/supabase/server`) are mocked here too.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ __fake: "supabase-client" })),
}));

const { StartProjectForm } = await import("../../app/workspace/projects/new/start-form");

describe("start project form — privacy notice", () => {
  it("shows the privacy notice near the submit button, every time, non-blocking", () => {
    const html = renderToStaticMarkup(
      createElement(StartProjectForm, {
        domains: [
          { id: "d1", key: "booking", name: "Booking", description: "Booking domain", supported: true },
        ],
        dailyUsage: { used: 0, remaining: 10, limit: 10 },
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Remove names and confidential details before analysing");
    // Non-blocking: no checkbox/consent input introduced by the notice.
    expect(html).not.toMatch(/type="checkbox"/);
  });
});
