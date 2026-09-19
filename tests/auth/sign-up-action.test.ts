/**
 * `signUp()`'s new gate (Phase 1, Slice 4) — proves only the branching this slice
 * added: a deliberate `enabled: false` blocks before `supabase.auth.signUp` is ever
 * called; an RPC failure (`ok: false`, not a toggle) falls through and `signUp` still
 * runs. `isSignUpEnabled` itself has its own coverage in
 * `tests/admin/sign-up-toggle.test.ts` and is mocked here, same shape as
 * `start-project-action.test.ts` mocking its own collaborators.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(public readonly destination: string) {
    super(`REDIRECT:${destination}`);
  }
}

const redirectMock = vi.fn((destination: string) => {
  throw new RedirectSignal(destination);
});
const revalidatePathMock = vi.fn();

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const authSignUpMock = vi.fn();
const createClientMock = vi.fn(async () => ({ auth: { signUp: authSignUpMock } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const isSignUpEnabledMock = vi.fn();
vi.mock("@/lib/admin/sign-up-toggle", () => ({ isSignUpEnabled: isSignUpEnabledMock }));

const { signUp } = await import("../../app/auth/actions");

function credentials(): FormData {
  const formData = new FormData();
  formData.set("email", "new-user@example.com");
  formData.set("password", "correct horse battery staple");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  authSignUpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  redirectMock.mockImplementation((destination: string) => {
    throw new RedirectSignal(destination);
  });
});

describe("signUp — sign-up switch", () => {
  it("blocks before signUp is ever called when the switch is deliberately off", async () => {
    isSignUpEnabledMock.mockResolvedValue({ ok: true, enabled: false });

    const result = await signUp({ error: null, notice: null }, credentials());

    expect(result).toEqual({
      error: "Sign-ups are currently closed. Contact the site owner.",
      notice: null,
    });
    expect(authSignUpMock).not.toHaveBeenCalled();
  });

  it("fails open — a toggle-read RPC failure still lets signUp proceed", async () => {
    isSignUpEnabledMock.mockResolvedValue({ ok: false });

    await expect(signUp({ error: null, notice: null }, credentials())).rejects.toThrow(
      "REDIRECT:/workspace",
    );

    expect(authSignUpMock).toHaveBeenCalledTimes(1);
  });

  it("proceeds normally when the switch is on", async () => {
    isSignUpEnabledMock.mockResolvedValue({ ok: true, enabled: true });

    await expect(signUp({ error: null, notice: null }, credentials())).rejects.toThrow(
      "REDIRECT:/workspace",
    );

    expect(authSignUpMock).toHaveBeenCalledTimes(1);
  });
});
