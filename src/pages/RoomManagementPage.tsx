import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type React from "react";
import { Navigate, useParams } from "react-router-dom";
import { createStudioCustomLayout, createStudioInvite, connectStudioEvents, deleteStudioBrowserSource, deleteStudioCustomLayout, deleteStudioInvite, invitePermanentCohost, listRoomChatMessages, listStudioBrowserSources, listStudioInvites, listStudioLobby, loadPresentationSources, loadRoomCohosts, loadStudioGuestSession, loadStudioRoomContext, movePresentationSource, moveStudioBrowserSource, moveStudioParticipant, refreshStudioBrowserSource, registerPresentationSource, reorderStudioCustomLayouts, reorderStudioStage, revokeCohostRelationship, revokeStudioInvite, setSessionCohost, stopPresentationSource, StudioApiError, transitionStudioGuest, transitionStudioRoom, updateCohostScope, updateStudioCustomLayout, updateStudioMediaIntent, updateStudioRoom, updateStudioPresentation } from "../api/studioAuth";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { StudioEdgeSidebar, StudioEdgeSidebarPortal } from "../components/shell/StudioEdgeSidebar";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import { ParticipantMenuPortal, type ParticipantMenuItem } from "../components/ui/ParticipantMenuPortal";
import { StudioIcon } from "../components/ui/StudioIcon";
import type { BrowserSource, InvitePolicy, PresentationSource, RoomBranding, RoomCohosts, RoomConnectionState, RoomInvite, RoomPermissions, RoomSummary, StageLayout, StudioGuest } from "../domain/studio";
import { CustomLayoutMenu, CustomLayoutsSection } from "../components/room/CustomLayoutControls";
import { RoomBrandingPanel } from "../components/room/RoomBrandingPanel";
import { RoomMediaPanel } from "../components/room/RoomMediaPanel";
import { BrowserSourceRenderer } from "../components/room/BrowserSourceRenderer";
import { ContextualNoticeStack, inferContextualNoticeTone, type ContextualNotice, type ContextualNoticeTone } from "../components/room/ContextualNoticeStack";
import { RoomChatPanel } from "../components/room/RoomChatPanel";
import { StageBrandingOverlay, stageBrandingStyle } from "../branding/StageBranding";
import { usePresentationPreferences } from "../presentation/presentationContext";
import { GuestRoomWorkspace } from "./GuestRoomWorkspace";
import exitIcon from "../../assets/icons/ui/exitroom.svg";
import exitFilledIcon from "../../assets/icons/ui/exitroom-filled.svg";
import backstageIcon from "../../assets/icons/ui/backstage.svg";
import backstageFilledIcon from "../../assets/icons/ui/backstage-filled.svg";
import inviteIcon from "../../assets/icons/ui/invite.svg";
import inviteFilledIcon from "../../assets/icons/ui/invite-filled.svg";
import roomPrefsIcon from "../../assets/icons/ui/roomprefs.svg";
import roomPrefsFilledIcon from "../../assets/icons/ui/roomprefs-filled.svg";
import gridIcon from "../../assets/icons/ui/layout4x.svg";
import gridFilledIcon from "../../assets/icons/ui/layout4x-filled.svg";
import interviewIcon from "../../assets/icons/ui/layout2x.svg";
import interviewFilledIcon from "../../assets/icons/ui/layout2x-filled.svg";
import spotlightIcon from "../../assets/icons/ui/layout1x.svg";
import spotlightFilledIcon from "../../assets/icons/ui/layout1x-filled.svg";
import presentationIcon from "../../assets/icons/ui/layoutpresent.svg";
import presentationFilledIcon from "../../assets/icons/ui/layoutpresent-filled.svg";
import autoIcon from "../../assets/icons/ui/layoutauto.svg";
import autoFilledIcon from "../../assets/icons/ui/layoutauto-filled.svg";
import removePersonIcon from "../../assets/icons/ui/personremove.svg";
import revokeIcon from "../../assets/icons/ui/removemod.svg";
import microphoneIcon from "../../assets/icons/ui/mic.svg";
import microphoneFilledIcon from "../../assets/icons/ui/mic-filled.svg";
import cameraIcon from "../../assets/icons/ui/videocamera.svg";
import cameraFilledIcon from "../../assets/icons/ui/videocamera-filled.svg";
import shareIcon from "../../assets/icons/ui/sharebox.svg";
import mediaIcon from "../../assets/icons/ui/media.svg";
import mediaFilledIcon from "../../assets/icons/ui/mediafill.svg";
import brandIcon from "../../assets/icons/ui/starform.svg";
import customIcon from "../../assets/icons/ui/layoutcustom.svg";
import customFilledIcon from "../../assets/icons/ui/layoutcustom-filled.svg";
import goLiveIcon from "../../assets/icons/ui/cast.svg";
import optionsIcon from "../../assets/icons/ui/options.svg";
import refreshIcon from "../../assets/icons/ui/refresh.svg";
import moveUpIcon from "../../assets/icons/ui/moveselectionup.svg";
import moveUpFilledIcon from "../../assets/icons/ui/moveselectionup-filled.svg";
import moveDownIcon from "../../assets/icons/ui/moveselectiondown.svg";
import moveDownFilledIcon from "../../assets/icons/ui/moveselectiondown-filled.svg";
import previousIcon from "../../assets/icons/ui/previous.svg";
import nextIcon from "../../assets/icons/ui/next.svg";
import chatIcon from "../../assets/icons/ui/chat.svg";
import chatFilledIcon from "../../assets/icons/ui/chatfill.svg";
import { useStudioMedia } from "../media/useStudioMedia";
import { BackstageMediaPreview, DevicePreflightDialog, LocalMediaVideo, MediaParticipantTile, ParticipantFallback, ParticipantLabelOverlay, ScreenShareVideo } from "../media/StudioMediaElements";
import { resolveEffectiveStageLayout, stageGridRows } from "../layout/stageLayout";

type WorkspacePanel = "backstage" | "invites" | "room" | "brand" | "media" | "chat";
const layoutLabels: Record<StageLayout, string> = {
  auto: "Auto",
  grid: "Grid",
  interview: "Interview",
  spotlight: "Spotlight",
  presentation: "Presentation",
  custom: "Custom",
};

const layoutIcons: Record<StageLayout, readonly [string, string]> = {
  grid: [gridIcon, gridFilledIcon],
  interview: [interviewIcon, interviewFilledIcon],
  spotlight: [spotlightIcon, spotlightFilledIcon],
  presentation: [presentationIcon, presentationFilledIcon],
  auto: [autoIcon, autoFilledIcon],
  custom: [customIcon, customFilledIcon],
};

const panelIcons: Record<WorkspacePanel, readonly [string, string]> = {
  backstage: [backstageIcon, backstageFilledIcon],
  invites: [inviteIcon, inviteFilledIcon],
  room: [roomPrefsIcon, roomPrefsFilledIcon],
  brand: [brandIcon, brandIcon],
  media: [mediaIcon, mediaFilledIcon],
  chat: [chatIcon, chatFilledIcon],
};
const panelLabels: Record<WorkspacePanel, string> = { backstage: "Backstage", invites: "Invites", room: "Room", brand: "Branding", media: "Media", chat: "Chat" };

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
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [guest.avatarUrl]);
  return guest.avatarUrl && !failed ? (
    <img className="guest-avatar" src={guest.avatarUrl} alt="" crossOrigin="use-credentials" onError={() => setFailed(true)} />
  ) : (
    <span className={`guest-avatar guest-avatar--${guest.avatarColor}`} aria-hidden="true">
      {initial(guest.displayName)}
    </span>
  );
}

function ControlButton({ label, helper, icon, filledIcon, disabled = false, active = false, onClick, buttonRef }: { readonly label: string; readonly helper: string; readonly icon: string; readonly filledIcon?: string; readonly disabled?: boolean; readonly active?: boolean; readonly onClick?: () => void; readonly buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <span className="control-dock__item studio-tooltip" data-tooltip={helper}>
      <button ref={buttonRef} type="button" className={`icon-control${active ? " is-active" : ""}`} aria-label={`${label}. ${helper}`} aria-pressed={active || undefined} disabled={disabled} onClick={onClick}>
        <StudioIcon regular={icon} filled={filledIcon} active={active} />
        <strong>{label}</strong>
      </button>
    </span>
  );
}

export function RoomManagementPage() {
  const { access } = useStudioAuth();
  return access.status === "allowed" ? <AuthorizedRoomWorkspace /> : <GuestRoomWorkspace />;
}

