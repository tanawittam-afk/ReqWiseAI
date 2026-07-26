# ReqWise AI — Export architecture (Slice 6C)

Turning reviewed requirements into a document somebody outside this application can use.
Companion to `ARCHITECTURE.md` §B.8, which reserved `lib/export/` for exactly this.

---

## 1. The pipeline

```text
loadExportInput()      lib/export/load.ts        the only module here that touches a database
      ↓
buildExportPackage()   lib/export/build.ts       pure: scope, ordering, sections, coverage
      ↓
assessReadiness()      lib/export/readiness.ts   pure: blocking errors vs warnings
      ↓
render*()              markdown.ts · json.ts · csv.ts · document.tsx (print)
      ↓
Response               app/…/exports/download/[format]/route.ts
```

Every stage after the loader is a pure function of its input, so the whole document is
testable without a browser and without a database — which is what the 198 unit tests in
`tests/export/` exercise. `lib/export/print.ts` holds the print rules that are *decisions*
(what page-breaks, what the PDF is called) rather than styling.

**Export reads.** Nothing in the pipeline writes, and no table records that an export
happened. That is why slice 6C needed **no migration**: every fact in a package already
exists in `projects`, `source_documents`, `analysis_items`, `item_source_references`,
`item_relations`, `item_versions` and `review_activities`, and coverage is derived
(§C.13).

## 2. The contract

`lib/contracts/export.ts`. Schema version **`reqwise-export/1.0`**, written into every
package.

A database row is not a public contract. Every field was chosen; nothing arrived by
spreading a row, and `z.strictObject` turns "a field was added upstream" into a parse error
rather than a silent leak. Absent on purpose: `organization_id`, `created_by`, `actor_id`,
`resolved_by`, `provider_key`, `raw_provider_output`, `validated_output`,
`idempotency_key`, `deleted_at`, and the source documents' `raw_text`.

Identity: items are referenced by **display id** (`FR-005`) — the identifier a stakeholder
can already cite — never by row UUID. Three UUIDs do appear, because they mean something
outside the database: the project, the cited **source revision**, and the **analysis run**
as audit metadata.

## 3. Scope

Four status scopes, all defined in one table (`STATUSES_IN_SCOPE`):

| Scope | Statuses |
|---|---|
| `approved_only` | `approved` |
| `reviewed_and_approved` | `reviewed`, `approved` |
| `active_working_set` | `draft`, `needs_clarification`, `reviewed`, `approved` |
| `all_statuses` | all five, each labelled |

**The status scope applies to requirements only.** An open question's status is always
`draft` — the review workflow excludes it by construction (§C.11) — so filtering questions
by status would delete every question from an approved-only export. Questions and findings
are governed by their section toggles and their own workflow state.

Nineteen optional sections, twelve of which map one-to-one onto the twelve
requirement-shaped item types. Defaults: every requirement type, both observation types,
evidence, traceability and coverage **on**; full version history and the full review
timeline **off** — they are an audit trail, not a requirements document.

The one thing that is **not** optional: the archived-project notice. A reader who cannot
tell that a package came from a frozen project may act on requirements nobody can change.

## 4. Presets

`portfolio_demo`, `developer_handoff`, `stakeholder_review`, `audit_package`,
`full_project_archive`.

A preset is a UI convenience and nothing else: it resolves to an explicit `ExportScope`
*before* the builder is called, and no rule anywhere reads a preset name. A preset that
could change behaviour would be a hidden business rule.

## 5. Scope lives in the URL

`lib/export/url.ts`. A scope is a reading choice, not a fact about the project, so it
belongs in the address bar: refreshing keeps it, a link shares it, the printable page and
every download inherit it, and the back button undoes a toggle — with no table and no
migration. An unreadable parameter is ignored rather than rejected; a stale bookmark should
still show a document.

## 6. Deterministic ordering

Sections follow one order (`documentSections()`), shared by Markdown and the printable
page. Items follow `compareItems`: display-id **prefix**, then its **number** (so `FR-2`
precedes `FR-10`, which string comparison gets backwards), then `created_at`, then the row
id so the order is total. Nothing relies on object iteration order or on the order Postgres
returned rows in — a test shuffles the input and asserts the output is byte-identical.

The same input and scope therefore produce the same Markdown, JSON and CSV every time.
`generatedAt` is the only value allowed to differ, and it is passed in rather than read from
a clock inside the builder.

## 7. Formats

