import Link from "next/link";
import { signIn } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";
import { T } from "../_components/t";

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
        <h1 className="font-display text-xl font-semibold text-text">
          <T en="Sign in" th="เข้าสู่ระบบ" />
        </h1>
        <p className="text-sm text-text-muted">
          <T en="Continue to your ReqWise AI workspace." th="ไปต่อยังพื้นที่ทำงาน ReqWise AI ของคุณ" />
        </p>
      </header>

      <AuthForm action={signIn} submitLabel="sign-in" next={next} />

      <p className="text-sm text-text-muted">
        <T en="No account?" th="ยังไม่มีบัญชี?" />{" "}
        <Link href="/sign-up" className="text-accent underline underline-offset-2">
          <T en="Create one" th="สร้างบัญชี" />
        </Link>
      </p>

      <p className="text-sm text-text-muted">
        <T en="Just curious?" th="แค่อยากลองดู?" />{" "}
        <Link href="/demo" className="text-accent underline underline-offset-2">
          <T en="See the demo" th="ดูตัวอย่างการใช้งาน" />
        </Link>{" "}
        <T en="— no account needed." th="— ไม่ต้องมีบัญชี" />
      </p>
    </main>
  );
}
