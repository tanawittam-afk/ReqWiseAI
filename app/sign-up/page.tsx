import Link from "next/link";
import { signUp } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";

export const metadata = { title: "Create an account — ReqWise AI" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold text-text">Create an account</h1>
        <p className="text-sm text-text-muted">
          Signing up creates your personal workspace automatically.
        </p>
      </header>

      <AuthForm action={signUp} submitLabel="Create account" withDisplayName />

      <p className="text-sm text-text-muted">
        Already have one?{" "}
        <Link href="/sign-in" className="text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}
