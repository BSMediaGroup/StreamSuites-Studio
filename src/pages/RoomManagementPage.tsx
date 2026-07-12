import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { createStudioInvite, connectStudioEvents, invitePermanentCohost, listStudioInvites, listStudioLobby, loadRoomCohosts, loadStudioRoomContext, revokeStudioInvite, setSessionCohost, StudioApiError, transitionStudioGuest, transitionStudioRoom, updateStudioRoom, updateStudioPresentation } from "../api/studioAuth";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { InvitePolicy, RoomCohosts, RoomConnectionState, RoomInvite, RoomPermissions, RoomSummary, StudioGuest } from "../domain/studio";
import { usePresentationPreferences } from "../presentation/presentationContext";

type WorkspacePanel = "backstage" | "invites" | "room";
type StageLayout = "grid" | "interview" | "spotlight";

const layoutLabels: Record<StageLayout, string> = {
  grid: "Grid",
  interview: "Interview",
  spotlight: "Spotlight",
};

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No expiry";
}

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function GuestAvatar({ guest }: { readonly guest: StudioGuest }) {
  return guest.avatarUrl ? (
    <img className="guest-avatar" src={guest.avatarUrl} alt="" crossOrigin="use-credentials" />
  ) : (
    <span className={`guest-avatar guest-avatar--${guest.avatarColor}`} aria-hidden="true">
      {initial(guest.displayName)}
    </span>
  );
}

