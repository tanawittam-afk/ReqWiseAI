import { describe, expect, it } from "vitest";
import { createDisplayIdAllocator } from "../../lib/normalization/ports";

describe("display id allocator", () => {
  it("numbers per type independently", () => {
    const alloc = createDisplayIdAllocator();
    expect(alloc.allocate("business_requirement")).toBe("BR-001");
    expect(alloc.allocate("business_requirement")).toBe("BR-002");
    expect(alloc.allocate("functional_requirement")).toBe("FR-001");
    expect(alloc.allocate("business_requirement")).toBe("BR-003");
  });

  it("continues numbering from a project's existing high-water mark", () => {
    // This is how the DB-backed implementation must behave: no reuse, gaps preserved.
    const alloc = createDisplayIdAllocator({ startAt: { functional_requirement: 3 } });
    expect(alloc.allocate("functional_requirement")).toBe("FR-004");
  });

  it("respects a custom padding", () => {
    const alloc = createDisplayIdAllocator({ padding: 4 });
    expect(alloc.allocate("risk")).toBe("RISK-0001");
  });
});
