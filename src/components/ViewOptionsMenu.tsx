import { useEffect, useRef, useState } from "react";
import { usePresentationPreferences } from "../presentation/presentationContext";
import type { HeaderMode, NoticeDuration, SidebarMode } from "../presentation/presentationPreferences";
import { StudioIcon } from "./ui/StudioIcon";
import viewIcon from "../../assets/icons/ui/visible.svg";
import viewFilledIcon from "../../assets/icons/ui/visiblefilled.svg";

interface ViewOptionsMenuProps {
  readonly roomWorkspace?: boolean;
  readonly primarySidebar?: SidebarMode;
  readonly onSetPrimarySidebar?: (mode: SidebarMode) => void;
  readonly fullscreenSupported?: boolean;
  readonly fullscreenActive?: boolean;
  readonly onToggleFullscreen?: () => void;
  readonly onOpenChange?: (open: boolean) => void;
}

const headerOptions: readonly [HeaderMode, string][] = [["standard", "Standard"], ["slim", "Slim"], ["auto-hide", "Auto-hide"]];
const sidebarOptions: readonly [SidebarMode, string][] = [["expanded", "Expanded"], ["collapsed", "Icons only"], ["hidden", "Hidden"]];
const noticeDurationOptions: readonly [NoticeDuration, string][] = [[3000, "3 seconds"], [5000, "5 seconds"], [8000, "8 seconds"], [12000, "12 seconds"], ["manual", "Until dismissed"]];

export function ViewOptionsMenu({ roomWorkspace = false, primarySidebar = "expanded", onSetPrimarySidebar, fullscreenSupported = false, fullscreenActive = false, onToggleFullscreen, onOpenChange }: ViewOptionsMenuProps) {
  const { preferences, setSidebar, setHeader, toggleCinematic, setNoticeDuration } = usePresentationPreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => onOpenChange?.(open), [onOpenChange, open]);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); close(true); } };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key, true); };
  }, [open]);

  return (
    <div className="view-options" ref={rootRef}>
      <button ref={triggerRef} type="button" className="view-options__trigger" aria-label="View options" aria-haspopup="menu" aria-expanded={open} aria-controls="view-options-menu" onClick={() => setOpen((value) => !value)}>
        <StudioIcon regular={viewIcon} filled={viewFilledIcon} active={open} /><span className="view-options__label">View</span>
      </button>
      {open && <div id="view-options-menu" className="view-options__menu" role="menu" aria-label="Studio display options">
        {roomWorkspace ? <fieldset><legend>Contextual panel</legend><button className="view-options__panel-visibility" type="button" role="menuitem" onClick={() => setSidebar(preferences.sidebar === "hidden" ? "collapsed" : "hidden")}>{preferences.sidebar === "hidden" ? "Show contextual panel" : "Hide contextual panel"}</button></fieldset> : <fieldset><legend>Sidebar</legend>{sidebarOptions.map(([value, label]) => <label key={value}><input type="radio" name="primary-sidebar-mode" checked={primarySidebar === value} onChange={() => onSetPrimarySidebar?.(value)} /> <span>{label}</span></label>)}</fieldset>}
        <fieldset><legend>Header</legend>{headerOptions.map(([value, label]) => <label key={value}><input type="radio" name="header-mode" checked={preferences.header === value} onChange={() => setHeader(value)} /> <span>{label}</span></label>)}</fieldset>
        {roomWorkspace && <fieldset><legend>Contextual notice duration</legend><select aria-label="Contextual notice duration" value={preferences.noticeDuration} onChange={(event) => setNoticeDuration(event.target.value === "manual" ? "manual" : Number(event.target.value) as NoticeDuration)}>{noticeDurationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></fieldset>}
        {roomWorkspace && <div className="view-options__actions">
          <button type="button" role="menuitemcheckbox" aria-checked={preferences.cinematic === "on"} onClick={toggleCinematic}><span>{preferences.cinematic === "on" ? "✓" : ""}</span>{preferences.cinematic === "on" ? "Exit cinematic" : "Enter cinematic"}<kbd>F</kbd></button>
          {fullscreenSupported && <button type="button" role="menuitemcheckbox" aria-checked={fullscreenActive} onClick={onToggleFullscreen}><span>{fullscreenActive ? "✓" : ""}</span>{fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}</button>}
        </div>}
      </div>}
    </div>
  );
}
