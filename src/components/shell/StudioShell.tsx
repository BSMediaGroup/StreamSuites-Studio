import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { GlobalLoadingBar } from "../../activity/GlobalLoadingBar";
import { BrandMark } from "../BrandMark";
import { StudioAccountMenu } from "../StudioAccountMenu";
import { AuthAccessBanner } from "../AuthAccessBanner";
import { ThemeToggle } from "../ThemeToggle";
import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";
import { ViewOptionsMenu } from "../ViewOptionsMenu";
import { usePresentationPreferences } from "../../presentation/presentationContext";
import { StudioFooter } from "../StudioFooter";
import { StudioIcon } from "../ui/StudioIcon";
import { TooltipPortal } from "../ui/TooltipPortal";
import { StudioEdgeSidebar } from "./StudioEdgeSidebar";
import { CohostRequests } from "../CohostRequests";
import studioIcon from "../../../assets/icons/ui/tvlive.svg";
import brandIcon from "../../../assets/icons/ui/starform.svg";
import mediaIcon from "../../../assets/icons/ui/media.svg";
import destinationsIcon from "../../../assets/icons/ui/sharelinks.svg";
import settingsIcon from "../../../assets/icons/ui/settingsquare.svg";
import sidebarIcon from "../../../assets/icons/ui/sidebar.svg";
import sidebarOpenIcon from "../../../assets/icons/ui/sidebaropen.svg";
import chatIcon from "../../../assets/icons/ui/chat.svg";
import chatFilledIcon from "../../../assets/icons/ui/chatfill.svg";

type PrimarySidebarSection = "studio" | "brand" | "media" | "destinations" | "settings";
type PrimarySidebarMode = "expanded" | "collapsed" | "hidden";

export const STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY = "streamsuites_studio_primary_sidebar";

const primaryNavigation: readonly { readonly id: PrimarySidebarSection; readonly label: string; readonly icon: string }[] = [
  { id: "studio", label: "Studio", icon: studioIcon },
  { id: "brand", label: "Brand", icon: brandIcon },
  { id: "media", label: "Media", icon: mediaIcon },
  { id: "destinations", label: "Destinations", icon: destinationsIcon },
  { id: "settings", label: "Settings", icon: settingsIcon },
];

export function parsePrimarySidebarMode(value: string | null): PrimarySidebarMode {
  if (!value) return "collapsed";
  try {
    const mode = (JSON.parse(value) as { mode?: unknown }).mode;
    return mode === "expanded" || mode === "collapsed" || mode === "hidden" ? mode : "collapsed";
  } catch {
    return "collapsed";
  }
}

function loadPrimarySidebarMode(): PrimarySidebarMode {
  try { return parsePrimarySidebarMode(window.localStorage.getItem(STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY)); }
  catch { return "collapsed"; }
}

interface StudioShellProps {
  readonly children: ReactNode;
  readonly roomWorkspace?: boolean;
  readonly fullscreenSupported?: boolean;
  readonly fullscreenActive?: boolean;
  readonly onToggleFullscreen?: () => void;
  readonly chatUnreadCount?: number;
  readonly chatOpen?: boolean;
  readonly onOpenChat?: () => void;
}

