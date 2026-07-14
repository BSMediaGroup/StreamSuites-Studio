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
export const STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY = "streamsuites_studio_room_production_sidebar";
export const defaultPresentationPreferences: PresentationPreferences = {
  sidebar: "collapsed",
  header: "standard",
  cinematic: "off",
  noticeDuration: 5000,
};

const sidebarModes: readonly SidebarMode[] = ["expanded", "collapsed", "hidden"];
const headerModes: readonly HeaderMode[] = ["standard", "slim", "auto-hide"];
const noticeDurations: readonly NoticeDuration[] = [3000, 5000, 8000, 12000, "manual"];

export function parseContextSidebarMode(value: string | null): SidebarMode {
  if (!value) return defaultPresentationPreferences.sidebar;
  try {
    const mode = (JSON.parse(value) as { mode?: unknown }).mode;
    return sidebarModes.includes(mode as SidebarMode) ? mode as SidebarMode : defaultPresentationPreferences.sidebar;
  } catch {
    return defaultPresentationPreferences.sidebar;
  }
}

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
    const preferences = parsePresentationPreferences(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY));
    const dedicatedSidebar = window.localStorage.getItem(STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY);
    return dedicatedSidebar === null ? preferences : { ...preferences, sidebar: parseContextSidebarMode(dedicatedSidebar) };
  } catch {
    return defaultPresentationPreferences;
  }
}

export function persistPresentationPreferences(value: PresentationPreferences) {
  try {
    window.localStorage.setItem(STUDIO_PRESENTATION_STORAGE_KEY, JSON.stringify(value));
    window.localStorage.setItem(STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY, JSON.stringify({ mode: value.sidebar }));
  } catch {
    // Storage may be unavailable; presentation preferences remain usable in memory.
  }
}
