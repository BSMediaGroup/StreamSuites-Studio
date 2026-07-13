import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StudioIcon } from "./StudioIcon";

export interface ParticipantMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly separatorBefore?: boolean;
  readonly icon?: string;
  readonly filledIcon?: string;
}

interface ParticipantMenuPortalProps {
  readonly participantName: string;
  readonly items: readonly ParticipantMenuItem[];
}

const MENU_WIDTH = 240;
const VIEWPORT_GAP = 8;

export function ParticipantMenuPortal({ participantName, items }: ParticipantMenuPortalProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function placeMenu() {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight || 280;
    const below = rect.bottom + 6;
    const top = below + menuHeight <= window.innerHeight - VIEWPORT_GAP ? below : Math.max(VIEWPORT_GAP, rect.top - menuHeight - 6);
    const left = Math.min(Math.max(VIEWPORT_GAP, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - VIEWPORT_GAP);
    setPosition({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    window.setTimeout(() => menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])') ?? []);
      if (!buttons.length) return;
      const current = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
      let next = -1;
      if (event.key === "ArrowDown") next = (current + 1) % buttons.length;
      if (event.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      if (next >= 0) {
        event.preventDefault();
        buttons[next]?.focus();
      }
      if (event.key === "Tab") setOpen(false);
    };
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="participant-menu-trigger icon-control"
        type="button"
        aria-label={`Actions for ${participantName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden="true">…</span>
      </button>
      {open && createPortal(
        <div
          id={menuId}
          ref={menuRef}
          className="participant-menu-portal"
          role="menu"
          aria-label={`Actions for ${participantName}`}
          style={{ top: position.top, left: position.left }}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              className={`${item.icon ? "icon-control " : ""}${item.destructive ? "is-destructive " : ""}${item.separatorBefore ? "has-separator" : ""}`.trim()}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                close(true);
              }}
            >
              {item.icon && <StudioIcon regular={item.icon} filled={item.filledIcon} />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
