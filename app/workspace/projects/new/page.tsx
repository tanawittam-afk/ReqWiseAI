/**
 * New project.
 *
 * The domain options come from the database — `domain_profiles` is the runtime source
 * of truth, and the TypeScript profiles under `lib/domain/profiles/` are the authoring
 * source that generates the seed. Importing them here would quietly reintroduce the
 * second source of truth this project just spent a slice removing.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listDomainProfileOptions } from "@/lib/domain/load-profile";
import { CUSTOM_DOMAIN_PLACEHOLDER, isDomainSupported } from "@/lib/domain/availability";
import { ProjectForm, type DomainOption } from "./project-form";

export const metadata = { title: "New project — ReqWise AI" };

export default async function NewProjectPage() {
  const supabase = await createClient();
  const profiles = await listDomainProfileOptions(supabase);

  const domains: DomainOption[] = [
    ...profiles.map((profile) => ({
      id: profile.id,
      key: profile.key,
      name: profile.name,
      description: profile.description,
      supported: isDomainSupported(profile.key),
    })),
    {
      // No row exists for this one, and the custom-domain editor is out of scope —
      // it is listed so the domain layer is visible, and disabled so it cannot be used.
      id: CUSTOM_DOMAIN_PLACEHOLDER.key,
      key: CUSTOM_DOMAIN_PLACEHOLDER.key,
      name: CUSTOM_DOMAIN_PLACEHOLDER.name,
      description: CUSTOM_DOMAIN_PLACEHOLDER.description,
      supported: false,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-1.5">
        <Link
          href="/workspace/projects"
          className="w-fit text-xs text-text-faint transition-colors hover:text-text-muted"
        >
          ← Projects
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">New project</h1>
        <p className="max-w-prose text-sm text-text-muted">
          Name the work and pick the business domain. You will add the source information —
          notes, an interview, a client message — in the next step.
        </p>
      </header>

      <ProjectForm domains={domains} />
    </main>
  );
}
