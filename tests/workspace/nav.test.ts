/**
 * Which navigation entry is current.
 *
 * This rule earned its own test because the previous one was wrong in a way nothing
 * caught: `pathname.startsWith(item.href)` lit **Projects** up on every page below
 * `/workspace/projects` — every analysis workspace, source and export screen — and the
 * bug survived several slices because a highlighted-but-wrong tab still looks like a
 * working sidebar.
 */

import { describe, expect, it } from "vitest";
import { isActiveNav } from "../../lib/workspace/nav";

const DASHBOARD = { href: "/workspace/dashboard", aliases: ["/workspace"] };
const PROJECTS = { href: "/workspace/projects", ownsSubtree: true };
const REQUIREMENTS = { href: "/workspace/requirements" };

describe("isActiveNav", () => {
  it("matches an entry on its own path", () => {
    expect(isActiveNav("/workspace/requirements", REQUIREMENTS)).toBe(true);
  });

  it("does not match a different entry", () => {
    expect(isActiveNav("/workspace/requirements", PROJECTS)).toBe(false);
  });

  it("keeps Projects lit under its own subtree — a run has no entry of its own", () => {
    for (const pathname of [
      "/workspace/projects/abc",
      "/workspace/projects/abc/sources",
      "/workspace/projects/abc/sources/def/analyze",
      "/workspace/projects/abc/analyses/run-1",
      "/workspace/projects/abc/exports/preview",
      "/workspace/projects/new",
    ]) {
      expect(isActiveNav(pathname, PROJECTS), pathname).toBe(true);
    }
  });

  it("does not let a subtree owner claim a sibling with the same prefix", () => {
    expect(isActiveNav("/workspace/projects-archive", PROJECTS)).toBe(false);
  });

  it("does not let an entry without ownsSubtree claim anything below it", () => {
    expect(isActiveNav("/workspace/requirements/anything", REQUIREMENTS)).toBe(false);
  });

  it("treats an alias as an exact match, never as a prefix", () => {
    expect(isActiveNav("/workspace", DASHBOARD)).toBe(true);
    // The regression the old rule would have produced: `/workspace` as a prefix would
    // make Dashboard active on every page in the application at once.
    expect(isActiveNav("/workspace/projects/abc", DASHBOARD)).toBe(false);
    expect(isActiveNav("/workspace/settings", DASHBOARD)).toBe(false);
  });

  it("lights exactly one of the five entries on every real workspace path", () => {
    const items = [
      DASHBOARD,
      PROJECTS,
      REQUIREMENTS,
      { href: "/workspace/reviews" },
      { href: "/workspace/settings" },
    ];
    const paths = [
      "/workspace",
      "/workspace/dashboard",
      "/workspace/projects",
      "/workspace/projects/abc/analyses/run-1",
      "/workspace/requirements",
      "/workspace/reviews",
      "/workspace/settings",
    ];
    for (const pathname of paths) {
      const lit = items.filter((item) => isActiveNav(pathname, item));
      expect(lit, pathname).toHaveLength(1);
    }
  });
});
