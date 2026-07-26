# Slice 6C — Requirements export and printable handoff

**Self-contained handoff.** Read this to pick up export work without reading the 1,000-line
`HANDOFF.md`. Shipped 2026-07-26 · commits `b0c6e9c` (feature) + `fa0bc84` (hash record) ·
branch `reqwise-ai` · **not pushed**.

- Architecture and rules: [`../architecture/EXPORT.md`](../architecture/EXPORT.md)
- Data-model context: [`../architecture/DATA-MODEL.md`](../architecture/DATA-MODEL.md) §C.13
- Whole-project state: [`../../HANDOFF.md`](../../HANDOFF.md)

---

## 1. What shipped

Reviewed requirements now leave the system as a document. One contract, six downloadable
files, one printable page:

| Surface | Route |
|---|---|
| Scope · readiness · preview | `/workspace/projects/:id/exports` |
| Full-width reading view | `/workspace/projects/:id/exports/preview` |
| Printable (browser print / Save as PDF) | `/workspace/projects/:id/exports/print` |
| Downloads | `/workspace/projects/:id/exports/download/:format` |

`:format` ∈ `markdown` · `json` · `requirements-csv` · `questions-csv` · `findings-csv` ·
`traceability-csv`.

Reachable from the project overview, next to Traceability, and only once the project has
analysed items.

**No migration.** Everything is derived from existing tables and nothing is written — which
is also why repeating an export is free and why there is no export history to clean up.

## 2. Where the code is

```text
lib/contracts/export.ts        the wire contract — reqwise-export/1.0, strictObject throughout
lib/export/load.ts            the ONLY database-touching module in the folder
lib/export/build.ts           scope filtering, ordering, sections, coverage → ExportPackage
lib/export/readiness.ts       blocking errors vs warnings
lib/export/markdown.ts        ⎫
lib/export/json.ts            ⎬ pure renderers, ExportPackage → string
lib/export/csv.ts             ⎭
lib/export/print.ts           print decisions (page-break classes, PDF title, footer)
lib/export/url.ts             scope ⇄ query string
lib/export/labels.ts          the document's vocabulary (see §6 for why it is separate)
lib/export/filenames.ts       slug, filenames, content types
lib/export/types.ts           internal loader shapes (carry rawText + row ids; never exported)

app/workspace/projects/[projectId]/exports/
  page.tsx                    scope · document · readiness + actions
  preview/page.tsx            full-width reading view
  print/page.tsx              printable document
  download/[format]/route.ts  one handler, six artefacts
  _components/document.tsx    the document, rendered once and used by preview AND print
  _components/scope-panel.tsx client — every change is a navigation, not local state
  _components/download-actions.tsx

app/globals.css               @media print block (A4, page breaks, screen-only/print-only)
scripts/verify-export.mts     26 runtime checks against the live database
tests/export/                 198 unit tests + committed golden fixtures
```

## 3. How to run and verify it

```bash
npm run dev                  # http://localhost:3000
npm run verify:export        # 26/26 against the live Supabase project
npm test                     # 637 tests (198 of them export)
npm run typecheck && npm run lint && npm run build
npx vitest run tests/export -u    # regenerate goldens — ONLY after reading the diff
```

Browser demo: `slice3.demo@reqwise.dev` / `Slice3Demo!2026` → project *Smart Space intake —
slice 3* → **Export**. Try the *Portfolio demo* preset first, then *Audit package* to see all
statuses and history.

### What was verified on 2026-07-26

- **eslint clean · typecheck clean · 637 tests · production build** with all four export
  routes in the output.
- **All eight runtime scripts green:** db 8/8 · projects 10/10 · sources 18/18 · analysis
  25/25 · review 30/30 · workflow 32/32 · traceability 22/22 · **export 26/26**.
- **Browser:** all six downloads returned **200** with the right content type, bodies
  inspected (Markdown 11,343 bytes / 10 `##` sections / Thai intact / no provider payload;
  JSON `reqwise-export/1.0`, keys sorted; requirements CSV header + CRLF + quoted Thai).
  `/download/pdf` → **404**, another tenant's project → **404**. Print rules read live from
  the DOM (`@page { size: a4; margin: 16mm 14mm }`, `.screen-only { display: none }`,
  `break-before: page`, 22 `.export-block`, 9 `.export-section`). No horizontal overflow at
  834 px or 390 px. All 35 interactive targets ≥ 44 px. No application console errors.
- **Not verified:** a file saved to disk (the browser extension blocks downloads, so
  responses were inspected instead), the native print dialog, and an archived project's
  export *screen* — no demo project is archived. Archived export itself is runtime check 3.

## 4. The decisions someone will want to re-litigate

Each of these is a deliberate answer, not an oversight.

1. **The status scope applies to requirements only.** An open question's status is always
   `draft` (the review workflow excludes it by construction, §C.11), so filtering questions by
   status would empty an approved-only export of every question. Questions and findings are
   governed by their section toggles and their own workflow state.
2. **Coverage is computed over the whole project, never over the scope.** "3 orphans"
   describes a project; recomputing it against a filtered set would report gaps the filter
   created and hide the ones it hid. The document says which it is.
