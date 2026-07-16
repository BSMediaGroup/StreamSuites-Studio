import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { createStudioRoom, deleteStudioRoom, listStudioRooms, StudioApiError, transitionStudioRoom, updateStudioRoom } from "../api/studioAuth";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { RoomSummary } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function AccessState() {
  const { access, refresh, logout } = useStudioAuth();
  if (access.status === "loading") return <SiteShell><section className="centered-page page-width"><Card className="access-card access-state-card" role="status"><StatusChip tone="neutral">Checking access</StatusChip><h1>Confirming Studio access.</h1><p>Runtime/Auth is validating the shared session and closed-ALPHA grant.</p></Card></section></SiteShell>;
  if (access.status === "unauthenticated") return <Navigate to="/login?return_to=%2Fstudio" replace />;
  if (access.status === "unavailable") return <SiteShell><section className="centered-page page-width"><Card className="access-card access-state-card"><StatusChip tone="blocked">Service unavailable</StatusChip><h1>Access cannot be confirmed.</h1><p>Runtime/Auth is unavailable, so Studio has failed closed.</p><Button onClick={() => void refresh()}>Retry access check</Button></Card></section></SiteShell>;
  return <SiteShell><section className="centered-page page-width"><Card className="access-card access-state-card"><StatusChip tone="blocked">{access.status === "restricted" ? "Account restricted" : "Access denied"}</StatusChip><h1>{access.status === "restricted" ? "This account is not eligible." : "Closed ALPHA access required."}</h1><p>Runtime/Auth has not granted this account access to the Studio workspace.</p><div className="access-actions"><Button onClick={() => void refresh()}>Check again</Button><Button variant="secondary" onClick={() => void logout().then((ok) => ok && window.location.assign("/login"))}>Logout</Button><ButtonLink to="/" variant="quiet">Return home</ButtonLink></div></Card></section></SiteShell>;
}

