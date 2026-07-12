import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  createStudioInvite,
  listStudioInvites,
  listStudioLobby,
  loadStudioRoom,
  revokeStudioInvite,
  transitionStudioGuest,
  transitionStudioRoom,
  updateStudioRoom,
} from "../api/studioAuth";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { RoomInvite, RoomSummary, StudioGuest } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No expiry";
}

export function RoomManagementPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const { access } = useStudioAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [guests, setGuests] = useState<StudioGuest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [oneTimeLink, setOneTimeLink] = useState("");
  const inviteLinkRef = useRef<HTMLInputElement>(null);
  useGlobalActivity(status === "loading" || Boolean(busy), "Loading room authority");

  const refresh = useCallback(async () => {
    setStatus("loading"); setMessage("");
    try {
      const [nextRoom, nextInvites, nextGuests] = await Promise.all([loadStudioRoom(roomId), listStudioInvites(roomId), listStudioLobby(roomId)]);
      setRoom(nextRoom); setInvites(nextInvites); setGuests(nextGuests); setTitle(nextRoom.title); setDescription(nextRoom.description ?? ""); setStatus("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Room workspace could not be loaded."); setStatus("error"); }
  }, [roomId]);

  useEffect(() => { if (access.status === "allowed") void refresh(); }, [access.status, refresh]);

  if (access.status === "loading") return <SiteShell><section className="centered-page page-width"><Card role="status"><h1>Checking room access…</h1></Card></section></SiteShell>;
  if (access.status === "unauthenticated") return <Navigate to={`/login?return_to=${encodeURIComponent(`/studio/rooms/${roomId}`)}`} replace />;
  if (access.status !== "allowed" || access.account?.accountType === "public") return <Navigate to="/studio" replace />;

  async function lifecycle(action: "open" | "close" | "end") {
    if (!room || busy || (action === "end" && !window.confirm("End this room? Active invite entry and guest room authority will be invalidated."))) return;
    setBusy(action); setMessage("");
    try { const updated = await transitionStudioRoom(room.id, action); setRoom(updated); setMessage(`Room ${action === "close" ? "closed" : `${action}ed`}.`); if (action === "end") { setInvites((items) => items.map((item) => ({ ...item, active: false }))); setGuests((items) => items.map((guest) => ["waiting", "admitted"].includes(guest.state) ? { ...guest, state: "expired" } : guest)); } }
    catch (error) { setMessage(error instanceof Error ? error.message : "Room state could not be changed."); }
    finally { setBusy(""); }
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault(); if (!room || busy || !title.trim()) return; setBusy("save"); setMessage("");
    try { const updated = await updateStudioRoom(room.id, { title, description: description.trim() || null }); setRoom(updated); setMessage("Room details saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Room details could not be saved."); }
    finally { setBusy(""); }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault(); if (!room || busy) return; setBusy("invite"); setMessage(""); setOneTimeLink("");
    try { const created = await createStudioInvite(room.id, inviteLabel.trim() ? { label: inviteLabel } : {}); setInvites((items) => [created.invite, ...items]); setInviteLabel(""); setOneTimeLink(`${window.location.origin}/join/${encodeURIComponent(created.inviteCode)}`); setMessage("Invite created. Copy the one-time link now."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Invite could not be created."); }
    finally { setBusy(""); }
  }

  async function copyInvite() {
    if (!oneTimeLink) return;
    try { await navigator.clipboard.writeText(oneTimeLink); setMessage("Invite link copied."); }
    catch { inviteLinkRef.current?.focus(); inviteLinkRef.current?.select(); setMessage("Clipboard access was unavailable. The invite link is selected for manual copying."); }
  }

  async function revoke(invite: RoomInvite) {
    if (!room || busy || !window.confirm("Revoke this invite? Existing guest sessions are unchanged, but the link cannot be used again.")) return;
    setBusy(invite.id); setMessage("");
    try { const updated = await revokeStudioInvite(room.id, invite.id); setInvites((items) => items.map((item) => item.id === invite.id ? updated : item)); setMessage("Invite revoked."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Invite could not be revoked."); }
    finally { setBusy(""); }
  }

  async function guestAction(guest: StudioGuest, action: "admit" | "deny" | "remove") {
    if (!room || busy) return; setBusy(guest.id); setMessage("");
    try { const updated = await transitionStudioGuest(room.id, guest.id, action); setGuests((items) => items.map((item) => item.id === guest.id ? updated : item)); const nextRoom = await loadStudioRoom(room.id); setRoom(nextRoom); setMessage(action === "admit" ? "Guest admitted to room authority. Media is not connected." : `Guest ${action === "deny" ? "denied" : "removed"}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Guest state could not be changed."); }
    finally { setBusy(""); }
  }

  if (status === "loading") return <StudioShell><p role="status">Loading room authority…</p></StudioShell>;
  if (status === "error" || !room) return <StudioShell><Card><EmptyState title="Room unavailable"><p>{message}</p><div className="access-actions"><Button onClick={() => void refresh()}>Retry</Button><ButtonLink to="/studio" variant="quiet">Back to rooms</ButtonLink></div></EmptyState></Card></StudioShell>;

  const waiting = guests.filter((guest) => guest.state === "waiting");
  const admitted = guests.filter((guest) => guest.state === "admitted");

  return <StudioShell>
    <div className="studio-page-heading"><div><p className="eyebrow"><ButtonLink to="/studio" variant="quiet">← Rooms</ButtonLink></p><h1>{room.title}</h1><p>{room.description || "No room description."}</p></div><StatusChip tone={room.lifecycleState === "open" ? "alpha" : room.lifecycleState === "ended" ? "blocked" : "neutral"}>{room.lifecycleState}</StatusChip></div>
    <Card className="media-notice"><strong>Authority workspace only.</strong> No camera, microphone, screen share, media tracks, recording, or broadcast delivery is connected.</Card>
    <div className="management-summary"><Card><span>Waiting</span><strong>{room.waitingGuestCount}</strong></Card><Card><span>Admitted guest slots</span><strong>{room.admittedGuestCount} / {room.maxGuestStageOccupants}</strong><small>The host/director is separate from these nine slots.</small></Card><Card><span>Room entry</span><strong>{room.lifecycleState === "open" ? "Open" : "Closed"}</strong></Card></div>
    <div className="room-controls" aria-label="Room lifecycle controls">{["draft", "closed"].includes(room.lifecycleState) && <Button disabled={Boolean(busy)} onClick={() => void lifecycle("open")}>Open room</Button>}{room.lifecycleState === "open" && <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void lifecycle("close")}>Close entry</Button>}{room.lifecycleState !== "ended" && <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void lifecycle("end")}>End room</Button>}<Button variant="secondary" disabled={Boolean(busy)} onClick={() => void refresh()}>Refresh</Button></div>
    {message && <p className="status-banner" role="status" aria-live="polite">{message}</p>}
    <div className="management-grid">
      <Card><h2>Room details</h2><form className="stack-form" onSubmit={saveRoom}><FormField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={room.lifecycleState === "ended"} /><label className="field"><span className="field__label">Description</span><textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={room.lifecycleState === "ended"} /></label><Button type="submit" disabled={Boolean(busy) || !title.trim() || room.lifecycleState === "ended"}>Save details</Button></form></Card>
      <Card><h2>Guest invites</h2>{room.lifecycleState !== "ended" && <form className="inline-form" onSubmit={createInvite}><FormField label="Invite label (optional)" value={inviteLabel} onChange={(event) => setInviteLabel(event.target.value)} maxLength={80} /><Button type="submit" disabled={Boolean(busy)}>Create invite</Button></form>}{oneTimeLink && <div className="one-time-secret" role="status"><strong>Copy this link now</strong><p>Runtime/Auth will never return this raw invite code again. It is not stored by Studio and disappears on reload or navigation.</p><FormField ref={inviteLinkRef} label="One-time guest invite URL" value={oneTimeLink} readOnly onFocus={(event) => event.currentTarget.select()} /><Button onClick={() => void copyInvite()}>Copy invite link</Button></div>}<div className="invite-list">{invites.length === 0 ? <p>No invites have been created.</p> : invites.map((invite) => <article key={invite.id}><div><strong>{invite.label || "Unlabelled invite"}</strong><p>{invite.active ? "Active" : "Revoked"} · Created {date(invite.createdAt)} · Expires {date(invite.expiresAt)}</p></div>{invite.active && room.lifecycleState !== "ended" && <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void revoke(invite)}>Revoke</Button>}</article>)}</div></Card>
    </div>
    <div className="management-grid lobby-grid">
      <Card><div className="panel-heading"><h2>Waiting lobby</h2><StatusChip>{waiting.length}</StatusChip></div>{waiting.length === 0 ? <EmptyState title="Nobody waiting"><p>The lobby may hold more people than the nine admitted guest slots.</p></EmptyState> : <div className="guest-list">{waiting.map((guest) => <article key={guest.id}><div><strong>{guest.displayName}</strong><p>Waiting since {date(guest.createdAt)}</p></div><div><Button disabled={Boolean(busy) || room.admittedGuestCount >= room.maxGuestStageOccupants} onClick={() => void guestAction(guest, "admit")}>Admit</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void guestAction(guest, "deny")}>Deny</Button></div></article>)}</div>}</Card>
      <Card><div className="panel-heading"><h2>Admitted authority</h2><StatusChip tone="alpha">{admitted.length} / {room.maxGuestStageOccupants}</StatusChip></div>{admitted.length === 0 ? <EmptyState title="No admitted guests"><p>Admission grants room authority only. It does not connect media.</p></EmptyState> : <div className="guest-list">{admitted.map((guest) => <article key={guest.id}><div><strong>{guest.displayName}</strong><p>Admitted {date(guest.admittedAt)}</p></div><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void guestAction(guest, "remove")}>Remove</Button></article>)}</div>}</Card>
    </div>
  </StudioShell>;
}