3. **The archived-project notice is not optional.** Everything else is the reader's choice;
   where a document came from is not theirs to switch off.
4. **Unanswered questions warn, they never block.** An export whose purpose is the handoff
   conversation must not be withheld because that conversation has not happened yet.
5. **A citation whose offsets no longer match its excerpt is a blocking error** (409 on the
   download route). A document that looks complete and is not is worse than no document. The
   error names display ids and never quotes the text.
6. **Formula injection is neutralised with a leading apostrophe**, not by stripping
   characters. Silently altering a requirement's words is worse than one visible character.
7. **Filenames are ascii** (`projectSlug()` falls back to `project`). A Thai filename in
   `Content-Disposition` is handled differently by every browser, spreadsheet and shell; the
   real name lives inside the document.
8. **No server-side PDF.** The browser's *Save as PDF* already exists, honours the reader's
   paper size, and needs no headless Chrome in the build. The page `<title>` is what the print
   dialog proposes as the filename.
9. **Actors are dropped in the loader.** "Approved on 26 July" is what a handoff document
   needs; `actor_id` is an auth identity.
10. **Only relations with both endpoints in the document are listed.** A relation naming an
    item the reader cannot find is a dangling reference.

## 5. Deliberately out of scope

Server-generated PDF · DOCX · ZIP · emailing or uploading an export · scheduled exports ·
export history or audit rows · re-running AI during export · editing relations from the
export screen · the change-request workflow · the real Gemini provider · deployment.

## 6. Gotchas hit while building this (the useful part)

- **`guard_item_update()` refuses a direct status or version write — even for the service
  role.** Fixtures must move items through `review_item()`, `edit_analysis_item()`,
  `resolve_open_question()` and `update_quality_finding()`. `approved` is two steps
  (draft → reviewed → approved), and an edit *after* a review resets it to draft, so edit
  first. RPC parameter names are `p_item_id` / `p_expected_state` / `p_to_state` / `p_answer`
  / `p_note` — check `verify-workflow.mts` rather than guessing.
- **Anything reachable from `scripts/*.mts` needs explicit `.ts` extensions on value
  imports** (Node's native type stripping). 16 files were converted for this slice, including
  `lib/contracts/{review,workflow}.ts`, `lib/review/history.ts` and `lib/traceability/*`. If a
  new script fails with `ERR_MODULE_NOT_FOUND` on a local import, this is why.
- **`lib/export/labels.ts` is a deliberate copy** of the screen labels, because a document's
  vocabulary is content rather than chrome. `tests/export/labels.test.ts` asserts the two
  agree, so the copy cannot drift. Source kinds are *not* copied — `lib/contracts/source.ts`
  already owns them.
- **Golden fixtures are vitest file snapshots**, not hand-written files. They exist to make an
  accidental wire-shape change visible; regenerate with `-u` only after reading the diff.
- **The dev server's source-map worker can crash** (`jest-worker` exception in the overlay)
  when many heavy page renders are fired at once — e.g. probing several iframes in a row. It
  is dev tooling, not application code; restart `npm run dev` if the overlay appears.
- **A not-found *page* answers HTTP 200 with the not-found body** in dev (the export page,
  the traceability page and the project page all behave identically). The *download* endpoint
  is the one that answers a real 404.

## 7. Known limitations

- A requirement excluded by the status scope takes its relations out of the traceability
  section with it. Coverage still describes the whole project, and says so.
- `humanEdited` is inferred from `version_no > 1` — the only evidence the data holds. It does
  not say *what* changed; the version summary carries the change reason.
- Markdown escaping neutralises structural constructs, not every special character, so
  intentional `*emphasis*` in a requirement survives.
- Six separate downloads rather than one archive.
- The "Preparing…" state on a download button is time-based (2.5 s): a browser gives a page
  no event when a link-initiated download finishes. It prevents a double-click, nothing more.

## 8. What to do next

**Recommended: the real Gemini provider.** Everything downstream is now proven against the
deterministic mock, and the adapter seam (`lib/providers/`) plus the validation gate already
exist. The requirement that matters: its output must satisfy the **typed relation contract**
(`AUTHORED_RELATION_TYPES` + the pair matrix, §C.13), not just the item schema — a model that
emits `derives_from` or an illegal pair must be stored as an `invalid` run, never repaired.

Then the **change request** against an approved requirement (`approved` and `rejected` are
terminal, so it must be a new object with its own audit trail).

If the next task is export-shaped instead, the cheap wins are: a ZIP of all six files, a
DOCX renderer behind the same package, or letting the export screen deep-link into the
Analysis Workspace from a listed requirement.

## 9. Housekeeping this slice touched

`scripts/verify-db-cleanup-dryrun.sql` is new: it reports what the destructive cleanup would
delete **without deleting anything**, and its `preserved` section must always show exactly the
two demo accounts and their four projects. The cleanup patterns were also fixed — slices 5,
6A, 6B and 6C named fixtures the script had never heard of, which is most of why 276
verification projects had accumulated. **Nothing was cleaned up**; that stays an explicit,
separate instruction from the owner.
