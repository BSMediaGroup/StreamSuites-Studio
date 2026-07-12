import { useEffect, useRef, useState } from "react";
import { useStudioAuth } from "../auth/studioAuthContext";

function fallbackInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "S";
}

export function StudioAccountMenu() {
  const { access, logout } = useStudioAuth();
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const account = access.account;
  const displayName = account?.displayName ?? account?.userCode ?? "StreamSuites account";

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
        onClick={() => setOpen((current) => !current)}
      >
        <span className="studio-account-avatar" aria-hidden="true">
          {account?.avatarUrl ? <img src={account.avatarUrl} alt="" /> : fallbackInitial(displayName)}
        </span>
        <span className="studio-account-name">{displayName}</span>
        <span className="studio-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id="studio-account-dropdown" className="studio-account-dropdown" role="menu">
          <div className="studio-account-dropdown__identity">
            <strong>{displayName}</strong>
            <span>{account?.accountType ?? "account"}{account?.tier ? ` · ${account.tier}` : ""}</span>
          </div>
          <button role="menuitem" type="button" onClick={() => void handleLogout()} disabled={logoutPending}>
            {logoutPending ? "Logging out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
