import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { StudioAuthProvider } from "../auth/StudioAuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { JoinPage } from "./JoinPage";
import { RoomManagementPage } from "./RoomManagementPage";
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
  expect(screen.getByRole("link", { name: "Enter room" })).toHaveAttribute("href", "/studio/rooms/room-1");
  expect(screen.getByText("0 waiting backstage")).toBeInTheDocument();
  expect(screen.getByText("0 / 9 on stage")).toBeInTheDocument();
  expect(screen.queryByText(/viewer count/i)).not.toBeInTheDocument();
});

it("keeps ended rooms visible without presenting an active Enter room action", async () => {
  const payload = authPayload("creator");
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    return response({ success: true, items: [{ id: "room-ended", owner_account_id: "creator-1", title: "Finished room", description: "Archived authority", lifecycle_state: "ended", max_guest_stage_occupants: 9, waiting_guest_count: 0, admitted_guest_count: 0, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T01:00:00Z", opened_at: "2026-07-11T00:10:00Z", ended_at: "2026-07-11T01:00:00Z" }] });
  }));
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Finished room")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Room ended" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Enter room" })).not.toBeInTheDocument();
});

it("renders the pre-media Stage and Backstage, changes local layout, and preserves Runtime lobby and invite actions", async () => {
  class EventSourceStub { onerror: (() => void) | null = null; addEventListener() {} close() {} }
  vi.stubGlobal("EventSource", EventSourceStub);
  const payload = authPayload("creator");
  let lobby = [
    { id: "guest-wait", room_id: "room-1", display_name: "Waiting Guest", account_id: null, state: "waiting", created_at: "2026-07-11T00:20:00Z", updated_at: "2026-07-11T00:20:00Z", expires_at: "2026-07-11T12:20:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null },
    { id: "guest-stage", room_id: "room-1", display_name: "Stage Guest", account_id: null, state: "admitted", created_at: "2026-07-11T00:10:00Z", updated_at: "2026-07-11T00:15:00Z", expires_at: "2026-07-11T12:10:00Z", admitted_at: "2026-07-11T00:15:00Z", denied_at: null, removed_at: null, left_at: null },
  ];
  let invites: object[] = [];
  const room = () => ({ id: "room-1", owner_account_id: "creator-1", title: "Production room", description: "Confirmed room description", lifecycle_state: "open", max_guest_stage_occupants: 9, waiting_guest_count: lobby.filter((guest) => guest.state === "waiting").length, admitted_guest_count: lobby.filter((guest) => guest.state === "admitted").length, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:30:00Z", opened_at: "2026-07-11T00:05:00Z", ended_at: null });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/rooms/room-1/lobby/guest-wait/admit")) {
      lobby = lobby.map((guest) => guest.id === "guest-wait" ? { ...guest, state: "admitted", admitted_at: "2026-07-11T00:31:00Z" } : guest);
      return response({ success: true, guest: lobby[0] });
    }
    if (url.endsWith("/api/studio/rooms/room-1/invites") && init?.method === "POST") {
      invites = [{ id: "invite-1", room_id: "room-1", label: "Panel", active: true, invite_code: "Abc234Xyz", policy_type: "open", max_uses: null, successful_use_count: 0, permanent: false, exhausted: false, expires_at: "2026-07-12T00:32:00Z", created_at: "2026-07-11T00:32:00Z", updated_at: "2026-07-11T00:32:00Z", revoked_at: null }];
      return response({ success: true, invite: invites[0], invite_code: "Abc234Xyz" }, 201);
    }
    if (url.endsWith("/api/studio/rooms/room-1/lobby")) return response({ success: true, items: lobby });
    if (url.endsWith("/api/studio/rooms/room-1/invites")) return response({ success: true, items: invites });
    if (url.endsWith("/api/studio/rooms/room-1/cohosts")) return response({ success: true, director: { id: "creator-1", display_name: "creator", avatar_url: null }, session: [], permanent: [], permissions: { owner: true, manage_backstage: true, manage_invites: true, update_room: true, update_presentation: true, manage_permanent_cohosts: true, end_room: true } });
    if (url.endsWith("/api/studio/rooms/room-1")) return response({ success: true, room: room(), permissions: { owner: true, manage_backstage: true, manage_invites: true, update_room: true, update_presentation: true, manage_permanent_cohosts: true, end_room: true } });
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter initialEntries={["/studio/rooms/room-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/rooms/:roomId" element={<RoomManagementPage />} /></Routes></MemoryRouter></StudioAuthProvider></ThemeProvider>);

  expect(await screen.findByRole("heading", { name: "Production room" })).toBeInTheDocument();
  expect(screen.getByText("Stage", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Waiting backstage" })).toBeInTheDocument();
  expect(screen.getAllByText("Stage Guest")).toHaveLength(2);
  expect(screen.getAllByText("creator").length).toBeGreaterThan(0);
  expect(screen.getByText("OFF AIR")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Microphone. Media is not connected" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Interview" }));
  expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-layout", "interview");

  fireEvent.click(screen.getByRole("button", { name: "Admit" }));
  await waitFor(() => expect(screen.getByText(/Guest admitted by Runtime\/Auth/)).toBeInTheDocument());
  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/lobby/guest-wait/admit"))).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Invite. Open secure invites" }));
  fireEvent.change(screen.getByLabelText("Invite label (optional)"), { target: { value: "Panel" } });
  fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
  expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
  expect(window.localStorage.getItem("Abc234Xyz")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Go live" }));
  expect(screen.getByRole("dialog", { name: "Live output is not connected yet." })).toBeInTheDocument();
});

it("validates an invite, joins the lobby, and displays admission-neutral waiting state", async () => {
  class EventSourceStub { onerror: (() => void) | null = null; addEventListener() {} close() {} }
  vi.stubGlobal("EventSource", EventSourceStub);
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response({ authenticated: false }, 401);
    if (url.includes("/api/studio/invites/validate")) return response({ success: true, room: { id: "room-1", title: "Guest room", description: "Panel", lifecycle_state: "open", director: { id: "creator-1", display_name: "Creator", avatar_url: null } }, invite: { id: "invite-1", room_id: "room-1", label: null, active: true, invite_code: "safe-invite-code", policy_type: "open", max_uses: null, successful_use_count: 0, permanent: true, exhausted: false, expires_at: null, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", revoked_at: null }, expires_at: null });
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
  fireEvent.click(screen.getByRole("button", { name: "Join as guest" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Waiting in lobby" })).toBeInTheDocument());
  expect(screen.getByText("Not connected")).toBeInTheDocument();
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
