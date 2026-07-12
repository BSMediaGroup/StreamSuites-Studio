import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  createStudioInvite,
  listStudioInvites,
  listStudioLobby,
  loadStudioRoom,
  revokeStudioInvite,
  StudioApiError,
  transitionStudioGuest,
  transitionStudioRoom,
  updateStudioRoom,
} from "../api/studioAuth";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { RoomInvite, RoomSummary, StudioGuest } from "../domain/studio";

type WorkspacePanel = "backstage" | "invites" | "room";
type StageLayout = "grid" | "interview" | "spotlight";

const layoutLabels: Record<StageLayout, string> = {
  grid: "Grid",
  interview: "Interview",
  spotlight: "Spotlight",
};

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "No expiry";
}

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function ControlButton({
  label,
  helper,
  disabled = false,
  active = false,
  onClick,
}: {
  readonly label: string;
  readonly helper: string;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly onClick?: () => void;
}) {
  return (
    <span className="control-dock__item" title={helper}>
      <button
        type="button"
        className={active ? "is-active" : ""}
        aria-label={`${label}. ${helper}`}
        aria-pressed={active || undefined}
        disabled={disabled}
        onClick={onClick}
      >
        <span className="control-dock__indicator" aria-hidden="true" />
        <strong>{label}</strong>
        <small>{disabled ? "Unavailable" : helper}</small>
      </button>
    </span>
  );
}

