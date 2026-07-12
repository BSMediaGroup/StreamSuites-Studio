import { useEffect, useState } from "react";
import { useStudioAuth } from "../auth/studioAuthContext";

export function AuthAccessBanner() {
  const { authGate } = useStudioAuth();
  const [dismissedKey, setDismissedKey] = useState("");
  const gateActive = authGate.mode === "maintenance" || authGate.mode === "development";
  const bannerKey = `${authGate.mode}:${authGate.message}`;

  useEffect(() => {
    if (dismissedKey && dismissedKey !== bannerKey) setDismissedKey("");
  }, [bannerKey, dismissedKey]);

  if (
    authGate.status !== "ready" ||
    !gateActive ||
    !authGate.showLockoutBanner ||
    dismissedKey === bannerKey
  ) return null;

  return (
    <div className="auth-access-banner" role="status">
      <span><strong>{authGate.mode === "development" ? "Development access mode" : "Maintenance"}</strong> {authGate.message}</span>
      <button type="button" aria-label="Dismiss access notice" onClick={() => setDismissedKey(bannerKey)}>×</button>
    </div>
  );
}
