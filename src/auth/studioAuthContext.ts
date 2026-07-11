import { createContext, useContext } from "react";
import type { StudioAccessState } from "../domain/studio";

export interface StudioAuthContextValue {
  readonly access: StudioAccessState;
  readonly refresh: () => Promise<void>;
  readonly logout: () => Promise<boolean>;
}

export const StudioAuthContext = createContext<StudioAuthContextValue | null>(null);

export function useStudioAuth(): StudioAuthContextValue {
  const value = useContext(StudioAuthContext);
  if (!value) throw new Error("useStudioAuth must be used within StudioAuthProvider");
  return value;
}
