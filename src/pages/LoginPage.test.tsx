import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalActivityProvider } from "../activity/GlobalActivityProvider";
import { StudioAuthContext, type StudioAuthContextValue } from "../auth/studioAuthContext";
import { ThemeProvider } from "../theme/ThemeProvider";
import { LoginPage } from "./LoginPage";

vi.mock("../components/TurnstileWidget", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    TurnstileWidget: React.forwardRef(() => <div data-testid="turnstile-widget">Security check</div>),
  };
});

afterEach(cleanup);

function authValue(mode: "normal" | "development", unlock = vi.fn()): StudioAuthContextValue {
  return {
    access: {
      status: "unauthenticated",
      source: "runtime-auth",
      reasonCode: "unauthenticated",
      account: null,
      stage: "ALPHA",
      activeTesterLimit: 25,
    },
    authGate: {
      status: "ready",
      mode,
      message: mode === "development" ? "Restricted development access." : "Authentication is operating normally.",
      showLockoutBanner: false,
      loginAllowed: mode === "normal",
      bypassEnabled: mode === "development",
      bypassUnlocked: false,
      unlockExpiresAt: null,
    },
    refresh: vi.fn(),
    refreshAuthGate: vi.fn(),
    unlockAuthGate: unlock,
    logout: vi.fn(),
  };
}

function renderLogin(value: StudioAuthContextValue) {
  return render(
    <ThemeProvider>
      <GlobalActivityProvider>
        <StudioAuthContext.Provider value={value}>
          <MemoryRouter initialEntries={["/login"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <LoginPage />
          </MemoryRouter>
        </StudioAuthContext.Provider>
      </GlobalActivityProvider>
    </ThemeProvider>,
  );
}

describe("LoginPage access parity", () => {
  it("hides the bypass field in normal mode and renders supported provider icons with labels", () => {
    renderLogin(authValue("normal"));
    expect(screen.queryByLabelText("Access code")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".oauth-grid img")).toHaveLength(5);
    for (const label of ["Google", "GitHub", "Discord", "X", "Twitch"]) {
      expect(screen.getByRole("button", { name: `Continue with ${label}` })).toBeInTheDocument();
    }
  });

  it("shows a password-style development code field and submits through the shared unlock action", async () => {
    const unlock = vi.fn().mockResolvedValue({ ok: true });
    renderLogin(authValue("development", unlock));
    const input = screen.getByLabelText("Access code");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.change(input, { target: { value: "  private-code  " } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(unlock).toHaveBeenCalledWith("private-code"));
    expect(input).toHaveValue("");
    expect(screen.getByText("Access unlocked. Continue with login.")).toBeVisible();
  });
});
