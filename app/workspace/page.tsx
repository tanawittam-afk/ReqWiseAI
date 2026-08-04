import { redirect } from "next/navigation";

/**
 * The workspace home is the Dashboard.
 *
 * It was the project list, because a landing page had nothing to say. It does now: the
 * dashboard's first line is what still needs a person, which is the question a
 * reviewer opens the application to answer. The project list stays one click away and
 * unchanged.
 */
export default function WorkspacePage() {
  redirect("/workspace/dashboard");
}