function ControlButton({ label, helper, disabled = false, active = false, onClick, buttonRef }: { readonly label: string; readonly helper: string; readonly disabled?: boolean; readonly active?: boolean; readonly onClick?: () => void; readonly buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <span className="control-dock__item" title={helper}>
      <button ref={buttonRef} type="button" className={active ? "is-active" : ""} aria-label={`${label}. ${helper}`} aria-pressed={active || undefined} disabled={disabled} onClick={onClick}>
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
  const [cohosts, setCohosts] = useState<RoomCohosts | null>(null);
  const [permissions, setPermissions] = useState<RoomPermissions | null>(null);
  const [connection, setConnection] = useState<RoomConnectionState>("unavailable");
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKind, setErrorKind] = useState<"not-found" | "unavailable">("unavailable");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [guestBusy, setGuestBusy] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [invitePolicy, setInvitePolicy] = useState<InvitePolicy>("open");
  const [inviteCap, setInviteCap] = useState("5");
  const [invitePermanent, setInvitePermanent] = useState(false);
  const [inviteExpiry, setInviteExpiry] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [panel, setPanel] = useState<WorkspacePanel>("backstage");
  const [layout, setLayout] = useState<StageLayout>("grid");
  const [selectedParticipant, setSelectedParticipant] = useState("host");
  const [showGoLiveInfo, setShowGoLiveInfo] = useState(false);
  const [cinematicPanelOpen, setCinematicPanelOpen] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const backstageHeadingRef = useRef<HTMLHeadingElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const roomWorkspaceRef = useRef<HTMLElement>(null);
  const sidePanelRef = useRef<HTMLElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const goLiveTriggerRef = useRef<HTMLElement | null>(null);
  const { preferences, setCinematic, toggleCinematic } = usePresentationPreferences();
  const cinematic = preferences.cinematic === "on";
  const fullscreenSupported = typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  useGlobalActivity(status === "loading" || Boolean(busy) || Boolean(guestBusy), "Loading room authority");

  const refreshAuthority = useCallback(
    async (showLoading = true) => {
      if (showLoading) setStatus("loading");
      setMessage("");
      try {
        const [roomContext, nextInvites, nextGuests, nextCohosts] = await Promise.all([loadStudioRoomContext(roomId), listStudioInvites(roomId), listStudioLobby(roomId), loadRoomCohosts(roomId)]);
        const nextRoom = roomContext.room;
        setRoom(nextRoom);
        setPermissions(roomContext.permissions);
        setInvites(nextInvites);
        setGuests(nextGuests);
        setCohosts(nextCohosts);
        setTitle(nextRoom.title);
        setDescription(nextRoom.description ?? "");
        if (roomId !== nextRoom.id) window.history.replaceState(null, "", `/studio/rooms/${encodeURIComponent(nextRoom.id)}`);
        setStatus("ready");
      } catch (error) {
        setErrorKind(error instanceof StudioApiError && error.status === 404 ? "not-found" : "unavailable");
        setMessage(error instanceof Error ? error.message : "Room workspace could not be loaded.");
        setStatus("error");
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (access.account) void refreshAuthority();
  }, [access.account, access.status, refreshAuthority]);

  const liveRoomId = room?.id;
  useEffect(() => {
    if (!liveRoomId || status !== "ready") return;
    let refreshTimer = 0;
    const connectionHandle = connectStudioEvents({
      roomId: liveRoomId,
      onState: setConnection,
      onEvent: (event) => {
        window.clearTimeout(refreshTimer);
        const eventName = event.type.replaceAll("_", " ");
        setAnnouncement(`Room update: ${eventName}.`);
        refreshTimer = window.setTimeout(() => void refreshAuthority(false), 80);
      },
    });
    return () => {
      window.clearTimeout(refreshTimer);
      connectionHandle.close();
    };
  }, [liveRoomId, status, refreshAuthority]);

  useEffect(() => {
    if (connection !== "fallback polling") return;
    const timer = window.setInterval(() => void refreshAuthority(false), 10000);
    return () => window.clearInterval(timer);
  }, [connection, refreshAuthority]);

  const waiting = useMemo(() => guests.filter((guest) => guest.state === "waiting"), [guests]);
  const admitted = useMemo(() => guests.filter((guest) => guest.state === "admitted"), [guests]);

  useEffect(() => {
    const update = () => setFullscreenActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    update();
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    if (!cinematic) setCinematicPanelOpen(false);
  }, [cinematic]);

  useEffect(() => {
    if (!cinematic || !cinematicPanelOpen) return;
    const panelElement = sidePanelRef.current;
    const focusable = () => Array.from(panelElement?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []);
    const first = focusable()[0];
    window.setTimeout(() => first?.focus(), 0);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCinematicPanelOpen(false);
        window.setTimeout(() => panelTriggerRef.current?.focus(), 0);
      } else if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) return;
        const firstItem = items[0];
        const lastItem = items.at(-1)!;
        if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
        else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [cinematic, cinematicPanelOpen]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.key.toLowerCase() !== "f" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable=true]"))) return;
      event.preventDefault();
      toggleCinematic();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [toggleCinematic]);

  useEffect(() => {
    if (!showGoLiveInfo) return;
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(".studio-dialog .button")?.focus(), 0);
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowGoLiveInfo(false);
      window.setTimeout(() => goLiveTriggerRef.current?.focus(), 0);
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [showGoLiveInfo]);

  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        setCinematic("on");
        const target = roomWorkspaceRef.current?.closest<HTMLElement>(".studio-main") ?? roomWorkspaceRef.current;
        await target?.requestFullscreen();
      }
    } catch {
      setMessage("Browser fullscreen was not allowed. Cinematic mode remains available.");
    }
  }, [fullscreenSupported, setCinematic]);

  function openWorkspacePanel(next: WorkspacePanel, trigger?: HTMLButtonElement | null) {
    setPanel(next);
    if (trigger) panelTriggerRef.current = trigger;
    if (cinematic) setCinematicPanelOpen(true);
  }

  function openGoLiveInfo() {
    goLiveTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShowGoLiveInfo(true);
  }

  function closeGoLiveInfo() {
    setShowGoLiveInfo(false);
    window.setTimeout(() => goLiveTriggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (selectedParticipant !== "host" && !admitted.some((guest) => guest.id === selectedParticipant)) {
      setSelectedParticipant("host");
    }
  }, [admitted, selectedParticipant]);

  if (access.status === "loading") {
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card role="status">
            <h1>Checking room access…</h1>
          </Card>
        </section>
      </SiteShell>
    );
  }
  if (access.status === "unauthenticated") {
    return <Navigate to={`/login?return_to=${encodeURIComponent(`/studio/rooms/${roomId}`)}`} replace />;
  }
  if (!access.account) {
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
      const updated = await updateStudioRoom(room.id, {
        title,
        description: description.trim() || null,
      });
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
    try {
      const created = await createStudioInvite(room.id, {
        ...(inviteLabel.trim() ? { label: inviteLabel } : {}),
        policy_type: invitePolicy,
        ...(invitePolicy === "capped" ? { max_uses: Number(inviteCap) } : {}),
        permanent: invitePermanent,
        ...(!invitePermanent ? { expires_at: new Date(inviteExpiry).toISOString() } : {}),
      });
      setInvites(await listStudioInvites(room.id));
      setInviteLabel("");
      setMessage(`Invite created. Canonical ${created.inviteCode.length}-character link is available to copy.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function copyInvite(invite: RoomInvite) {
    const link = `${window.location.origin}/join/${encodeURIComponent(invite.inviteCode)}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Invite link copied.");
    } catch {
      setMessage(`Clipboard access was unavailable. Copy this link manually: ${link}`);
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
      const [nextRoom, nextGuests] = await Promise.all([loadStudioRoomContext(room.id), listStudioLobby(room.id)]);
      setRoom(nextRoom.room);
      setPermissions(nextRoom.permissions);
      setGuests(nextGuests);
      setMessage(action === "admit" ? "Guest admitted by Runtime/Auth. Media remains unconnected." : `Guest ${action === "deny" ? "denied" : "removed from stage"} by Runtime/Auth.`);
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

  async function sessionCohost(guest: StudioGuest, enabled: boolean) {
    if (!room || guestBusy) return;
    setGuestBusy(guest.id);
    try {
      await setSessionCohost(room.id, guest.id, enabled);
      await refreshAuthority(false);
      setMessage(`${guest.displayName} ${enabled ? "promoted to" : "removed from"} session cohost authority.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Session cohost authority could not be changed.");
    } finally {
      setGuestBusy("");
    }
  }

  async function permanentCohost(guest: StudioGuest) {
    if (!room || guestBusy) return;
    setGuestBusy(guest.id);
    try {
      await invitePermanentCohost({
        roomId: room.id,
        guestId: guest.id,
        scopeType: "selected_rooms",
        roomIds: [room.id],
      });
      await refreshAuthority(false);
      setMessage(`Permanent cohost invitation sent to ${guest.displayName}. Provisional authority is active for this room${guest.signedIn ? "." : "; they must sign in with the same guest session to accept."}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Permanent cohost invitation could not be created.");
    } finally {
      setGuestBusy("");
    }
  }

  if (status === "loading") {
    return (
      <StudioShell>
        <Card className="workspace-loading" role="status">
          <p className="eyebrow">Runtime-owned room</p>
          <h1>Preparing the Studio workspace…</h1>
          <p>Loading room, invite, and lobby authority.</p>
        </Card>
      </StudioShell>
    );
  }
  if (status === "error" || !room) {
    return (
      <StudioShell>
        <Card>
          <EmptyState title={errorKind === "not-found" ? "Room not found" : "Room unavailable"}>
            <p>{message}</p>
            <div className="access-actions">
              <Button onClick={() => void refreshAuthority()}>Retry</Button>
              <ButtonLink to="/studio" variant="quiet">
                Back to rooms
              </ButtonLink>
            </div>
          </EmptyState>
        </Card>
      </StudioShell>
    );
  }

  const hostName = access.account?.displayName || "Host / Director";
  const visibleAdmitted = layout === "spotlight" ? admitted.filter((guest) => guest.id === selectedParticipant).slice(0, 1) : layout === "interview" ? admitted.slice(0, 1) : admitted.slice(0, 5);
  const emptySlots = layout === "grid" ? Math.max(0, 4 - (1 + visibleAdmitted.length)) : layout === "interview" && visibleAdmitted.length === 0 ? 1 : 0;

  return (
    <StudioShell roomWorkspace fullscreenSupported={fullscreenSupported} fullscreenActive={fullscreenActive} onToggleFullscreen={() => void toggleFullscreen()}>
      <section ref={roomWorkspaceRef} className="room-workspace" aria-label={`${room.title} Studio workspace`}>
        {cinematic && <div className="cinematic-room-actions" aria-label="Cinematic workspace controls">
          <button type="button" onClick={toggleCinematic}>Exit cinematic <kbd>F</kbd></button>
          {fullscreenSupported && <button type="button" onClick={() => void toggleFullscreen()}>{fullscreenActive ? "Exit fullscreen" : "Fullscreen"}</button>}
        </div>}
        <header className="room-status-strip">
          <div className="room-status-strip__identity">
            <ButtonLink to="/studio" variant="quiet">
              ← Rooms
            </ButtonLink>
            <div>
              <p className="eyebrow">Runtime-owned room</p>
              <h1>{room.title}</h1>
              <p>{room.description || "No room description."}</p>
            </div>
          </div>
          <div className="room-status-strip__facts">
            <StatusChip tone={room.lifecycleState === "open" ? "alpha" : room.lifecycleState === "ended" ? "blocked" : "neutral"}>{room.lifecycleState}</StatusChip>
            <span>
              <strong>
                {room.admittedGuestCount} / {room.maxGuestStageOccupants}
              </strong>{" "}
              on stage
            </span>
            <span>
              <strong>{room.waitingGuestCount}</strong> waiting
            </span>
            <span className={`connection-state connection-state--${connection.replace(" ", "-")}`}>
              <i aria-hidden="true" /> {connection}
            </span>
            <span className="runtime-indicator">
              <i aria-hidden="true" /> Runtime authority
            </span>
          </div>
          <div className="broadcast-state" aria-label="Broadcast state">
            <div>
              <span className="off-air-dot" aria-hidden="true" />
              <strong>OFF AIR</strong>
              <time>00:00:00</time>
            </div>
            <Button onClick={openGoLiveInfo}>Go live</Button>
          </div>
        </header>

        <div className="room-lifecycle-bar" aria-label="Room lifecycle controls">
          {["draft", "closed"].includes(room.lifecycleState) && (
            <Button disabled={Boolean(busy)} onClick={() => void lifecycle("open")}>
              {busy === "lifecycle-open" ? "Opening…" : "Open room"}
            </Button>
          )}
          {room.lifecycleState === "open" && (
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void lifecycle("close")}>
              {busy === "lifecycle-close" ? "Closing…" : "Close entry"}
            </Button>
          )}
          {room.lifecycleState !== "ended" && permissions?.endRoom && (
            <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void lifecycle("end")}>
              {busy === "lifecycle-end" ? "Ending…" : "End room"}
            </Button>
          )}
          <Button variant="secondary" disabled={Boolean(busy) || Boolean(guestBusy)} onClick={() => void refreshAuthority(false)}>
            Refresh authority
          </Button>
          <span>Room entry is {room.lifecycleState === "open" ? "open to valid invites" : "not accepting invite entry"}.</span>
        </div>

        {message && (
          <p className="status-banner" role="status" aria-live="polite">
            {message}
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <div className="production-workspace">
          <aside className="production-rail" aria-label="Production tools">
            <button type="button" className={panel === "backstage" ? "is-active" : ""} onClick={(event) => openWorkspacePanel("backstage", event.currentTarget)} aria-pressed={panel === "backstage"}>
              Backstage <span>{waiting.length}</span>
            </button>
            <button type="button" className={panel === "invites" ? "is-active" : ""} onClick={(event) => openWorkspacePanel("invites", event.currentTarget)} aria-pressed={panel === "invites"}>
              Invites <span>{invites.filter((invite) => invite.active).length}</span>
            </button>
            <button type="button" className={panel === "room" ? "is-active" : ""} onClick={(event) => openWorkspacePanel("room", event.currentTarget)} aria-pressed={panel === "room"}>
              Room
            </button>
          </aside>

          <main className="program-panel">
            <div className="program-panel__toolbar">
              <div>
                <p className="eyebrow">Program output</p>
                <strong>Stage</strong>
                <span>Preview only · Media not connected</span>
              </div>
              <div className="layout-picker" ref={layoutRef} role="group" aria-label="Stage layout">
                {(Object.keys(layoutLabels) as StageLayout[]).map((option) => (
                  <button key={option} type="button" className={layout === option ? "is-selected" : ""} aria-pressed={layout === option} onClick={() => setLayout(option)}>
                    {layoutLabels[option]}
                  </button>
                ))}
              </div>
            </div>
            <div className={`program-canvas program-canvas--${layout}`} data-testid="program-canvas" data-layout={layout}>
              <div className="program-safe-area" aria-hidden="true">
                <span>Safe area</span>
              </div>
              <button type="button" className={`participant-tile participant-tile--host ${selectedParticipant === "host" ? "is-selected" : ""}`} onClick={() => setSelectedParticipant("host")} aria-pressed={selectedParticipant === "host"}>
                <span className="participant-avatar">{initial(hostName)}</span>
                <span className="participant-identity">
                  <strong>{hostName}</strong>
                  <small>Host / Director · Awaiting media</small>
                </span>
              </button>
              {visibleAdmitted.map((guest) => (
                <button type="button" className={`participant-tile ${selectedParticipant === guest.id ? "is-selected" : ""}`} key={guest.id} onClick={() => setSelectedParticipant(guest.id)} aria-pressed={selectedParticipant === guest.id}>
                  {guest.avatarUrl ? <img className="participant-avatar" src={guest.avatarUrl} alt="" crossOrigin="use-credentials" /> : <span className={`participant-avatar guest-avatar--${guest.avatarColor}`}>{initial(guest.displayName)}</span>}
                  <span className="participant-identity">
                    <strong>{guest.displayName}</strong>
                    {room.presentation.showParticipantSubtitles && guest.subtitle && <small>{guest.subtitle}</small>}
                    <small>On stage · Awaiting media</small>
                  </span>
                </button>
              ))}
              {Array.from({ length: emptySlots }, (_, index) => (
                <div className="participant-tile participant-tile--empty" key={`empty-${index}`}>
                  <span className="empty-slot-mark" aria-hidden="true">
                    +
                  </span>
                  <span className="participant-identity">
                    <strong>Open stage position</strong>
                    <small>Admit a backstage guest</small>
                  </span>
                </div>
              ))}
              {layout === "spotlight" && selectedParticipant !== "host" && visibleAdmitted.length === 0 && (
                <div className="participant-tile participant-tile--empty">
                  <span className="empty-slot-mark" aria-hidden="true">
                    +
                  </span>
                  <span className="participant-identity">
                    <strong>Select an on-stage guest</strong>
                    <small>Spotlight changes preview layout only</small>
                  </span>
                </div>
              )}
              <div className="program-canvas__notice">
                <strong>Media not connected</strong>
                <span>No camera, microphone, screen share, track, or broadcast output is active.</span>
              </div>
            </div>
          </main>

          {cinematic && cinematicPanelOpen && <button className="cinematic-panel-scrim" type="button" aria-label="Close room tools" onClick={() => { setCinematicPanelOpen(false); window.setTimeout(() => panelTriggerRef.current?.focus(), 0); }} />}
          <aside ref={sidePanelRef} className={`workspace-side-panel${cinematicPanelOpen ? " is-cinematic-open" : ""}`} aria-label="Room tools" {...(cinematic ? (cinematicPanelOpen ? { role: "dialog", "aria-modal": true } : { "aria-hidden": true }) : {})}>
            {cinematic && <button className="cinematic-panel-close" type="button" onClick={() => { setCinematicPanelOpen(false); window.setTimeout(() => panelTriggerRef.current?.focus(), 0); }}>Close room tools</button>}
            <nav className="workspace-tabs" aria-label="Workspace panels">
              {(["backstage", "invites", "room"] as WorkspacePanel[]).map((item) => (
                <button type="button" key={item} className={panel === item ? "is-active" : ""} onClick={() => setPanel(item)} aria-pressed={panel === item}>
                  {item === "backstage" ? "Backstage" : item === "invites" ? "Invites" : "Room"}
                </button>
              ))}
            </nav>

            {panel === "backstage" && (
              <div className="backstage-panel">
                <section aria-labelledby="waiting-backstage-heading">
                  <div className="side-panel-heading">
                    <div>
                      <p className="eyebrow">Waiting lobby</p>
                      <h2 id="waiting-backstage-heading" ref={backstageHeadingRef} tabIndex={-1}>
                        Waiting backstage
                      </h2>
                    </div>
                    <StatusChip tone={waiting.length ? "pending" : "neutral"}>{waiting.length}</StatusChip>
                  </div>
                  {waiting.length === 0 ? (
                    <EmptyState title="Backstage is clear">
                      <p>Guests using a valid invite will appear here immediately.</p>
                    </EmptyState>
                  ) : (
                    <div className="guest-card-list">
                      {waiting.map((guest) => (
                        <article className="guest-card guest-card--arrival" key={guest.id}>
                          <GuestAvatar guest={guest} />
                          <div className="guest-card__identity">
                            <strong>{guest.displayName}</strong>
                            {room.presentation.showParticipantSubtitles && guest.subtitle && <small>{guest.subtitle}</small>}
                            <span>
                              Waiting since {date(guest.createdAt)} · {guest.signedIn ? "Signed in" : "Guest"}
                            </span>
                            {guest.sessionCohost && <StatusChip tone="alpha">Session cohost</StatusChip>}
                          </div>
                          <div className="guest-card__actions">
                            <Button disabled={Boolean(guestBusy) || room.admittedGuestCount >= room.maxGuestStageOccupants} onClick={() => void guestAction(guest, "admit")}>
                              {guestBusy === guest.id ? "Working…" : "Admit"}
                            </Button>
                            <Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void guestAction(guest, "deny")}>
                              Deny
                            </Button>
                            {permissions?.endRoom && (
                              <Button variant="secondary" disabled={Boolean(guestBusy)} onClick={() => void sessionCohost(guest, !guest.sessionCohost)}>
                                {guest.sessionCohost ? "Revoke cohost" : "Session cohost"}
                              </Button>
                            )}
                            {permissions?.managePermanentCohosts && !guest.pendingPermanentCohost && (
                              <Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void permanentCohost(guest)}>
                                Permanent cohost
                              </Button>
                            )}
                            {guest.pendingPermanentCohost && <StatusChip tone="pending">Permanent invite pending</StatusChip>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {room.admittedGuestCount >= room.maxGuestStageOccupants && waiting.length > 0 && (
                    <p className="stage-full-note" role="note">
                      Stage full. Remove an on-stage guest before admitting another.
                    </p>
                  )}
                </section>
                <section aria-labelledby="on-stage-heading">
                  <div className="side-panel-heading">
                    <div>
                      <p className="eyebrow">Admitted authority</p>
                      <h2 id="on-stage-heading">On stage</h2>
                    </div>
                    <StatusChip tone="alpha">
                      {admitted.length} / {room.maxGuestStageOccupants}
                    </StatusChip>
                  </div>
                  {admitted.length === 0 ? (
                    <EmptyState title="No guests on stage">
                      <p>The host/director remains separate from the nine Runtime-owned guest slots.</p>
                    </EmptyState>
                  ) : (
                    <div className="guest-card-list">
                      {admitted.map((guest) => (
                        <article className="guest-card" key={guest.id}>
                          <GuestAvatar guest={guest} />
                          <div className="guest-card__identity">
                            <strong>{guest.displayName}</strong>
                            {room.presentation.showParticipantSubtitles && guest.subtitle && <small>{guest.subtitle}</small>}
                            <span>On stage · admitted {date(guest.admittedAt)}</span>
                            {guest.sessionCohost && <StatusChip tone="alpha">Session cohost</StatusChip>}
                          </div>
                          <div className="guest-card__actions">
                            <Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void guestAction(guest, "remove")}>
                              {guestBusy === guest.id ? "Removing…" : "Remove from stage"}
                            </Button>
                            {permissions?.endRoom && (
                              <Button variant="secondary" disabled={Boolean(guestBusy)} onClick={() => void sessionCohost(guest, !guest.sessionCohost)}>
                                {guest.sessionCohost ? "Revoke cohost" : "Session cohost"}
                              </Button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <section aria-labelledby="cohosts-heading">
                  <div className="side-panel-heading">
                    <div>
                      <p className="eyebrow">Scoped authority</p>
                      <h2 id="cohosts-heading">Cohosts</h2>
                    </div>
                  </div>
                  <div className="cohost-list">
                    <article>
                      <strong>{cohosts?.director?.displayName ?? hostName}</strong>
                      <span>Director</span>
                    </article>
                    {cohosts?.session.map((guest) => (
                      <article key={guest.id}>
                        <strong>{guest.displayName}</strong>
                        <span>Session cohost · this room</span>
                      </article>
                    ))}
                    {cohosts?.permanent.map((relationship) => (
                      <article key={relationship.id}>
                        <strong>{relationship.cohost?.displayName ?? "Cohost"}</strong>
                        <span>
                          {relationship.status} · {relationship.scopeType === "all_rooms" ? "All rooms" : `${relationship.roomIds.length} selected room${relationship.roomIds.length === 1 ? "" : "s"}`}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {panel === "invites" && (
              <div className="invite-panel">
                <div className="side-panel-heading">
                  <div>
                    <p className="eyebrow">Secure guest entry</p>
                    <h2>Invite guests</h2>
                  </div>
                  <StatusChip tone="neutral">{invites.filter((invite) => invite.active).length} active</StatusChip>
                </div>
                {room.lifecycleState !== "ended" && permissions?.manageInvites && (
                  <form className="stack-form invite-policy-form" onSubmit={createInvite}>
                    <FormField label="Invite label (optional)" value={inviteLabel} onChange={(event) => setInviteLabel(event.target.value)} maxLength={80} />
                    <label className="field">
                      <span className="field__label">Invite policy</span>
                      <select value={invitePolicy} onChange={(event) => setInvitePolicy(event.target.value as InvitePolicy)}>
                        <option value="single_use">Single use</option>
                        <option value="capped">Capped entrants</option>
                        <option value="open">Open</option>
                      </select>
                    </label>
                    {invitePolicy === "capped" && <FormField label="Entrant cap" type="number" min={1} value={inviteCap} onChange={(event) => setInviteCap(event.target.value)} />}
                    {!invitePermanent && <FormField label="Expiry" type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} />}
                    <label className="check-row">
                      <input type="checkbox" checked={invitePermanent} onChange={(event) => setInvitePermanent(event.target.checked)} />
                      <span>Permanent / no expiry</span>
                    </label>
                    <Button type="submit" disabled={Boolean(busy) || (invitePolicy === "capped" && Number(inviteCap) < 1)}>
                      {busy === "invite-create" ? "Creating…" : "Create invite"}
                    </Button>
                  </form>
                )}
                <div className="invite-list">
                  {invites.length === 0 ? (
                    <EmptyState title="No invites yet">
                      <p>Create a reusable canonical link with a Runtime-enforced policy.</p>
                    </EmptyState>
                  ) : (
                    invites.map((invite) => (
                      <article key={invite.id}>
                        <div>
                          <strong>{invite.label || "Unlabelled invite"}</strong>
                          <p>
                            {invite.exhausted ? "Exhausted" : invite.active ? "Active" : "Revoked"} · {invite.policyType.replace("_", " ")} · {invite.successfulUseCount}
                            {invite.maxUses === null ? " uses" : ` / ${invite.maxUses} uses`} · {invite.permanent ? "No expiry" : `Expires ${date(invite.expiresAt)}`}
                          </p>
                        </div>
                        <div className="guest-card__actions">
                          {invite.inviteCode && (
                            <Button variant="secondary" onClick={() => void copyInvite(invite)}>
                              Copy link
                            </Button>
                          )}
                          {invite.active && room.lifecycleState !== "ended" && (
                            <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void revoke(invite)}>
                              {busy === `invite-${invite.id}` ? "Revoking…" : "Revoke"}
                            </Button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}

            {panel === "room" && (
              <div className="room-settings-panel">
                <div className="side-panel-heading">
                  <div>
                    <p className="eyebrow">Runtime-owned details</p>
                    <h2>Room settings</h2>
                  </div>
                  <StatusChip>{room.lifecycleState}</StatusChip>
                </div>
                <form className="stack-form" onSubmit={saveRoom}>
                  <FormField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={room.lifecycleState === "ended" || !permissions?.updateRoom} />
                  <label className="field">
                    <span className="field__label">Description</span>
                    <textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={room.lifecycleState === "ended" || !permissions?.updateRoom} />
                  </label>
                  <Button type="submit" disabled={Boolean(busy) || !title.trim() || room.lifecycleState === "ended" || !permissions?.updateRoom}>
                    {busy === "save" ? "Saving…" : "Save details"}
                  </Button>
                </form>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={room.presentation.showParticipantSubtitles}
                    disabled={!permissions?.updatePresentation}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      void updateStudioPresentation(room.id, checked)
                        .then(setRoom)
                        .catch((error) => setMessage(error instanceof Error ? error.message : "Presentation setting could not be changed."));
                    }}
                  />
                  <span>Show participant subtitles</span>
                </label>
                <p className="fine-print">Updated {date(room.updatedAt)}. Room, lifecycle, invite, cohost, and lobby truth remains in Runtime/Auth.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="control-dock" aria-label="Production control dock">
          <ControlButton label="Microphone" helper="Media is not connected" disabled />
          <ControlButton label="Camera" helper="Media is not connected" disabled />
          <ControlButton label="Screen share" helper="Media is not connected" disabled />
          <ControlButton
            label="Layout"
            helper={`${layoutLabels[layout]} preview`}
            active
            onClick={() => {
              layoutRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              layoutRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }}
          />
          <ControlButton buttonRef={panelTriggerRef} label="Backstage" helper={`${waiting.length} waiting, ${admitted.length} on stage`} active={panel === "backstage" && (!cinematic || cinematicPanelOpen)} onClick={() => openWorkspacePanel("backstage")} />
          <ControlButton label="Invite" helper="Open secure invites" active={panel === "invites" && (!cinematic || cinematicPanelOpen)} onClick={() => openWorkspacePanel("invites")} />
          <ControlButton label="Settings" helper="Open room settings" active={panel === "room" && (!cinematic || cinematicPanelOpen)} onClick={() => openWorkspacePanel("room")} />
          <ControlButton label="Go live" helper="Output integration not connected" onClick={openGoLiveInfo} />
        </div>
      </section>

      {showGoLiveInfo && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGoLiveInfo();
          }}
        >
          <section className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="go-live-title">
            <StatusChip tone="blocked">OFF AIR</StatusChip>
            <h2 id="go-live-title">Live output is not connected yet.</h2>
            <p>This pre-media workspace shows the intended production flow without starting a timer, requesting device access, connecting media, or sending a broadcast. Cloudflare Realtime is the next media milestone.</p>
            <Button onClick={closeGoLiveInfo}>Got it</Button>
          </section>
        </div>
      )}
    </StudioShell>
  );
}
