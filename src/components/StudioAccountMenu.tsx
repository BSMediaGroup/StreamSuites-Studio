import { useEffect, useRef, useState } from "react";
import { useStudioAuth } from "../auth/studioAuthContext";
import adminRoleIcon from "../../assets/icons/ui/ss-admin.svg";
import creatorRoleIcon from "../../assets/icons/ui/ss-creator.svg";
import developerRoleIcon from "../../assets/icons/ui/ss-developer.svg";
import publicRoleIcon from "../../assets/icons/ui/ss-public.svg";
import adminShieldIcon from "../../assets/icons/ui/adminactionshield.svg";
import tierAdminIcon from "../../assets/icons/tierbadge-admin.svg";
import tierCoreIcon from "../../assets/icons/tierbadge-core.svg";
import tierGoldIcon from "../../assets/icons/tierbadge-gold.svg";
import tierProIcon from "../../assets/icons/tierbadge-pro.svg";

const roleIcons = { admin: adminRoleIcon, creator: creatorRoleIcon, developer: developerRoleIcon, public: publicRoleIcon };
const tierIcons: Record<string, string> = { ADMIN: tierAdminIcon, CORE: tierCoreIcon, GOLD: tierGoldIcon, PRO: tierProIcon };

function fallbackInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "S";
}

export function StudioAccountMenu({ onOpenChange }: { readonly onOpenChange?: (open: boolean) => void }) {
  const { access, logout } = useStudioAuth();
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const account = access.account;
  const displayName = account?.displayName ?? account?.userCode ?? "StreamSuites account";
  const roleIcon = account ? roleIcons[account.accountType] : publicRoleIcon;
  const tierIcon = account?.tier ? tierIcons[account.tier.toUpperCase()] : undefined;

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
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
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
    <div className="studio-account-menu" ref={rootRef}>
      <button
        className="studio-account-trigger"
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="studio-account-dropdown"
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="studio-account-avatar" aria-hidden="true">
          {account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : fallbackInitial(displayName)}
        </span>
        <span className="studio-account-name">{displayName}</span>
        {account && <img className="studio-account-badge" src={roleIcon} alt={`${account.accountType} account`} title={`${account.accountType} account`} />}
        {account?.accountType === "admin" && <img className="studio-account-badge" src={adminShieldIcon} alt="Administrator" title="Administrator" />}
        {tierIcon && <img className="studio-account-badge" src={tierIcon} alt={`${account?.tier} tier`} title={`${account?.tier} tier`} />}
      </button>
      {open && (
        <div id="studio-account-dropdown" className="studio-account-dropdown" role="menu">
          <div className="studio-account-dropdown__identity">
            <span className="studio-account-avatar" aria-hidden="true">{account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : fallbackInitial(displayName)}</span>
            <strong>{displayName}</strong>
            <span>Account type: {account?.accountType ?? "account"}</span>
            <span>Tier: {account?.tier ?? "Standard"}</span>
          </div>
          <button role="menuitem" type="button" onClick={() => void handleLogout()} disabled={logoutPending}>
            {logoutPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
