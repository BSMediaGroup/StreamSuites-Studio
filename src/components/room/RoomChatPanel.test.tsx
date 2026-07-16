import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RoomChatPanel } from "./RoomChatPanel";

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function response(payload: object, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }); }
const message = { id: "m1", room_id: "room-1", sender: { participant_id: "account:owner", account_linked: true, display_name: "Director", avatar_url: null }, body: "Hello guest", created_at: "2026-07-16T00:00:00Z", deleted: false, deleted_at: null, moderation_reason_code: null };

it("loads canonical private history, marks visible messages read, and sends Enter while preserving Shift+Enter", async () => {
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/chat/read")) return Promise.resolve(response({ success: true, state: { unread_count: 0 } }));
    if (url.includes("/chat/messages") && init?.method === "POST") return Promise.resolve(response({ success: true, message: { ...message, id: "m2", body: "Reply", sender: { ...message.sender, participant_id: "account:self" } } }, 201));
    return Promise.resolve(response({ success: true, items: [message], has_more: false, before_id: null, unread_count: 1, participant_id: "account:self", max_length: 1000 }));
  });
  const unread = vi.fn();
  render(<RoomChatPanel roomId="room-1" visible refreshKey={0} onUnreadChange={unread} />);
  expect(await screen.findByText("Hello guest")).toBeInTheDocument();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/chat/read"), expect.objectContaining({ method: "PATCH" })));
  const composer = screen.getByRole("textbox", { name: "Private room message" });
  fireEvent.change(composer, { target: { value: "Line one" } });
  fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
  expect(composer).toHaveValue("Line one");
  fireEvent.keyDown(composer, { key: "Enter" });
  expect(await screen.findByText("Reply")).toBeInTheDocument();
  expect(unread).toHaveBeenCalledWith(0);
});

it("renders truthful provider foundations and keeps the public composer disabled", async () => {
  fetchMock.mockImplementation((input: RequestInfo | URL) => String(input).includes("/chat/public")
    ? Promise.resolve(response({ success: true, items: [{ platform: "twitch", display_name: "Twitch", configured: false, connected: false, actor_identity_connected: false, oauth_supported: true, chat_read_supported: true, chat_write_supported: true, currently_implemented: false, required_scopes: ["user:write:chat"], connection_label: "Not connected", actor: null, reason_code: "actor_not_connected", reconnect_required: false, selected_room_destination: null, authorization_url: "https://creator.streamsuites.app/integrations/twitch" }, { platform: "rumble", display_name: "Rumble", configured: false, connected: false, actor_identity_connected: false, oauth_supported: false, chat_read_supported: true, chat_write_supported: false, currently_implemented: false, required_scopes: [], connection_label: "Not connected", actor: null, reason_code: "oauth_unavailable", reconnect_required: false, selected_room_destination: null, authorization_url: null }], public_unread_count: 0, sending_enabled: false, sending_reason: "provider_transport_deferred" }))
    : Promise.resolve(response({ success: true, items: [], has_more: false, before_id: null, unread_count: 0, participant_id: "account:self", max_length: 1000 })));
  render(<RoomChatPanel roomId="room-1" visible refreshKey={0} onUnreadChange={() => undefined} />);
  fireEvent.click(screen.getByRole("tab", { name: "Public" }));
  expect(await screen.findByRole("link", { name: "Connect" })).toHaveAttribute("href", "https://creator.streamsuites.app/integrations/twitch");
  expect(screen.getByText("Send not supported")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send publicly" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Public message" })).toBeDisabled();
});
