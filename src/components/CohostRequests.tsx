import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listCohostRelationships, respondCohostInvitation } from "../api/studioAuth";
import { useStudioAuth } from "../auth/studioAuthContext";
import type { CohostRelationship } from "../domain/studio";
import { Button } from "./ui/Button";
import { StudioIcon } from "./ui/StudioIcon";
import { StatusChip } from "./ui/StatusChip";
import inboxIcon from "../../assets/icons/ui/inbox1.svg";

export function CohostRequests({ onOpenChange }: { readonly onOpenChange?: (open: boolean) => void }) {
  const { access } = useStudioAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CohostRelationship[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 420, maxHeight: 560 });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const headingId = useId();

  useEffect(() => {
    if (access.status !== "allowed") return;
    const controller = new AbortController();
    void listCohostRelationships(true, controller.signal).then(setItems).catch(() => setMessage("Requests could not be loaded."));
    return () => controller.abort();
  }, [access.status]);

  function close(restoreFocus = true) {
    setOpen(false);
    onOpenChange?.(false);
    if (restoreFocus) window.setTimeout(() => rootRef.current?.querySelector<HTMLButtonElement>(".cohost-requests__trigger")?.focus(), 0);
  }

  function toggle() {
    if (open) return close();
    setOpen(true);
    onOpenChange?.(true);
  }

  function placePanel() {
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>(".cohost-requests__trigger");
    if (!trigger) return;
    const gap = 8;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - gap * 2);
    setPosition({
      top: Math.min(rect.bottom + gap, window.innerHeight - gap - 180),
      left: Math.min(Math.max(gap, rect.right - width), window.innerWidth - width - gap),
      width,
      maxHeight: Math.min(560, window.innerHeight - gap * 2),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    window.setTimeout(() => panelRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !rootRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      if (!buttons.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (current + 1) % buttons.length : (current <= 0 ? buttons.length : current) - 1;
      buttons[next]?.focus();
    };
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  async function respond(item: CohostRelationship, action: "accept" | "decline") {
    setBusy(`${item.id}:${action}`); setMessage("");
    try {
      await respondCohostInvitation(item.id, action);
      setItems((current) => current.filter((request) => request.id !== item.id));
      setMessage(`Permanent cohost request ${action === "accept" ? "accepted" : "declined"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Request could not be ${action}ed.`);
    } finally { setBusy(""); }
  }

  if (access.status !== "allowed") return null;
  return <div ref={rootRef} className="cohost-requests">
    <Button className="cohost-requests__trigger" variant="quiet" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle}>
      <StudioIcon regular={inboxIcon} /> <span>Requests</span>{items.length > 0 && <span className="request-count" aria-label={`${items.length} pending`}>{items.length}</span>}
    </Button>
    {open && createPortal(<section ref={panelRef} id={panelId} className="cohost-requests__panel studio-overlay-surface" role="dialog" aria-modal="false" aria-labelledby={headingId} tabIndex={-1} style={position}>
      <header className="cohost-requests__header"><div><p className="eyebrow">Account authority</p><h2 id={headingId}>Requests</h2></div><StatusChip tone={items.length ? "pending" : "neutral"}>{items.length} pending</StatusChip></header>
      <div className="cohost-requests__body">
        {items.length === 0 ? <div className="cohost-requests__empty"><strong>No pending requests</strong><p>Permanent-cohost invitations will appear here.</p></div> : items.map((item) => {
          const expired = Boolean(item.expiresAt && Date.parse(item.expiresAt) <= Date.now());
          return <article className={expired ? "is-expired" : ""} aria-disabled={expired || undefined} key={item.id}>
            <div className="cohost-requests__identity"><strong>{item.room?.title ?? "Studio room"}</strong>{expired && <StatusChip tone="neutral">Expired</StatusChip>}</div>
            <code className="room-id-chip">{item.room?.id ?? item.roomIds[0] ?? "Room"}</code>
            <p>{item.director?.displayName ?? "A StreamSuites director"} requested {item.scopeType === "all_rooms" ? "all current and future rooms" : "selected-room"} cohost authority.</p>
            <small>Created {new Date(item.createdAt).toLocaleString()} · {item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiry supplied"}</small>
            <div className="cohost-requests__actions"><Button className="cohost-requests__accept" disabled={Boolean(busy) || expired} onClick={() => void respond(item, "accept")}>{busy === `${item.id}:accept` ? "Accepting…" : "Accept"}</Button><Button className="cohost-requests__decline button--destructive" variant="quiet" disabled={Boolean(busy) || expired} onClick={() => void respond(item, "decline")}>{busy === `${item.id}:decline` ? "Declining…" : "Decline"}</Button></div>
          </article>;
        })}
        {message && <p className="fine-print" role="status">{message}</p>}
      </div>
    </section>, document.body)}
  </div>;
}