function AuthorizedRoomWorkspace() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const [mode, setMode] = useState<"checking" | "host" | "guest" | "not-found" | "unavailable">("checking");
  const [authorityMessage, setAuthorityMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setMode("checking");
    setAuthorityMessage("");
    void listStudioLobby(roomId).then(() => {
      if (!cancelled) setMode("host");
    }).catch(async (error) => {
      if (error instanceof StudioApiError && error.status === 404) {
        if (!cancelled) {
          setAuthorityMessage(error.message);
          setMode("not-found");
        }
        return;
      }
      if (!(error instanceof StudioApiError) || error.code !== "forbidden") {
        if (!cancelled) {
          setAuthorityMessage(error instanceof Error ? error.message : "Room authority could not be resolved.");
          setMode("unavailable");
        }
        return;
      }
      try {
        const guest = await loadStudioGuestSession();
        if (!cancelled) {
          if (guest.roomId === roomId) setMode("guest");
          else {
            setAuthorityMessage("The current identity is not authorized for this room.");
            setMode("unavailable");
          }
        }
      } catch (guestError) {
        if (!cancelled) {
          setAuthorityMessage(guestError instanceof Error ? guestError.message : "The current identity is not authorized for this room.");
          setMode("unavailable");
        }
      }
    });
    return () => { cancelled = true; };
  }, [roomId]);

  if (mode === "guest") return <GuestRoomWorkspace />;
  if (mode === "host") return <HostRoomManagementPage />;
  if (mode === "not-found" || mode === "unavailable") return (
    <SiteShell><section className="centered-page page-width"><Card><EmptyState title={mode === "not-found" ? "Room not found" : "Room unavailable"}><p>{authorityMessage}</p><div className="access-actions"><ButtonLink to="/studio" variant="quiet">Back to rooms</ButtonLink></div></EmptyState></Card></section></SiteShell>
  );
  return <SiteShell><section className="centered-page page-width"><Card role="status"><h1>Checking room authority…</h1></Card></section></SiteShell>;
}