export function RoomManagementPage() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const { access } = useStudioAuth();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [guests, setGuests] = useState<StudioGuest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<"not-found" | "unavailable">("unavailable");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [guestBusy, setGuestBusy] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [oneTimeLink, setOneTimeLink] = useState("");
  const [panel, setPanel] = useState<WorkspacePanel>("backstage");
  const [layout, setLayout] = useState<StageLayout>("grid");
  const [selectedParticipant, setSelectedParticipant] = useState("host");
  const [showGoLiveInfo, setShowGoLiveInfo] = useState(false);
  const inviteLinkRef = useRef<HTMLInputElement>(null);
  const backstageHeadingRef = useRef<HTMLHeadingElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  useGlobalActivity(status === "loading" || Boolean(busy) || Boolean(guestBusy), "Loading room authority");

  const refreshAuthority = useCallback(async (showLoading = true) => {
    if (showLoading) setStatus("loading");
    setMessage("");
    try {
      const [nextRoom, nextInvites, nextGuests] = await Promise.all([
        loadStudioRoom(roomId),
        listStudioInvites(roomId),
        listStudioLobby(roomId),
      ]);
      setRoom(nextRoom);
      setInvites(nextInvites);
      setGuests(nextGuests);
      setTitle(nextRoom.title);
      setDescription(nextRoom.description ?? "");
      setStatus("ready");
    } catch (error) {
      setErrorKind(error instanceof StudioApiError && error.status === 404 ? "not-found" : "unavailable");
      setMessage(error instanceof Error ? error.message : "Room workspace could not be loaded.");
      setStatus("error");
    }
  }, [roomId]);

  useEffect(() => {
    if (access.status === "allowed") void refreshAuthority();
  }, [access.status, refreshAuthority]);

  const waiting = useMemo(() => guests.filter((guest) => guest.state === "waiting"), [guests]);
  const admitted = useMemo(() => guests.filter((guest) => guest.state === "admitted"), [guests]);

  useEffect(() => {
    if (selectedParticipant !== "host" && !admitted.some((guest) => guest.id === selectedParticipant)) {
      setSelectedParticipant("host");
    }
  }, [admitted, selectedParticipant]);

  if (access.status === "loading") {
    return <SiteShell><section className="centered-page page-width"><Card role="status"><h1>Checking room access…</h1></Card></section></SiteShell>;
  }
  if (access.status === "unauthenticated") {
    return <Navigate to={`/login?return_to=${encodeURIComponent(`/studio/rooms/${roomId}`)}`} replace />;
  }
  if (access.status !== "allowed" || access.account?.accountType === "public") {
    return <Navigate to="/studio" replace />;
  }

  async function lifecycle(action: "open" | "close" | "end") {
    if (!room || busy || (action === "end" && !window.confirm("End this room? Active invite entry and guest room authority will be invalidated."))) return;
    setBusy(`lifecycle-${action}`);
    setMessage("");
    try {
      await transitionStudioRoom(room.id, action);
      await refreshAuthority(false);
      setMessage(`Room ${action === "close" ? "closed" : `${action}ed`}. Runtime/Auth state refreshed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room state could not be changed.");
    } finally {
      setBusy("");
    }
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    if (!room || busy || !title.trim()) return;
    setBusy("save");
    setMessage("");
    try {
      const updated = await updateStudioRoom(room.id, { title, description: description.trim() || null });
      setRoom(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setMessage("Room details saved in Runtime/Auth.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Room details could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    if (!room || busy) return;
    setBusy("invite-create");
    setMessage("");
    setOneTimeLink("");
    try {
      const created = await createStudioInvite(room.id, inviteLabel.trim() ? { label: inviteLabel } : {});
      setInvites(await listStudioInvites(room.id));
      setInviteLabel("");
      setOneTimeLink(`${window.location.origin}/join/${encodeURIComponent(created.inviteCode)}`);
      setMessage("Invite created. Copy the one-time link now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    if (!oneTimeLink) return;
    try {
      await navigator.clipboard.writeText(oneTimeLink);
      setMessage("Invite link copied.");
    } catch {
      inviteLinkRef.current?.focus();
      inviteLinkRef.current?.select();
      setMessage("Clipboard access was unavailable. The invite link is selected for manual copying.");
    }
  }

  async function revoke(invite: RoomInvite) {
    if (!room || busy || !window.confirm("Revoke this invite? Existing guest sessions are unchanged, but the link cannot be used again.")) return;
    setBusy(`invite-${invite.id}`);
    setMessage("");
    try {
      await revokeStudioInvite(room.id, invite.id);
      setInvites(await listStudioInvites(room.id));
      setMessage("Invite revoked in Runtime/Auth.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite could not be revoked.");
    } finally {
      setBusy("");
    }
  }

  async function guestAction(guest: StudioGuest, action: "admit" | "deny" | "remove") {
    if (!room || guestBusy) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuestBusy(guest.id);
    setMessage("");
    try {
      await transitionStudioGuest(room.id, guest.id, action);
      const [nextRoom, nextGuests] = await Promise.all([loadStudioRoom(room.id), listStudioLobby(room.id)]);
      setRoom(nextRoom);
      setGuests(nextGuests);
      setMessage(action === "admit"
        ? "Guest admitted by Runtime/Auth. Media remains unconnected."
        : `Guest ${action === "deny" ? "denied" : "removed from stage"} by Runtime/Auth.`);
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else backstageHeadingRef.current?.focus();
      });
    } catch (error) {
      if (error instanceof StudioApiError && error.code === "stage_full") {
        setMessage("Stage full: Runtime/Auth allows at most nine admitted guests. Remove a guest before admitting another.");
      } else {
        setMessage(error instanceof Error ? error.message : "Guest state could not be changed.");
      }
    } finally {
      setGuestBusy("");
    }
  }

  if (status === "loading") {
    return <StudioShell><Card className="workspace-loading" role="status"><p className="eyebrow">Runtime-owned room</p><h1>Preparing the Studio workspace…</h1><p>Loading room, invite, and lobby authority.</p></Card></StudioShell>;
  }
  if (status === "error" || !room) {
    return <StudioShell><Card><EmptyState title={errorKind === "not-found" ? "Room not found" : "Room unavailable"}><p>{message}</p><div className="access-actions"><Button onClick={() => void refreshAuthority()}>Retry</Button><ButtonLink to="/studio" variant="quiet">Back to rooms</ButtonLink></div></EmptyState></Card></StudioShell>;
  }

  const hostName = access.account?.displayName || "Host / Director";
  const visibleAdmitted = layout === "spotlight"
    ? admitted.filter((guest) => guest.id === selectedParticipant).slice(0, 1)
    : layout === "interview"
      ? admitted.slice(0, 1)
      : admitted.slice(0, 5);
  const emptySlots = layout === "grid"
    ? Math.max(0, 4 - (1 + visibleAdmitted.length))
    : layout === "interview" && visibleAdmitted.length === 0
      ? 1
      : 0;

  return <StudioShell>
    <section className="room-workspace" aria-label={`${room.title} Studio workspace`}>
      <header className="room-status-strip">
        <div className="room-status-strip__identity">
          <ButtonLink to="/studio" variant="quiet">← Rooms</ButtonLink>
          <div><p className="eyebrow">Runtime-owned room</p><h1>{room.title}</h1><p>{room.description || "No room description."}</p></div>
        </div>
        <div className="room-status-strip__facts">
          <StatusChip tone={room.lifecycleState === "open" ? "alpha" : room.lifecycleState === "ended" ? "blocked" : "neutral"}>{room.lifecycleState}</StatusChip>
          <span><strong>{room.admittedGuestCount} / {room.maxGuestStageOccupants}</strong> on stage</span>
          <span><strong>{room.waitingGuestCount}</strong> waiting</span>
          <span className="runtime-indicator"><i aria-hidden="true" /> Runtime authority</span>
        </div>
        <div className="broadcast-state" aria-label="Broadcast state">
          <div><span className="off-air-dot" aria-hidden="true" /><strong>OFF AIR</strong><time>00:00:00</time></div>
          <Button onClick={() => setShowGoLiveInfo(true)}>Go live</Button>
        </div>
      </header>

      <div className="room-lifecycle-bar" aria-label="Room lifecycle controls">
        {["draft", "closed"].includes(room.lifecycleState) && <Button disabled={Boolean(busy)} onClick={() => void lifecycle("open")}>{busy === "lifecycle-open" ? "Opening…" : "Open room"}</Button>}
        {room.lifecycleState === "open" && <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void lifecycle("close")}>{busy === "lifecycle-close" ? "Closing…" : "Close entry"}</Button>}
        {room.lifecycleState !== "ended" && <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void lifecycle("end")}>{busy === "lifecycle-end" ? "Ending…" : "End room"}</Button>}
        <Button variant="secondary" disabled={Boolean(busy) || Boolean(guestBusy)} onClick={() => void refreshAuthority(false)}>Refresh authority</Button>
        <span>Room entry is {room.lifecycleState === "open" ? "open to valid invites" : "not accepting invite entry"}.</span>
      </div>

      {message && <p className="status-banner" role="status" aria-live="polite">{message}</p>}

      <div className="production-workspace">
        <aside className="production-rail" aria-label="Production tools">
          <button type="button" className={panel === "backstage" ? "is-active" : ""} onClick={() => setPanel("backstage")} aria-pressed={panel === "backstage"}>Backstage <span>{waiting.length}</span></button>
          <button type="button" className={panel === "invites" ? "is-active" : ""} onClick={() => setPanel("invites")} aria-pressed={panel === "invites"}>Invites <span>{invites.filter((invite) => invite.active).length}</span></button>
          <button type="button" className={panel === "room" ? "is-active" : ""} onClick={() => setPanel("room")} aria-pressed={panel === "room"}>Room</button>
        </aside>

        <main className="program-panel">
          <div className="program-panel__toolbar">
            <div><p className="eyebrow">Program output</p><strong>Stage</strong><span>Preview only · Media not connected</span></div>
            <div className="layout-picker" ref={layoutRef} role="group" aria-label="Stage layout">
              {(Object.keys(layoutLabels) as StageLayout[]).map((option) => <button key={option} type="button" className={layout === option ? "is-selected" : ""} aria-pressed={layout === option} onClick={() => setLayout(option)}>{layoutLabels[option]}</button>)}
            </div>
          </div>
          <div className={`program-canvas program-canvas--${layout}`} data-testid="program-canvas" data-layout={layout}>
            <div className="program-safe-area" aria-hidden="true"><span>Safe area</span></div>
            <button type="button" className={`participant-tile participant-tile--host ${selectedParticipant === "host" ? "is-selected" : ""}`} onClick={() => setSelectedParticipant("host")} aria-pressed={selectedParticipant === "host"}>
              <span className="participant-avatar">{initial(hostName)}</span>
              <span className="participant-identity"><strong>{hostName}</strong><small>Host / Director · Awaiting media</small></span>
            </button>
            {visibleAdmitted.map((guest) => <button type="button" className={`participant-tile ${selectedParticipant === guest.id ? "is-selected" : ""}`} key={guest.id} onClick={() => setSelectedParticipant(guest.id)} aria-pressed={selectedParticipant === guest.id}>
              <span className="participant-avatar">{initial(guest.displayName)}</span>
              <span className="participant-identity"><strong>{guest.displayName}</strong><small>On stage · Awaiting media</small></span>
            </button>)}
            {Array.from({ length: emptySlots }, (_, index) => <div className="participant-tile participant-tile--empty" key={`empty-${index}`}><span className="empty-slot-mark" aria-hidden="true">+</span><span className="participant-identity"><strong>Open stage position</strong><small>Admit a backstage guest</small></span></div>)}
            {layout === "spotlight" && selectedParticipant !== "host" && visibleAdmitted.length === 0 && <div className="participant-tile participant-tile--empty"><span className="empty-slot-mark" aria-hidden="true">+</span><span className="participant-identity"><strong>Select an on-stage guest</strong><small>Spotlight changes preview layout only</small></span></div>}
            <div className="program-canvas__notice"><strong>Media not connected</strong><span>No camera, microphone, screen share, track, or broadcast output is active.</span></div>
          </div>
        </main>

        <aside className="workspace-side-panel" aria-label="Room tools">
          <nav className="workspace-tabs" aria-label="Workspace panels">
            {(["backstage", "invites", "room"] as WorkspacePanel[]).map((item) => <button type="button" key={item} className={panel === item ? "is-active" : ""} onClick={() => setPanel(item)} aria-pressed={panel === item}>{item === "backstage" ? "Backstage" : item === "invites" ? "Invites" : "Room"}</button>)}
          </nav>

          {panel === "backstage" && <div className="backstage-panel">
            <section aria-labelledby="waiting-backstage-heading">
              <div className="side-panel-heading"><div><p className="eyebrow">Waiting lobby</p><h2 id="waiting-backstage-heading" ref={backstageHeadingRef} tabIndex={-1}>Waiting backstage</h2></div><StatusChip tone={waiting.length ? "pending" : "neutral"}>{waiting.length}</StatusChip></div>
              {waiting.length === 0 ? <EmptyState title="Backstage is clear"><p>Guests using a valid invite will wait here for a Runtime/Auth admission decision.</p></EmptyState> : <div className="guest-card-list">{waiting.map((guest) => <article className="guest-card" key={guest.id}><span className="guest-avatar" aria-hidden="true">{initial(guest.displayName)}</span><div className="guest-card__identity"><strong>{guest.displayName}</strong><span>Waiting · since {date(guest.createdAt)}</span></div><div className="guest-card__actions"><Button disabled={Boolean(guestBusy) || room.admittedGuestCount >= room.maxGuestStageOccupants} onClick={() => void guestAction(guest, "admit")}>{guestBusy === guest.id ? "Working…" : "Admit"}</Button><Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void guestAction(guest, "deny")}>Deny</Button></div></article>)}</div>}
              {room.admittedGuestCount >= room.maxGuestStageOccupants && waiting.length > 0 && <p className="stage-full-note" role="note">Stage full. Remove an on-stage guest before admitting another.</p>}
            </section>
            <section aria-labelledby="on-stage-heading">
              <div className="side-panel-heading"><div><p className="eyebrow">Admitted authority</p><h2 id="on-stage-heading">On stage</h2></div><StatusChip tone="alpha">{admitted.length} / {room.maxGuestStageOccupants}</StatusChip></div>
              {admitted.length === 0 ? <EmptyState title="No guests on stage"><p>The host/director remains separate from the nine Runtime-owned guest slots.</p></EmptyState> : <div className="guest-card-list">{admitted.map((guest) => <article className="guest-card" key={guest.id}><span className="guest-avatar" aria-hidden="true">{initial(guest.displayName)}</span><div className="guest-card__identity"><strong>{guest.displayName}</strong><span>On stage · admitted {date(guest.admittedAt)}</span></div><Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void guestAction(guest, "remove")}>{guestBusy === guest.id ? "Removing…" : "Remove from stage"}</Button></article>)}</div>}
            </section>
          </div>}

          {panel === "invites" && <div className="invite-panel"><div className="side-panel-heading"><div><p className="eyebrow">Secure guest entry</p><h2>Invite guests</h2></div><StatusChip tone="neutral">{invites.filter((invite) => invite.active).length} active</StatusChip></div>{room.lifecycleState !== "ended" && <form className="inline-form" onSubmit={createInvite}><FormField label="Invite label (optional)" value={inviteLabel} onChange={(event) => setInviteLabel(event.target.value)} maxLength={80} /><Button type="submit" disabled={Boolean(busy)}>{busy === "invite-create" ? "Creating…" : "Create invite"}</Button></form>}{oneTimeLink && <div className="one-time-secret" role="status"><strong>Copy this link now</strong><p>Runtime/Auth will never return this raw invite code again. Studio keeps it only in this page’s memory; it disappears on reload or navigation.</p><FormField ref={inviteLinkRef} label="One-time guest invite URL" value={oneTimeLink} readOnly onFocus={(event) => event.currentTarget.select()} /><Button onClick={() => void copyInvite()}>Copy invite link</Button></div>}<div className="invite-list">{invites.length === 0 ? <EmptyState title="No invites yet"><p>Create a one-time-reveal guest entry link when the room is ready.</p></EmptyState> : invites.map((invite) => <article key={invite.id}><div><strong>{invite.label || "Unlabelled invite"}</strong><p>{invite.active ? "Active" : "Revoked"} · Created {date(invite.createdAt)} · Expires {date(invite.expiresAt)}</p></div>{invite.active && room.lifecycleState !== "ended" && <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void revoke(invite)}>{busy === `invite-${invite.id}` ? "Revoking…" : "Revoke"}</Button>}</article>)}</div></div>}

          {panel === "room" && <div className="room-settings-panel"><div className="side-panel-heading"><div><p className="eyebrow">Runtime-owned details</p><h2>Room settings</h2></div><StatusChip>{room.lifecycleState}</StatusChip></div><form className="stack-form" onSubmit={saveRoom}><FormField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={room.lifecycleState === "ended"} /><label className="field"><span className="field__label">Description</span><textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={room.lifecycleState === "ended"} /></label><Button type="submit" disabled={Boolean(busy) || !title.trim() || room.lifecycleState === "ended"}>{busy === "save" ? "Saving…" : "Save details"}</Button></form><p className="fine-print">Updated {date(room.updatedAt)}. Room, lifecycle, invite, and lobby truth remains in Runtime/Auth.</p></div>}
        </aside>
      </div>

      <div className="control-dock" aria-label="Production control dock">
        <ControlButton label="Microphone" helper="Media is not connected" disabled />
        <ControlButton label="Camera" helper="Media is not connected" disabled />
        <ControlButton label="Screen share" helper="Media is not connected" disabled />
        <ControlButton label="Layout" helper={`${layoutLabels[layout]} preview`} active onClick={() => { layoutRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); layoutRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }} />
        <ControlButton label="Invite" helper="Open secure invites" active={panel === "invites"} onClick={() => setPanel("invites")} />
        <ControlButton label="Settings" helper="Open room settings" active={panel === "room"} onClick={() => setPanel("room")} />
        <ControlButton label="Go live" helper="Output integration not connected" onClick={() => setShowGoLiveInfo(true)} />
      </div>
    </section>

    {showGoLiveInfo && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGoLiveInfo(false); }}><section className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="go-live-title"><StatusChip tone="blocked">OFF AIR</StatusChip><h2 id="go-live-title">Live output is not connected yet.</h2><p>This pre-media workspace shows the intended production flow without starting a timer, requesting device access, connecting media, or sending a broadcast. Cloudflare Realtime is the next media milestone.</p><Button onClick={() => setShowGoLiveInfo(false)}>Got it</Button></section></div>}
  </StudioShell>;
}
