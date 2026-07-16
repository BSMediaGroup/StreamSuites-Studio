import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StudioIcon } from "../ui/StudioIcon";

export type StudioEdgeSidebarMode = "expanded" | "collapsed" | "hidden";

export interface StudioEdgeSidebarItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly filledIcon?: string;
  readonly count?: number;
}

interface StudioEdgeSidebarProps {
  readonly edge: "left" | "right";
  readonly ariaLabel: string;
  readonly navigationLabel: string;
  readonly mode: StudioEdgeSidebarMode;
  readonly items: readonly StudioEdgeSidebarItem[];
  readonly selectedSection: string;
  readonly panelHeading: string;
  readonly panelBody: ReactNode;
  readonly panelFooter?: ReactNode;
  readonly temporaryExpanded: boolean;
  readonly onTemporaryExpandedChange: (expanded: boolean) => void;
  readonly onSelectedSectionChange: (section: string) => void;
  readonly onModeChange: (mode: Exclude<StudioEdgeSidebarMode, "hidden">) => void;
  readonly className?: string;
  readonly panelHeadingControl?: ReactNode;
  readonly toggleHidden?: boolean;
  readonly dialogOpen?: boolean;
}

export const StudioEdgeSidebar = forwardRef<HTMLElement, StudioEdgeSidebarProps>(function StudioEdgeSidebar({
  edge,
  ariaLabel,
  navigationLabel,
  mode,
  items,
  selectedSection,
  panelHeading,
  panelBody,
  panelFooter,
  temporaryExpanded,
  onTemporaryExpandedChange,
  onSelectedSectionChange,
  onModeChange,
  className = "",
  panelHeadingControl,
  toggleHidden = false,
  dialogOpen = false,
}, forwardedRef) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef(0);
  const setSidebarRef = useCallback((node: HTMLElement | null) => {
    sidebarRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const reveal = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    if (mode === "collapsed") onTemporaryExpandedChange(true);
  }, [mode, onTemporaryExpandedChange]);

  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (sidebarRef.current?.contains(document.activeElement) || document.querySelector(".custom-layout-popup, [role='dialog'][aria-modal='true']")) return;
      onTemporaryExpandedChange(false);
    }, 180);
  }, [onTemporaryExpandedChange]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (mode !== "collapsed" && temporaryExpanded) onTemporaryExpandedChange(false);
  }, [mode, onTemporaryExpandedChange, temporaryExpanded]);

  function selectSection(section: string) {
    onSelectedSectionChange(section);
    reveal();
  }

  function navigateRail(event: KeyboardEvent<HTMLElement>) {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".studio-edge-sidebar__items > button"));
    if (!buttons.length) return;
    event.preventDefault();
    const current = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  const pinned = mode === "expanded";
  const toggleLabel = `${pinned ? "Collapse" : "Expand"} ${edge} sidebar`;

  return (
    <aside
      ref={setSidebarRef}
      className={`studio-edge-sidebar studio-edge-sidebar--${edge} is-${mode}${temporaryExpanded && mode === "collapsed" ? " is-temporarily-expanded" : ""}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
      data-edge={edge}
      data-mode={mode}
      data-temporary-expanded={temporaryExpanded && mode === "collapsed" ? "true" : "false"}
      onPointerEnter={reveal}
      onPointerLeave={scheduleClose}
      onFocusCapture={reveal}
      onBlurCapture={(event) => { if (!sidebarRef.current?.contains(event.relatedTarget as Node)) scheduleClose(); }}
      {...(dialogOpen ? { role: "dialog", "aria-modal": true } : {})}
    >
      <nav className="studio-edge-sidebar__rail" aria-label={navigationLabel} onKeyDown={navigateRail}>
        <div className="studio-edge-sidebar__items">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`studio-edge-sidebar__section icon-control studio-tooltip${selectedSection === item.id ? " is-active" : ""}`}
              data-tooltip={item.label}
              aria-label={`Open ${item.label} panel`}
              aria-pressed={selectedSection === item.id}
              onClick={() => selectSection(item.id)}
            >
              <StudioIcon regular={item.icon} filled={item.filledIcon} active={selectedSection === item.id} />
              {item.count !== undefined && <span className="studio-edge-sidebar__count">{item.count}</span>}
            </button>
          ))}
        </div>
        {!toggleHidden && mode !== "hidden" && (
          <button
            className="studio-edge-sidebar__toggle icon-control studio-tooltip"
            data-tooltip={toggleLabel}
            type="button"
            aria-label={toggleLabel}
            onClick={() => { onTemporaryExpandedChange(false); onModeChange(pinned ? "collapsed" : "expanded"); }}
          >
            <span className="studio-edge-sidebar__toggle-glyph" aria-hidden="true">{pinned ? "‹" : "›"}</span>
          </button>
        )}
      </nav>
      <section className="studio-edge-sidebar__panel" aria-label={`${panelHeading} panel`}>
        <header className="studio-edge-sidebar__header">
          <p className="eyebrow">{panelHeading.toUpperCase()}</p>
          {panelHeadingControl}
        </header>
        <div className="studio-edge-sidebar__body">{panelBody}</div>
        {panelFooter && <footer className="studio-edge-sidebar__footer">{panelFooter}</footer>}
      </section>
    </aside>
  );
});

export function StudioEdgeSidebarPortal({ children }: { readonly children: ReactNode }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const [shell, setShell] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setShell(markerRef.current?.closest<HTMLElement>(".studio-shell") ?? null);
  }, []);

  return (
    <>
      <span ref={markerRef} className="studio-edge-sidebar-portal-marker" aria-hidden="true" />
      {shell ? createPortal(children, shell) : null}
    </>
  );
}
