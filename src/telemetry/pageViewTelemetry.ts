import { publicStudioConfig } from "../config/env";

type StudioRouterState = Readonly<{ location: Readonly<{ pathname: string }> }>;
type StudioRouterLike = {
  state: StudioRouterState;
  subscribe(listener: (state: StudioRouterState) => void): () => void;
};
type PageViewTransport = (endpoint: string, body: string) => void;

const installedRouters = new WeakSet<object>();

export function normalizeStudioPageRoute(value: string): string {
  let path = "/";
  try {
    path = new URL(String(value || "/"), "https://studio.streamsuites.app").pathname.toLowerCase();
  } catch {
    return "/other";
  }
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (["/", "/login", "/studio", "/join"].includes(path)) return path;
  if (path.startsWith("/studio/rooms/")) return "/studio/rooms/:room";
  if (path.startsWith("/join/")) return "/join/:invite";
  return "/other";
}

function createEventId(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return `pv-${crypto.randomUUID()}`;
  } catch {
    // Use the bounded non-identity fallback below.
  }
  return `pv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function browserTransport(endpoint: string, body: string): void {
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
  } catch {
    // Fall through to fetch.
  }
  try {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Telemetry never affects Studio.
  }
}

export function createStudioPageViewReporter(transport: PageViewTransport = browserTransport) {
  const endpoint = new URL(
    "/api/public/analytics/page-visit",
    `${publicStudioConfig.runtimeApiBaseUrl}/`,
  ).toString();
  let lastRoute = "";
  return (routeCandidate: string): boolean => {
    const path = normalizeStudioPageRoute(routeCandidate);
    if (path === lastRoute) return false;
    lastRoute = path;
    try {
      transport(endpoint, JSON.stringify({ surface: "studio", path, event_id: createEventId() }));
    } catch {
      // A telemetry transport failure must not escape into Studio routing.
    }
    return true;
  };
}

export function installStudioPageViewTelemetry(router: StudioRouterLike): void {
  if (installedRouters.has(router)) return;
  installedRouters.add(router);
  const report = createStudioPageViewReporter();
  queueMicrotask(() => report(router.state.location.pathname));
  router.subscribe((state) => {
    report(state.location.pathname);
  });
}
