import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchRuntimeVersion } from "../api/runtimeVersion";
import { publicStudioConfig } from "../config/env";

type RuntimeState = "loading" | "online" | "degraded";

export function StudioFooter() {
  const location = useLocation();
  const [version, setVersion] = useState("Runtime version loading");
  const [build, setBuild] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("loading");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);

  const closeStatus = useCallback((restoreFocus = false) => {
    setStatusOpen(false);
    if (restoreFocus) window.setTimeout(() => statusTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchRuntimeVersion(controller.signal),
      fetch(new URL("/api/health", `${publicStudioConfig.runtimeApiBaseUrl}/`), { signal: controller.signal, credentials: "include" }).then((response) => response.ok),
    ]).then(([versionResult, healthy]) => {
      setVersion(versionResult.ok ? `v${versionResult.value.version}` : "Version unavailable");
      setBuild(versionResult.ok ? versionResult.value.build : null);
      setRuntimeState(healthy ? "online" : "degraded");
    }).catch(() => setRuntimeState("degraded"));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setStatusOpen(false);
  }, [build, location.hash, location.key, location.pathname, location.search, runtimeState, version]);

  useEffect(() => {
    if (!statusOpen) return;
    const pointerDown = (event: PointerEvent) => {
      if (!statusRef.current?.contains(event.target as Node)) closeStatus();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeStatus(true);
    };
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("keydown", keyDown);
    };
  }, [closeStatus, statusOpen]);

  const statusState = runtimeState === "online" ? "operational" : runtimeState === "degraded" ? "partial" : "unknown";
  const statusSummary = runtimeState === "online"
    ? "Runtime/Auth is reachable."
    : runtimeState === "loading"
      ? "Checking Runtime/Auth."
      : "Runtime/Auth is unavailable or degraded.";

  return (
    <footer className="studio-global-footer footer-shell">
      <div className="footer-bar">
        <nav className="footer-links" aria-label="Studio footer navigation">
          <a href="https://streamsuites.app/support.html">/support</a>
          <a href="https://streamsuites.app/privacy.html">/privacy</a>
          <a href="https://streamsuites.app/about.html">/about</a>
        </nav>
        <a className="footer-copyright" href="https://brainstream.media" target="_blank" rel="noopener noreferrer">© 2026 Brainstream Media Group</a>
        <div className="footer-meta">
          <div className="footer-status" data-status-slot>
            <div
              ref={statusRef}
              id="ss-status-indicator"
              className="ss-status-indicator"
              data-state={statusState}
              data-expanded={String(statusOpen)}
              onPointerLeave={() => closeStatus()}
              onBlurCapture={(event) => {
                if (!statusRef.current?.contains(event.relatedTarget as Node)) closeStatus();
              }}
            >
              <button
                ref={statusTriggerRef}
                className="ss-status-toggle"
                type="button"
                aria-expanded={statusOpen}
                aria-controls="ss-status-details"
                aria-label="Service status details"
                onClick={() => setStatusOpen((open) => !open)}
              >
                <span className="ss-status-dot" aria-hidden="true" />
                <span className="ss-status-label">Status</span>
              </button>
              <div id="ss-status-details" className="ss-status-details" hidden={!statusOpen}>
                <div className="ss-status-summary">{statusSummary}</div>
                <a className="ss-status-link" href="https://streamsuites.statuspage.io/" target="_blank" rel="noreferrer">View full status →</a>
              </div>
            </div>
          </div>
          <span className="footer-version-tooltip-container">
            <a className="footer-version" href="https://streamsuites.app/changelog" aria-describedby="studio-footer-version-tooltip">{version}</a>
            <div className="footer-version-tooltip" id="studio-footer-version-tooltip" role="tooltip">
              <div className="footer-version-tooltip-line">StreamSuites Runtime {version}</div>
              {build && <div className="footer-version-tooltip-line">Build {build}</div>}
              <a className="footer-version-tooltip-link" href="https://streamsuites.app/changelog">View changelog</a>
            </div>
          </span>
        </div>
      </div>
    </footer>
  );
}
