import { useEffect, useState } from "react";
import { fetchRuntimeVersion } from "../api/runtimeVersion";
import { publicStudioConfig } from "../config/env";

type RuntimeState = "loading" | "online" | "degraded";

export function StudioFooter() {
  const [version, setVersion] = useState("Runtime version loading");
  const [build, setBuild] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("loading");
  const [statusOpen, setStatusOpen] = useState(false);

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
          <div className="footer-status">
            <div className="studio-runtime-status" data-state={runtimeState === "online" ? "operational" : runtimeState === "degraded" ? "partial" : "unknown"}>
              <button className="studio-runtime-status__toggle" type="button" aria-expanded={statusOpen} aria-controls="studio-runtime-status-details" onClick={() => setStatusOpen((open) => !open)}>
                <span className="studio-runtime-status__dot" aria-hidden="true" />
                <span>Runtime/Auth {runtimeState === "loading" ? "checking" : runtimeState}</span>
              </button>
              <div id="studio-runtime-status-details" className="studio-runtime-status__details" hidden={!statusOpen}>
                <strong>{runtimeState === "online" ? "Runtime/Auth is reachable" : runtimeState === "loading" ? "Checking Runtime/Auth" : "Runtime/Auth is unavailable or degraded"}</strong>
                <span>Studio remains fail-closed and OFF AIR when canonical health cannot be confirmed.</span>
              </div>
            </div>
          </div>
          <span className="footer-version-tooltip-container">
            <a className="footer-version" href="https://streamsuites.app/changelog" aria-describedby="studio-footer-version-tooltip">{version}</a>
            <span className="footer-version-tooltip" id="studio-footer-version-tooltip" role="tooltip">
              <span className="footer-version-tooltip-line">StreamSuites Runtime {version}</span>
              {build && <span className="footer-version-tooltip-line">Build {build}</span>}
              <a className="footer-version-tooltip-link" href="https://streamsuites.app/changelog">View changelog</a>
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
