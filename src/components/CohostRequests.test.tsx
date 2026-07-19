import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioAuthContext, type StudioAuthContextValue } from "../auth/studioAuthContext";
import { listCohostRelationships } from "../api/studioAuth";
import { CohostRequests } from "./CohostRequests";

vi.mock("../api/studioAuth", () => ({ listCohostRelationships: vi.fn(), respondCohostInvitation: vi.fn() }));

const auth: StudioAuthContextValue = {
  access: { status: "allowed", source: "runtime-auth", reasonCode: "alpha_grant_active", stage: "ALPHA", activeTesterLimit: 25, account: { id: "account-1", userCode: "ABC1234", displayName: "Tester", avatarUrl: null, accountType: "creator", tier: "CORE" } },
  authGate: { status: "ready", mode: "normal", message: "Ready", showLockoutBanner: false, loginAllowed: true, bypassEnabled: false, bypassUnlocked: false, unlockExpiresAt: null },
  refresh: vi.fn(), refreshAuthGate: vi.fn(), unlockAuthGate: vi.fn(), logout: vi.fn(),
};

const request = { id: "request-1", director: { id: "director-1", displayName: "Director", avatarUrl: null }, cohost: null, status: "pending" as const, scopeType: "selected_rooms" as const, roomIds: ["room-1"], room: { id: "room-1", title: "Production room" }, createdAt: "2026-07-19T00:00:00Z", updatedAt: "2026-07-19T00:00:00Z", expiresAt: "2099-07-26T00:00:00Z" };

beforeEach(() => vi.mocked(listCohostRelationships).mockResolvedValue([request]));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function renderRequests(onOpenChange = vi.fn()) {
  return render(<StudioAuthContext.Provider value={auth}><div data-testid="room-media">RealtimeKit mounted</div><aside data-mode="collapsed" /><CohostRequests onOpenChange={onOpenChange} /></StudioAuthContext.Provider>);
}

describe("CohostRequests overlay", () => {
  it("portals an opaque dialog surface without changing sidebar or room-media identity", async () => {
    const { getByTestId } = renderRequests();
    const media = getByTestId("room-media");
    const sidebar = document.querySelector("aside");
    await waitFor(() => expect(screen.getByRole("button", { name: /Requests/ })).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: /Requests/ }));
    const panel = screen.getByRole("dialog", { name: "Requests" });
    expect(panel.parentElement).toBe(document.body);
    expect(panel).toHaveClass("studio-overlay-surface");
    expect(getByTestId("room-media")).toBe(media);
    expect(sidebar).toHaveAttribute("data-mode", "collapsed");
  });

  it("closes on Escape and outside click and restores focus without duplicate listeners", async () => {
    renderRequests();
    const trigger = await screen.findByRole("button", { name: /Requests/ });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Requests" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Requests" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
