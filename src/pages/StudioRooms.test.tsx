import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { StudioAuthProvider } from "../auth/StudioAuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { JoinPage } from "./JoinPage";
import { StudioPage } from "./StudioPage";

function response(payload: object, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status }));
}

function authPayload(role: "creator" | "public") {
  return {
    session: { authenticated: true, user: { internal_id: `${role}-1`, user_code: "ABC1234", display_name: role, avatar_url: null, role, tier: "CORE" } },
    access: { authenticated: true, access_allowed: true, reason_code: "alpha_grant_active", stage: "ALPHA", active_tester_limit: 25 },
  };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the truthful public-account invitation policy without fetching owner rooms", async () => {
  const payload = authPayload("public");
  const fetchMock = vi.fn((input: RequestInfo | URL) => String(input).includes("/auth/session") ? response(payload.session) : response(payload.access));
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Join through a room invitation")).toBeInTheDocument();
  expect(screen.getByText(/does not change your account role/i)).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/studio/rooms"))).toBe(false);
});

it("loads creator room summaries without inventing media state", async () => {
  const payload = authPayload("creator");
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    return response({ success: true, items: [{ id: "room-1", owner_account_id: "creator-1", title: "Real room", description: null, lifecycle_state: "draft", max_guest_stage_occupants: 9, waiting_guest_count: 0, admitted_guest_count: 0, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", opened_at: null, ended_at: null }] });
  }));
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Real room")).toBeInTheDocument();
  expect(screen.getByText(/Media and broadcasting are not connected/i)).toBeInTheDocument();
  expect(screen.queryByText(/viewer count/i)).not.toBeInTheDocument();
});

it("validates an invite, joins the lobby, and displays admission-neutral waiting state", async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response({ authenticated: false }, 401);
    if (url.includes("/api/studio/invites/validate")) return response({ success: true, room: { id: "room-1", title: "Guest room", description: "Panel", lifecycle_state: "open" }, expires_at: null });
    if (url.includes("/api/studio/invites/join")) {
      expect(JSON.parse(String(init?.body))).toMatchObject({ display_name: "Guest Person" });
      return response({ success: true, guest: { id: "guest-1", room_id: "room-1", display_name: "Guest Person", account_id: null, state: "waiting", created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", expires_at: "2026-07-11T12:00:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null } }, 201);
    }
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter initialEntries={["/join/safe-invite-code"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/join/:inviteCode" element={<JoinPage />} /></Routes></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Valid room invite")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: "Guest Person" } });
  fireEvent.click(screen.getByRole("button", { name: "Join lobby" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Waiting in lobby" })).toBeInTheDocument());
  expect(screen.getByText("Not connected")).toBeInTheDocument();
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