function HostRoomManagementPage() {
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
  const [message, setMessageState] = useState("");
  const [notices, setNotices] = useState<ContextualNotice[]>([]);
  const [busy, setBusy] = useState("");
  const [guestBusy, setGuestBusy] = useState("");
  const [draggedGuestId, setDraggedGuestId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [invitePolicy, setInvitePolicy] = useState<InvitePolicy>("open");
  const [inviteCap, setInviteCap] = useState("5");
  const [invitePermanent, setInvitePermanent] = useState(false);
  const [inviteRole, setInviteRole] = useState<"producer" | "guest" | "viewer">("guest");
  const [inviteRequiresApproval, setInviteRequiresApproval] = useState(true);
  const [newInviteLink, setNewInviteLink] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [panel, setPanel] = useState<WorkspacePanel>("backstage");
  const [panelPeek, setPanelPeek] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [brandingPreview, setBrandingPreview] = useState<RoomBranding | null>(null);
  const [productionRefreshKey, setProductionRefreshKey] = useState(0);
  const [presentationSources, setPresentationSources] = useState<PresentationSource[]>([]);
  const [browserSources, setBrowserSources] = useState<BrowserSource[]>([]);
  const [interactingBrowserSourceId, setInteractingBrowserSourceId] = useState("");
  const [layout, setLayout] = useState<StageLayout>("grid");
  const [selectedParticipant, setSelectedParticipant] = useState("host");
  const [spotlightSelectionExplicit, setSpotlightSelectionExplicit] = useState(false);
  const [roomActionsOpen, setRoomActionsOpen] = useState(false);
  const [showGoLiveInfo, setShowGoLiveInfo] = useState(false);
  const [cinematicPanelOpen, setCinematicPanelOpen] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const backstageHeadingRef = useRef<HTMLHeadingElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const roomWorkspaceRef = useRef<HTMLElement>(null);
  const sidePanelRef = useRef<HTMLElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const goLiveTriggerRef = useRef<HTMLElement | null>(null);
  const roomActionsRef = useRef<HTMLDivElement>(null);
  const roomActionsTriggerRef = useRef<HTMLButtonElement>(null);
  const dockScrollRef = useRef<HTMLDivElement>(null);
  const noticeId = useRef(0);
  const { preferences, setSidebar, setCinematic, toggleCinematic } = usePresentationPreferences();
  const media = useStudioMedia(roomId, { location: "on_stage", canScreenShare: true });
  const cinematic = preferences.cinematic === "on";
  const fullscreenSupported = typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";
  useGlobalActivity(status === "loading" || Boolean(busy) || Boolean(guestBusy), "Loading room authority");

  function setMessage(next: string, tone?: ContextualNoticeTone) {
    setMessageState(next);
    if (!next) {
      setNotices([]);
      return;
    }
    setNotices((current) => [...current.slice(-2), { id: ++noticeId.current, message: next, tone: tone ?? inferContextualNoticeTone(next) }]);
  }

  function revealPanel() {
    if (preferences.sidebar === "collapsed") setPanelPeek(true);
  }

  const refreshAuthority = useCallback(
    async (showLoading = true) => {
      if (showLoading) setStatus("loading");
      setMessage("");
      try {
        const [roomContext, nextInvites, nextGuests, nextCohosts, nextSources, nextBrowserSources] = await Promise.all([loadStudioRoomContext(roomId), listStudioInvites(roomId), listStudioLobby(roomId), loadRoomCohosts(roomId), loadPresentationSources(roomId), listStudioBrowserSources(roomId)]);
        const nextRoom = roomContext.room;
        setRoom(nextRoom);
        setPermissions(roomContext.permissions);
        setInvites(nextInvites);
        setGuests(nextGuests);
        setCohosts(nextCohosts);
        setPresentationSources(nextSources);
        setBrowserSources(nextBrowserSources);
        setTitle(nextRoom.title);
        setDescription(nextRoom.description ?? "");
        setLayout(nextRoom.presentation.layoutMode);
        if (nextRoom.presentation.spotlightGuestId) {
          setSelectedParticipant(nextRoom.presentation.spotlightGuestId);
          setSpotlightSelectionExplicit(true);
        }
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
        if (event.type.startsWith("room.chat_")) { setChatRefreshKey((value) => value + 1); return; }
        if (["room.branding_updated", "room.asset_created", "room.asset_updated", "room.asset_deleted", "room.custom_layouts_updated", "room.presentation_updated"].includes(event.type)) setProductionRefreshKey((value) => value + 1);
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

  useEffect(() => {
    if (!liveRoomId || panel === "chat") return;
    const controller = new AbortController();
    void listRoomChatMessages(liveRoomId, null, controller.signal).then((page) => setChatUnread(page.unreadCount)).catch(() => undefined);
    return () => controller.abort();
  }, [chatRefreshKey, liveRoomId, panel]);

  useEffect(() => {
    if (!room?.id || media.state !== "connected" || !media.selfRuntimeParticipantId) return;
    const ownSource = presentationSources.find((source) => source.ownerParticipantId === media.selfRuntimeParticipantId);
    if (media.screenEnabled && !ownSource) void registerPresentationSource(room.id).then((source) => setPresentationSources((current) => [...current, source])).catch((error) => setMessage(error instanceof Error ? error.message : "Screen share source could not be registered."));
    if (!media.screenEnabled && ownSource) void stopPresentationSource(room.id, ownSource.id).then(() => { setPresentationSources((current) => current.filter((source) => source.id !== ownSource.id)); if (ownSource.location === "on_stage") setMessage("Screen share stopped. Stage returned to participant cameras."); }).catch(() => undefined);
  }, [media.screenEnabled, media.selfRuntimeParticipantId, media.state, presentationSources, room?.id]);

  const waiting = useMemo(() => guests.filter((guest) => guest.state === "backstage"), [guests]);
  const admitted = useMemo(() => guests.filter((guest) => guest.state === "on_stage").sort((a, b) => (a.stagePosition ?? 999) - (b.stagePosition ?? 999)), [guests]);
  const mediaState = media.state;
  const refreshMediaMappings = media.refreshMappings;

  useEffect(() => {
    if (mediaState === "connected") void refreshMediaMappings();
  }, [guests, mediaState, refreshMediaMappings]);

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

  useEffect(() => {
    if (!roomActionsOpen) return;
    const pointer = (event: PointerEvent) => { if (!roomActionsRef.current?.contains(event.target as Node)) setRoomActionsOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setRoomActionsOpen(false);
      window.setTimeout(() => roomActionsTriggerRef.current?.focus(), 0);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key, true);
    };
  }, [roomActionsOpen]);

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
    else if (window.matchMedia("(max-width: 1020px)").matches) setMobilePanelOpen(true);
    else if (preferences.sidebar === "collapsed") setPanelPeek(true);
    if (preferences.sidebar === "hidden") setSidebar("collapsed");
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
        permission_preset: inviteRole,
        requires_approval: inviteRequiresApproval,
        ...(!invitePermanent ? { expires_at: new Date(inviteExpiry).toISOString() } : {}),
      });
      setInvites(await listStudioInvites(room.id));
      setInviteLabel("");
      const link = `${window.location.origin}/join/${encodeURIComponent(created.inviteCode)}`;
      setNewInviteLink(link);
      setMessage("Invite created. Its one-time plaintext link is available below until this page is left or another invite is created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function copyInvite(link: string) {
    if (!link) return;
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
      setNewInviteLink("");
      setInvites(await listStudioInvites(room.id));
      setMessage("Invite revoked in Runtime/Auth.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invite could not be revoked.");
    } finally {
      setBusy("");
    }
  }

  async function removeInvite(invite: RoomInvite) {
    if (!room || busy || !window.confirm(`Permanently delete ${invite.label || "this invite"}? It can never be validated or used again.`)) return;
    setBusy(`invite-delete-${invite.id}`); setMessage("");
    try {
      await deleteStudioInvite(room.id, invite.id);
      setInvites((items) => items.filter((item) => item.id !== invite.id));
      setMessage("Invite permanently deleted by Runtime/Auth.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invite could not be deleted."); }
    finally { setBusy(""); }
  }

  async function guestAction(guest: StudioGuest, action: "admit" | "deny" | "remove") {
    if (!room || guestBusy) return;
    if (action === "admit" && admitted.length >= room.maxAdditionalStageParticipants) {
      setMessage("Stage full — 9 participants including the director. Move someone Backstage before admitting another participant.");
      return;
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGuestBusy(guest.id);
    setMessage("");
    try {
      await transitionStudioGuest(room.id, guest.id, action);
      if (action === "admit") await media.syncParticipantLocation(guest.id, "on_stage");
      const [nextRoom, nextGuests] = await Promise.all([loadStudioRoomContext(room.id), listStudioLobby(room.id)]);
      setRoom(nextRoom.room);
      setPermissions(nextRoom.permissions);
      setGuests(nextGuests);
      setMessage(action === "admit" ? "Guest approved by Runtime/Auth for direct Realtime SFU access." : `Guest ${action === "deny" ? "denied" : "removed from the room"} by Runtime/Auth.`);
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else backstageHeadingRef.current?.focus();
      });
    } catch (error) {
      if (error instanceof StudioApiError && ["stage_full", "stage_capacity_reached"].includes(error.code)) {
        setMessage("Stage full — 9 participants including the director. Move someone Backstage before admitting another participant.");
      } else {
        setMessage(error instanceof Error ? error.message : "Guest state could not be changed.");
      }
    } finally {
      setGuestBusy("");
    }
  }

  async function moveParticipant(guest: StudioGuest, location: "stage" | "backstage") {
    if (!room || guestBusy) return;
    if (location === "stage" && admitted.length >= room.maxAdditionalStageParticipants) {
      setMessage("Stage full — 9 participants including the director. Move someone Backstage before admitting another participant.");
      return;
    }
    setGuestBusy(guest.id); setMessage("");
    try {
      await moveStudioParticipant(room.id, guest.id, location);
      await media.syncParticipantLocation(guest.id, location === "stage" ? "on_stage" : "backstage");
      await refreshAuthority(false);
      setMessage(`${guest.displayName} moved ${location === "stage" ? "onto Stage" : "Backstage"}. No guest session was invalidated.`);
    } catch (error) {
      setMessage(error instanceof StudioApiError && ["stage_full", "stage_capacity_reached"].includes(error.code)
        ? "Stage full — 9 participants including the director. Move someone Backstage before admitting another participant."
        : error instanceof Error ? error.message : "Participant location could not be changed.");
    }
    finally { setGuestBusy(""); }
  }

  async function mediaIntent(guest: StudioGuest, field: "microphone" | "camera") {
    if (!room || guestBusy) return;
    setGuestBusy(guest.id);
    try {
      const disabling = field === "microphone" ? !guest.microphoneMuted : !guest.cameraHidden;
      await updateStudioMediaIntent(field === "microphone" ? { roomId: room.id, guestId: guest.id, microphoneMuted: disabling } : { roomId: room.id, guestId: guest.id, cameraHidden: disabling });
      if (disabling) await media.forceDisableParticipant(guest.id, field === "microphone" ? "audio" : "video");
      await refreshAuthority(false);
      setMessage(disabling ? `${field === "microphone" ? "Microphone" : "Camera"} disabled after Runtime authorization.` : `The participant may now enable their ${field}; their hardware was not force-enabled.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Participant intended state could not be updated."); }
    finally { setGuestBusy(""); }
  }

  async function changeLayout(next: StageLayout) {
    if (!room || busy || next === layout) return;
    const previous = layout; setLayout(next); setBusy("layout");
    try { const updated = await updateStudioPresentation(room.id, { layoutMode: next }); setRoom(updated); setAnnouncement(`Stage layout changed to ${layoutLabels[next]}.`); }
    catch (error) { setLayout(previous); setMessage(error instanceof Error ? error.message : "Stage layout could not be synchronized."); }
    finally { setBusy(""); }
  }

  async function changePresentationSetting(input: Parameters<typeof updateStudioPresentation>[1]) {
    if (!room || busy) return;
    const previous = room; setBusy("presentation-settings");
    try { setRoom(await updateStudioPresentation(room.id, input)); }
    catch (error) { setRoom(previous); setMessage(error instanceof Error ? error.message : "Presentation settings could not be synchronized."); }
    finally { setBusy(""); }
  }

  async function changeSourceLocation(source: PresentationSource, location: "backstage" | "on_stage") {
    if (!room || busy) return;
    setBusy(source.id);
    try { const updated = await movePresentationSource(room.id, source.id, location); setPresentationSources((current) => current.map((item) => item.id === updated.id ? updated : location === "on_stage" && item.location === "on_stage" ? { ...item, location: "backstage" } : item)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Presentation source could not be moved."); }
    finally { setBusy(""); }
  }

  async function changeBrowserSourceLocation(source: BrowserSource, location: "backstage" | "on_stage") {
    if (!room || busy || !permissions?.manageBrowserSources) return;
    setBusy(source.id);
    try { const updated = await moveStudioBrowserSource(room.id, source.id, location); setBrowserSources((current) => current.map((item) => item.id === updated.id ? updated : item)); if (location === "backstage" && interactingBrowserSourceId === source.id) setInteractingBrowserSourceId(""); setMessage(`${source.displayName} moved ${location === "on_stage" ? "to Stage" : "Backstage"}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Browser source could not be moved."); }
    finally { setBusy(""); }
  }

  async function refreshBrowserSource(source: BrowserSource) {
    if (!room || busy || !permissions?.manageBrowserSources) return;
    setBusy(source.id);
    try { const updated = await refreshStudioBrowserSource(room.id, source.id); setBrowserSources((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`${source.displayName} refreshed without reconnecting room media.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Browser source could not be refreshed."); }
    finally { setBusy(""); }
  }

  async function disableBrowserSource(source: BrowserSource) {
    if (!room || busy || !permissions?.manageBrowserSources) return;
    setBusy(source.id);
    try { const updated = await moveStudioBrowserSource(room.id, source.id, "disabled"); setBrowserSources((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`${source.displayName} disabled and deactivated.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Browser source could not be disabled."); }
    finally { setBusy(""); }
  }

  async function removeBrowserSource(source: BrowserSource) {
    if (!room || busy || !permissions?.manageBrowserSources || !window.confirm(`Delete ${source.displayName}? This removes it from Stage and Backstage.`)) return;
    setBusy(source.id);
    try { await deleteStudioBrowserSource(room.id, source.id); setBrowserSources((current) => current.filter((item) => item.id !== source.id)); setMessage(`${source.displayName} deleted.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Browser source could not be deleted."); }
    finally { setBusy(""); }
  }

  async function createCustomLayout() {
    if (!room || busy || room.presentation.customLayouts.length >= 8) return;
    setBusy("custom-layout");
    try { const created = await createStudioCustomLayout(room.id, effectiveLayout); const updated = await updateStudioPresentation(room.id, { layoutMode: "custom", selectedCustomLayoutId: created.id }); setRoom(updated); setLayout("custom"); setAnnouncement(`${created.displayName} saved and applied.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Custom layout could not be created."); await refreshAuthority(false); }
    finally { setBusy(""); }
  }

  async function selectCustomLayout(layoutId: string) {
    if (!room || busy) return;
    const previous = layout; setLayout("custom"); setBusy("custom-layout");
    try { const updated = await updateStudioPresentation(room.id, { layoutMode: "custom", selectedCustomLayoutId: layoutId }); setRoom(updated); setAnnouncement("Custom layout applied."); }
    catch (error) { setLayout(previous); setMessage(error instanceof Error ? error.message : "Custom layout could not be applied."); }
    finally { setBusy(""); }
  }

  async function renameCustomLayout(layoutId: string, name: string) {
    if (!room || busy) return; setBusy(layoutId);
    try { await updateStudioCustomLayout(room.id, layoutId, name); await refreshAuthority(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Custom layout could not be renamed."); await refreshAuthority(false); }
    finally { setBusy(""); }
  }

  async function moveCustomLayout(layoutId: string, direction: -1 | 1) {
    if (!room || busy) return; const ids = room.presentation.customLayouts.map((item) => item.id), from = ids.indexOf(layoutId), to = from + direction; if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]]; setBusy(layoutId);
    try { await reorderStudioCustomLayouts(room.id, ids); await refreshAuthority(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Custom layout order could not be saved."); await refreshAuthority(false); }
    finally { setBusy(""); }
  }

  async function removeCustomLayout(layoutId: string) {
    if (!room || busy) return; const target = room.presentation.customLayouts.find((item) => item.id === layoutId); if (!target || !window.confirm(`Delete ${target.displayName}?`)) return; setBusy(layoutId);
    try { const result = await deleteStudioCustomLayout(room.id, layoutId); await refreshAuthority(false); if (result.presentationFellBackToGrid) { setLayout("grid"); setAnnouncement("Selected custom layout deleted. Stage returned to Grid."); } }
    catch (error) { setMessage(error instanceof Error ? error.message : "Custom layout could not be deleted."); await refreshAuthority(false); }
    finally { setBusy(""); }
  }

  function manageCustomLayouts() {
    openWorkspacePanel("room"); window.setTimeout(() => document.getElementById("custom-layout-manager")?.scrollIntoView({ block: "start" }), 0);
  }

  function selectStageParticipant(participantId: string) {
    setSelectedParticipant(participantId);
    if (layout !== "auto" && layout !== "spotlight") return;
    setSpotlightSelectionExplicit(true);
    if (!room || !permissions?.updatePresentation) return;
    void updateStudioPresentation(room.id, { spotlightGuestId: participantId === "host" ? null : participantId })
      .then(setRoom)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Spotlight selection could not be synchronized."));
  }

  function scrollDock(direction: -1 | 1) {
    dockScrollRef.current?.scrollBy({ left: direction * Math.max(260, dockScrollRef.current.clientWidth * 0.7), behavior: "smooth" });
  }

  async function moveStageOrder(guestId: string, direction: -1 | 1) {
    if (!room || guestBusy) return;
    const ids = admitted.map((guest) => guest.id);
    const from = ids.indexOf(guestId), to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const previous = guests; const order = new Map(ids.map((id, index) => [id, index]));
    setGuests((items) => items.map((item) => order.has(item.id) ? { ...item, stagePosition: order.get(item.id)! } : item));
    setGuestBusy("stage-order");
    try { await reorderStudioStage(room.id, ids); await refreshAuthority(false); setAnnouncement(`${admitted[from].displayName} moved ${direction < 0 ? "earlier" : "later"} on Stage.`); }
    catch (error) { setGuests(previous); setMessage(error instanceof Error ? error.message : "Stage order could not be saved."); }
    finally { setGuestBusy(""); }
  }

  async function dropStageOrder(targetId: string) {
    if (!room || !draggedGuestId || draggedGuestId === targetId || guestBusy) { setDraggedGuestId(""); return; }
    const ids = admitted.map((guest) => guest.id), from = ids.indexOf(draggedGuestId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDraggedGuestId(""); return; }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const previous = guests, order = new Map(ids.map((id, index) => [id, index]));
    setGuests((items) => items.map((item) => order.has(item.id) ? { ...item, stagePosition: order.get(item.id)! } : item));
    setGuestBusy("stage-order"); setDraggedGuestId("");
    try { await reorderStudioStage(room.id, ids); await refreshAuthority(false); setAnnouncement("Stage order updated."); }
    catch (error) { setGuests(previous); setMessage(error instanceof Error ? error.message : "Stage order could not be saved."); }
    finally { setGuestBusy(""); }
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

  async function changeCohostScope(id: string, scope: "all_rooms" | "selected_rooms") {
    if (!room || guestBusy) return;
    setGuestBusy(id);
    try { await updateCohostScope(id, scope, scope === "selected_rooms" ? [room.id] : []); await refreshAuthority(false); setMessage("Permanent cohost scope updated by Runtime/Auth."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Cohost scope could not be updated."); }
    finally { setGuestBusy(""); }
  }

  async function revokePermanentCohost(id: string) {
    if (!window.confirm("Revoke this permanent cohost relationship?")) return;
    setGuestBusy(id);
    try { await revokeCohostRelationship(id); await refreshAuthority(false); setMessage("Permanent cohost relationship revoked."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Cohost relationship could not be revoked."); }
    finally { setGuestBusy(""); }
  }

  if (status === "loading") {
    return (
      <StudioShell roomWorkspace>
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
      <StudioShell roomWorkspace>
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
  const onStageSource = presentationSources.find((source) => source.location === "on_stage");
  const backstageSources = presentationSources.filter((source) => source.location === "backstage");
  const backstageBrowserSources = browserSources.filter((source) => source.location === "backstage");
  const onStageBrowserSources = browserSources.filter((source) => source.location === "on_stage" && source.url);
  const presentationShare = onStageSource ? media.activeShares.find((share) => share.runtimeParticipantId === onStageSource.ownerParticipantId) : undefined;
  const stageParticipantCount = room.reservedDirectorStageSlots + admitted.length;
  const selectedParticipantOnStage = selectedParticipant === "host" || admitted.some((guest) => guest.id === selectedParticipant);
  const selectedCustomLayout = room.presentation.customLayouts.find((item) => item.id === room.presentation.selectedCustomLayoutId);
  const effectiveLayout = resolveEffectiveStageLayout({ requested: layout, customBaseMode: selectedCustomLayout?.baseLayoutMode, activeScreenShare: Boolean(onStageSource), explicitSpotlight: spotlightSelectionExplicit && selectedParticipantOnStage, participantCount: stageParticipantCount });
  const activeBranding = brandingPreview ?? room.branding;
  const interviewPrimaryIds = new Set(["host", admitted[0]?.id].filter(Boolean));
  const spotlightPrimaryId = selectedParticipantOnStage ? selectedParticipant : "host";
  const stageTileClass = (participantId: string) => effectiveLayout === "grid"
    ? ""
    : effectiveLayout === "interview"
      ? interviewPrimaryIds.has(participantId) ? " is-primary" : " is-filmstrip"
      : effectiveLayout === "spotlight"
        ? participantId === spotlightPrimaryId ? " is-primary" : " is-filmstrip"
        : " is-filmstrip";
  const participantMenuItems = (guest: StudioGuest): ParticipantMenuItem[] => [
    { label: "Move Backstage", icon: moveDownIcon, filledIcon: moveDownFilledIcon, onSelect: () => void moveParticipant(guest, "backstage") },
    { label: guest.microphoneMuted ? "Unmute intent" : "Mute intent", onSelect: () => void mediaIntent(guest, "microphone") },
    { label: guest.cameraHidden ? "Show camera intent" : "Hide camera intent", onSelect: () => void mediaIntent(guest, "camera") },
    { label: "Move earlier", disabled: admitted[0]?.id === guest.id, onSelect: () => void moveStageOrder(guest.id, -1) },
    { label: "Move later", disabled: admitted.at(-1)?.id === guest.id, onSelect: () => void moveStageOrder(guest.id, 1) },
    { label: guest.sessionCohost ? "Revoke session cohost" : "Session / this room only", destructive: guest.sessionCohost, separatorBefore: true, icon: guest.sessionCohost ? revokeIcon : undefined, onSelect: () => void sessionCohost(guest, !guest.sessionCohost) },
    ...(permissions?.managePermanentCohosts ? [{ label: "Invite permanent cohost", disabled: guest.pendingPermanentCohost, onSelect: () => void permanentCohost(guest) }] : []),
    { label: "Remove from room", destructive: true, separatorBefore: true, icon: removePersonIcon, onSelect: () => { if (window.confirm(`Remove ${guest.displayName} from the room?`)) void guestAction(guest, "remove"); } },
  ];
  const gridParticipants = [{ id: "host", guest: null as StudioGuest | null }, ...admitted.map((guest) => ({ id: guest.id, guest }))].slice(0, 9);
  const sourceShare = (source: PresentationSource) => media.activeShares.find((share) => share.runtimeParticipantId === source.ownerParticipantId);
  let gridOffset = 0;
  const gridRows = stageGridRows(gridParticipants.length).map((size) => { const row = gridParticipants.slice(gridOffset, gridOffset + size); gridOffset += size; return row; });
  const renderGridParticipant = ({ guest }: (typeof gridParticipants)[number]) => guest ? <MediaParticipantTile className={`participant-tile${selectedParticipant === guest.id ? " is-selected" : ""}${stageTileClass(guest.id)}`} guest={guest} media={media} labelMode={room.presentation.participantLabelMode} branding={activeBranding} key={guest.id} draggable={permissions?.reorderStage} onDragStart={() => setDraggedGuestId(guest.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => void dropStageOrder(guest.id)} onClick={() => selectStageParticipant(guest.id)}>{permissions?.manageParticipants && <ParticipantMenuPortal participantName={guest.displayName} items={participantMenuItems(guest)} />}</MediaParticipantTile> : <button type="button" key="host" className={`participant-tile participant-tile--host${selectedParticipant === "host" ? " is-selected" : ""}${stageTileClass("host")}`} onClick={() => selectStageParticipant("host")} aria-pressed={selectedParticipant === "host"} data-participant-id="host">{media.videoEnabled && media.meeting?.self.videoTrack?.readyState === "live" ? <LocalMediaVideo media={media} /> : <ParticipantFallback guest={{ displayName: hostName, avatarColor: "green", avatarUrl: access.account?.avatarUrl ?? null }} status={media.state === "connected" ? `${media.audioEnabled ? "Microphone on" : "Microphone muted"} · Camera off` : media.reason} />}<ParticipantLabelOverlay name={hostName} subtitle="Host / Director" mode={room.presentation.participantLabelMode} branding={activeBranding} /></button>;

  return (
    <StudioShell roomWorkspace fullscreenSupported={fullscreenSupported} fullscreenActive={fullscreenActive} onToggleFullscreen={() => void toggleFullscreen()} chatUnreadCount={chatUnread} chatOpen={panel === "chat" && preferences.sidebar !== "hidden"} onOpenChat={() => openWorkspacePanel("chat")}>
      <section ref={roomWorkspaceRef} className={`room-workspace is-panel-${preferences.sidebar}${panelPeek ? " is-panel-peeking" : ""}`} aria-label={`${room.title} Studio workspace`}>
        <div className="room-viewport">
        {cinematic && <div className="cinematic-room-actions" aria-label="Cinematic workspace controls">
          <button type="button" onClick={toggleCinematic}>Exit cinematic <kbd>F</kbd></button>
          {fullscreenSupported && <button type="button" onClick={() => void toggleFullscreen()}>{fullscreenActive ? "Exit fullscreen" : "Fullscreen"}</button>}
        </div>}
        <header className="room-status-strip">
          <div className="room-status-strip__identity">
            <ButtonLink to="/studio" variant="quiet" className="room-exit-button icon-control">
              <StudioIcon regular={exitIcon} filled={exitFilledIcon} />
              <span>Rooms</span>
            </ButtonLink>
            <div className="room-status-strip__copy">
              <div className="room-details-heading">
                <p className="eyebrow">ROOM DETAILS</p>
                <code className="room-id-chip" title="Room ID">{room.id}</code>
              </div>
              <h1>{room.title}</h1>
              <p>{room.description || "No room description."}</p>
            </div>
          </div>
          <div className="room-status-strip__facts">
            <StatusChip tone={room.lifecycleState === "open" ? "alpha" : room.lifecycleState === "ended" ? "blocked" : "neutral"}>{room.lifecycleState}</StatusChip>
            <span><strong>{stageParticipantCount} / {room.totalStageCapacity}</strong> on Stage</span>
            <span><strong>{room.waitingGuestCount}</strong> waiting</span>
            <span>Authority: {connection}</span>
          </div>
          <div className="room-actions" ref={roomActionsRef}>
            <button ref={roomActionsTriggerRef} className="room-actions__trigger icon-control" type="button" aria-label="Room actions" aria-haspopup="menu" aria-expanded={roomActionsOpen} aria-controls="room-actions-menu" onClick={() => setRoomActionsOpen((open) => !open)}>
              <StudioIcon regular={optionsIcon} /><span>Room Actions</span>
            </button>
            {roomActionsOpen && <div id="room-actions-menu" className="room-actions__menu" role="menu">
              {["draft", "closed"].includes(room.lifecycleState) && <button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => { setRoomActionsOpen(false); void lifecycle("open"); }}>{busy === "lifecycle-open" ? "Opening…" : "Open room entry"}</button>}
              {room.lifecycleState === "open" && <button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => { setRoomActionsOpen(false); void lifecycle("close"); }}>{busy === "lifecycle-close" ? "Closing…" : "Close room entry"}</button>}
              <button role="menuitem" type="button" disabled={Boolean(busy) || Boolean(guestBusy)} onClick={() => { setRoomActionsOpen(false); void refreshAuthority(false); }}><StudioIcon regular={refreshIcon} /> Refresh authority</button>
              {room.lifecycleState !== "ended" && permissions?.endRoom && <button className="is-destructive" role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => { setRoomActionsOpen(false); void lifecycle("end"); }}>End room</button>}
            </div>}
          </div>
          <div className="broadcast-state" aria-label="Broadcast state">
            <div><strong>OFF AIR</strong><time>00:00:00</time></div>
            <Button disabled title="Output integration not connected" onClick={openGoLiveInfo}>Go live</Button>
          </div>
        </header>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <div className={`production-workspace is-panel-${preferences.sidebar}${panelPeek ? " is-panel-peeking" : ""}${mobilePanelOpen ? " is-mobile-panel-open" : ""}`}>
          <ContextualNoticeStack notices={notices} duration={preferences.noticeDuration} onDismiss={(id) => setNotices((current) => current.filter((notice) => notice.id !== id))} />
          <main className="program-panel">
            <div className="program-panel__toolbar">
              <div>
                <p className="eyebrow">STAGE OUTPUT</p>
                <strong className="sr-only">Stage output</strong>
                <span>Preview only · {layout === "auto" ? `Auto → ${layoutLabels[effectiveLayout]}` : layout === "custom" ? `${selectedCustomLayout?.displayName ?? "Custom"} → ${layoutLabels[effectiveLayout]}` : layoutLabels[effectiveLayout]} · {media.state === "connected" ? "Media connected" : media.reason}</span>
              </div>
              <div className="layout-picker" ref={layoutRef} role="group" aria-label="Stage layout">
                {(["grid", "interview", "spotlight", "presentation", "auto"] as StageLayout[]).map((option) => (
                  <button key={option} type="button" disabled={busy === "layout" || !permissions?.updatePresentation} className={`icon-control studio-tooltip${layout === option ? " is-selected" : ""}`} data-tooltip={layoutLabels[option]} aria-label={`${layoutLabels[option]} layout`} aria-pressed={layout === option} onClick={() => void changeLayout(option)}>
                    <StudioIcon regular={layoutIcons[option][0]} filled={layoutIcons[option][1]} active={layout === option} />
                  </button>
                ))}
                <CustomLayoutMenu layouts={room.presentation.customLayouts} selectedId={layout === "custom" ? room.presentation.selectedCustomLayoutId : null} disabled={!permissions?.updatePresentation} busy={busy === "custom-layout"} onCreate={() => void createCustomLayout()} onSelect={(id) => void selectCustomLayout(id)} onManage={manageCustomLayouts} />
              </div>
            </div>
            <div className="program-stage-viewport" data-testid="program-stage-viewport">
              <div className={`program-canvas program-canvas--${effectiveLayout}${onStageSource ? ` has-presentation presentation-${room.presentation.participantMode} edge-${room.presentation.participantEdge}` : ""}`} style={stageBrandingStyle(activeBranding)} data-testid="program-canvas" data-layout={layout} data-effective-layout={effectiveLayout} data-participant-count={stageParticipantCount} data-slot-sizing={room.presentation.guestSlotSizing}>
              {effectiveLayout === "presentation" && (presentationShare ? <div className="presentation-source" key={onStageSource?.id}><ScreenShareVideo track={presentationShare.track} />{onStageSource && permissions?.updatePresentation && <Button className="presentation-source__backstage" onClick={() => void changeSourceLocation(onStageSource, "backstage")}>Move Backstage</Button>}</div> : <div className="presentation-source-placeholder">{onStageSource ? "Presentation track not connected" : "Presentation source not connected"}</div>)}
              <div className="browser-source-layer">{onStageBrowserSources.map((source) => <BrowserSourceRenderer key={source.id} source={source} mode="stage" interactionActive={interactingBrowserSourceId === source.id} onExitInteraction={() => setInteractingBrowserSourceId("")} />)}</div>
              <div className="browser-source-stage-toolbar">{permissions?.manageBrowserSources ? onStageBrowserSources.map((source) => <div key={`controls:${source.id}`}><span>{source.displayName}</span><Button variant="quiet" onClick={() => void changeBrowserSourceLocation(source, "backstage")}>Move Backstage</Button><Button variant="quiet" onClick={() => void refreshBrowserSource(source)}>Refresh</Button>{source.interactive && <Button variant="quiet" aria-pressed={interactingBrowserSourceId === source.id} onClick={() => setInteractingBrowserSourceId(interactingBrowserSourceId === source.id ? "" : source.id)}>{interactingBrowserSourceId === source.id ? "Exit interaction" : "Interact"}</Button>}</div>) : null}</div>
              {activeBranding.safeAreaVisible && <div className="program-safe-area" aria-hidden="true">
                <span>Safe area</span>
              </div>}
              <StageBrandingOverlay branding={activeBranding} />
              <div className="program-stage-grid">
                {gridRows.map((row) => <div className="program-stage-row" key={row.map((item) => item.id).join(":")} style={{ "--stage-row-size": row.length } as React.CSSProperties}>{row.map(renderGridParticipant)}</div>)}
              </div>
              <div className="program-canvas__notice">
                <strong>{media.state === "connected" ? "Media connected · OFF AIR" : "Media not connected"}</strong>
                <span>{media.state === "connected" ? "Cloudflare Realtime SFU transports room media only; no broadcast output is active." : "No camera, microphone, screen share, track, or broadcast output is active."}</span>
              </div>
              </div>
            </div>
          </main>

          {cinematic && cinematicPanelOpen && <button className="cinematic-panel-scrim" type="button" aria-label="Close room tools" onClick={() => { setCinematicPanelOpen(false); window.setTimeout(() => panelTriggerRef.current?.focus(), 0); }} />}
          {!cinematic && mobilePanelOpen && <button className="workspace-panel-scrim" type="button" aria-label="Close room tools" onClick={() => { setMobilePanelOpen(false); window.setTimeout(() => panelTriggerRef.current?.focus(), 0); }} />}
          <StudioEdgeSidebarPortal>
            <StudioEdgeSidebar
              ref={sidePanelRef}
              edge="right"
              ariaLabel="Room production sidebar"
              navigationLabel="Room production panels"
              mode={preferences.sidebar}
              items={(["backstage", "invites", "room", "brand", "media", "chat"] as WorkspacePanel[]).map((item) => ({ id: item, label: panelLabels[item], icon: panelIcons[item][0], filledIcon: panelIcons[item][1], ...((item === "backstage" || item === "invites" || item === "chat") ? { count: item === "backstage" ? waiting.length : item === "invites" ? invites.filter((invite) => invite.active).length : chatUnread } : {}) }))}
              selectedSection={panel}
              panelHeading={panelLabels[panel]}
              temporaryExpanded={panelPeek}
              onTemporaryExpandedChange={setPanelPeek}
              onSelectedSectionChange={(section) => setPanel(section as WorkspacePanel)}
              onModeChange={setSidebar}
              className={`${mobilePanelOpen ? "is-mobile-open" : ""}${cinematicPanelOpen ? " is-cinematic-open" : ""}`}
              toggleHidden={cinematic}
              dialogOpen={cinematic && cinematicPanelOpen}
              panelHeadingControl={cinematic && <button className="cinematic-panel-close" type="button" onClick={() => { setCinematicPanelOpen(false); window.setTimeout(() => panelTriggerRef.current?.focus(), 0); }}>Close room tools</button>}
              panelBody={<>
            {panel === "backstage" && (
              <div className="backstage-panel">
                <section aria-labelledby="waiting-backstage-heading">
                  <div className="side-panel-heading">
                    <div>
                      <p className="eyebrow">WAITING BACKSTAGE</p>
                      <h2 id="waiting-backstage-heading" ref={backstageHeadingRef} tabIndex={-1} className="sr-only">Waiting Backstage</h2>
                    </div>
                    <StatusChip tone={waiting.length ? "pending" : "neutral"}>{waiting.length}</StatusChip>
                  </div>
                  {waiting.length === 0 && backstageSources.length === 0 && backstageBrowserSources.length === 0 ? (
                    <EmptyState title="Backstage is clear">
                      <p>Guests using a valid invite will appear here immediately.</p>
                    </EmptyState>
                  ) : (
                    <div className="guest-card-list">
                      {waiting.map((guest) => (
                        <article className="guest-card guest-card--arrival" key={guest.id}>
                          <BackstageMediaPreview guest={guest} media={media} />
                          <div className="guest-card__identity">
                            <strong>{guest.displayName}</strong>
                            {guest.subtitle && <small>{guest.subtitle}</small>}
                            <span>
                              Waiting since {date(guest.createdAt)} · {guest.signedIn ? "Signed in" : "Guest"}
                            </span>
                            {guest.sessionCohost && <StatusChip tone="alpha">Session cohost</StatusChip>}
                          </div>
                          <div className="guest-card__actions">
                            <Button className="icon-control" disabled={Boolean(guestBusy) || admitted.length >= room.maxAdditionalStageParticipants} onClick={() => void moveParticipant(guest, "stage")}>
                              <StudioIcon regular={moveUpIcon} filled={moveUpFilledIcon} /> {guestBusy === guest.id ? "Working…" : "Move to Stage"}
                            </Button>
                            <Button className="button--destructive" variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void guestAction(guest, "deny")}>
                              Deny
                            </Button>
                            {permissions?.endRoom && (
                              <Button className={guest.sessionCohost ? "button--destructive" : ""} variant="secondary" disabled={Boolean(guestBusy)} onClick={() => void sessionCohost(guest, !guest.sessionCohost)}>
                                {guest.sessionCohost && <StudioIcon regular={revokeIcon} />} {guest.sessionCohost ? "Revoke cohost" : "Session cohost"}
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
                  {backstageSources.map((source) => <article className="guest-card presentation-source-card" key={source.id}>
                    <div className="presentation-source-preview">{sourceShare(source) ? <ScreenShareVideo track={sourceShare(source)!.track} label={source.displayName} /> : <StudioIcon regular={shareIcon} />}</div>
                    <div className="guest-card__identity"><strong>{source.displayName}</strong><small>Screen share</small><StatusChip tone="pending">Backstage</StatusChip></div>
                    <div className="guest-card__actions">{permissions?.updatePresentation && <Button disabled={Boolean(busy)} onClick={() => void changeSourceLocation(source, "on_stage")}>Move to Stage</Button>}{source.ownerParticipantId === media.selfRuntimeParticipantId && <Button variant="quiet" onClick={() => void media.toggleScreen()}>Stop sharing</Button>}</div>
                  </article>)}
                  {backstageBrowserSources.map((source, index) => <article className="guest-card browser-source-card" key={source.id}>
                    <div className="browser-source-preview">{index < 2 && preferences.sidebar !== "hidden" && (preferences.sidebar === "expanded" || panelPeek || mobilePanelOpen || cinematicPanelOpen) ? <BrowserSourceRenderer source={source} mode="preview" /> : <StudioIcon regular={mediaIcon} filled={mediaFilledIcon} />}</div>
                    <div className="guest-card__identity"><strong>{source.displayName}</strong><small>Browser source · {source.safeHost ?? "Restricted URL"}</small><StatusChip tone="pending">Backstage · {source.visibilityScope === "room" ? "Room" : "Production only"}</StatusChip></div>
                    <div className="guest-card__actions">{permissions?.manageBrowserSources && <><Button disabled={Boolean(busy)} onClick={() => void changeBrowserSourceLocation(source, "on_stage")}>Move to Stage</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => { setPanel("media"); revealPanel(); }}>Edit</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void disableBrowserSource(source)}>Disable</Button><Button className="button--destructive" variant="quiet" disabled={Boolean(busy)} onClick={() => void removeBrowserSource(source)}>Delete</Button></>}</div>
                  </article>)}
                  {admitted.length >= room.maxAdditionalStageParticipants && waiting.length > 0 && (
                    <p className="stage-full-note" role="note">
                      Stage full — 9 participants including the director. Move someone Backstage to free one additional slot.
                    </p>
                  )}
                </section>
                <section aria-labelledby="on-stage-heading">
                  <div className="side-panel-heading">
                    <div>
                      <p className="eyebrow">ON STAGE</p>
                      <h2 id="on-stage-heading" className="sr-only">On Stage</h2>
                    </div>
                    <StatusChip tone="alpha">
                      {admitted.length} / {room.maxAdditionalStageParticipants} additional · {room.totalStageCapacity} total
                    </StatusChip>
                  </div>
                  {admitted.length === 0 ? (
                    <EmptyState title="No guests on stage">
                      <p>8 additional Stage slots are available; the director reserves 1 of 9 total slots.</p>
                    </EmptyState>
                  ) : (
                    <div className="guest-card-list">
                      {admitted.map((guest) => (
                        <article className="guest-card" key={guest.id}>
                          <GuestAvatar guest={guest} />
                          <div className="guest-card__identity">
                            <strong>{guest.displayName}</strong>
                            {guest.subtitle && <small>{guest.subtitle}</small>}
                            <span>On stage · admitted {date(guest.admittedAt)}</span>
                            {guest.sessionCohost && <StatusChip tone="alpha">Session cohost</StatusChip>}
                          </div>
                          <div className="guest-card__actions">
                            <Button className="icon-control" variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void moveParticipant(guest, "backstage")}>
                              <StudioIcon regular={moveDownIcon} filled={moveDownFilledIcon} /> {guestBusy === guest.id ? "Moving…" : "Move Backstage"}
                            </Button>
                            <Button className="button--destructive" variant="quiet" disabled={Boolean(guestBusy)} onClick={() => { if (window.confirm(`Remove ${guest.displayName} from the room?`)) void guestAction(guest, "remove"); }}><StudioIcon regular={removePersonIcon} /> Remove from room</Button>
                            {permissions?.endRoom && (
                              <Button className={guest.sessionCohost ? "button--destructive" : ""} variant="secondary" disabled={Boolean(guestBusy)} onClick={() => void sessionCohost(guest, !guest.sessionCohost)}>
                                {guest.sessionCohost && <StudioIcon regular={revokeIcon} />} {guest.sessionCohost ? "Revoke cohost" : "Session cohost"}
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
                      <p className="eyebrow">CO-HOSTS</p>
                      <h2 id="cohosts-heading" className="sr-only">Co-hosts</h2>
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
                        {permissions?.endRoom && <Button className="button--destructive" variant="quiet" onClick={() => void sessionCohost(guest, false)}><StudioIcon regular={revokeIcon} /> Revoke session access</Button>}
                      </article>
                    ))}
                    {cohosts?.permanent.map((relationship) => (
                      <article key={relationship.id}>
                        <strong>{relationship.cohost?.displayName ?? "Cohost"}</strong>
                        <span>
                          {relationship.status} · {relationship.scopeType === "all_rooms" ? "All rooms" : `${relationship.roomIds.length} selected room${relationship.roomIds.length === 1 ? "" : "s"}`}
                        </span>
                        {permissions?.managePermanentCohosts && relationship.status === "accepted" && <div className="cohost-scope-actions"><Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void changeCohostScope(relationship.id, relationship.scopeType === "all_rooms" ? "selected_rooms" : "all_rooms")}>{relationship.scopeType === "all_rooms" ? "Limit to this room" : "All current/future rooms"}</Button><Button className="button--destructive" variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void revokePermanentCohost(relationship.id)}><StudioIcon regular={revokeIcon} /> Revoke permanent relationship</Button></div>}
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
                    <label className="field"><span className="field__label">Room role</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "producer" | "guest" | "viewer")}><option value="guest">Guest</option><option value="viewer">Viewer</option><option value="producer">Producer</option></select></label>
                    <label className="check-row"><input type="checkbox" checked={inviteRequiresApproval} onChange={(event) => setInviteRequiresApproval(event.target.checked)} /><span>Require host approval before room/media access</span></label>
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
                {newInviteLink && <div className="safe-room-summary" role="status"><strong>New invitation link</strong><code className="room-id-chip invite-code-chip" aria-label="Invite code">{newInviteLink}</code><Button variant="secondary" onClick={() => void copyInvite(newInviteLink)}>Copy link</Button><p className="fine-print">Runtime/Auth stores only its hash. This plaintext link will not appear in the invitation list again.</p></div>}
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
                            {invite.exhausted ? "Exhausted" : invite.expired ? "Expired" : invite.active ? "Active" : "Revoked"} · {invite.policyType.replace("_", " ")} · {invite.successfulUseCount}
                            {invite.maxUses === null ? " uses" : ` / ${invite.maxUses} uses`} · {invite.permanent ? "No expiry" : `Expires ${date(invite.expiresAt)}`}
                          </p>
                        </div>
                        <div className="guest-card__actions">
                          <Button className="button--destructive" variant="quiet" disabled={Boolean(busy)} onClick={() => void removeInvite(invite)}>{busy === `invite-delete-${invite.id}` ? "Deleting…" : "Delete"}</Button>
                          {invite.active && room.lifecycleState !== "ended" && (
                            <Button className="button--destructive" variant="quiet" disabled={Boolean(busy)} onClick={() => void revoke(invite)}>
                              <StudioIcon regular={revokeIcon} /> {busy === `invite-${invite.id}` ? "Revoking…" : "Revoke"}
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
                <fieldset className="participant-label-settings" disabled={!permissions?.updatePresentation}><legend>Participant labels on Stage output</legend>
                  {([['name_and_subtitle', 'Show names and subtitles'], ['name_only', 'Show names only'], ['hidden', 'Hide participant labels']] as const).map(([value, label]) => <label key={value} className="check-row"><input type="radio" name="participant-label-mode" value={value} checked={room.presentation.participantLabelMode === value} onChange={() => { const previous = room; setRoom({ ...room, presentation: { ...room.presentation, participantLabelMode: value } }); void updateStudioPresentation(room.id, { participantLabelMode: value }).then(setRoom).catch((error) => { setRoom(previous); setMessage(error instanceof Error ? error.message : "Participant label setting could not be changed."); }); }} /><span>{label}</span></label>)}
                </fieldset>
                <fieldset className="participant-label-settings" disabled={!permissions?.updatePresentation || Boolean(busy)}><legend>Guest slot sizing</legend>
                  {([['fill', 'Fill guest media slots', 'Fill each allocated grid region.'], ['fit', 'Fit guest media slots', 'Keep every guest slot exactly 16:9.']] as const).map(([value, label, helper]) => <label key={value} className="check-row"><input type="radio" name="guest-slot-sizing" checked={room.presentation.guestSlotSizing === value} onChange={() => void changePresentationSetting({ guestSlotSizing: value })} /><span><strong>{label}</strong><small>{helper}</small></span></label>)}
                </fieldset>
                <fieldset className="participant-label-settings" disabled={!permissions?.updatePresentation || Boolean(busy)}><legend>Presentation participant layout</legend>
                  {([['overlay', 'Overlay presentation'], ['outside', 'Outside presentation']] as const).map(([value, label]) => <label key={value} className="check-row"><input type="radio" name="presentation-participant-mode" checked={room.presentation.participantMode === value} onChange={() => void changePresentationSetting({ participantMode: value })} /><span>{label}</span></label>)}
                </fieldset>
                <fieldset className="participant-label-settings" disabled={!permissions?.updatePresentation || Boolean(busy)}><legend>Participant edge</legend>
                  {(['top', 'bottom', 'left', 'right'] as const).map((value) => <label key={value} className="check-row"><input type="radio" name="presentation-participant-edge" checked={room.presentation.participantEdge === value} onChange={() => void changePresentationSetting({ participantEdge: value })} /><span>{value[0].toUpperCase() + value.slice(1)}</span></label>)}
                </fieldset>
                <p className="fine-print">This controls only broadcast-output badges. Backstage and management identity remains visible.</p>
                <CustomLayoutsSection layouts={room.presentation.customLayouts} selectedId={layout === "custom" ? room.presentation.selectedCustomLayoutId : null} disabled={!permissions?.manageCustomLayouts} busyId={busy} onCreate={() => void createCustomLayout()} onSelect={(id) => void selectCustomLayout(id)} onRename={(id, name) => void renameCustomLayout(id, name)} onMove={(id, direction) => void moveCustomLayout(id, direction)} onDelete={(id) => void removeCustomLayout(id)} />
                <p className="fine-print">Updated {date(room.updatedAt)}. Room, lifecycle, invite, cohost, and lobby truth remains in Runtime/Auth.</p>
              </div>
            )}
            {panel === "brand" && <RoomBrandingPanel roomId={room.id} canonical={room.branding} canEdit={Boolean(permissions?.updateBranding)} refreshKey={productionRefreshKey} onPreview={setBrandingPreview} onCanonical={(branding) => { setBrandingPreview(branding); setRoom((current) => current ? { ...current, branding } : current); }} />}
            {panel === "media" && <RoomMediaPanel roomId={room.id} branding={activeBranding} browserSources={browserSources} canEdit={Boolean(permissions?.manageAssets && permissions?.manageBrowserSources)} refreshKey={productionRefreshKey} onBranding={(branding) => { setBrandingPreview(branding); setRoom((current) => current ? { ...current, branding } : current); }} onChanged={() => refreshAuthority(false)} onNotice={setMessage} />}
            {panel === "chat" && <RoomChatPanel roomId={room.id} visible={(preferences.sidebar === "expanded" || panelPeek || mobilePanelOpen || cinematicPanelOpen) && panel === "chat"} refreshKey={chatRefreshKey} canModerate={Boolean(permissions?.manageParticipants)} onUnreadChange={setChatUnread} />}
              </>}
            />
          </StudioEdgeSidebarPortal>
        </div>

        <div className="control-dock" aria-label="Production control dock">
          <button className="control-dock__nav control-dock__nav--previous icon-control studio-tooltip" data-tooltip="Previous controls" type="button" aria-label="Previous production controls" onClick={() => scrollDock(-1)}><StudioIcon regular={previousIcon} /></button>
          <div ref={dockScrollRef} className="control-dock__scroll" role="group" aria-label="Scrollable production controls" tabIndex={0} onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY; }}>
            <ControlButton icon={microphoneIcon} filledIcon={microphoneFilledIcon} label="Microphone" helper={media.state === "connected" ? (media.audioEnabled ? "Mute microphone" : "Enable microphone") : media.reason} disabled={media.state !== "connected" || Boolean(media.pending)} active={media.audioEnabled} onClick={() => void media.toggleAudio()} />
            <ControlButton icon={cameraIcon} filledIcon={cameraFilledIcon} label="Camera" helper={media.state === "connected" ? (media.videoEnabled ? "Turn camera off" : "Enable camera") : media.reason} disabled={media.state !== "connected" || Boolean(media.pending)} active={media.videoEnabled} onClick={() => void media.toggleVideo()} />
            <ControlButton icon={shareIcon} label="Screen share" helper={media.state === "connected" ? (media.screenEnabled ? "Stop sharing" : "Share a screen") : media.reason} disabled={media.state !== "connected" || Boolean(media.pending)} active={media.screenEnabled} onClick={() => void media.toggleScreen()} />
            <ControlButton icon={mediaIcon} filledIcon={mediaFilledIcon} label={media.state === "connected" ? "Disconnect media" : "Connect media"} helper={media.reason} disabled={["provisioning", "connecting"].includes(media.state)} active={media.state === "connected"} onClick={() => void (media.state === "connected" ? media.leave() : media.openPreflight())} />
            {media.audioBlocked && <ControlButton icon={microphoneIcon} filledIcon={microphoneFilledIcon} label="Enable audio" helper="Browser blocked remote audio playback" onClick={() => void media.enableAudio()} />}
            <ControlButton icon={layoutIcons[layout][0]} filledIcon={layoutIcons[layout][1]} label="Layout" helper={`${layoutLabels[layout]} preview`} active onClick={() => { layoutRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); layoutRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }} />
            <ControlButton buttonRef={panelTriggerRef} icon={backstageIcon} filledIcon={backstageFilledIcon} label="Backstage" helper={`${waiting.length} waiting, ${admitted.length} on stage`} active={panel === "backstage" && (!cinematic || cinematicPanelOpen) && preferences.sidebar !== "hidden"} onClick={() => openWorkspacePanel("backstage")} />
            <ControlButton icon={inviteIcon} filledIcon={inviteFilledIcon} label="Invite" helper="Open secure invites" active={panel === "invites" && (!cinematic || cinematicPanelOpen) && preferences.sidebar !== "hidden"} onClick={() => openWorkspacePanel("invites")} />
            <ControlButton icon={roomPrefsIcon} filledIcon={roomPrefsFilledIcon} label="Settings" helper="Open room settings" active={panel === "room" && (!cinematic || cinematicPanelOpen) && preferences.sidebar !== "hidden"} onClick={() => openWorkspacePanel("room")} />
            <ControlButton icon={goLiveIcon} label="Go live" helper="Output integration not connected" disabled onClick={openGoLiveInfo} />
          </div>
          <button className="control-dock__nav control-dock__nav--next icon-control studio-tooltip" data-tooltip="Next controls" type="button" aria-label="Next production controls" onClick={() => scrollDock(1)}><StudioIcon regular={nextIcon} /></button>
        </div>
        </div>
        <section className="backstage-tray" aria-labelledby="backstage-tray-heading">
          <div className="backstage-tray__heading"><h2 id="backstage-tray-heading">Backstage</h2><StatusChip tone={waiting.length || backstageSources.length || backstageBrowserSources.length ? "pending" : "neutral"}>{waiting.length + backstageSources.length + backstageBrowserSources.length}</StatusChip></div>
          {waiting.length || backstageSources.length || backstageBrowserSources.length ? <div className="backstage-tray__scroll">{waiting.map((guest) => <article className="backstage-tile" key={guest.id}>
            <BackstageMediaPreview guest={guest} media={media} />
            <div><strong>{guest.displayName}</strong><small>{guest.subtitle || (guest.sessionCohost ? "Session cohost" : "Waiting Backstage")}</small></div>
            <div className="participant-actions">
              <Button className="icon-control" disabled={Boolean(guestBusy) || admitted.length >= room.maxAdditionalStageParticipants} onClick={() => void moveParticipant(guest, "stage")}><StudioIcon regular={moveUpIcon} filled={moveUpFilledIcon} /> Move to Stage</Button>
              <Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void mediaIntent(guest, "microphone")}>{guest.microphoneMuted ? "Unmute intent" : "Mute intent"}</Button>
              <Button variant="quiet" disabled={Boolean(guestBusy)} onClick={() => void mediaIntent(guest, "camera")}>{guest.cameraHidden ? "Show camera" : "Hide camera"}</Button>
            </div>
          </article>)}{presentationSources.filter((source) => source.location === "backstage").map((source) => <article className="backstage-tile presentation-source-card" key={source.id}><div className="presentation-source-preview">{sourceShare(source) ? <ScreenShareVideo track={sourceShare(source)!.track} label={source.displayName} /> : <StudioIcon regular={shareIcon} />}</div><div><strong>{source.displayName}</strong><small>Screen share · Backstage</small></div>{permissions?.updatePresentation && <Button disabled={Boolean(busy)} onClick={() => void changeSourceLocation(source, "on_stage")}>Move to Stage</Button>}</article>)}{backstageBrowserSources.map((source) => <article className="backstage-tile browser-source-card" key={source.id}><div className="presentation-source-preview"><StudioIcon regular={mediaIcon} filled={mediaFilledIcon} /></div><div><strong>{source.displayName}</strong><small>Browser source · {source.safeHost ?? "Restricted URL"} · Backstage</small></div>{permissions?.manageBrowserSources && <Button disabled={Boolean(busy)} onClick={() => void changeBrowserSourceLocation(source, "on_stage")}>Move to Stage</Button>}</article>)}</div> : <EmptyState title="Backstage is clear"><p>Guests, presentation sources, and browser sources appear here.</p></EmptyState>}
        </section>
      </section>
      <DevicePreflightDialog media={media} />

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
