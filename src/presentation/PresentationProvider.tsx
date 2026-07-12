import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PresentationContext } from "./presentationContext";
import { loadPresentationPreferences, persistPresentationPreferences, type CinematicMode, type HeaderMode, type SidebarMode } from "./presentationPreferences";

export function PresentationProvider({ children }: { readonly children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadPresentationPreferences);

  useEffect(() => persistPresentationPreferences(preferences), [preferences]);

  const setSidebar = useCallback((sidebar: SidebarMode) => setPreferences((current) => ({ ...current, sidebar })), []);
  const cycleSidebar = useCallback(() => setPreferences((current) => ({
    ...current,
    sidebar: current.sidebar === "expanded" ? "compact" : current.sidebar === "compact" ? "hidden" : "expanded",
  })), []);
  const setHeader = useCallback((header: HeaderMode) => setPreferences((current) => ({ ...current, header })), []);
  const setCinematic = useCallback((cinematic: CinematicMode) => setPreferences((current) => ({ ...current, cinematic })), []);
  const toggleCinematic = useCallback(() => setPreferences((current) => ({ ...current, cinematic: current.cinematic === "on" ? "off" : "on" })), []);

  const value = useMemo(() => ({ preferences, setSidebar, cycleSidebar, setHeader, setCinematic, toggleCinematic }), [preferences, setSidebar, cycleSidebar, setHeader, setCinematic, toggleCinematic]);
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}
