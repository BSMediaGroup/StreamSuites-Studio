import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

it("completes Runtime-owned lobby broadcast details and thumbnail create-edit workflow", async () => {
  const payload = authPayload("creator");
  const NativeURL = URL;
  vi.stubGlobal("URL", class extends NativeURL { static createObjectURL() { return "blob:thumbnail-preview"; } static revokeObjectURL() {} });
  const canonical = (overrides: object = {}) => ({ id: "room-broadcast", owner_account_id: "creator-1", title: "Internal green room", description: null, broadcast_title: "Launch broadcast", broadcast_description: "A concise public description", broadcast_thumbnail_asset_id: "asset-thumb", broadcast_thumbnail_url: "https://cdn.streamsuites.app/studio/rooms/RoomCode/broadcast-thumbnail/11111111-1111-1111-1111-111111111111/v1.webp", broadcast_thumbnail_revision: 1, scheduled_start_at: "2026-07-31T23:30:00Z", broadcast_visibility: "unlisted", destination_readiness: { available_count: 5, connected_count: 1, configured_count: 1, ready_count: 0, output_enabled: false }, lifecycle_state: "draft", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, backstage_guest_count: 2, on_stage_guest_count: 1, created_at: "2026-07-16T00:00:00Z", updated_at: "2026-07-16T00:01:00Z", opened_at: null, ended_at: null, ...overrides });
  let rooms: Array<ReturnType<typeof canonical>> = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/cohosts/invitations")) return response({ success: true, items: [] });
    if (url.endsWith("/api/studio/rooms/room-broadcast/assets") && init?.method === "POST") return response({ success: true, asset: { id: "asset-thumb", room_id: "room-broadcast", category: "broadcast_thumbnail", display_name: "launch.png", url: "https://cdn.streamsuites.app/studio/rooms/RoomCode/assets/11111111-1111-1111-1111-111111111111/v1.webp", mime_type: "image/webp", width: 640, height: 360, file_size: 1000, sort_order: 0, created_at: "2026-07-16T00:00:30Z", updated_at: "2026-07-16T00:00:30Z" } }, 201);
    if (url.endsWith("/api/studio/rooms/room-broadcast/assets")) return response({ success: true, items: [{ id: "asset-thumb", room_id: "room-broadcast", category: "broadcast_thumbnail", display_name: "launch.png", url: "https://cdn.streamsuites.app/studio/rooms/RoomCode/assets/11111111-1111-1111-1111-111111111111/v1.webp", mime_type: "image/webp", width: 640, height: 360, file_size: 1000, sort_order: 0, created_at: "2026-07-16T00:00:30Z", updated_at: "2026-07-16T00:00:30Z" }] });
    if (url.endsWith("/api/studio/rooms/room-broadcast") && init?.method === "PATCH") { const body = JSON.parse(String(init.body)); rooms = [canonical({ broadcast_title: body.broadcast_title ?? rooms[0]?.broadcast_title, broadcast_visibility: body.broadcast_visibility ?? rooms[0]?.broadcast_visibility, broadcast_thumbnail_url: body.broadcast_thumbnail_asset_id === null ? null : "https://cdn.streamsuites.app/studio/rooms/RoomCode/broadcast-thumbnail/11111111-1111-1111-1111-111111111111/v1.webp", broadcast_thumbnail_asset_id: body.broadcast_thumbnail_asset_id === null ? null : "asset-thumb", updated_at: "2026-07-16T00:02:00Z" })]; return response({ success: true, room: rooms[0] }); }
    if (url.endsWith("/api/studio/rooms") && init?.method === "POST") { rooms = [canonical({ broadcast_thumbnail_asset_id: null, broadcast_thumbnail_url: null, broadcast_thumbnail_revision: 0 })]; return response({ success: true, room: rooms[0] }, 201); }
    if (url.endsWith("/api/studio/rooms")) return response({ success: true, items: rooms, destination_readiness: { available_count: 5, connected_count: 1, configured_count: 1, ready_count: 0, output_enabled: false } });
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect(await screen.findByRole("heading", { name: "Create Room" })).toBeInTheDocument();
  for (const heading of ["Room Details", "Broadcast Details", "Thumbnail", "Destinations Summary"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  const create = screen.getByRole("heading", { name: "Create Room" }).closest(".card") as HTMLElement;
  expect(within(create).getByRole("button", { name: "Create room" })).toBeDisabled();
  fireEvent.change(within(create).getByLabelText("Internal room name"), { target: { value: "Internal green room" } });
  fireEvent.change(within(create).getByLabelText("Broadcast title"), { target: { value: "Launch broadcast" } });
  fireEvent.change(within(create).getByLabelText("Broadcast description"), { target: { value: "A concise public description" } });
  fireEvent.click(within(create).getByLabelText("Schedule this broadcast"));
  fireEvent.change(within(create).getByLabelText("Scheduled date and time"), { target: { value: "2026-08-01T09:30" } });
  fireEvent.change(within(create).getByLabelText("Visibility"), { target: { value: "unlisted" } });
  fireEvent.change(within(create).getByLabelText("Upload PNG, JPEG, or WebP"), { target: { files: [new File(["image"], "launch.png", { type: "image/png" })] } });
  expect(within(create).getByAltText("Broadcast thumbnail preview")).toHaveAttribute("src", "blob:thumbnail-preview");
  fireEvent.click(within(create).getByRole("button", { name: "Create room" }));
  expect(await screen.findByRole("heading", { name: "Launch broadcast" })).toBeInTheDocument();
  expect(screen.getByText("A concise public description")).toBeInTheDocument();
  expect(screen.getByText("unlisted")).toBeInTheDocument();
  expect(screen.getByTitle("Room code")).toHaveTextContent("room-broadcast");
  expect(screen.getByAltText("Launch broadcast thumbnail")).toHaveAttribute("src", expect.stringContaining("https://cdn.streamsuites.app/"));
  expect(screen.getByRole("link", { name: "Open room" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete room" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit room" }));
  const dialog = await screen.findByRole("dialog", { name: "Edit Internal green room" });
  expect(within(dialog).getByLabelText("Internal room name")).toHaveValue("Internal green room");
  expect(within(dialog).getByLabelText("Broadcast title")).toHaveValue("Launch broadcast");
  expect(within(dialog).getByLabelText("Broadcast description")).toHaveValue("A concise public description");
  expect(within(dialog).getByLabelText("Visibility")).toHaveValue("unlisted");
  fireEvent.change(within(dialog).getByLabelText("Broadcast title"), { target: { value: "Edited launch" } });
  fireEvent.change(within(dialog).getByLabelText("Visibility"), { target: { value: "private" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove thumbnail" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Save room" }));
  expect(await screen.findByRole("heading", { name: "Edited launch" })).toBeInTheDocument();
  expect(screen.getByAltText("Default broadcast thumbnail")).toHaveAttribute("src", expect.stringContaining("defaultssthumb.svg"));
  expect(screen.getByText("1 destinations connected · 0 ready")).toBeInTheDocument();
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
    return response({ success: true, items: [{ id: "room-1", owner_account_id: "creator-1", title: "Real room", description: null, lifecycle_state: "draft", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, waiting_guest_count: 0, admitted_guest_count: 0, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", opened_at: null, ended_at: null }] });
  }));
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect((await screen.findAllByText("Real room")).length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText(/Studio remains OFF AIR/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("link", { name: "Open room" })).toHaveAttribute("href", "/studio/rooms/room-1");
  expect(screen.getByText("0 on Stage · 0 waiting")).toBeInTheDocument();
  expect(screen.queryByText(/viewer count/i)).not.toBeInTheDocument();
});

it("edits and deletes lobby rooms and accepts signed-in cohost requests from the header", async () => {
  const payload = authPayload("creator");
  let rooms = [{ id: "room-edit", owner_account_id: "creator-1", title: "Editable room", description: "Before", lifecycle_state: "draft", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, waiting_guest_count: 0, admitted_guest_count: 0, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", opened_at: null, ended_at: null }];
  let requests = [{ id: "request-1", director: { id: "director-2", display_name: "Requesting director", avatar_url: null }, cohost: { id: "creator-1", display_name: "creator", avatar_url: null }, status: "pending", scope_type: "selected_rooms", room_ids: ["safe-code"], room: { id: "safe-code", title: "Requested room" }, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", expires_at: "2099-07-30T00:00:00Z" }];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/cohosts/invitations") && !init?.method) return response({ success: true, items: requests });
    if (url.endsWith("/api/studio/cohosts/invitations/request-1/accept")) { const accepted = requests[0]; requests = []; return response({ success: true, relationship: { ...accepted, status: "accepted", updated_at: "2026-07-11T00:01:00Z" } }); }
    if (url.endsWith("/api/studio/rooms/room-edit") && init?.method === "PATCH") { rooms = [{ ...rooms[0], title: JSON.parse(String(init.body)).title, updated_at: "2026-07-11T00:02:00Z" }]; return response({ success: true, room: rooms[0] }); }
    if (url.endsWith("/api/studio/rooms/room-edit") && init?.method === "DELETE") { rooms = []; return response({ success: true, deleted: true, room_id: "room-edit" }); }
    if (url.endsWith("/api/studio/rooms")) return response({ success: true, items: rooms });
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect((await screen.findAllByText("Editable room")).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("button", { name: /Requests/ })).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: /Requests/ }));
  expect(screen.getByText("Requested room")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  await waitFor(() => expect(screen.getByText(/request accepted/i)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Edit room" }));
  const editDialog = screen.getByRole("dialog", { name: "Edit Editable room" });
  fireEvent.change(within(editDialog).getByLabelText("Internal room name"), { target: { value: "Edited room" } });
  fireEvent.click(within(editDialog).getByRole("button", { name: "Save room" }));
  expect((await screen.findAllByText("Edited room")).length).toBeGreaterThanOrEqual(1);
  fireEvent.click(screen.getByRole("button", { name: "Delete room" }));
  const deleteDialog = screen.getByRole("alertdialog", { name: "Delete Edited room?" });
  fireEvent.change(within(deleteDialog).getByLabelText("Type Edited room to confirm"), { target: { value: "Edited room" } });
  fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete room permanently" }));
  await waitFor(() => expect(screen.queryAllByText("Edited room")).toHaveLength(0));
});

it("keeps ended rooms visible without presenting an active Enter room action", async () => {
  const payload = authPayload("creator");
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    return response({ success: true, items: [{ id: "room-ended", owner_account_id: "creator-1", title: "Finished room", description: "Archived authority", lifecycle_state: "ended", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, waiting_guest_count: 0, admitted_guest_count: 0, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T01:00:00Z", opened_at: "2026-07-11T00:10:00Z", ended_at: "2026-07-11T01:00:00Z" }] });
  }));
  render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StudioPage /></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect((await screen.findAllByText("Finished room")).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("button", { name: "Room ended" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Open room" })).not.toBeInTheDocument();
});

it("renders the pre-media Stage and Backstage, changes local layout, and preserves Runtime lobby and invite actions", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
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
  let lobby: Array<{ id: string; room_id: string; display_name: string; account_id: string | null; state: string; session_cohost?: boolean; stage_position: number | null; created_at: string; updated_at: string; expires_at: string; admitted_at: string | null; denied_at: null; removed_at: null; left_at: null }> = [
    { id: "guest-wait", room_id: "room-1", display_name: "Waiting Guest", account_id: null, state: "backstage", stage_position: null, created_at: "2026-07-11T00:20:00Z", updated_at: "2026-07-11T00:20:00Z", expires_at: "2026-07-11T12:20:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null },
    { id: "guest-stage", room_id: "room-1", display_name: "Stage Guest", account_id: null, state: "on_stage", stage_position: 0, created_at: "2026-07-11T00:10:00Z", updated_at: "2026-07-11T00:15:00Z", expires_at: "2026-07-11T12:10:00Z", admitted_at: "2026-07-11T00:15:00Z", denied_at: null, removed_at: null, left_at: null },
  ];
  let invites: object[] = [];
  let layout = "grid";
  const room = () => ({ id: "room-1", owner_account_id: "creator-1", title: "Production room", description: "Confirmed room description", lifecycle_state: "open", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, backstage_guest_count: lobby.filter((guest) => guest.state === "backstage").length, on_stage_guest_count: lobby.filter((guest) => guest.state === "on_stage").length, presentation: { show_participant_subtitles: true, layout_mode: layout, spotlight_guest_id: null, presentation_guest_id: null }, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:30:00Z", opened_at: "2026-07-11T00:05:00Z", ended_at: null });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/cohosts/invitations")) return response({ success: true, items: [] });
    if (url.endsWith("/api/studio/rooms/room-1/participants/guest-wait/stage")) {
      lobby = lobby.map((guest) => guest.id === "guest-wait" ? { ...guest, state: "on_stage", stage_position: 1, admitted_at: "2026-07-11T00:31:00Z" } : guest);
      return response({ success: true, guest: lobby[0] });
    }
    if (url.endsWith("/api/studio/rooms/room-1/presentation") && init?.method === "PATCH") { layout = String(JSON.parse(String(init.body)).layout_mode); return response({ success: true, room: room() }); }
    if (url.endsWith("/api/studio/rooms/room-1/invites") && init?.method === "POST") {
      invites = [{ id: "invite-1", room_id: "room-1", label: "Panel", active: true, invite_code: "Abc234Xyz", policy_type: "open", max_uses: null, successful_use_count: 0, permanent: false, exhausted: false, expires_at: "2026-07-12T00:32:00Z", created_at: "2026-07-11T00:32:00Z", updated_at: "2026-07-11T00:32:00Z", revoked_at: null }];
      return response({ success: true, invite: invites[0], invite_code: "Abc234Xyz" }, 201);
    }
    if (url.endsWith("/api/studio/rooms/room-1/invites/invite-1/revoke") && init?.method === "POST") { invites = [{ ...(invites[0] as object), active: false, invite_code: undefined, revoked_at: "2026-07-11T00:33:00Z" }]; return response({ success: true, invite: invites[0] }); }
    if (url.endsWith("/api/studio/rooms/room-1/invites/invite-1") && init?.method === "DELETE") { invites = []; return response({ success: true, id: "invite-1", deleted: true }); }
    if (url.endsWith("/api/studio/rooms/room-1/lobby")) return response({ success: true, items: lobby });
    if (url.endsWith("/api/studio/rooms/room-1/invites")) return response({ success: true, items: invites });
    if (url.endsWith("/api/studio/rooms/room-1/presentation-sources") || url.endsWith("/api/studio/rooms/room-1/browser-sources")) return response({ success: true, items: [] });
    if (url.endsWith("/api/studio/rooms/room-1/cohosts")) return response({ success: true, director: { id: "creator-1", display_name: "creator", avatar_url: null }, session: [], permanent: [], permissions: { owner: true, manage_backstage: true, manage_invites: true, update_room: true, update_presentation: true, manage_permanent_cohosts: true, end_room: true } });
    if (url.endsWith("/api/studio/rooms/room-1")) return response({ success: true, room: room(), permissions: { owner: true, manage_backstage: true, manage_invites: true, update_room: true, update_presentation: true, manage_permanent_cohosts: true, end_room: true } });
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  const rendered = render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter initialEntries={["/studio/rooms/room-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/rooms/:roomId" element={<RoomManagementPage />} /></Routes></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);

  expect(await screen.findByRole("heading", { name: "Production room" })).toBeInTheDocument();
  expect(screen.getByText("STAGE OUTPUT")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Waiting Backstage" })).toBeInTheDocument();
  expect(screen.getAllByText("Stage Guest").length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText("creator").length).toBeGreaterThan(0);
  expect(screen.getByText("OFF AIR")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Microphone. Media status unavailable" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Connect media. Media status unavailable" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Backstage. 1 waiting, 1 on stage" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("backstage.svg");
  expect(screen.getByRole("button", { name: "Backstage. 1 waiting, 1 on stage" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("backstage-filled.svg");
  expect(screen.getByRole("button", { name: "Previous production controls" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("previous.svg");
  expect(screen.getByRole("button", { name: "Next production controls" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("next.svg");
  expect(screen.getAllByRole("button", { name: "Move to Stage" })[0].querySelector(".studio-icon")?.getAttribute("style")).toContain("moveselectionup.svg");
  expect(screen.getByRole("link", { name: "Rooms" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("exitroom.svg");
  expect(rendered.container.querySelector(".production-rail")).not.toBeInTheDocument();
  expect(rendered.container.querySelector(".room-lifecycle-bar")).not.toBeInTheDocument();
  expect(screen.getByTitle("Room ID").parentElement).toHaveTextContent("ROOM DETAILS");
  fireEvent.click(screen.getByRole("button", { name: "Expand right sidebar" }));
  expect(screen.getByRole("button", { name: "Collapse right sidebar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse right sidebar" }));
  expect(screen.getByRole("button", { name: "Open Backstage panel" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Backstage panel" }));
  expect(screen.getByRole("button", { name: "Expand right sidebar" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Enter cinematic/i }));
  expect(screen.getByText("Production room").closest(".studio-shell")).toHaveClass("studio-shell--cinematic");
  expect(eventSourceCount).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "View options" }));
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

  fireEvent.click(screen.getByRole("button", { name: "Interview layout" }));
  expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-layout", "interview");
  await waitFor(() => expect(screen.getByRole("button", { name: "Auto layout" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Auto layout" }));
  await waitFor(() => expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-layout", "auto"));
  expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-effective-layout", "interview");

  fireEvent.click(screen.getAllByRole("button", { name: "Move to Stage" })[0]);
  await waitFor(() => expect(screen.getByText(/moved onto Stage/)).toBeInTheDocument());
  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/participants/guest-wait/stage"))).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Invite. Open secure invites" }));
  fireEvent.change(screen.getByLabelText("Invite label (optional)"), { target: { value: "Panel" } });
  fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
  expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
  expect(screen.getByLabelText("Invite code")).toHaveTextContent("Abc234Xyz");
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.getByText("No invites yet")).toBeInTheDocument());
  expect(window.localStorage.getItem("Abc234Xyz")).toBeNull();

  expect(screen.getByRole("button", { name: "Go live" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Go live. Output integration not connected" })).toBeDisabled();
});

it("enforces nine total Stage slots across layouts and recovers after a capacity rejection", async () => {
  class EventSourceStub { onerror: (() => void) | null = null; addEventListener() {} close() {} }
  vi.stubGlobal("EventSource", EventSourceStub);
  const payload = authPayload("creator");
  let layout = "grid";
  let lobby: Array<{ id: string; room_id: string; display_name: string; account_id: string | null; state: string; session_cohost?: boolean; stage_position: number | null; created_at: string; updated_at: string; expires_at: string; admitted_at: string | null; denied_at: null; removed_at: null; left_at: null }> = [
    ...Array.from({ length: 8 }, (_, index) => ({ id: `stage-${index}`, room_id: "room-capacity", display_name: `Stage ${index}`, account_id: index === 0 ? "cohost-1" : null, state: "on_stage", session_cohost: index === 0, stage_position: index, created_at: `2026-07-11T00:0${index}:00Z`, updated_at: "2026-07-11T00:20:00Z", expires_at: "2026-07-11T12:00:00Z", admitted_at: "2026-07-11T00:20:00Z", denied_at: null, removed_at: null, left_at: null })),
    { id: "wait", room_id: "room-capacity", display_name: "Waiting", account_id: null, state: "backstage", stage_position: null, created_at: "2026-07-11T00:30:00Z", updated_at: "2026-07-11T00:30:00Z", expires_at: "2026-07-11T12:30:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null },
  ];
  const room = () => ({ id: "room-capacity", owner_account_id: "creator-1", title: "Capacity room", description: null, lifecycle_state: "open", max_guest_stage_occupants: 8, total_stage_capacity: 9, reserved_director_stage_slots: 1, max_additional_stage_participants: 8, backstage_guest_count: lobby.filter((guest) => guest.state === "backstage").length, on_stage_guest_count: lobby.filter((guest) => guest.state === "on_stage").length, presentation: { show_participant_subtitles: true, layout_mode: layout, spotlight_guest_id: null, presentation_guest_id: null }, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:30:00Z", opened_at: "2026-07-11T00:05:00Z", ended_at: null });
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.endsWith("/api/studio/cohosts/invitations")) return response({ success: true, items: [] });
    if (url.endsWith("/participants/stage-0/backstage")) {
      lobby = lobby.map((guest) => guest.id === "stage-0" ? { ...guest, state: "backstage", stage_position: null } : guest);
      return response({ success: true, guest: lobby.find((guest) => guest.id === "stage-0") });
    }
    if (url.endsWith("/participants/wait/stage")) return response({ success: false, error: "Stage capacity reached: maximum of 9 Stage participants including the director.", error_code: "stage_capacity_reached" }, 409);
    if (url.endsWith("/presentation") && init?.method === "PATCH") { layout = String(JSON.parse(String(init.body)).layout_mode); return response({ success: true, room: room() }); }
    if (url.endsWith("/lobby")) return response({ success: true, items: lobby });
    if (url.endsWith("/invites")) return response({ success: true, items: [] });
    if (url.endsWith("/presentation-sources") || url.endsWith("/browser-sources")) return response({ success: true, items: [] });
    if (url.endsWith("/cohosts")) return response({ success: true, director: { id: "creator-1", display_name: "creator", avatar_url: null }, session: [lobby[0]], permanent: [], permissions: { owner: true, manage_backstage: true, manage_participants: true, update_presentation: true, end_room: true } });
    if (url.endsWith("/api/studio/rooms/room-capacity")) return response({ success: true, room: room(), permissions: { owner: true, manage_backstage: true, manage_participants: true, update_presentation: true, end_room: true } });
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  const rendered = render(<ThemeProvider><PresentationProvider><StudioAuthProvider><MemoryRouter initialEntries={["/studio/rooms/room-capacity"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/rooms/:roomId" element={<RoomManagementPage />} /></Routes></MemoryRouter></StudioAuthProvider></PresentationProvider></ThemeProvider>);
  expect(await screen.findByRole("heading", { name: "Capacity room" })).toBeInTheDocument();
  expect(rendered.container.querySelectorAll("[data-testid='program-canvas'] .participant-tile")).toHaveLength(9);
  expect(screen.getByText("8 / 8 additional · 9 total")).toBeInTheDocument();
  screen.getAllByRole("button", { name: "Move to Stage" }).forEach((button) => expect(button).toBeDisabled());
  for (const mode of ["Interview", "Spotlight", "Presentation", "Auto"] as const) {
    fireEvent.click(screen.getByRole("button", { name: `${mode} layout` }));
    await waitFor(() => expect(screen.getByTestId("program-canvas")).toHaveAttribute("data-layout", mode.toLowerCase()));
    expect(rendered.container.querySelectorAll("[data-testid='program-canvas'] .participant-tile").length).toBeLessThanOrEqual(9);
  }
  expect(rendered.container.querySelectorAll("[data-testid='program-canvas'] .participant-tile")).toHaveLength(9);
  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Enter cinematic/i }));
  expect(rendered.container.querySelectorAll("[data-testid='program-canvas'] .participant-tile")).toHaveLength(9);
  fireEvent.click(screen.getByLabelText("Actions for Stage 0"));
  const stageZeroMenu = screen.getByRole("menu", { name: "Actions for Stage 0" });
  expect(within(stageZeroMenu).getByRole("menuitem", { name: "Move Backstage" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("moveselectiondown.svg");
  expect(within(stageZeroMenu).getByRole("menuitem", { name: "Move Backstage" }).querySelector(".studio-icon")?.getAttribute("style")).toContain("moveselectiondown-filled.svg");
  fireEvent.click(stageZeroMenu.querySelector<HTMLButtonElement>('button[role="menuitem"]') as HTMLButtonElement);
  await waitFor(() => screen.getAllByRole("button", { name: "Move to Stage" }).forEach((button) => expect(button).toBeEnabled()));
  expect(lobby.filter((guest) => guest.state === "on_stage")).toHaveLength(7);
  const waitingTile = Array.from(rendered.container.querySelectorAll(".backstage-tile")).find((tile) => within(tile as HTMLElement).queryAllByText("Waiting").length > 0);
  expect(waitingTile).toBeTruthy();
  fireEvent.click(within(waitingTile as HTMLElement).getByRole("button", { name: "Move to Stage" }));
  expect(await screen.findByText("Stage full — 9 participants including the director. Move someone Backstage before admitting another participant.")).toBeInTheDocument();
  expect(lobby.filter((guest) => guest.state === "on_stage")).toHaveLength(7);
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

it("hydrates the same invite form after password login and joins as a server-linked account", async () => {
  class EventSourceStub { onerror: (() => void) | null = null; addEventListener() {} close() {} }
  vi.stubGlobal("EventSource", EventSourceStub);
  let authenticated = false;
  let submitted: Record<string, unknown> | null = null;
  const accountSession = { authenticated: true, user: { internal_id: "account-1", user_code: "DAN1234", display_name: "Daniel Account", avatar_url: "https://cdn.streamsuites.app/avatars/account-1.webp", role: "public", tier: "CORE" } };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/access-state")) return response({ mode: "normal", login_allowed: true });
    if (url.includes("/auth/turnstile/config")) return response({ enabled: false, runtime_enabled: true, configured: false, sitekey: "" });
    if (url.includes("/auth/login/password")) { authenticated = true; return response({ success: true }); }
    if (url.includes("/auth/session")) return authenticated ? response(accountSession) : response({ authenticated: false }, 401);
    if (url.includes("/api/studio/access")) return response({ authenticated: true, access_allowed: true, reason_code: "alpha_grant_active", stage: "ALPHA", active_tester_limit: 25 });
    if (url.includes("/api/studio/invites/validate")) return response({ success: true, room: { id: "room-1", title: "Guest room", description: "Panel", lifecycle_state: "open", director: { id: "creator-1", display_name: "Creator", avatar_url: null } }, invite: { id: "invite-1", room_id: "room-1", label: null, active: true, invite_code: "safe-invite-code", policy_type: "open", max_uses: null, successful_use_count: 0, permanent: true, exhausted: false, expires_at: null, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", revoked_at: null }, expires_at: null });
    if (url.includes("/api/studio/invites/join")) {
      submitted = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({ success: true, guest: { id: "guest-1", room_id: "room-1", display_name: "Daniel Account", account_id: "account-1", account_user_code: "DAN1234", linked_account: { user_code: "DAN1234", display_name: "Daniel Account", avatar_url: "https://cdn.streamsuites.app/avatars/account-1.webp" }, avatar_url: "https://cdn.streamsuites.app/avatars/account-1.webp", avatar_source: "linked_account", state: "backstage", created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", expires_at: "2026-07-11T12:00:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null } }, 201);
    }
    return response({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter initialEntries={["/join/safe-invite-code"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/join/:inviteCode" element={<JoinPage />} /><Route path="/studio/rooms/:roomId" element={<h1>Linked guest workspace</h1>} /></Routes></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByText("Valid room invite")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with StreamSuites" }));
  const loginDialog = await screen.findByRole("dialog", { name: "Sign in with StreamSuites" });
  fireEvent.change(within(loginDialog).getByLabelText("Email"), { target: { value: "daniel@example.com" } });
  fireEvent.change(within(loginDialog).getByLabelText("Password"), { target: { value: "correct horse" } });
  const signIn = within(loginDialog).getByRole("button", { name: "Sign in with StreamSuites" });
  await waitFor(() => expect(signIn).toBeEnabled());
  fireEvent.click(signIn);
  expect(await screen.findByRole("status", { name: "Linked StreamSuites account" })).toHaveTextContent("Daniel Account · DAN1234");
  expect(screen.getByLabelText(/Display name/)).toHaveValue("Daniel Account");
  expect(screen.getByAltText("Fallback avatar preview")).toHaveAttribute("src", "https://cdn.streamsuites.app/avatars/account-1.webp");
  fireEvent.click(screen.getByRole("button", { name: "Join as linked participant" }));
  await screen.findByRole("heading", { name: "Linked guest workspace" });
  expect(submitted).toMatchObject({ display_name: "Daniel Account" });
  expect(submitted).not.toHaveProperty("account_id");
  expect(JSON.stringify(window.sessionStorage)).not.toContain("correct horse");
});

it("merges an OAuth invite draft without overwriting explicit edits or persisting avatar bytes", async () => {
  window.sessionStorage.setItem("streamsuites.studio.invite-draft.v1", JSON.stringify({ savedAt: Date.now(), displayName: "Room Name", subtitle: "Panel subtitle", avatarColor: "violet", avatarSelected: true, dirtyFields: { displayName: true, subtitle: true, avatarColor: true, avatar: true } }));
  const payload = authPayload("public");
  const oauthUser = payload.session.user as Omit<typeof payload.session.user, "display_name" | "avatar_url"> & { display_name: string; avatar_url: string | null };
  oauthUser.display_name = "Canonical Name";
  oauthUser.avatar_url = "https://cdn.streamsuites.app/avatars/public-1.webp";
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/session")) return response(payload.session);
    if (url.includes("/api/studio/access")) return response(payload.access);
    if (url.includes("/auth/access-state")) return response({ mode: "normal", login_allowed: true });
    if (url.includes("/api/studio/invites/validate")) return response({ success: true, room: { id: "room-1", title: "OAuth room", lifecycle_state: "open" }, invite: { id: "invite-1", room_id: "room-1", active: true, invite_code: "safe-invite-code", policy_type: "open", permanent: true, exhausted: false, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z" }, expires_at: null });
    return response({}, 404);
  }));
  render(<ThemeProvider><StudioAuthProvider><MemoryRouter initialEntries={["/join/safe-invite-code"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/join/:inviteCode" element={<JoinPage />} /></Routes></MemoryRouter></StudioAuthProvider></ThemeProvider>);
  expect(await screen.findByLabelText(/Display name/)).toHaveValue("Room Name");
  expect(screen.getByLabelText(/Subtitle/)).toHaveValue("Panel subtitle");
  expect(screen.getByRole("status", { name: "Linked StreamSuites account" })).toHaveTextContent("Canonical Name");
  expect(screen.getByText(/avatar file was not stored/i)).toBeInTheDocument();
  expect(window.sessionStorage.getItem("streamsuites.studio.invite-draft.v1")).toBeNull();
  expect(document.body.innerHTML).not.toContain("data:image/");
});
