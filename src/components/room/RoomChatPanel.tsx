import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { deleteRoomChatMessage, listRoomChatMessages, loadPublicChatFoundation, markRoomChatRead, sendRoomChatMessage } from "../../api/studioAuth";
import type { PublicChatFoundation, RoomChatMessage } from "../../domain/studio";
import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";

interface RoomChatPanelProps {
  readonly roomId: string;
  readonly visible: boolean;
  readonly refreshKey: number;
  readonly canModerate?: boolean;
  readonly onUnreadChange: (count: number) => void;
}

function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function RoomChatPanel({ roomId, visible, refreshKey, canModerate = false, onUnreadChange }: RoomChatPanelProps) {
  const [tab, setTab] = useState<"private" | "public">("private");
  const [items, setItems] = useState<RoomChatMessage[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [maxLength, setMaxLength] = useState(1000);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [publicState, setPublicState] = useState<PublicChatFoundation | null>(null);
  const [publicError, setPublicError] = useState("");
  const [newMessages, setNewMessages] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const previousCount = useRef(0);
  const autoScroll = useRef(true);

  const markVisibleRead = useCallback(async (messages: readonly RoomChatMessage[]) => {
    if (!visible || tab !== "private") return;
    onUnreadChange(0);
    try { await markRoomChatRead(roomId, messages.at(-1)?.id); } catch { /* Reading remains available when cursor persistence temporarily fails. */ }
  }, [onUnreadChange, roomId, tab, visible]);

  const loadNewest = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await listRoomChatMessages(roomId, null, signal);
      const list = listRef.current;
      const nearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 72;
      autoScroll.current = nearBottom;
      setItems(page.items.slice());
      setParticipantId(page.participantId);
      setBeforeId(page.beforeId);
      setHasMore(page.hasMore);
      setMaxLength(page.maxLength);
      onUnreadChange(visible && tab === "private" ? 0 : page.unreadCount);
      if (page.items.length > previousCount.current && !nearBottom) setNewMessages(true);
      previousCount.current = page.items.length;
      await markVisibleRead(page.items);
      setError("");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Private chat could not be loaded.");
    } finally { setLoading(false); }
  }, [markVisibleRead, onUnreadChange, roomId, tab, visible]);

  useEffect(() => {
    const controller = new AbortController();
    void loadNewest(controller.signal);
    return () => controller.abort();
  }, [loadNewest, refreshKey]);

  useEffect(() => {
    if (tab !== "public" || publicState) return;
    const controller = new AbortController();
    void loadPublicChatFoundation(roomId, controller.signal).then(setPublicState).catch((cause) => setPublicError(cause instanceof Error ? cause.message : "Public chat capabilities could not be loaded."));
    return () => controller.abort();
  }, [publicState, roomId, tab]);

  useEffect(() => { if (visible && tab === "private") void markVisibleRead(items); }, [items, markVisibleRead, tab, visible]);
  useEffect(() => { if (visible) window.setTimeout(() => composerRef.current?.focus(), 0); }, [visible]);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && autoScroll.current) list.scrollTop = list.scrollHeight;
  }, [items]);

  async function loadEarlier() {
    if (!beforeId || loadingEarlier) return;
    const list = listRef.current;
    const previousHeight = list?.scrollHeight ?? 0;
    setLoadingEarlier(true);
    try {
      const page = await listRoomChatMessages(roomId, beforeId);
      setItems((current) => [...page.items, ...current]); setBeforeId(page.beforeId); setHasMore(page.hasMore);
      requestAnimationFrame(() => { if (list) list.scrollTop += list.scrollHeight - previousHeight; });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Earlier messages could not be loaded."); }
    finally { setLoadingEarlier(false); }
  }

  async function send() {
    const text = draft.replace(/\r\n?/g, "\n").trim();
    if (!text || pending) return;
    const key = failedKey ?? (globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random().toString(36).slice(2)}`);
    setPending(true); setError("");
    try {
      const message = await sendRoomChatMessage(roomId, text, key);
      setItems((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft(""); setFailedKey(null); setNewMessages(false);
      requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; });
    } catch (cause) { setFailedKey(key); setError(cause instanceof Error ? cause.message : "Message was not sent. Retry is available."); }
    finally { setPending(false); }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
  }

  async function remove(message: RoomChatMessage) {
    try { const removed = await deleteRoomChatMessage(roomId, message.id); setItems((current) => current.map((item) => item.id === removed.id ? removed : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Message could not be removed."); }
  }

  return <div className="room-chat-panel">
    <div className="room-chat-tabs" role="tablist" aria-label="Room chat type">
      <button type="button" role="tab" aria-selected={tab === "private"} onClick={() => setTab("private")}>Private</button>
      <button type="button" role="tab" aria-selected={tab === "public"} onClick={() => setTab("public")}>Public</button>
    </div>
    {tab === "private" ? <>
      <div className="room-chat-history" ref={listRef} aria-live="polite" onScroll={(event) => { const node = event.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 72) setNewMessages(false); }}>
        {hasMore && <Button variant="quiet" disabled={loadingEarlier} onClick={() => void loadEarlier()}>{loadingEarlier ? "Loading…" : "Load earlier messages"}</Button>}
        {loading && <p className="fine-print">Loading private room chat…</p>}
        {!loading && items.length === 0 && <p className="room-chat-empty">No private messages yet. Only current room participants can read and reply.</p>}
        {items.map((message, index) => {
          const own = message.sender.participantId === participantId;
          const grouped = index > 0 && items[index - 1]?.sender.participantId === message.sender.participantId;
          return <article key={message.id} className={`room-chat-message${own ? " is-own" : ""}${grouped ? " is-grouped" : ""}`}>
            {!grouped && <div className="room-chat-avatar">{message.sender.avatarUrl ? <img src={message.sender.avatarUrl} alt="" /> : initials(message.sender.displayName)}</div>}
            <div>{!grouped && <header><strong>{message.sender.displayName}</strong>{message.sender.accountLinked && <span title="Linked StreamSuites participant">SS</span>}<time>{time(message.createdAt)}</time></header>}
              {message.deleted ? <p className="room-chat-tombstone">Message removed</p> : <p>{message.body}</p>}
              {!message.deleted && (own || canModerate) && <button className="room-chat-delete" type="button" onClick={() => void remove(message)}>Delete</button>}
            </div>
          </article>;
        })}
      </div>
      {newMessages && <button className="room-chat-new" type="button" onClick={() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; setNewMessages(false); }}>New messages</button>}
      <div className="room-chat-composer">
        {error && <p role="alert">{error}</p>}
        <textarea ref={composerRef} aria-label="Private room message" rows={3} value={draft} maxLength={maxLength} disabled={pending} placeholder="Message current room participants" onChange={(event) => { setDraft(event.target.value); if (failedKey) setFailedKey(null); }} onKeyDown={keyDown} />
        <div><span className={maxLength - draft.length < 100 ? "is-near-limit" : ""}>{maxLength - draft.length}</span><Button disabled={pending || !draft.trim()} onClick={() => void send()}>{pending ? "Sending…" : failedKey ? "Retry" : "Send"}</Button></div>
        <small>Enter sends · Shift+Enter adds a line</small>
      </div>
    </> : <div className="public-chat-foundation">
      {publicError && <p role="alert">{publicError}</p>}
      {!publicState && !publicError && <p>Loading Runtime/Auth platform capabilities…</p>}
      {publicState?.items.map((item) => <article className="public-chat-card" key={item.platform}>
        <div><strong>{item.displayName}</strong><span>{item.connectionLabel}</span></div>
        <div className="public-chat-chips"><StatusChip tone={item.chatReadSupported ? "neutral" : "blocked"}>{item.chatReadSupported ? "Read" : "Read not supported"}</StatusChip><StatusChip tone={item.chatWriteSupported ? "pending" : "blocked"}>{item.chatWriteSupported ? "Send · foundation only" : "Send not supported"}</StatusChip></div>
        {item.actor && <p>Connected actor: {item.actor.displayName}</p>}
        {item.oauthSupported && item.authorizationUrl && <a className="button button--secondary" href={item.authorizationUrl}>{item.reconnectRequired ? "Reconnect" : item.connected ? "Manage connection" : "Connect"}</a>}
        {!item.oauthSupported && <p className="fine-print">No verified Runtime/Auth OAuth start is available for Studio.</p>}
      </article>)}
      <div className="public-chat-feed-placeholder"><strong>Combined public feed</strong><p>No external messages are loaded in this milestone.</p></div>
      <label>Public message<textarea disabled rows={3} placeholder="Public provider sending is not available" /></label>
      <Button disabled>Send publicly</Button>
      <p className="fine-print">Connect a supported platform identity. Public chat sending will be enabled in the provider transport milestone.</p>
    </div>}
  </div>;
}
