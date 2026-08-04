/**
 * Settings — what this workspace is configured with, and what each domain profile
 * contributes to an analysis.
 *
 * **Read-only, deliberately.** The UX/UI plan's Phase 5 said Settings would "hold the
 * provider choice", and that turned out to need a preference to store and nowhere to
 * store it: there is no user- or organization-settings table, and adding a migration
 * to a live database to persist a dropdown is a schema change bought for a
 * convenience. Two things follow, and both are stated on the page rather than hidden:
 *
 *   1. **The provider is disclosed, not chosen, here.** Which provider is configured
 *      is an environment fact (`AI_PROVIDER`, plus whether a Gemini key and model
 *      chain exist), so it is reported as one. The per-run choice stays on the Analyze
 *      screen, which is where it has always been and where it is actually needed —
 *      Phase 4 kept it there for the same reason.
 *   2. **Domain Profiles are absorbed here as a reading surface**, replacing the
 *      separate sidebar entry. A profile is data, not configuration
 *      (`lib/domain/types.ts`): showing what it contributes is the useful thing; an
 *      editor for it is a different feature nobody has asked for.
 *
 * The API key itself is never read into this page, never rendered and never sent to
 * the browser — only the boolean `available`, which `readServerEnvironment()` already
 * derives. That rule is absolute (CLAUDE.md → Stack).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readServerEnvironment, toProviderOptions } from "@/lib/config/env";
import { ALL_PROFILES } from "@/lib/domain/profiles";
import { isDomainSupported } from "@/lib/domain/availability";
import type { DomainProfile } from "@/lib/domain/types";

export const metadata = { title: "Settings — ReqWise AI" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const env = readServerEnvironment();
  const providers = toProviderOptions(env);
  const effective = env.defaultProvider === "gemini" && !env.gemini.available;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Settings</h1>
        <p className="text-sm text-text-muted">
          What this workspace runs on, and what each domain profile contributes to an
          analysis. Everything here is read-only.
        </p>
      </header>

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-sm font-semibold text-text">
          Account
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft sm:grid-cols-2">
          <Row label="Signed in as" value={user.email ?? "—"} />
          <Row label="Interface language" value="Switch with the EN / TH toggle in the sidebar" />
        </dl>
        <p className="text-xs leading-relaxed text-text-faint">
          Interface language and the language an analysis writes in are two separate
          controls. The output language belongs to the project and is fixed when the project
          is created — changing the chrome never rewrites a requirement.
        </p>
      </section>

      <section aria-labelledby="provider-heading" className="flex flex-col gap-3">
        <h2 id="provider-heading" className="text-sm font-semibold text-text">
          Analysis provider
        </h2>

        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {providers.map((provider) => {
            const isDefault = provider.key === env.defaultProvider;
            return (
              <li
                key={provider.key}
                className="flex flex-wrap items-center gap-2 bg-surface px-4 py-3"
              >
                <span className="text-sm font-medium text-text">{provider.label}</span>
                {isDefault ? (
                  <span className="rounded-[var(--radius-card)] border border-accent-border bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                    Default
                  </span>
                ) : null}
                <span
                  className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
                    provider.available
                      ? "border-ok-border bg-ok-soft text-ok"
                      : "border-border-soft bg-surface-muted text-text-muted"
                  }`}
                >
                  {provider.available ? "Configured" : "Not configured"}
                </span>
                <span className="ml-auto text-[11px] text-text-faint">
                  {provider.key === "mock"
                    ? "Deterministic — same input, same output, no network"
                    : env.gemini.models.length > 0
                      ? `Model chain: ${env.gemini.models.join(" → ")}`
                      : "No model chain set"}
                </span>
              </li>
            );
          })}
        </ul>

        {effective ? (
          <p
            role="status"
            className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
          >
            Gemini is the configured default but has no API key or model chain, so analyses
            fall back to the deterministic mock. Runs say which provider actually produced
            them — the run header is never vague about that.
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-text-faint">
          Which provider a single run uses is chosen on that source&rsquo;s{" "}
          <span className="font-medium text-text-muted">Analyze</span> screen; this page
          reports how the server is configured. An API key is never read into a page, never
          rendered, and never sent to the browser.
        </p>
      </section>

      <section aria-labelledby="profiles-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="profiles-heading" className="text-sm font-semibold text-text">
            Domain profiles
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-text-faint">
            A profile supplies business context <em>around</em> the analysis engine, never
            inside it — terminology to recognise, questions worth asking, risks worth
            raising. It is never evidence: knowing that booking systems usually have a refund
            policy does not make it a fact about <em>this</em> one.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {ALL_PROFILES.map((profile) => (
            <ProfileCard key={profile.key} profile={profile} />
          ))}
        </div>
      </section>

      <p className="text-xs text-text-faint">
        Looking for a project&rsquo;s own settings?{" "}
        <Link
          href="/workspace/projects"
          className="font-medium text-accent underline underline-offset-2"
        >
          Open the project
        </Link>{" "}
        — domain, output language and archiving belong to it, not to the workspace.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="text-[11px] text-text-faint">{label}</dt>
      <dd className="text-sm break-words text-text">{value}</dd>
    </div>
  );
}

function ProfileCard({ profile }: { profile: DomainProfile }) {
  const supported = isDomainSupported(profile.key);

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{profile.name}</h3>
        <span
          className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
            supported
              ? "border-ok-border bg-ok-soft text-ok"
              : "border-border-soft bg-surface-muted text-text-muted"
          }`}
        >
          {supported ? "Available" : "Not yet available"}
        </span>
        <span className="font-mono text-[11px] text-text-faint">{profile.key}</span>
      </div>

      <p className="text-sm leading-relaxed text-text-muted">{profile.description}</p>

      {/* Counts, not contents: a profile is long, and the number is the honest summary
          of what it actually contributes. Zero reads as zero — an unenriched profile
          should look unenriched. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <Count label="Terms" value={profile.terminology.length} />
        <Count label="Stakeholders" value={profile.typicalStakeholders.length} />
        <Count label="Workflows" value={profile.commonWorkflows.length} />
        <Count label="Business rules" value={profile.commonBusinessRules.length} />
        <Count label="Clarifications" value={profile.requiredClarificationCategories.length} />
        <Count label="Risks" value={profile.commonRisks.length} />
        <Count label="Suggested NFRs" value={profile.suggestedNonFunctionalRequirements.length} />
        <Count label="Validation rules" value={profile.validationRules.length} />
      </dl>

      {profile.requiredClarificationCategories.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border-soft pt-3">
          <h4 className="text-xs font-semibold text-text-muted">
            Always asks about
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {profile.requiredClarificationCategories.map((category) => (
              <li
                key={category}
                className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 text-[11px] text-text-muted"
              >
                {category}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:justify-start">
      <dt className="text-text-faint">{label}</dt>
      <dd className={`font-mono font-semibold ${value === 0 ? "text-text-faint" : "text-text"}`}>
        {value}
      </dd>
    </div>
  );
}
