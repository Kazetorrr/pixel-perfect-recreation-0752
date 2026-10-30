import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  resend: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signUp: mocks.signUp, signInWithPassword: mocks.signIn, resend: mocks.resend } },
}));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: { signInWithOAuth: vi.fn() } } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));

import { AuthScreen } from "@/components/game/AuthScreen";

const fill = (view: ReturnType<typeof render>) => {
  fireEvent.change(view.getByLabelText("E-mail"), { target: { value: "Kundus@Example.COM" } });
  fireEvent.change(view.getByLabelText("Heslo"), { target: { value: "picopico5" } });
};

beforeEach(() => {
  mocks.signUp.mockReset();
  mocks.signIn.mockReset();
  mocks.resend.mockReset();
  mocks.error.mockReset();
  mocks.success.mockReset();
});

describe("Signup feedback", () => {
  it("tells the player to verify the e-mail when no session was issued", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    const view = render(<AuthScreen />);
    fill(view);
    fireEvent.click(view.getByRole("button", { name: "Vytvořit účet" }));

    await waitFor(() => expect(view.getByText("Ověřte svůj e-mail")).toBeTruthy());
    expect(view.getByText(/kundus@example\.com/)).toBeTruthy();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("resends the confirmation e-mail to the addressed player", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    mocks.resend.mockResolvedValue({ error: null });
    const view = render(<AuthScreen />);
    fill(view);
    fireEvent.click(view.getByRole("button", { name: "Vytvořit účet" }));
    await waitFor(() => expect(view.getByText("Ověřte svůj e-mail")).toBeTruthy());

    fireEvent.click(view.getByRole("button", { name: /Poslat ověřovací e-mail znovu/ }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "kundus@example.com" }),
    ));
  });

  it("shows a Czech message when the server refuses a repeat request", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "For security purposes, you can only request this after 60 seconds." },
    });
    const view = render(<AuthScreen />);
    fill(view);
    fireEvent.click(view.getByRole("button", { name: "Vytvořit účet" }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(
      "Z bezpečnostních důvodů si o e-mail můžete požádat znovu až za chvíli. Zkuste to prosím později.",
    ));
    expect(view.queryByText("Ověřte svůj e-mail")).toBeNull();
  });
});