export function StudioPage() {
  const { access } = useStudioAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [roomActionPending, setRoomActionPending] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomSummary | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deletingRoom, setDeletingRoom] = useState<RoomSummary | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  useGlobalActivity(status === "loading" || submitting || roomActionPending, "Loading Studio rooms");

  const mayOwnRooms = access.status === "allowed" && ["admin", "creator", "developer"].includes(access.account?.accountType ?? "");

  useEffect(() => {
    if (!mayOwnRooms) return;
    const controller = new AbortController();
    setStatus("loading");
    void listStudioRooms(controller.signal).then((items) => { setRooms(items); setStatus("ready"); }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) { setMessage(error instanceof Error ? error.message : "Rooms could not be loaded."); setStatus("error"); }
    });
    return () => controller.abort();
  }, [mayOwnRooms]);

  if (access.status !== "allowed") return <AccessState />;

  if (!mayOwnRooms) {
    return <StudioShell><div className="studio-page-heading"><div><p className="eyebrow">Invite participation</p><h1>Studio</h1><p>Your public StreamSuites account remains a participant account.</p></div><StatusChip tone="alpha">Access confirmed</StatusChip></div><Card className="access-state-card"><h2>Join through a room invitation</h2><p>Public accounts can use valid guest invitation links without becoming creators or room owners. A Studio ALPHA grant does not change your account role, tier, or profile visibility.</p><p className="fine-print">Room creation is available only to admins and creator-capable accounts with active Studio access.</p></Card></StudioShell>;
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true); setMessage("");
    try {
      const room = await createStudioRoom({ title, ...(description.trim() ? { description } : {}) });
      setRooms((items) => [room, ...items]); setTitle(""); setDescription(""); setStatus("ready"); setMessage("Room created. It remains closed until you open it.");
    } catch (error) { setMessage(error instanceof StudioApiError ? error.message : "Room creation failed."); }
    finally { setSubmitting(false); }
  }

  async function openRoom(room: RoomSummary) {
    if (roomActionPending) return;
    setRoomActionPending(true);
    setMessage("");
    try { const updated = await transitionStudioRoom(room.id, "open"); setRooms((items) => items.map((item) => item.id === room.id ? updated : item)); setMessage("Room opened for invited guest entry."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Room could not be opened."); }
    finally { setRoomActionPending(false); }
  }

  function beginEdit(room: RoomSummary) {
    setEditingRoom(room); setEditTitle(room.title); setEditDescription(room.description ?? ""); setMessage("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingRoom || !editTitle.trim() || roomActionPending) return;
    setRoomActionPending(true); setMessage("");
    try {
      const updated = await updateStudioRoom(editingRoom.id, { title: editTitle.trim(), description: editDescription.trim() || null });
      setRooms((items) => items.map((item) => item.id === updated.id ? updated : item)); setEditingRoom(null); setMessage("Room details updated by Runtime/Auth.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Room details could not be updated."); }
    finally { setRoomActionPending(false); }
  }

  async function confirmDelete() {
    if (!deletingRoom || deleteConfirmation !== deletingRoom.title || roomActionPending) return;
    setRoomActionPending(true); setMessage("");
    try {
      await deleteStudioRoom(deletingRoom.id);
      setRooms((items) => items.filter((item) => item.id !== deletingRoom.id)); setDeletingRoom(null); setDeleteConfirmation(""); setMessage("Room permanently deleted from active Studio authority.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Room could not be deleted."); }
    finally { setRoomActionPending(false); }
  }

  return <StudioShell>
    <div className="studio-page-heading"><div><p className="eyebrow">Runtime-owned room authority</p><h1>Studio rooms</h1><p>Create and manage lobby authority here. Media and broadcasting are not connected.</p></div><StatusChip tone="alpha">Access confirmed</StatusChip></div>
    <div className="room-dashboard-grid">
      <Card><p className="eyebrow">New room</p><h2>Create a room</h2><form className="stack-form" onSubmit={createRoom}><FormField label="Room title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /><label className="field"><span className="field__label">Description <span className="fine-print">optional</span></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} /></label><Button type="submit" disabled={submitting || !title.trim()}>{submitting ? "Creating…" : "Create room"}</Button></form></Card>
      <Card className="room-list-card"><div className="panel-heading"><div><p className="eyebrow">Your workspace</p><h2>Rooms</h2></div><StatusChip tone="neutral">{rooms.length} total</StatusChip></div>
        {status === "loading" && <p role="status">Loading Runtime/Auth room summaries…</p>}
        {status === "error" && <EmptyState title="Rooms unavailable"><p>{message}</p><Button onClick={() => window.location.reload()}>Retry</Button></EmptyState>}
        {status === "ready" && rooms.length === 0 && <EmptyState title="No rooms yet"><p>Create a room to establish server-owned lobby authority. It will not start a broadcast.</p></EmptyState>}
        {status === "ready" && rooms.length > 0 && <div className="room-list">{rooms.map((room) => { const mayDelete = access.account?.accountType === "admin" || access.account?.id === room.ownerAccountId; return <article className="room-list__item" key={room.id}><div className="room-list__content"><div className="room-list__title"><h3>{room.title}</h3><code className="room-id-chip" title="Room ID">{room.id}</code><StatusChip tone={room.lifecycleState === "open" ? "alpha" : room.lifecycleState === "ended" ? "blocked" : "neutral"}>{room.lifecycleState}</StatusChip></div><p className="room-list__description">{room.description || "No room description."}</p><div className="room-list__meta"><span>Updated {formatDate(room.updatedAt)}</span><span>{room.backstageGuestCount} waiting backstage</span><span>{room.onStageGuestCount} / {room.maxAdditionalStageParticipants} additional on stage · {room.totalStageCapacity} total including director</span></div></div><div className="room-list__actions">{room.lifecycleState === "ended" ? <Button disabled>Room ended</Button> : <ButtonLink to={`/studio/rooms/${room.id}`}>Enter room</ButtonLink>}{room.lifecycleState !== "ended" && <Button variant="secondary" disabled={roomActionPending} onClick={() => beginEdit(room)}>Edit room</Button>}{["draft", "closed"].includes(room.lifecycleState) && <Button variant="secondary" disabled={roomActionPending} onClick={() => void openRoom(room)}>Open room</Button>}{mayDelete && <Button className="button--destructive" variant="quiet" disabled={roomActionPending} onClick={() => { setDeletingRoom(room); setDeleteConfirmation(""); setMessage(""); }}>Delete room</Button>}</div></article>; })}</div>}
      </Card>
    </div>
    {message && status !== "error" && <p className="status-banner" role="status" aria-live="polite">{message}</p>}
    {editingRoom && <div className="modal-backdrop"><section className="studio-dialog room-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="room-edit-title"><p className="eyebrow">Runtime-owned room</p><h2 id="room-edit-title">Edit {editingRoom.title}</h2><form className="stack-form" onSubmit={saveEdit}><FormField label="Room title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} required /><label className="field"><span className="field__label">Description</span><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={1000} rows={4} /></label><div className="access-actions"><Button type="submit" disabled={roomActionPending || !editTitle.trim()}>{roomActionPending ? "Saving…" : "Save room"}</Button><Button type="button" variant="secondary" disabled={roomActionPending} onClick={() => setEditingRoom(null)}>Cancel</Button></div></form></section></div>}
    {deletingRoom && <div className="modal-backdrop"><section className="studio-dialog room-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="room-delete-title"><p className="eyebrow">Permanent deletion</p><h2 id="room-delete-title">Delete {deletingRoom.title}?</h2><p>This ends room authority, invalidates guests and invites, and removes room-owned child records. StreamSuites user accounts are not deleted.</p><FormField label={`Type ${deletingRoom.title} to confirm`} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /><div className="access-actions"><Button className="button--destructive" disabled={deleteConfirmation !== deletingRoom.title || roomActionPending} onClick={() => void confirmDelete()}>{roomActionPending ? "Deleting…" : "Delete room permanently"}</Button><Button variant="secondary" disabled={roomActionPending} onClick={() => setDeletingRoom(null)}>Cancel</Button></div></section></div>}
  </StudioShell>;
}
