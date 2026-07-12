import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioAuthContext, type StudioAuthContextValue } from "../auth/studioAuthContext";
import { StudioAccountMenu } from "./StudioAccountMenu";

afterEach(cleanup);

function value(avatarUrl: string | null): StudioAuthContextValue {
  return {
    access: {
      status: "allowed",
      source: "runtime-auth",
      reasonCode: "alpha_grant_active",
      stage: "ALPHA",
      activeTesterLimit: 25,
      account: {
        id: "account-1",
        userCode: "ABC1234",
        displayName: "Alpha Tester",
        avatarUrl,
        accountType: "creator",
        tier: "CORE",
      },
    },
    authGate: {
      status: "ready",
      mode: "normal",
      message: "Authentication is operating normally.",
      showLockoutBanner: false,
      loginAllowed: true,
      bypassEnabled: false,
      bypassUnlocked: false,
      unlockExpiresAt: null,
    },
    refresh: vi.fn(),
    refreshAuthGate: vi.fn(),
    unlockAuthGate: vi.fn(),
    logout: vi.fn().mockResolvedValue(false),
  };
}

describe("StudioAccountMenu", () => {
  it("renders the Runtime avatar and safe account metadata", () => {
    render(<StudioAuthContext.Provider value={value("https://example.test/avatar.png")}><StudioAccountMenu /></StudioAuthContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: /Alpha Tester/ }));
    expect(document.querySelector(".studio-account-avatar img")).toHaveAttribute("src", "https://example.test/avatar.png");
    expect(screen.getByText("creator · CORE")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeEnabled();
  });

  it("uses an initial fallback and restores trigger focus on Escape", async () => {
    render(<StudioAuthContext.Provider value={value(null)}><StudioAccountMenu /></StudioAuthContext.Provider>);
    const trigger = screen.getByRole("button", { name: /Alpha Tester/ });
    expect(screen.getByText("A")).toBeVisible();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