export function StudioShell({ children, roomWorkspace = false, fullscreenSupported, fullscreenActive, onToggleFullscreen, chatUnreadCount = 0, chatOpen = false, onOpenChat }: StudioShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [primarySidebar, setPrimarySidebar] = useState<PrimarySidebarMode>(loadPrimarySidebarMode);
  const [primarySection, setPrimarySection] = useState<PrimarySidebarSection>("studio");
  const [primaryPeek, setPrimaryPeek] = useState(false);
  const [headerHeldOpen, setHeaderHeldOpen] = useState(false);
  const [headerRevealed, setHeaderRevealed] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  const hideTimer = useRef(0);
  const { preferences, toggleCinematic } = usePresentationPreferences();
  const location = useLocation();
  const cinematic = roomWorkspace && preferences.cinematic === "on";
  const autoHide = preferences.header === "auto-hide" && !cinematic;

  const revealHeader = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setHeaderRevealed(true);
  }, []);
  const scheduleHeaderHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    if (autoHide && !headerHeldOpen) hideTimer.current = window.setTimeout(() => setHeaderRevealed(false), 1200);
  }, [autoHide, headerHeldOpen]);

  useEffect(() => {
    if (!autoHide || headerHeldOpen) return setHeaderRevealed(true);
    const timer = window.setTimeout(() => setHeaderRevealed(false), 1800);
    return () => window.clearTimeout(timer);
  }, [autoHide, headerHeldOpen]);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  useEffect(() => {
    try { window.localStorage.setItem(STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY, JSON.stringify({ mode: primarySidebar })); }
    catch { /* Storage may be unavailable; the sidebar remains usable in memory. */ }
  }, [primarySidebar]);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    const pointer = (event: PointerEvent) => { if (!(event.target as Element).closest(".studio-edge-sidebar--left,.menu-toggle")) setMenuOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [menuOpen]);

  function selectPrimarySection(section: PrimarySidebarSection) {
    setPrimarySection(section);
    if (primarySidebar === "collapsed") setPrimaryPeek(true);
  }

  const effectiveSidebar = cinematic ? "hidden" : primarySidebar;
  const primaryLabel = primaryNavigation.find((item) => item.id === primarySection)?.label ?? "Studio";
  const shellClass = `studio-shell studio-shell--sidebar-${effectiveSidebar}${primaryPeek && effectiveSidebar === "collapsed" ? " studio-shell--sidebar-peeking" : ""} studio-shell--header-${cinematic ? "cinematic" : preferences.header}${roomWorkspace ? ` studio-shell--room-workspace studio-shell--context-panel-${preferences.sidebar}` : ""}${autoHide && !headerRevealed ? " studio-shell--header-hidden" : ""}${cinematic ? " studio-shell--cinematic" : ""}${menuOpen ? " studio-shell--menu-open" : ""}`;

  return (
    <div className={shellClass}>
      {autoHide && <button className="studio-topbar-activator" type="button" aria-label="Reveal Studio header" onFocus={revealHeader} onPointerEnter={revealHeader} onClick={revealHeader} />}
      <header ref={headerRef} className="studio-topbar" onPointerEnter={revealHeader} onPointerLeave={scheduleHeaderHide} onFocusCapture={revealHeader} onBlurCapture={(event) => { if (!headerRef.current?.contains(event.relatedTarget as Node)) scheduleHeaderHide(); }}>
        <Button
          className="menu-toggle"
          variant="quiet"
          aria-expanded={menuOpen}
          aria-controls="studio-sidebar"
          aria-label="Toggle Studio navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <StudioIcon regular={sidebarIcon} />
        </Button>
        <BrandMark />
        <div className="studio-topbar__status">
          <CohostRequests onOpenChange={setHeaderHeldOpen} />
          {roomWorkspace && onOpenChat && <Button className="cohost-requests__trigger" variant="quiet" aria-label="Open room chat" aria-pressed={chatOpen} title="Room chat" onClick={onOpenChat}>
            <StudioIcon regular={chatIcon} filled={chatFilledIcon} active={chatOpen} /> <span>Chat</span>{chatUnreadCount > 0 && <span className="request-count" aria-label={`${chatUnreadCount} unread private messages`}>{chatUnreadCount > 99 ? "99+" : chatUnreadCount}</span>}
          </Button>}
          <ViewOptionsMenu roomWorkspace={roomWorkspace} primarySidebar={primarySidebar} onSetPrimarySidebar={setPrimarySidebar} fullscreenSupported={fullscreenSupported} fullscreenActive={fullscreenActive} onToggleFullscreen={onToggleFullscreen} onOpenChange={setHeaderHeldOpen} />
          <ThemeToggle />
          <StatusChip tone="alpha">ALPHA</StatusChip>
          <StudioAccountMenu onOpenChange={setHeaderHeldOpen} />
        </div>
      </header>
      <GlobalLoadingBar />
      <AuthAccessBanner />

      <StudioEdgeSidebar
        edge="left"
        ariaLabel="Primary Studio sidebar"
        navigationLabel={roomWorkspace ? "In-room Studio navigation" : "Studio navigation"}
        mode={effectiveSidebar}
        items={primaryNavigation.map((item) => ({ ...item, label: roomWorkspace && item.id === "studio" ? "Rooms" : item.label }))}
        selectedSection={primarySection}
        panelHeading={primaryLabel}
        temporaryExpanded={primaryPeek}
        onTemporaryExpandedChange={setPrimaryPeek}
        onSelectedSectionChange={(section) => selectPrimarySection(section as PrimarySidebarSection)}
        onModeChange={setPrimarySidebar}
        toggleHidden={cinematic}
        panelBody={
          <>
            {primarySection === "studio" && <div className="studio-primary-panel"><h3>{roomWorkspace ? "Active room" : "Room lobby"}</h3><p>{roomWorkspace ? "The current room stays open while you return to the Runtime/Auth-owned room lobby." : "Create, open, edit, and manage Runtime/Auth-owned Studio rooms from the lobby workspace."}</p>{roomWorkspace ? <Link className="button button--secondary" to="/studio">Open Studio rooms</Link> : <p className="fine-print">Open a room from the center workspace to reveal room-production controls on the independent right sidebar.</p>}</div>}
            {primarySection === "brand" && <div className="studio-primary-panel"><h3>Brand library foundation</h3><p>Prepare reusable Studio identity, visual defaults, and product-level brand assets independently from any active room.</p><p className="fine-print">This closed-ALPHA foundation does not publish or replace Runtime/Auth-owned room Branding.</p></div>}
            {primarySection === "media" && <div className="studio-primary-panel"><h3>Media library foundation</h3><p>Organize reusable Studio images and media defaults before assigning room-scoped assets or browser sources.</p><p className="fine-print">Uploads remain unavailable here until a canonical product-media contract is exposed by Runtime/Auth.</p></div>}
            {primarySection === "destinations" && <div className="studio-primary-panel"><h3>No destinations connected</h3><p>Destination credentials and canonical output state belong to Runtime/Auth. Studio remains OFF AIR and does not claim provider configuration or broadcasting success.</p><p className="fine-print">The local destination foundation stays visible while connection, authorization, readiness, and output remain unavailable.</p></div>}
            {primarySection === "settings" && <div className="studio-primary-panel"><h3>Studio display settings</h3><p>Theme and View controls configure this browser's shell presentation without changing rooms, participants, permissions, or shared production state.</p><p className="fine-print">Identity, authorization, rooms, and production truth remain server-owned.</p></div>}
          </>
        }
        panelFooter={<div className="studio-sidebar__note"><strong>Closed ALPHA · OFF AIR</strong><p>Runtime/Auth owns room authority and proxies direct Cloudflare Realtime SFU signaling.</p></div>}
      />

      {effectiveSidebar === "hidden" && !cinematic && <button className="sidebar-restore icon-control studio-tooltip" data-tooltip="Restore Studio sidebar" type="button" onClick={() => setPrimarySidebar("collapsed")} aria-label="Restore Studio sidebar"><StudioIcon regular={sidebarOpenIcon} filled={sidebarOpenIcon} /></button>}
      {cinematic && <button className="cinematic-exit" type="button" onClick={toggleCinematic}>Exit cinematic <kbd>F</kbd></button>}

      <main id="main-content" className="studio-main">
        {children}
      </main>
      <StudioFooter />
      <TooltipPortal />
    </div>
  );
}
