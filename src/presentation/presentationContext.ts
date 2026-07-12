import { createContext, useContext } from "react";
import type { CinematicMode, HeaderMode, PresentationPreferences, SidebarMode } from "./presentationPreferences";

export interface PresentationContextValue {
  readonly preferences: PresentationPreferences;
  readonly setSidebar: (mode: SidebarMode) => void;
  readonly cycleSidebar: () => void;
  readonly setHeader: (mode: HeaderMode) => void;
  readonly setCinematic: (mode: CinematicMode) => void;
  readonly toggleCinematic: () => void;
}

export const PresentationContext = createContext<PresentationContextValue | null>(null);

export function usePresentationPreferences() {
  const value = useContext(PresentationContext);
  if (!value) throw new Error("Presentation preferences require PresentationProvider.");
  return value;
}