| Format | File | Notes |
|---|---|---|
| Markdown | `<slug>-requirements.md` | Requirement text is escaped as *data*: line-leading `#`, `>`, `-`, `|`, `1.` and code fences are neutralised so a requirement cannot become markup. Excerpts render as blockquotes. TOC once the document is long. |
| JSON | `<slug>-requirements.json` | Validated against the contract before it is written; object keys sorted recursively (array order is the export's determinism and is untouched); no `undefined`, no `Date`, no functions. |
| CSV ×4 | `-requirements` · `-open-questions` · `-quality-findings` · `-traceability` | RFC 4180 quoting, CRLF rows, UTF-8, fixed column order. |
| Printable HTML | `/exports/print` | Browser print / Save as PDF. No server-side PDF. |

**Filenames are ascii by construction.** Most projects here are named in Thai, and a Thai
filename in `Content-Disposition` needs RFC 5987 encoding that browsers, spreadsheets and
shells each handle slightly differently. `projectSlug()` keeps `[a-z0-9-]` and falls back to
`project` when a name transliterates to nothing; the real name is inside the document.

### CSV formula injection

A spreadsheet treats a cell starting with `=`, `+`, `-`, `@`, a tab or a CR as a formula, so
a requirement that legitimately begins "-" would be **executed** by whoever opens the file.
Such a value is prefixed with a single apostrophe — visible, reversible, and preferred to
stripping, because silently altering a requirement's words is worse than one extra character
a reader can see.

## 8. Source evidence

When evidence is included, each citation carries the source title, kind, revision, the
verbatim excerpt, its character span and the database's own `offset_verified` verdict.

The invariant checked before any file is produced:

```ts
storedRawText.slice(startOffset, endOffset) === excerpt
```

A mismatch is a **blocking error**: the export refuses rather than shipping a quotation
attributed to a span that does not contain it. The error names the affected display ids and
never quotes the text — an error message ends up in logs and bug reports.

An item whose origin is `domain_profile` or `quality_rule` has no citation by construction
(a profile is context, never evidence). It says
*"Generated from domain guidance; no direct source evidence."* Nothing in the pipeline ever
selects an excerpt itself, so a plausible-looking citation cannot be invented.

The **full source text is never reproduced** — only the spans items actually cite.

## 9. Questions, findings, traceability, coverage

* Questions split into **Outstanding** (open, deferred) and **Resolved** (answered, not
  applicable), carrying the answer, the deferral reason, the follow-up date and the
  recorded timestamp. An answer is never rewritten into a requirement: that is a change
  request, and it has its own workflow (§C.12).
* Findings split into **Unresolved** (open, acknowledged — acknowledged means seen, not
  fixed) and **Resolved or dismissed**, carrying the provider's own finding kind. There is
  deliberately **no severity**: the provider contract has none.
* Relations export as sentences in the direction the row is stored, with the inverse phrase
  for inbound edges. Legacy `derives_from` rows export **as legacy**, direction unchanged —
  re-typing them during export would be the guess §C.13 forbids. Only edges whose *both*
  endpoints are in the document are listed, so no relation names an item the reader cannot
  find.
* **Coverage is computed over the whole project, never over the scope.** "3 orphans"
  describes a project; recomputing it against a filtered set would report gaps the filter
  created. The document says which it is, and carries
  *"Coverage indicators assist review and do not replace human judgment."* Nothing calls a
  coverage number a quality score.

## 10. Readiness

Three levels: **Ready** · **Ready with warnings** · **Cannot export**.

Blocking: a citation whose offsets no longer match, a citation naming an unreadable source
revision, an unresolvable relation, a package that fails its own schema, an empty scope.

Warning: unanswered questions, unresolved findings, drafts, rejected items, orphans,
stories with no acceptance criterion, legacy relations, domain-guidance items, unverified
spans.

**Unanswered questions never block.** An export whose purpose is the handoff conversation
must not be withheld because that conversation has not happened yet.

## 11. Printing

The printable route lives inside the workspace shell because that is where its URL belongs;
a nested layout cannot remove its parent, so the print rules in `app/globals.css` do it:

* `.screen-only` (sidebar, toolbar, buttons, links) is hidden; `.print-only` (the
  provenance footer) appears.
* The shell is one viewport tall and never scrolls — every height and overflow constraint is
  released for print, or a printer would render one page and clip the rest.
* `@page { size: A4; margin: 16mm 14mm }`. A requirement block gets `break-inside: avoid`; a
  major section starts on a new page; headings never end a page.
* Black on white with borders kept, so status **words** and table structure survive a
  greyscale photocopy. Nothing encodes meaning in colour alone.

The `<title>` carries the project name and date, because that is what a browser proposes as
the PDF filename — the only part of the print dialog an application can influence.

## 12. Authorization

Every route builds its Supabase client from the request, so **RLS decides what exists**.
`loadExportInput` returns `null` both for a project that does not exist and for one
belonging to another tenant; pages render the ordinary not-found, and the download endpoint
answers **404** with no body that distinguishes them. A blocked readiness check answers
**409** listing issue *keys*, never prose or content.

There is **no service-role client anywhere in the export path**, and there must never be
one: this is the single place where a whole project leaves the system in one piece.

Download responses set `Content-Type` with an explicit charset, `Content-Disposition`,
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and a `default-src 'none';
sandbox` CSP. An archived project exports normally — read-only, with its notice.

## 13. Known limitations

* No server-generated PDF, no DOCX, no ZIP. Six files download individually.
* A requirement excluded by the status scope takes its relations out of the traceability
  section with it (both endpoints must be in the document). Coverage still describes the
  whole project, and says so.
* `humanEdited` is inferred from `version_no > 1`, which is the only evidence the data
  holds; it does not say *what* changed. The version summary carries the change reason.
* Markdown escaping neutralises structural constructs, not every special character —
  intentional emphasis in a requirement survives.
* The review summary reports what happened and when, never who. Actors are dropped in the
  loader.
