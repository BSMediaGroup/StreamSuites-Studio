import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createLoadingAccessState,
  createLoadingAuthAccessGateState,
  loadAuthAccessGate,
  loadStudioAccess,
  logoutFromStudio,
  unlockAuthAccess,
} from "../api/studioAuth";
import type { AuthAccessGateState, StudioAccessState } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { StudioAuthContext } from "./studioAuthContext";

export function StudioAuthProvider({ children }: { readonly children: ReactNode }) {
  const [access, setAccess] = useState<StudioAccessState>(createLoadingAccessState);
  const [authGate, setAuthGate] = useState<AuthAccessGateState>(createLoadingAuthAccessGateState);
  useGlobalActivity(access.status === "loading" || authGate.status === "loading", "Resolving authentication");

  const refresh = useCallback(async () => {
    setAccess(createLoadingAccessState());
    const controller = new AbortController();
    setAccess(await loadStudioAccess(controller.signal));
  }, []);

  const refreshAuthGate = useCallback(async () => {
    setAuthGate((current) => ({ ...current, status: "loading" }));
    const next = await loadAuthAccessGate(authGate);
    setAuthGate(next);
  }, [authGate]);

  const unlockAuthGate = useCallback(async (code: string) => {
    const result = await unlockAuthAccess(code);
    if (!result.ok) return result;
    const unlocked: AuthAccessGateState = {
      status: "ready",
      mode: result.mode,
      message: result.message,
      showLockoutBanner: authGate.showLockoutBanner,
      loginAllowed: false,
      bypassEnabled: true,
      bypassUnlocked: true,
      unlockExpiresAt: result.expiresAt,
    };
    setAuthGate(await loadAuthAccessGate(unlocked));
    return { ok: true as const };
  }, [authGate.showLockoutBanner]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      loadStudioAccess(controller.signal),
      loadAuthAccessGate(null, controller.signal),
    ])
      .then(([nextAccess, nextGate]) => {
        setAccess(nextAccess);
        setAuthGate(nextGate);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccess({
            status: "unavailable",
            source: "runtime-auth",
            reasonCode: "runtime_request_failed",
            account: null,
            stage: "ALPHA",
            activeTesterLimit: 25,
            errorMessage: "Runtime/Auth is currently unavailable.",
          });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!authGate.bypassUnlocked || !authGate.unlockExpiresAt) return;
    const delay = Date.parse(authGate.unlockExpiresAt) - Date.now();
    if (delay <= 0) {
      setAuthGate((current) => ({ ...current, bypassUnlocked: false, unlockExpiresAt: null }));
      return;
    }
    const timer = window.setTimeout(() => {
      setAuthGate((current) => ({ ...current, bypassUnlocked: false, unlockExpiresAt: null }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [authGate.bypassUnlocked, authGate.unlockExpiresAt]);

  const logout = useCallback(async () => {
    const result = await logoutFromStudio();
    if (!result.ok) return false;
    setAccess({
      status: "unauthenticated",
      source: "runtime-auth",
      reasonCode: "logged_out",
      account: null,
      stage: "ALPHA",
      activeTesterLimit: 25,
    });
    return true;
  }, []);

  const value = useMemo(
    () => ({ access, authGate, refresh, refreshAuthGate, unlockAuthGate, logout }),
    [access, authGate, logout, refresh, refreshAuthGate, unlockAuthGate],
  );
  return <StudioAuthContext.Provider value={value}>{children}</StudioAuthContext.Provider>;
}
