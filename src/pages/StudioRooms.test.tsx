import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { StudioAuthProvider } from "../auth/StudioAuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { JoinPage } from "./JoinPage";
import { RoomManagementPage } from "./RoomManagementPage";
import { StudioPage } from "./StudioPage";
import { PresentationProvider } from "../presentation/PresentationProvider";

function response(payload: object, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status }));
}

function authPayload(role: "creator" | "public") {
  return {
    session: { authenticated: true, user: { internal_id: `${role}-1`, user_code: "ABC1234", display_name: role, avatar_url: null, role, tier: "CORE" } },
    access: { authenticated: true, access_allowed: true, reason_code: "alpha_grant_active", stage: "ALPHA", active_tester_limit: 25 },
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete (Element.prototype as { requestFullscreen?: unknown }).requestFullscreen;
  delete (document as { exitFullscreen?: unknown }).exitFullscreen;
  delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  vi.unstubAllGlobals();
});

it("shows the truthful public-account invitation policy without fetching owner rooms", async () => {
  const payload = authPayload("public");
  const fetchMock = vi.fn((input: RequestInfo | URL) => String(input).includes("/auth/session") ? response(payload.session) : response(payload.access));
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
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
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
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
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect(await screen.findByText("Finished room")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Room ended" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Enter room" })).not.toBeInTheDocument();
});

it("renders the pre-media Stage and Backstage, changes local layout, and preserves Runtime lobby and invite actions", async () => {
  let eventSourceCount = 0;
  class EventSourceStub { onerror: (() => void) | null = null; constructor() { eventSourceCount += 1; } addEventListener() {} close() {} }
  vi.stubGlobal("EventSource", EventSourceStub);
  let fullscreenElement: Element | null = null;
  const requestFullscreen = vi.fn(() => {
    fullscreenElement = document.querySelector(".studio-main");
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
  Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: vi.fn(() => { fullscreenElement = null; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); }) });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  const payload = authPayload("creator");
  let lobby = [
    { id: "guest-wait", room_id: "room-1", display_name: "Waiting Guest", account_id: null, state: "backstage", stage_position: null, created_at: "2026-07-11T00:20:00Z", updated_at: "2026-07-11T00:20:00Z", expires_at: "2026-07-11T12:20:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null },
    { id: "guest-stage", room_id: "room-1", display_name: "Stage Guest", account_id: null, state: "on_stage", stage_position: 0, created_at: "2026-07-11T00:10:00Z", updated_at: "2026-07-11T00:15:00Z", expires_at: "2026-07-11T12:10:00Z", admitted_at: "2026-07-11T00:15:00Z", denied_at: null, removed_at: null, left_at: null },
  ];
  let invites: object[] = [];
  let layout = "grid";
  const room = () => ({ id: "room-1", owner_account_id: "creator-1", title: "Production room", description: "Confirmed room description", lifecycle_state: "open", max_guest_stage_occupants: 9, backstage_guest_count: lobby.filter((guest) => guest.state === "backstage").length, on_stage_guest_count: lobby.filter((guest) => guest.state === "on_stage").length, presentation: { show_participant_subtitles: true, layout_mode: layout, spotlight_guest_id: null, presentation_guest_id: null }, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:30:00Z", opened_at: "2026-07-11T00:05:00Z", ended_at: null });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/rooms/room-1/participants/guest-wait/stage")) {
      lobby = lobby.map((guest) => guest.id === "guest-wait" ? { ...guest, state: "on_stage", stage_position: 1, admitted_at: "2026-07-11T00:31:00Z" } : guest);
      return response({ success: true, guest: lobby[0] });
    }
    if (url.endsWith("/api/studio/rooms/room-1/presentation") && init?.method === "PATCH") { layout = String(JSON.parse(String(init.body)).layout_mode); return response({ success: true, room: room() }); }
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
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter initialEntries={["/studio/rooms/room-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/rooms/:roomId" element={<RoomManagementPage />} /></Routes></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);

  expect(await screen.findByRole("heading", { name: "Production room" })).toBeInTheDocument();
  expect(screen.getByText("STAGE OUTPUT")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Waiting Backstage" })).toBeInTheDocument();
  expect(screen.getAllByText("Stage Guest").length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText("creator").length).toBeGreaterThan(0);
  expect(screen.getByText("OFF AIR")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Microphone. Media is not connected" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Enter cinematic/i }));
  expect(screen.getByText("Production room").closest(".studio-shell")).toHaveClass("studio-shell--cinematic");
  expect(eventSourceCount).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Backstage. 1 waiting, 1 on stage" }));
  expect(screen.getByRole("dialog", { name: "Room tools" })).toBeInTheDocument();
  expect(screen.getAllByText("Waiting Guest").length).toBeGreaterThanOrEqual(2);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Room tools" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument());
  expect(requestFullscreen).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Fullscreen" })).toBeInTheDocument());
  requestFullscreen.mockRejectedValueOnce(new Error("blocked"));
  fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
  expect(await screen.findByText("Browser fullscreen was not allowed. Cinematic mode remains available.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Exit fullscreen" })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: "f" });
  expect(screen.getByText("Production room").closest(".studio-shell")).not.toHaveClass("studio-shell--cinematic");
  expect(eventSourceCount).toBe(1);

  fireEvent.click(screen.getByRole("button", { name: "Interview" }));
  expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-layout", "interview");

  fireEvent.click(screen.getAllByRole("button", { name: "Move to Stage" })[0]);
  await waitFor(() => expect(screen.getByText(/moved onto Stage/)).toBeInTheDocument());
  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/participants/guest-wait/stage"))).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Invite. Open secure invites" }));
  fireEvent.change(screen.getByLabelText("Invite label (optional)"), { target: { value: "Panel" } });
  fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
  expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
  expect(window.localStorage.getItem("Abc234Xyz")).toBeNull();

  const goLiveTrigger = screen.getByRole("button", { name: "Go live" });
  goLiveTrigger.focus();
  fireEvent.click(goLiveTrigger);
  expect(screen.getByRole("dialog", { name: "Live output is not connected yet." })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Got it" })).toHaveFocus());
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Live output is not connected yet." })).not.toBeInTheDocument();
  await waitFor(() => expect(goLiveTrigger).toHaveFocus());
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
      return response({ success: true, guest: { id: "guest-1", room_id: "room-1", display_name: "Guest Person", account_id: null, state: "backstage", created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", expires_at: "2026-07-11T12:00:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null } }, 201);
    }
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter initialEntries={["/join/safe-invite-code"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/join/:inviteCode" element={<JoinPage />} /><Route path="/studio/rooms/:roomId" element={<h1>Guest room workspace</h1>} /></Routes></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Valid room invite")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: "Guest Person" } });
  expect(screen.getByRole("radiogroup", { name: "Initials color" })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Initials color" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with StreamSuites" }));
  expect(screen.getByRole("dialog", { name: "Sign in with StreamSuites" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close sign in" }));
  expect(screen.queryByRole("dialog", { name: "Sign in with StreamSuites" })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Display name/)).toHaveValue("Guest Person");
  fireEvent.click(screen.getByRole("button", { name: "Join as guest" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Guest room workspace" })).toBeInTheDocument());
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
