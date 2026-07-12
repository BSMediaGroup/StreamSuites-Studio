import { createContext, useContext } from "react";
import type { AuthAccessGateState, StudioAccessState } from "../domain/studio";
import type { SafeApiError } from "../api/contracts";

export interface StudioAuthContextValue {
  readonly access: StudioAccessState;
  readonly authGate: AuthAccessGateState;
  readonly refresh: () => Promise<void>;
  readonly refreshAuthGate: () => Promise<void>;
  readonly unlockAuthGate: (code: string) => Promise<{ ok: true } | { ok: false; error: SafeApiError }>;
  readonly logout: () => Promise<boolean>;
}

export const StudioAuthContext = createContext<StudioAuthContextValue | null>(null);

export function useStudioAuth(): StudioAuthContextValue {
  const value = useContext(StudioAuthContext);
  if (!value) throw new Error("useStudioAuth must be used within StudioAuthProvider");
  return value;
}
