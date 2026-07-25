/**
 * Version history and the review timeline.
 *
 * The subtle part is not the comparison, it is *what each snapshot is compared with*.
 * `item_versions` stores the state BEFORE an edit, so version N's row must be read
 * against version N+1's row — and the newest row against the live item, which is not
 * in the table at all. Getting that off by one produces a history that is wrong in the
 * most convincing possible way: every line looks plausible and every line is shifted.
 */

import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../fake-supabase";
import {
  activityLabel,
  buildItemHistory,
  diffFields,
  getRunHistory,
} from "../../lib/review/history";

function version(versionNo: number, snapshot: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    item_id: "item-1",
    version_no: versionNo,
    snapshot,
    changed_by: "user-1",
    change_reason: null,
    created_at: `2026-07-2${versionNo}T00:00:00.000Z`,
    ...extra,
  };
}

const live = { title: "v3 title", description: "v3 body", priority: "critical" };

describe("diffFields", () => {
  it("reports only the fields that actually differ", () => {
    expect(
      diffFields(
        { title: "a", description: "b", priority: "low" },
        { title: "a", description: "B", priority: "high" },
      ),
    ).toEqual(["description", "priority"]);
  });

  it("reports nothing when nothing changed", () => {
    const state = { title: "a", description: "b", priority: "low" };
    expect(diffFields(state, state)).toEqual([]);
  });
});

describe("buildItemHistory", () => {
  const rows = [
    version(1, { title: "v1 title", description: "v1 body", priority: "medium", status: "draft" }),
    version(2, { title: "v2 title", description: "v1 body", priority: "medium", status: "reviewed" }),
  ];

  it("orders versions newest first regardless of the order they arrive in", () => {
    const history = buildItemHistory([rows[0], rows[1]], [], live);
    expect(history.versions.map((v) => v.versionNo)).toEqual([2, 1]);

    const reversed = buildItemHistory([rows[1], rows[0]], [], live);
    expect(reversed.versions.map((v) => v.versionNo)).toEqual([2, 1]);
  });

  it("compares the newest snapshot against the LIVE item, not against itself", () => {
    const history = buildItemHistory(rows, [], live);
    // v2 held "v2 title"/"v1 body"/medium; the live item is "v3 title"/"v3 body"/critical.
    expect(history.versions[0].changedFields).toEqual(["title", "description", "priority"]);
  });

  it("compares an older snapshot against the version that replaced it", () => {
    const history = buildItemHistory(rows, [], live);
    // v1 -> v2 changed only the title.
    expect(history.versions[1].changedFields).toEqual(["title"]);
  });

  it("keeps the review status the item held at the time of each snapshot", () => {
    const history = buildItemHistory(rows, [], live);
    expect(history.versions[0].status).toBe("reviewed");
    expect(history.versions[1].status).toBe("draft");
  });

  it("survives a snapshot missing a field rather than rendering 'undefined'", () => {
    const history = buildItemHistory([version(1, { title: "only a title" })], [], live);
    expect(history.versions[0].description).toBe("");
    expect(history.versions[0].priority).toBe("");
  });

  it("orders activities newest first", () => {
    const activities = [
      {
        id: "a1",
        activity_type: "status_change",
        from_status: "draft" as const,
        to_status: "reviewed" as const,
        actor_id: "user-1",
        comment: null,
        created_at: "2026-07-21T00:00:00.000Z",
      },
      {
        id: "a2",
        activity_type: "approve",
        from_status: "reviewed" as const,
        to_status: "approved" as const,
        actor_id: "user-1",
        comment: null,
        created_at: "2026-07-23T00:00:00.000Z",
      },
    ];
    const history = buildItemHistory([], activities, live);
    expect(history.versions).toEqual([]);
    expect(history.activities.map((a) => a.id)).toEqual(["a2", "a1"]);
  });
});

describe("getRunHistory", () => {
  it("returns an entry for every item, including items with no history at all", async () => {
    const client = fakeSupabase({
      item_versions: [
        { ...version(1, { title: "old", description: "d", priority: "low", status: "draft" }), project_id: "p1" },
      ],
      review_activities: [
        {
          id: "a1",
          item_id: "item-1",
          project_id: "p1",
          activity_type: "status_change",
          from_status: "draft",
          to_status: "reviewed",
          actor_id: "user-1",
          comment: null,
          created_at: "2026-07-21T00:00:00.000Z",
        },
      ],
    });

    const history = await getRunHistory(client, "p1", [
      { id: "item-1", title: "new", description: "d", priority: "low" },
      { id: "item-2", title: "untouched", description: "d", priority: "low" },
    ]);

    expect(Object.keys(history).sort()).toEqual(["item-1", "item-2"]);
    expect(history["item-1"].versions).toHaveLength(1);
    expect(history["item-1"].versions[0].changedFields).toEqual(["title"]);
    expect(history["item-1"].activities).toHaveLength(1);
    expect(history["item-2"].versions).toEqual([]);
    expect(history["item-2"].activities).toEqual([]);
  });

  it("does not query at all for an empty run", async () => {
    const client = fakeSupabase({});
    expect(await getRunHistory(client, "p1", [])).toEqual({});
  });

  it("scopes both queries to the route's project", async () => {
    const client = fakeSupabase({
      item_versions: [
        { ...version(1, { title: "other tenant" }), project_id: "p2" },
      ],
      review_activities: [],
    });
    const history = await getRunHistory(client, "p1", [
      { id: "item-1", title: "mine", description: "", priority: "low" },
    ]);
    expect(history["item-1"].versions).toEqual([]);
  });
});

describe("activityLabel", () => {
  it("gives every recorded action a human sentence, never a bare enum", () => {
    const cases: Array<[{ activityType: string; fromStatus: string | null; toStatus: string | null }, string]> = [
      [{ activityType: "status_change", fromStatus: "draft", toStatus: "reviewed" }, "Marked as reviewed"],
      [
        { activityType: "request_clarification", fromStatus: "draft", toStatus: "needs_clarification" },
        "Requested clarification",
      ],
      [{ activityType: "approve", fromStatus: "reviewed", toStatus: "approved" }, "Approved"],
      [{ activityType: "reject", fromStatus: "draft", toStatus: "rejected" }, "Rejected"],
      [{ activityType: "edit", fromStatus: "reviewed", toStatus: "draft" }, "Returned to draft after edit"],
      [{ activityType: "comment", fromStatus: null, toStatus: null }, "Comment"],
    ];
    for (const [activity, expected] of cases) {
      expect(activityLabel(activity)).toBe(expected);
    }
  });

  it("never returns a raw database enum value", () => {
    for (const activityType of ["status_change", "priority_change", "edit", "comment"]) {
      const label = activityLabel({ activityType, fromStatus: "draft", toStatus: "draft" });
      expect(label).not.toMatch(/_/);
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});
