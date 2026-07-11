import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createLoadingAccessState,
  loadStudioAccess,
  logoutFromStudio,
} from "../api/studioAuth";
import type { StudioAccessState } from "../domain/studio";
import { StudioAuthContext } from "./studioAuthContext";

export function StudioAuthProvider({ children }: { readonly children: ReactNode }) {
  const [access, setAccess] = useState<StudioAccessState>(createLoadingAccessState);

  const refresh = useCallback(async () => {
    setAccess(createLoadingAccessState());
    const controller = new AbortController();
    setAccess(await loadStudioAccess(controller.signal));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStudioAccess(controller.signal)
      .then(setAccess)
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

  const value = useMemo(() => ({ access, refresh, logout }), [access, logout, refresh]);
  return <StudioAuthContext.Provider value={value}>{children}</StudioAuthContext.Provider>;
}
