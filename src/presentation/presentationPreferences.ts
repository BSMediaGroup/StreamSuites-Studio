export type SidebarMode = "expanded" | "collapsed" | "hidden";
export type HeaderMode = "standard" | "slim" | "auto-hide";
export type CinematicMode = "off" | "on";
export type NoticeDuration = 3000 | 5000 | 8000 | 12000 | "manual";

export interface PresentationPreferences {
  readonly sidebar: SidebarMode;
  readonly header: HeaderMode;
  readonly cinematic: CinematicMode;
  readonly noticeDuration: NoticeDuration;
}

export const STUDIO_PRESENTATION_STORAGE_KEY = "streamsuites_studio_presentation";
export const defaultPresentationPreferences: PresentationPreferences = {
  sidebar: "collapsed",
  header: "standard",
  cinematic: "off",
  noticeDuration: 5000,
};

const sidebarModes: readonly SidebarMode[] = ["expanded", "collapsed", "hidden"];
const headerModes: readonly HeaderMode[] = ["standard", "slim", "auto-hide"];
const noticeDurations: readonly NoticeDuration[] = [3000, 5000, 8000, 12000, "manual"];

export function parsePresentationPreferences(value: string | null): PresentationPreferences {
  if (!value) return defaultPresentationPreferences;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      sidebar: parsed.sidebar === "compact" ? "collapsed" : sidebarModes.includes(parsed.sidebar as SidebarMode) ? parsed.sidebar as SidebarMode : defaultPresentationPreferences.sidebar,
      header: headerModes.includes(parsed.header as HeaderMode) ? parsed.header as HeaderMode : defaultPresentationPreferences.header,
      cinematic: parsed.cinematic === "on" || parsed.cinematic === "off" ? parsed.cinematic : defaultPresentationPreferences.cinematic,
      noticeDuration: noticeDurations.includes(parsed.noticeDuration as NoticeDuration) ? parsed.noticeDuration as NoticeDuration : defaultPresentationPreferences.noticeDuration,
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
