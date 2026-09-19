/**
 * A tiny in-memory stand-in for the parts of the Supabase client the loaders and
 * services use.
 *
 * It **applies** filters, ordering, limits and writes rather than replaying a canned
 * answer, which is what makes "the active filter does not return archived projects" or
 * "the revision payload uses the previous revision from the database" a real assertion
 * instead of a restatement of the fixture.
 *
 * It deliberately models no permissions and no triggers: RLS, the archive guard and
 * the lock are the database's job and are proven against the real database in
 * `scripts/verify-projects.mts` and `scripts/verify-sources.mts`. What is proven here
 * is the shape of the request this layer sends and the shape it maps back.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

type Result = { data: unknown; error: { message: string } | null; count: number | null };

type Sort = { column: string; ascending: boolean };

class FakeQuery implements PromiseLike<Result> {
  private filters: Array<[string, unknown]> = [];
  /** Each entry is one `.or(...)` call's comma-separated conditions, ANDed with every
   * other filter/or-group; a row must match at least one condition within each group. */
  private orGroups: Array<Array<[string, unknown]>> = [];
  private sort: Sort | null = null;
  private max: number | null = null;
  private wantsCount = false;
  private headOnly = false;
  private singleMode: "none" | "maybe" | "one" = "none";
  private write: { kind: "insert" | "update"; payload: Row } | null = null;

  constructor(
    private readonly table: string,
    private readonly rows: Row[],
    private readonly failWith: string | null,
    private readonly writes: Array<{ table: string; kind: string; payload: Row }>,
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.wantsCount = options?.count === "exact";
    this.headOnly = options?.head === true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  /** `null` behaves like `.eq(column, null)` — strict equality already covers it. */
  is(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push([column, { __in: values }]);
    return this;
  }

  /** Only the subset of PostgREST's `.or()` syntax this codebase actually uses:
   * comma-separated `column.eq.value` / `column.is.null` conditions, OR'd together. */
  or(filterString: string) {
    const conditions = filterString.split(",").map((raw): [string, unknown] => {
      const [column, , ...rest] = raw.split(".");
      const rawValue = rest.join(".");
      return [column, rawValue === "null" ? null : rawValue];
    });
    this.orGroups.push(conditions);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(n: number) {
    this.max = n;
    return this;
  }

  insert(payload: Row) {
    this.write = { kind: "insert", payload };
    return this;
  }

  update(payload: Row) {
    this.write = { kind: "update", payload };
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "one";
    return this;
  }

  private matched(): Row[] {
    let rows = this.rows.filter(
      (row) =>
        this.filters.every(([col, value]) => {
          if (value && typeof value === "object" && "__in" in (value as object)) {
            return (value as { __in: unknown[] }).__in.includes(row[col]);
          }
          return row[col] === value;
        }) && this.orGroups.every((group) => group.some(([col, value]) => row[col] === value)),
    );

    if (this.sort) {
      const { column, ascending } = this.sort;
      rows = [...rows].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    return this.max === null ? rows : rows.slice(0, this.max);
  }

  private apply(): Row[] {
    if (!this.write) return this.matched();

    if (this.write.kind === "insert") {
      const row: Row = { id: `generated-${this.writes.length + 1}`, ...this.write.payload };
      this.writes.push({ table: this.table, kind: "insert", payload: this.write.payload });
      this.rows.push(row);
      return [row];
    }

    const targets = this.matched();
    this.writes.push({ table: this.table, kind: "update", payload: this.write.payload });
    for (const row of targets) Object.assign(row, this.write.payload);
    return targets;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const settle = (): Result => {
      if (this.failWith) return { data: null, error: { message: this.failWith }, count: null };

      const rows = this.apply();
      if (this.headOnly) return { data: null, error: null, count: rows.length };

      if (this.singleMode !== "none") {
        const first = rows[0] ?? null;
        if (this.singleMode === "one" && !first) {
          return { data: null, error: { message: "no rows returned" }, count: null };
        }
        return { data: first, error: null, count: this.wantsCount ? rows.length : null };
      }
      return { data: rows, error: null, count: this.wantsCount ? rows.length : null };
    };
    return Promise.resolve(settle()).then(onfulfilled, onrejected);
  }
}

export type FakeClient = SupabaseClient & {
  /** Every write the code under test issued, in order. */
  writes: Array<{ table: string; kind: string; payload: Row }>;
  /** Every RPC the code under test called, in order. */
  rpcCalls: Array<{ name: string; args: Row }>;
};

export function fakeSupabase(
  tables: Record<string, Row[]>,
  options: {
    failTable?: string;
    failWith?: string;
    userId?: string | null;
    /** Included on the fake user returned by `auth.getUser()` when `userId` is set —
     * only `lib/admin/guard.ts`'s tests need this; every other caller ignores it. */
    userEmail?: string;
    /** Canned response for `client.rpc(name, args)`, keyed by function name. */
    rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  } = {},
): FakeClient {
  const writes: Array<{ table: string; kind: string; payload: Row }> = [];
  const rpcCalls: Array<{ name: string; args: Row }> = [];
  const userId = options.userId === undefined ? "user-1" : options.userId;

  return {
    writes,
    rpcCalls,
    from(table: string) {
      const failWith = options.failTable === table ? (options.failWith ?? "boom") : null;
      tables[table] ??= [];
      return new FakeQuery(table, tables[table], failWith, writes);
    },
    async rpc(name: string, args: Row = {}) {
      rpcCalls.push({ name, args });
      const canned = options.rpc?.[name];
      return canned ?? { data: null, error: { message: `no fake response configured for rpc "${name}"` } };
    },
    auth: {
      async getUser() {
        const user = userId ? { id: userId, email: options.userEmail } : null;
        return { data: { user }, error: null };
      },
    },
  } as unknown as FakeClient;
}
