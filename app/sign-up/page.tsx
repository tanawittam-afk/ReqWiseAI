import Link from "next/link";
import { signUp } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";
import { T } from "../_components/t";

export const metadata = { title: "Create an account — ReqWise AI" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold text-text">
          <T en="Create an account" th="สร้างบัญชี" />
        </h1>
        <p className="text-sm text-text-muted">
          <T
            en="Signing up creates your personal workspace automatically."
            th="การสมัครจะสร้างพื้นที่ทำงานส่วนตัวให้คุณโดยอัตโนมัติ"
          />
        </p>
      </header>

      <AuthForm action={signUp} submitLabel="create-account" withDisplayName />

      <p className="text-sm text-text-muted">
        <T en="Already have one?" th="มีบัญชีอยู่แล้ว?" />{" "}
        <Link href="/sign-in" className="text-accent underline underline-offset-2">
          <T en="Sign in" th="เข้าสู่ระบบ" />
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
