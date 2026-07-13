import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CustomLayout } from "../../domain/studio";
import { StudioIcon } from "../ui/StudioIcon";
import customIcon from "../../../assets/icons/ui/layoutcustom.svg";
import customFilledIcon from "../../../assets/icons/ui/layoutcustom-filled.svg";
import newIcon from "../../../assets/icons/ui/layoutnew.svg";
import newFilledIcon from "../../../assets/icons/ui/layoutnew-filled.svg";
import slot1 from "../../../assets/icons/ui/layoutcustom1.svg"; import slot1Filled from "../../../assets/icons/ui/layoutcustom1-filled.svg";
import slot2 from "../../../assets/icons/ui/layoutcustom2.svg"; import slot2Filled from "../../../assets/icons/ui/layoutcustom2-filled.svg";
import slot3 from "../../../assets/icons/ui/layoutcustom3.svg"; import slot3Filled from "../../../assets/icons/ui/layoutcustom3-filled.svg";
import slot4 from "../../../assets/icons/ui/layoutcustom4.svg"; import slot4Filled from "../../../assets/icons/ui/layoutcustom4-filled.svg";
import slot5 from "../../../assets/icons/ui/layoutcustom5.svg"; import slot5Filled from "../../../assets/icons/ui/layoutcustom5-filled.svg";
import slot6 from "../../../assets/icons/ui/layoutcustom6.svg"; import slot6Filled from "../../../assets/icons/ui/layoutcustom6-filled.svg";
import slot7 from "../../../assets/icons/ui/layoutcustom7.svg"; import slot7Filled from "../../../assets/icons/ui/layoutcustom7-filled.svg";
import slot8 from "../../../assets/icons/ui/layoutcustom8.svg"; import slot8Filled from "../../../assets/icons/ui/layoutcustom8-filled.svg";

const slotIcons = [[slot1, slot1Filled], [slot2, slot2Filled], [slot3, slot3Filled], [slot4, slot4Filled], [slot5, slot5Filled], [slot6, slot6Filled], [slot7, slot7Filled], [slot8, slot8Filled]] as const;

export function CustomLayoutMenu({ layouts, selectedId, disabled, busy, onCreate, onSelect, onManage }: { readonly layouts: readonly CustomLayout[]; readonly selectedId: string | null; readonly disabled: boolean; readonly busy: boolean; readonly onCreate: () => void; readonly onSelect: (id: string) => void; readonly onManage: () => void }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ left: 12, top: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null), popupRef = useRef<HTMLDivElement>(null);
  const close = (restore = true) => { setOpen(false); if (restore) window.setTimeout(() => triggerRef.current?.focus(), 0); };
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 24), estimatedHeight = Math.min(430, 140 + layouts.length * 48);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: rect.bottom + 8 + estimatedHeight <= window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - estimatedHeight - 8) });
  }, [layouts.length, open]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []); if (!items.length) return;
      event.preventDefault(); const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    const pointer = (event: PointerEvent) => { if (!popupRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) close(false); };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", pointer);
    window.setTimeout(() => popupRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus(), 0);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [open]);
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} className={`icon-control studio-tooltip${selectedId ? " is-selected" : ""}`} data-tooltip="Custom layouts" aria-label="Custom layouts" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><StudioIcon regular={customIcon} filled={customFilledIcon} active={Boolean(selectedId) || open} /></button>
    {open && createPortal(<div ref={popupRef} className="custom-layout-popup" role="menu" aria-label="Saved custom layouts" style={position}>
      <div className="custom-layout-popup__heading"><strong>Custom layouts</strong><span>{layouts.length} / 8</span></div>
      {layouts.map((layout, index) => <button key={layout.id} type="button" role="menuitemradio" aria-checked={selectedId === layout.id} className={selectedId === layout.id ? "is-selected" : ""} disabled={busy} onClick={() => { onSelect(layout.id); close(); }}><StudioIcon regular={slotIcons[index][0]} filled={slotIcons[index][1]} active={selectedId === layout.id} /><span><strong>{layout.displayName}</strong><small>{layout.baseLayoutMode}</small></span></button>)}
      {layouts.length < 8 && <button type="button" role="menuitem" disabled={busy || disabled} onClick={() => { onCreate(); close(); }}><StudioIcon regular={newIcon} filled={newFilledIcon} /><span><strong>Create new layout</strong><small>Snapshot the effective layout</small></span></button>}
      <button type="button" role="menuitem" onClick={() => { onManage(); close(); }}>Manage custom layouts</button>
    </div>, document.body)}
  </>;
}

export function CustomLayoutsSection({ layouts, selectedId, disabled, busyId, onCreate, onSelect, onRename, onMove, onDelete }: { readonly layouts: readonly CustomLayout[]; readonly selectedId: string | null; readonly disabled: boolean; readonly busyId: string; readonly onCreate: () => void; readonly onSelect: (id: string) => void; readonly onRename: (id: string, name: string) => void; readonly onMove: (id: string, direction: -1 | 1) => void; readonly onDelete: (id: string) => void }) {
  return <section className="custom-layout-manager" id="custom-layout-manager" aria-labelledby="custom-layout-manager-title">
    <div className="side-panel-heading"><div><p className="eyebrow">BUILT-IN SNAPSHOTS</p><h3 id="custom-layout-manager-title">Custom layouts</h3></div><span>{layouts.length} / 8 custom layouts</span></div>
    <p className="fine-print">Custom geometry editing will be added in a later Studio milestone.</p>
    <div className="custom-layout-manager__list">{layouts.map((layout, index) => <article key={layout.id} className={selectedId === layout.id ? "is-selected" : ""}>
      <StudioIcon regular={slotIcons[index][0]} filled={slotIcons[index][1]} active={selectedId === layout.id} />
      <label><span className="sr-only">Layout {index + 1} name</span><input defaultValue={layout.displayName} maxLength={120} disabled={disabled || Boolean(busyId)} onBlur={(event) => { if (event.currentTarget.value.trim() && event.currentTarget.value.trim() !== layout.displayName) onRename(layout.id, event.currentTarget.value); }} /><small>{layout.baseLayoutMode} base</small></label>
      <div><button type="button" disabled={disabled || Boolean(busyId)} onClick={() => onSelect(layout.id)}>Apply</button><button type="button" aria-label={`Move ${layout.displayName} earlier`} disabled={disabled || Boolean(busyId) || index === 0} onClick={() => onMove(layout.id, -1)}>Earlier</button><button type="button" aria-label={`Move ${layout.displayName} later`} disabled={disabled || Boolean(busyId) || index === layouts.length - 1} onClick={() => onMove(layout.id, 1)}>Later</button><button type="button" className="is-destructive" disabled={disabled || Boolean(busyId)} onClick={() => onDelete(layout.id)}>Delete</button></div>
    </article>)}</div>
    {layouts.length < 8 && <button type="button" disabled={disabled || Boolean(busyId)} onClick={onCreate}><StudioIcon regular={newIcon} filled={newFilledIcon} /> Create new layout</button>}
  </section>;
}
