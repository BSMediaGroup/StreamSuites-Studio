import { useEffect, useRef, useState } from "react";
import { useStudioAuth } from "../auth/studioAuthContext";
import { StudioIcon } from "./ui/StudioIcon";
import profileIcon from "../../assets/icons/ui/profile.svg";
import adminBadgeIcon from "../../assets/icons/tierbadge-admin.svg";
import developerBadgeIcon from "../../assets/icons/dev-green.svg";
import tierCoreIcon from "../../assets/icons/tierbadge-core.svg";
import tierGoldIcon from "../../assets/icons/tierbadge-gold.svg";
import tierProIcon from "../../assets/icons/tierbadge-pro.svg";

const tierIcons: Record<string, string> = { core: tierCoreIcon, gold: tierGoldIcon, pro: tierProIcon };

function fallbackInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "S";
}

function compactBadge(accountType: string | undefined, tier: string | null | undefined) {
  if (accountType === "admin") return { key: "admin", label: "Administrator", icon: adminBadgeIcon };
  if (accountType === "developer") return { key: "developer", label: "Developer", icon: developerBadgeIcon };
  const key = String(tier || "").trim().toLowerCase();
  return tierIcons[key] ? { key, label: `${key.charAt(0).toUpperCase()}${key.slice(1)} tier`, icon: tierIcons[key] } : null;
}

export function StudioAccountMenu({ onOpenChange }: { readonly onOpenChange?: (open: boolean) => void }) {
  const { access, logout } = useStudioAuth();
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const account = access.account;
  const displayName = account?.displayName ?? account?.userCode ?? "StreamSuites account";
  const badge = compactBadge(account?.accountType, account?.tier);

  useEffect(() => onOpenChange?.(open), [onOpenChange, open]);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
        return;
      }
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
      if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  async function handleLogout() {
    if (logoutPending) return;
    setLogoutPending(true);
    const completed = await logout();
    setLogoutPending(false);
    if (completed) window.location.assign("/login");
  }

  return (
    <div className="studio-account-menu account-widget" ref={rootRef}>
      <button
        className={`studio-account-trigger account-pill account-trigger${open ? " is-open" : ""}${account ? " is-authenticated" : ""}`}
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="studio-account-dropdown"
        aria-label={`Account menu for ${displayName}`}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          setOpen(true);
          window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 0);
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="studio-account-avatar account-avatar" aria-hidden="true">
          {account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : account ? fallbackInitial(displayName) : <StudioIcon regular={profileIcon} />}
        </span>
        <span className="account-text">
          <span className="studio-account-name account-name">{displayName}</span>
          <span className="account-badges">
            {badge && <img className="studio-account-badge account-badge-icon" src={badge.icon} alt={badge.label} title={badge.label} data-badge-key={badge.key} />}
          </span>
        </span>
      </button>
      {open && (
        <div id="studio-account-dropdown" ref={menuRef} className="studio-account-dropdown account-menu" role="menu">
          <div className="account-menu-header">
            <div className="account-menu-name">{displayName}</div>
            <div className="account-menu-role">{account?.accountType ?? "account"}</div>
          </div>
          {account && <div className="account-menu-overview">
            <div className="account-menu-overview-row"><span className="account-menu-overview-label">Account</span><span className="account-menu-overview-value">{account.accountType}</span></div>
            {account.tier && <div className="account-menu-overview-row"><span className="account-menu-overview-label">Tier</span><span className="account-menu-overview-value">{account.tier}</span></div>}
          </div>}
          <div className="account-menu-separator" />
          <button className="account-menu-item is-danger" role="menuitem" type="button" onClick={() => void handleLogout()} disabled={logoutPending}>
            {logoutPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
