/**
 * A tiny in-memory stand-in for the parts of the Supabase client the project queries
 * use.
 *
 * It **applies** the `eq` filters rather than replaying a canned answer, which is what
 * makes "the active filter does not return archived projects" a real assertion instead
 * of a restatement of the fixture. It deliberately models no permissions: RLS is the
 * database's job and is proven against the real database in
 * `scripts/verify-projects.mts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

type Result = { data: unknown; error: { message: string } | null; count: number | null };

class FakeQuery implements PromiseLike<Result> {
  private filters: Array<[string, unknown]> = [];
  private wantsCount = false;
  private headOnly = false;
  private single: "none" | "maybe" = "none";

  constructor(
    private readonly rows: Row[],
    private readonly failWith: string | null,
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

  // Ordering and limiting do not change which rows match, so the fake accepts them
  // and ignores them rather than pretending to sort.
  order(column: string, options?: { ascending?: boolean }) {
    void column;
    void options;
    return this;
  }

  limit(n: number) {
    void n;
    return this;
  }

  maybeSingle() {
    this.single = "maybe";
    return this;
  }

  private matched(): Row[] {
    return this.rows.filter((row) => this.filters.every(([col, value]) => row[col] === value));
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const settle = (): Result => {
      if (this.failWith) return { data: null, error: { message: this.failWith }, count: null };
      const matched = this.matched();
      if (this.headOnly) return { data: null, error: null, count: matched.length };
      if (this.single === "maybe") {
        return { data: matched[0] ?? null, error: null, count: this.wantsCount ? matched.length : null };
      }
      return { data: matched, error: null, count: this.wantsCount ? matched.length : null };
    };
    return Promise.resolve(settle()).then(onfulfilled, onrejected);
  }
}

export function fakeSupabase(
  tables: Record<string, Row[]>,
  options: { failTable?: string; failWith?: string } = {},
): SupabaseClient {
  return {
    from(table: string) {
      const failWith = options.failTable === table ? (options.failWith ?? "boom") : null;
      return new FakeQuery(tables[table] ?? [], failWith);
    },
  } as unknown as SupabaseClient;
}
