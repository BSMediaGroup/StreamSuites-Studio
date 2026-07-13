import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT_GAP = 8;
const TOOLTIP_GAP = 8;

interface TooltipState {
  readonly anchor: HTMLElement;
  readonly text: string;
}

export function TooltipPortal() {
  const [active, setActive] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const showTimer = useRef(0);
  const hideTimer = useRef(0);

  const place = useCallback(() => {
    if (!active || !tooltipRef.current || !document.contains(active.anchor)) return;
    const anchor = active.anchor.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const centered = anchor.left + anchor.width / 2 - tooltip.width / 2;
    const left = Math.min(Math.max(VIEWPORT_GAP, centered), Math.max(VIEWPORT_GAP, window.innerWidth - tooltip.width - VIEWPORT_GAP));
    const above = anchor.top - tooltip.height - TOOLTIP_GAP;
    const below = anchor.bottom + TOOLTIP_GAP;
    const top = above >= VIEWPORT_GAP ? above : Math.min(below, window.innerHeight - tooltip.height - VIEWPORT_GAP);
    setPosition({ left, top: Math.max(VIEWPORT_GAP, top) });
  }, [active]);

  useLayoutEffect(place, [place]);
  useEffect(() => {
    if (!active) return;
    const previous = active.anchor.getAttribute("aria-describedby");
    active.anchor.setAttribute("aria-describedby", previous ? `${previous} ${tooltipId}` : tooltipId);
    return () => {
      if (previous) active.anchor.setAttribute("aria-describedby", previous);
      else active.anchor.removeAttribute("aria-describedby");
    };
  }, [active, tooltipId]);

  useEffect(() => {
    const tooltipAnchor = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>("[data-tooltip]") : null;
    const show = (anchor: HTMLElement) => {
      const text = anchor.dataset.tooltip?.trim();
      if (!text) return;
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => setActive({ anchor, text }), 350);
    };
    const hide = (anchor: HTMLElement | null, nextTarget: EventTarget | null) => {
      if (anchor?.contains(nextTarget as Node)) return;
      window.clearTimeout(showTimer.current);
      hideTimer.current = window.setTimeout(() => setActive((current) => current?.anchor === anchor ? null : current), 80);
    };
    const pointerOver = (event: PointerEvent) => { const anchor = tooltipAnchor(event.target); if (anchor) show(anchor); };
    const pointerOut = (event: PointerEvent) => hide(tooltipAnchor(event.target), event.relatedTarget);
    const focusIn = (event: FocusEvent) => { const anchor = tooltipAnchor(event.target); if (anchor) show(anchor); };
    const focusOut = (event: FocusEvent) => hide(tooltipAnchor(event.target), event.relatedTarget);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null); };
    document.addEventListener("pointerover", pointerOver);
    document.addEventListener("pointerout", pointerOut);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(showTimer.current); window.clearTimeout(hideTimer.current);
      document.removeEventListener("pointerover", pointerOver); document.removeEventListener("pointerout", pointerOut);
      document.removeEventListener("focusin", focusIn); document.removeEventListener("focusout", focusOut);
      document.removeEventListener("keydown", escape); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  return active ? createPortal(<div ref={tooltipRef} id={tooltipId} className="studio-tooltip-portal" role="tooltip" style={position}>{active.text}</div>, document.body) : null;
}
