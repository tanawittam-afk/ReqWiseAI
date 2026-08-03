// Bilingual text primitive. Renders both languages inline; CSS (globals.css) hides the
// inactive one based on <html data-locale>. Works in BOTH server and client components
// (no directive), so server pages stay static — the toggle is a pure CSS swap with no
// re-render or refetch.
//
// Chrome only. Never wrap requirement content, source text, or export output — those
// follow analysis_runs.output_lang, a separate axis CLAUDE.md keeps distinct from this
// one on purpose.
export function T({ en, th }: { en: React.ReactNode; th: React.ReactNode }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="th">{th}</span>
    </>
  );
}
