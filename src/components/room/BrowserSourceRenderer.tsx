import { useEffect } from "react";
import type { CSSProperties } from "react";
import type { BrowserSource } from "../../domain/studio";

const deniedPermissions = "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; payment 'none'; usb 'none'; bluetooth 'none'; midi 'none'; display-capture 'none'; autoplay 'none'";

export function BrowserSourceRenderer({ source, mode, interactionActive = false, onExitInteraction }: { readonly source: BrowserSource; readonly mode: "stage" | "preview"; readonly interactionActive?: boolean; readonly onExitInteraction?: () => void }) {
  useEffect(() => {
    if (!interactionActive || !onExitInteraction) return;
    const exit = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onExitInteraction(); } };
    document.addEventListener("keydown", exit, true);
    return () => document.removeEventListener("keydown", exit, true);
  }, [interactionActive, onExitInteraction]);
  if (!source.url || source.location === "disabled") return null;
  const style = mode === "stage" ? ({ "--browser-x": source.scene.x, "--browser-y": source.scene.y, "--browser-width": source.scene.width, "--browser-height": source.scene.height, "--browser-layer": source.scene.zIndex, opacity: source.opacity } as CSSProperties) : undefined;
  return <div className={`browser-source browser-source--${mode}${interactionActive ? " is-interacting" : ""}`} style={style} data-source-id={source.id} data-testid={`browser-source-${mode}`}>
    <iframe key={`${source.id}:${source.refreshRevision}`} title={source.displayName} src={source.url} width={source.viewportWidth} height={source.viewportHeight} loading={mode === "preview" ? "lazy" : "eager"} referrerPolicy="no-referrer" sandbox="allow-scripts" allow={deniedPermissions} tabIndex={interactionActive ? 0 : -1} />
    {mode === "stage" && interactionActive && <button type="button" className="browser-source__exit" onClick={onExitInteraction}>Exit interaction</button>}
  </div>;
}
