/**
 * "Try an example" — the zero-typing path in.
 *
 * Its own `<form>` rather than a second button inside the intake form: the intake form
 * marks its two fields `required`, and a button that has to opt out of the browser's
 * own validation to work is a button in the wrong form.
 *
 * The action behind it forces the deterministic mock provider — see
 * `startExampleAction`. Rendered as a server component so the button is real before
 * any JavaScript arrives.
 */

import { T } from "@/app/_components/t";
import { SubmitButton } from "@/app/_components/ui/button";
import { startExampleAction } from "./actions";

export function TryExampleButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  return (
    <form action={startExampleAction}>
      <SubmitButton
        variant={variant}
        pendingLabel="กำลังสร้างตัวอย่าง…"
        className="min-h-11 w-full sm:w-auto"
      >
        <T en="Try an example — no typing" th="ลองด้วยตัวอย่าง — ไม่ต้องพิมพ์" />
      </SubmitButton>
    </form>
  );
}
