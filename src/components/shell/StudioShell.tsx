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

const futureNavigation = ["Brand", "Media", "Destinations", "Settings"];

interface StudioShellProps {
  readonly children: ReactNode;
  readonly roomWorkspace?: boolean;
  readonly fullscreenSupported?: boolean;
  readonly fullscreenActive?: boolean;
  readonly onToggleFullscreen?: () => void;
}

export function StudioShell({ children, roomWorkspace = false, fullscreenSupported, fullscreenActive, onToggleFullscreen }: StudioShellProps) {
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
  const shellClass = `studio-shell studio-shell--sidebar-${effectiveSidebar} studio-shell--header-${cinematic ? "cinematic" : preferences.header}${autoHide && !headerRevealed ? " studio-shell--header-hidden" : ""}${cinematic ? " studio-shell--cinematic" : ""}${menuOpen ? " studio-shell--menu-open" : ""}`;

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
          <span aria-hidden="true">☰</span>
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
        <nav>
          <Link className="studio-nav-link studio-nav-link--active" to="/studio" title="Studio" aria-label="Studio">
            <span aria-hidden="true">◉</span>
            <span className="studio-nav-link__label">Studio</span>
          </Link>
          {futureNavigation.map((label) => (
            <button key={label} className="studio-nav-link" type="button" disabled title={`${label} (Later)`} aria-label={`${label}, unavailable, later`}>
              <span aria-hidden="true">○</span>
              <span className="studio-nav-link__label">{label}</span>
              <span className="studio-nav-link__future">Later</span>
            </button>
          ))}
        </nav>
        <div className="studio-sidebar__note">
          <strong>Closed ALPHA</strong>
          <p>Rooms, invitations, and lobby authority are Runtime/Auth-owned. Media is not implemented.</p>
        </div>
        <button className="sidebar-mode-cycle" type="button" onClick={cycleSidebar} aria-label={`Sidebar is ${preferences.sidebar}. Change sidebar mode.`} title={`Sidebar: ${preferences.sidebar}. Change mode.`}>⇤ <span>Change sidebar</span></button>
      </aside>

      {effectiveSidebar === "hidden" && !cinematic && <button className="sidebar-restore" type="button" onClick={() => setSidebar("expanded")} aria-label="Restore Studio sidebar" title="Restore sidebar">☰</button>}
      {cinematic && <button className="cinematic-exit" type="button" onClick={toggleCinematic}>Exit cinematic <kbd>F</kbd></button>}

      <main id="main-content" className="studio-main">
        {children}
      </main>
    </div>
  );
}
