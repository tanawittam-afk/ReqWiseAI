/**
 * Product-wide numeric limits that must stay identical on both sides of a database
 * call — never re-typed at the call site.
 *
 * `DAILY_ANALYSIS_LIMIT` is passed as `p_limit` to `increment_daily_usage()`
 * (`lib/analysis/daily-usage.ts`) and used to render the "N of 10 left today" copy.
 * The database enforces whatever limit it is told, so this file is the one place that
 * can change the number.
 */
export const DAILY_ANALYSIS_LIMIT = 10;
