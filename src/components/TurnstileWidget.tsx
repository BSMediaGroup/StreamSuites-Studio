import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { loadTurnstileConfig, type TurnstileConfig } from "../api/studioAuth";
import type { StudioTheme } from "../theme/themeContext";
import { Button } from "./ui/Button";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileWidgetId = string | number;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: StudioTheme;
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
    },
  ): TurnstileWidgetId;
  reset(widgetId: TurnstileWidgetId): void;
  remove(widgetId: TurnstileWidgetId): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstilePhase =
  | "loading"
  | "challenge_required"
  | "ready"
  | "expired"
  | "failed"
  | "provider_unavailable"
  | "not_required";

export interface TurnstileState {
  readonly enabled: boolean | null;
  readonly token: string;
  readonly phase: TurnstilePhase;
}

export interface TurnstileWidgetHandle {
  reset(): void;
  retry(): void;
}

interface TurnstileWidgetProps {
  readonly theme: StudioTheme;
  readonly onStateChange: (state: TurnstileState) => void;
}

let scriptPromise: Promise<TurnstileApi> | null = null;
let configPromise: Promise<TurnstileConfig> | null = null;

function loadScriptOnce(): Promise<TurnstileApi> {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_URL}"]`,
    );
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const finish = () => {
      script!.dataset.turnstileState = "loaded";
      if (window.turnstile?.render) resolve(window.turnstile);
      else reject(new Error("turnstile_script_invalid"));
    };
    const fail = () => {
      script!.dataset.turnstileState = "failed";
      if (created) script?.remove();
      reject(new Error("turnstile_script_unavailable"));
    };

    if (script.dataset.turnstileState === "loaded") {
      finish();
      return;
    }
    if (script.dataset.turnstileState === "failed") {
      fail();
      return;
    }
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

function loadConfigOnce(): Promise<TurnstileConfig> {
  if (!configPromise) {
    configPromise = loadTurnstileConfig().finally(() => {
      configPromise = null;
    });
  }
  return configPromise;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ theme, onStateChange }, ref) {
    const slotRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
    const apiRef = useRef<TurnstileApi | null>(null);
    const onStateChangeRef = useRef(onStateChange);
    const [config, setConfig] = useState<TurnstileConfig | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [state, setState] = useState<TurnstileState>({
      enabled: null,
      token: "",
      phase: "loading",
    });

    onStateChangeRef.current = onStateChange;

    function publish(next: TurnstileState) {
      setState(next);
      onStateChangeRef.current(next);
    }

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current !== null && apiRef.current?.reset) {
          apiRef.current.reset(widgetIdRef.current);
          publish({ enabled: true, token: "", phase: "challenge_required" });
        }
      },
      retry() {
        setConfig(null);
        setRetryKey((current) => current + 1);
      },
    }));

    useEffect(() => {
      let mounted = true;
      publish({ enabled: null, token: "", phase: "loading" });
      void loadConfigOnce()
        .then((nextConfig) => {
          if (mounted) setConfig(nextConfig);
        })
        .catch(() => {
          if (mounted) publish({ enabled: null, token: "", phase: "provider_unavailable" });
        });
      return () => {
        mounted = false;
      };
    }, [retryKey]);

    useEffect(() => {
      if (!config) return;
      if (!config.enabled) {
        publish({ enabled: false, token: "", phase: "not_required" });
        return;
      }
      const slot = slotRef.current;
      if (!slot) return;

      let mounted = true;
      let renderedId: TurnstileWidgetId | null = null;
      publish({ enabled: true, token: "", phase: "loading" });
      void loadScriptOnce()
        .then((turnstile) => {
          if (!mounted) return;
          apiRef.current = turnstile;
          renderedId = turnstile.render(slot, {
            sitekey: config.sitekey,
            theme,
            callback(token) {
              if (!mounted) return;
              const normalizedToken = String(token || "").trim();
              publish({
                enabled: true,
                token: normalizedToken,
                phase: normalizedToken ? "ready" : "challenge_required",
              });
            },
            "expired-callback"() {
              if (mounted) publish({ enabled: true, token: "", phase: "expired" });
            },
            "error-callback"() {
              if (mounted) publish({ enabled: true, token: "", phase: "failed" });
            },
          });
          widgetIdRef.current = renderedId;
          publish({ enabled: true, token: "", phase: "challenge_required" });
        })
        .catch(() => {
          if (mounted) publish({ enabled: true, token: "", phase: "provider_unavailable" });
        });

      return () => {
        mounted = false;
        const widgetId = renderedId ?? widgetIdRef.current;
        if (widgetId !== null && apiRef.current?.remove) apiRef.current.remove(widgetId);
        if (widgetIdRef.current === widgetId) widgetIdRef.current = null;
        slot.replaceChildren();
      };
    }, [config, theme]);

    const copy: Record<TurnstilePhase, string> = {
      loading: "Loading security check…",
      challenge_required: "Complete the security check to continue.",
      ready: "Security check ready.",
      expired: "The security check expired. Complete it again.",
      failed: "The security challenge failed. Retry the check.",
      provider_unavailable: "The security provider is unavailable. Retry the check.",
      not_required: "Runtime/Auth does not currently require a security challenge.",
    };
    const retryable = state.phase === "failed" || state.phase === "provider_unavailable";

    return (
      <section className="turnstile-panel" aria-label="Cloudflare Turnstile security check">
        <div className="turnstile-slot" ref={slotRef} />
        <div className="turnstile-panel__status" aria-live="polite" data-phase={state.phase}>
          <span>{copy[state.phase]}</span>
          {retryable && (
            <Button variant="secondary" onClick={() => setRetryKey((current) => current + 1)}>
              Retry security check
            </Button>
          )}
        </div>
      </section>
    );
  },
);
