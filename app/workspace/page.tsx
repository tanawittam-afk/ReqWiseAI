import { redirect } from "next/navigation";

/**
 * The workspace home is the project list. A separate landing page would be a page
 * with nothing to say until several slices from now.
 */
export default function WorkspacePage() {
  redirect("/workspace/projects");
}
