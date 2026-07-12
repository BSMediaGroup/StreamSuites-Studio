import { useEffect, useState } from "react";
import { fetchRuntimeVersion } from "../api/runtimeVersion";
import { publicStudioConfig } from "../config/env";

type RuntimeState = "loading" | "online" | "degraded";

export function StudioFooter() {
  const [version, setVersion] = useState("Runtime version loading");
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchRuntimeVersion(controller.signal),
      fetch(new URL("/api/health", `${publicStudioConfig.runtimeApiBaseUrl}/`), { signal: controller.signal, credentials: "include" }).then((response) => response.ok),
    ]).then(([versionResult, healthy]) => {
      setVersion(versionResult.ok ? `v${versionResult.value.version}` : "Version unavailable");
      setRuntimeState(healthy ? "online" : "degraded");
    }).catch(() => setRuntimeState("degraded"));
    return () => controller.abort();
  }, []);

  return (
    <footer className="studio-global-footer">
      <span>StreamSuites Studio</span><span aria-hidden="true">•</span><span>ALPHA</span><span aria-hidden="true">•</span><span>{version}</span><span aria-hidden="true">•</span>
      <span className={`runtime-footer-state runtime-footer-state--${runtimeState}`}><i aria-hidden="true" /> Runtime/Auth {runtimeState === "loading" ? "checking" : runtimeState}</span>
    </footer>
  );
}
