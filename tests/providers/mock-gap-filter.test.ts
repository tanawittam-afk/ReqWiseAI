import { describe, expect, it } from "vitest";
import { filterGapCandidates } from "../../lib/providers/mock/runtime/gap-filter";

describe("filterGapCandidates (mock provider)", () => {
  it("keeps a genuine, substantial candidate as a gap", () => {
    const { results } = filterGapCandidates([
      { key: "gap-0", text: "The team has not yet agreed on the refund policy." },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].is_gap).toBe(true);
    expect(results[0].title).toBeDefined();
    expect(results[0].description).toBeDefined();
  });

  it("drops a short fragment as noise", () => {
    const { results } = filterGapCandidates([{ key: "gap-0", text: "Ok" }]);
    expect(results[0]).toEqual({ key: "gap-0", is_gap: false });
  });

  it("drops an English greeting/logistics candidate", () => {
    const { results } = filterGapCandidates([
      { key: "gap-0", text: "Good morning everyone, thanks for joining today." },
    ]);
    expect(results[0].is_gap).toBe(false);
  });

  it("drops a Thai greeting/attendee-list candidate", () => {
    const { results } = filterGapCandidates([
      { key: "gap-0", text: "สวัสดีค่ะ ขอบคุณที่มาประชุมกันวันนี้" },
    ]);
    expect(results[0].is_gap).toBe(false);
  });

  it("is deterministic — same input, byte-identical output", () => {
    const candidates = [
      { key: "gap-0", text: "A real requirement gap about consent." },
      { key: "gap-1", text: "Good afternoon team." },
    ];
    expect(filterGapCandidates(candidates)).toEqual(filterGapCandidates(candidates));
  });

  it("returns exactly one result per candidate, in order, by key", () => {
    const candidates = [
      { key: "gap-0", text: "A genuine unaddressed topic worth reviewing." },
      { key: "gap-1", text: "Hi" },
      { key: "gap-2", text: "Another genuine unaddressed topic here." },
    ];
    const { results } = filterGapCandidates(candidates);
    expect(results.map((r) => r.key)).toEqual(["gap-0", "gap-1", "gap-2"]);
  });
});
