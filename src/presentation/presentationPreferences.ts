export type SidebarMode = "expanded" | "compact" | "hidden";
export type HeaderMode = "standard" | "slim" | "auto-hide";
export type CinematicMode = "off" | "on";

export interface PresentationPreferences {
  readonly sidebar: SidebarMode;
  readonly header: HeaderMode;
  readonly cinematic: CinematicMode;
}

export const STUDIO_PRESENTATION_STORAGE_KEY = "streamsuites_studio_presentation";
export const defaultPresentationPreferences: PresentationPreferences = {
  sidebar: "expanded",
  header: "standard",
  cinematic: "off",
};

const sidebarModes: readonly SidebarMode[] = ["expanded", "compact", "hidden"];
const headerModes: readonly HeaderMode[] = ["standard", "slim", "auto-hide"];

export function parsePresentationPreferences(value: string | null): PresentationPreferences {
  if (!value) return defaultPresentationPreferences;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      sidebar: sidebarModes.includes(parsed.sidebar as SidebarMode) ? parsed.sidebar as SidebarMode : defaultPresentationPreferences.sidebar,
      header: headerModes.includes(parsed.header as HeaderMode) ? parsed.header as HeaderMode : defaultPresentationPreferences.header,
      cinematic: parsed.cinematic === "on" || parsed.cinematic === "off" ? parsed.cinematic : defaultPresentationPreferences.cinematic,
    };
  } catch {
    return defaultPresentationPreferences;
  }
}

export function loadPresentationPreferences(): PresentationPreferences {
  try {
    return parsePresentationPreferences(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY));
  } catch {
    return defaultPresentationPreferences;
  }
}

export function persistPresentationPreferences(value: PresentationPreferences) {
  try {
    window.localStorage.setItem(STUDIO_PRESENTATION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; presentation preferences remain usable in memory.
  }
}
