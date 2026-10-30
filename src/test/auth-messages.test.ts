import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/game/auth-messages";

describe("Auth error wording", () => {
  it("translates the signup rate-limit message into Czech", () => {
    expect(
      authErrorMessage("For security purposes, you can only request this after 60 seconds."),
    ).toBe("Z bezpečnostních důvodů si o e-mail můžete požádat znovu až za chvíli. Zkuste to prosím později.");
  });

  it("translates invalid credentials and an unconfirmed e-mail", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Neplatný e-mail nebo heslo.");
    expect(authErrorMessage("Email not confirmed")).toContain("E-mail zatím nebyl ověřen");
  });

  it("leaves an unknown message untouched", () => {
    expect(authErrorMessage("Něco zcela nečekaného")).toBe("Něco zcela nečekaného");
  });
});
