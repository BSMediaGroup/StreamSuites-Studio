import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (access.status !== "allowed") return;
    const controller = new AbortController();
    void listCohostRelationships(true, controller.signal).then(setItems).catch(() => setMessage("Requests could not be loaded."));
    return () => controller.abort();
  }, [access.status]);

  function toggle() {
    const next = !open;
    setOpen(next); onOpenChange?.(next);
  }

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
  return <div className="cohost-requests">
    <Button className="cohost-requests__trigger" variant="quiet" aria-expanded={open} aria-controls="cohost-requests-panel" onClick={toggle}>
      <StudioIcon regular={inboxIcon} /> <span>Requests</span>{items.length > 0 && <span className="request-count" aria-label={`${items.length} pending`}>{items.length}</span>}
    </Button>
    {open && <section id="cohost-requests-panel" className="cohost-requests__panel" aria-label="Permanent cohost requests">
      <div className="panel-heading"><div><p className="eyebrow">Account authority</p><h2>Requests</h2></div><StatusChip tone={items.length ? "pending" : "neutral"}>{items.length} pending</StatusChip></div>
      {items.length === 0 ? <p className="fine-print">No pending permanent-cohost requests.</p> : items.map((item) => <article key={item.id}>
        <strong>{item.room?.title ?? "Studio room"}</strong>
        <code className="room-id-chip">{item.room?.id ?? item.roomIds[0] ?? "Room"}</code>
        <p>{item.director?.displayName ?? "A StreamSuites director"} requested {item.scopeType === "all_rooms" ? "all current and future rooms" : "selected-room"} cohost authority.</p>
        <small>Created {new Date(item.createdAt).toLocaleString()} · {item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiry supplied"}</small>
        <div className="cohost-requests__actions"><Button disabled={Boolean(busy)} onClick={() => void respond(item, "accept")}>{busy === `${item.id}:accept` ? "Accepting…" : "Accept"}</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => void respond(item, "decline")}>{busy === `${item.id}:decline` ? "Declining…" : "Decline"}</Button></div>
      </article>)}
      {message && <p className="fine-print" role="status">{message}</p>}
    </section>}
  </div>;
}
