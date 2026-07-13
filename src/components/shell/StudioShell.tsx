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
import studioIcon from "../../../assets/icons/ui/tvlive.svg";
import brandIcon from "../../../assets/icons/ui/starform.svg";
import mediaIcon from "../../../assets/icons/ui/media.svg";
import destinationsIcon from "../../../assets/icons/ui/sharelinks.svg";
import settingsIcon from "../../../assets/icons/ui/settingsquare.svg";
import sidebarIcon from "../../../assets/icons/ui/sidebar.svg";
import sidebarCloseIcon from "../../../assets/icons/ui/sidebarclose.svg";
import sidebarOpenIcon from "../../../assets/icons/ui/sidebaropen.svg";

const futureNavigation = [
  { label: "Brand", icon: brandIcon },
  { label: "Media", icon: mediaIcon },
  { label: "Destinations", icon: destinationsIcon },
  { label: "Settings", icon: settingsIcon },
];

interface StudioShellProps {
  readonly children: ReactNode;
  readonly roomWorkspace?: boolean;
  readonly fullscreenSupported?: boolean;
  readonly fullscreenActive?: boolean;
  readonly onToggleFullscreen?: () => void;
  readonly onOpenRoomTool?: (tool: "brand" | "media") => void;
}

export function StudioShell({ children, roomWorkspace = false, fullscreenSupported, fullscreenActive, onToggleFullscreen, onOpenRoomTool }: StudioShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeldOpen, setHeaderHeldOpen] = useState(false);
  const [headerRevealed, setHeaderRevealed] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  const hideTimer = useRef(0);
  const { preferences, cycleSidebar, setSidebar, toggleCinematic } = usePresentationPreferences();
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
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    const pointer = (event: PointerEvent) => { if (!(event.target as Element).closest("#studio-sidebar,.menu-toggle")) setMenuOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [menuOpen]);

  const effectiveSidebar = cinematic ? "hidden" : preferences.sidebar;
  const shellClass = `studio-shell studio-shell--sidebar-${effectiveSidebar} studio-shell--header-${cinematic ? "cinematic" : preferences.header}${roomWorkspace ? " studio-shell--room-workspace" : ""}${autoHide && !headerRevealed ? " studio-shell--header-hidden" : ""}${cinematic ? " studio-shell--cinematic" : ""}${menuOpen ? " studio-shell--menu-open" : ""}`;

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
          <ViewOptionsMenu roomWorkspace={roomWorkspace} fullscreenSupported={fullscreenSupported} fullscreenActive={fullscreenActive} onToggleFullscreen={onToggleFullscreen} onOpenChange={setHeaderHeldOpen} />
          <ThemeToggle />
          <StatusChip tone="alpha">ALPHA</StatusChip>
          <StudioAccountMenu onOpenChange={setHeaderHeldOpen} />
        </div>
      </header>
      <GlobalLoadingBar />
      <AuthAccessBanner />

      <aside id="studio-sidebar" className="studio-sidebar" aria-label="Studio workspace">
        <div className="studio-sidebar__header"><span>Studio workspace</span></div>
        <div className="studio-sidebar__scroll">
          <nav>
            <Link className="studio-nav-link studio-nav-link--active icon-control studio-tooltip" to="/studio" data-tooltip="Studio" aria-label="Studio">
              <StudioIcon regular={studioIcon} active />
              <span className="studio-nav-link__label">Studio</span>
            </Link>
            {futureNavigation.map(({ label, icon }) => {
              const tool = label === "Brand" ? "brand" : label === "Media" ? "media" : null;
              const available = Boolean(roomWorkspace && tool && onOpenRoomTool);
              return <button key={label} className="studio-nav-link icon-control studio-tooltip" type="button" disabled={!available} data-tooltip={available ? `Open room ${label}` : `${label} (Later)`} aria-label={available ? `Open room ${label}` : `${label}, unavailable, later`} onClick={() => { if (tool) onOpenRoomTool?.(tool); }}>
                <StudioIcon regular={icon} />
                <span className="studio-nav-link__label">{label}</span>
                {!available && <span className="studio-nav-link__future">Later</span>}
              </button>;
            })}
          </nav>
        </div>
        <div className="studio-sidebar__bottom">
          <div className="studio-sidebar__note">
            <strong>Closed ALPHA · OFF AIR</strong>
            <p>Runtime/Auth owns room authority; RealtimeKit carries private room media only.</p>
          </div>
          <button className="sidebar-mode-cycle icon-control studio-tooltip" data-tooltip={`Sidebar: ${preferences.sidebar}. Change mode.`} type="button" onClick={cycleSidebar} aria-label={`Sidebar is ${preferences.sidebar}. Change sidebar mode.`}><StudioIcon regular={sidebarCloseIcon} filled={sidebarOpenIcon} active={preferences.sidebar !== "expanded"} /> <span>Change sidebar</span></button>
        </div>
      </aside>

      {effectiveSidebar === "hidden" && !cinematic && <button className="sidebar-restore icon-control studio-tooltip" data-tooltip="Restore sidebar" type="button" onClick={() => setSidebar("expanded")} aria-label="Restore Studio sidebar"><StudioIcon regular={sidebarOpenIcon} filled={sidebarOpenIcon} /></button>}
      {cinematic && <button className="cinematic-exit" type="button" onClick={toggleCinematic}>Exit cinematic <kbd>F</kbd></button>}

      <main id="main-content" className="studio-main">
        {children}
      </main>
      <StudioFooter />
      <TooltipPortal />
    </div>
  );
}
