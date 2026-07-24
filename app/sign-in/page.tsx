import Link from "next/link";
import { signIn } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const metadata = { title: "Sign in — ReqWise AI" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm opacity-70">Continue to your ReqWise AI workspace.</p>
      </header>

      <AuthForm action={signIn} submitLabel="Sign in" next={next} />

      <p className="text-sm opacity-70">
        No account?{" "}
        <Link href="/sign-up" className="underline underline-offset-4">
          Create one
        </Link>
      </p>
    </main>
  );
}
