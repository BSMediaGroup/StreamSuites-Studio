import { publicStudioConfig } from "../config/env";
import type {
  StreamSuitesAccountType,
  StudioAccessState,
  StudioSessionAccount,
} from "../domain/studio";
import type { SafeApiError } from "./contracts";

const ACCOUNT_TYPES = new Set<StreamSuitesAccountType>([
  "admin",
  "creator",
  "developer",
  "public",
]);

const loadingState: StudioAccessState = {
  status: "loading",
  source: "runtime-auth",
  reasonCode: "loading",
  account: null,
  stage: "ALPHA",
  activeTesterLimit: 25,
};

export function createLoadingAccessState(): StudioAccessState {
  return loadingState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accountType(value: unknown): StreamSuitesAccountType | null {
  const normalized = stringOrNull(value)?.toLowerCase() as StreamSuitesAccountType | undefined;
  return normalized && ACCOUNT_TYPES.has(normalized) ? normalized : null;
}

function apiUrl(path: string): string {
  return new URL(path, `${publicStudioConfig.runtimeApiBaseUrl}/`).toString();
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function requestError(code: string, message: string, status?: number): SafeApiError {
  return { code, message, status, retryable: !status || status >= 500 };
}

export interface TurnstileConfig {
  readonly enabled: boolean;
  readonly runtimeEnabled: boolean;
  readonly configured: boolean;
  readonly sitekey: string;
}

export async function loadTurnstileConfig(signal?: AbortSignal): Promise<TurnstileConfig> {
  const response = await fetch(apiUrl("/auth/turnstile/config"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("turnstile_config_unavailable");
  const payload = await readPayload(response);
  if (!isRecord(payload)) throw new Error("turnstile_config_invalid");
  const sitekey = stringOrNull(payload.sitekey) ?? "";
  const enabled = payload.enabled === true;
  if (enabled && !sitekey) throw new Error("turnstile_config_invalid");
  return {
    enabled,
    runtimeEnabled: payload.runtime_enabled !== false,
    configured: payload.configured === true,
    sitekey,
  };
}

function unavailable(error: SafeApiError): StudioAccessState {
  return {
    status: "unavailable",
    source: "runtime-auth",
    reasonCode: error.code,
    account: null,
    stage: "ALPHA",
    activeTesterLimit: 25,
    errorMessage: error.message,
  };
}

function parseSessionAccount(payload: unknown): StudioSessionAccount | null {
  if (!isRecord(payload) || payload.authenticated !== true || !isRecord(payload.user)) return null;
  const user = payload.user;
  const type = accountType(user.role ?? user.account_type ?? user.access_class);
  const id = stringOrNull(user.internal_id ?? user.id);
  if (!type || !id) return null;
  return {
    id,
    userCode: stringOrNull(user.user_code),
    displayName: stringOrNull(user.display_name),
    avatarUrl: stringOrNull(user.avatar_url ?? user.profile_image_url),
    accountType: type,
    tier: stringOrNull(user.tier ?? user.effective_tier),
  };
}

export function normalizeStudioAccess(
  sessionPayload: unknown,
  accessPayload: unknown,
  accessStatus: number,
): StudioAccessState {
  const account = parseSessionAccount(sessionPayload);
  if (!isRecord(accessPayload)) {
    return unavailable(
      requestError("invalid_access_response", "Runtime/Auth returned an invalid Studio access response."),
    );
  }
  const reasonCode = stringOrNull(accessPayload.reason_code) ?? "access_unconfirmed";
  const testerLimit =
    typeof accessPayload.active_tester_limit === "number" && accessPayload.active_tester_limit > 0
      ? accessPayload.active_tester_limit
      : 25;
  const base = {
    source: "runtime-auth" as const,
    reasonCode,
    account,
    stage: "ALPHA" as const,
    activeTesterLimit: testerLimit,
  };
  if (accessStatus === 401 || accessPayload.authenticated === false) {
    return { ...base, status: "unauthenticated", account: null };
  }
  if (accessStatus >= 500 || reasonCode === "service_unavailable") {
    return {
      ...base,
      status: "unavailable",
      errorMessage: "Runtime/Auth could not confirm Studio access. Please try again.",
    };
  }
  if (reasonCode === "account_suspended" || reasonCode === "account_ineligible") {
    return { ...base, status: "restricted" };
  }
  if (accessPayload.access_allowed === true && account) {
    return { ...base, status: "allowed" };
  }
  return { ...base, status: "denied" };
}

export async function loadStudioAccess(signal?: AbortSignal): Promise<StudioAccessState> {
  try {
    const sessionResponse = await fetch(apiUrl("/auth/session"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    const sessionPayload = await readPayload(sessionResponse);
    if (sessionResponse.status === 401) {
      const reason = isRecord(sessionPayload) ? stringOrNull(sessionPayload.reason) : null;
      return {
        status: reason === "inactive_account" || reason === "email_unverified" ? "restricted" : "unauthenticated",
        source: "runtime-auth",
        reasonCode: reason ?? "unauthenticated",
        account: null,
        stage: "ALPHA",
        activeTesterLimit: 25,
      };
    }
    if (!sessionResponse.ok || !parseSessionAccount(sessionPayload)) {
      return unavailable(
        requestError(
          "session_unavailable",
          "Runtime/Auth could not confirm the current StreamSuites session.",
          sessionResponse.status,
        ),
      );
    }

    const accessResponse = await fetch(apiUrl("/api/studio/access"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    return normalizeStudioAccess(sessionPayload, await readPayload(accessResponse), accessResponse.status);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return unavailable(
      requestError("runtime_request_failed", "Runtime/Auth is currently unavailable."),
    );
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
  turnstileToken: string,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: SafeApiError }> {
  try {
    const body: Record<string, string> = { email, password, surface: "studio" };
    const normalizedToken = turnstileToken.trim();
    if (normalizedToken) body.turnstile_token = normalizedToken;
    const response = await fetch(apiUrl("/auth/login/password"), {
      method: "POST",
      credentials: "include",
      redirect: "manual",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (
      response.ok ||
      response.type === "opaqueredirect" ||
      [302, 303, 307, 308].includes(response.status)
    ) {
      return { ok: true };
    }
    const payload = await readPayload(response);
    const reason = isRecord(payload) ? stringOrNull(payload.reason) : null;
    if (reason === "turnstile_required") {
      return {
        ok: false,
        error: requestError("turnstile_required", "Complete the security check before continuing.", response.status),
      };
    }
    if (reason === "turnstile_invalid") {
      return {
        ok: false,
        error: requestError("turnstile_invalid", "The security check expired or was rejected. Complete it again.", response.status),
      };
    }
    if (reason === "turnstile_unavailable") {
      return {
        ok: false,
        error: requestError("turnstile_unavailable", "Security verification is temporarily unavailable. Please try again.", response.status),
      };
    }
    if (response.status === 401) {
      return {
        ok: false,
        error: requestError("invalid_credentials", "Invalid email or password.", response.status),
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        error: requestError("login_rate_limited", "Too many login attempts. Please wait and try again.", response.status),
      };
    }
    if (isRecord(payload) && payload.verification_required === true) {
      return {
        ok: false,
        error: requestError("email_unverified", "Verify your email before signing in.", response.status),
      };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        error: requestError("auth_unavailable", "Runtime/Auth is currently unavailable.", response.status),
      };
    }
    return {
      ok: false,
      error: requestError("login_rejected", "StreamSuites login was not accepted.", response.status),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      error: requestError("login_request_failed", "Runtime/Auth could not process the login request."),
    };
  }
}

export async function logoutFromStudio(signal?: AbortSignal): Promise<{ ok: true } | { ok: false; error: SafeApiError }> {
  try {
    const response = await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        error: requestError("logout_failed", "Runtime/Auth could not complete logout.", response.status),
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      error: requestError("logout_request_failed", "Runtime/Auth could not be reached for logout."),
    };
  }
}

export type OAuthProvider = "google" | "github" | "discord" | "x" | "twitch";

const oauthPaths: Record<OAuthProvider, string> = {
  google: "/auth/login/google",
  github: "/auth/login/github",
  discord: "/auth/login/discord",
  x: "/auth/x/start",
  twitch: "/oauth/twitch/start",
};

export function safeStudioReturnPath(value: string | null, fallback = "/studio"): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith("/")) return fallback;
    if (parsed.pathname === "/login") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildOAuthLoginUrl(
  provider: OAuthProvider,
  returnPath: string,
  turnstileToken = "",
): string {
  const url = new URL(oauthPaths[provider], `${publicStudioConfig.runtimeApiBaseUrl}/`);
  url.searchParams.set("surface", "studio");
  url.searchParams.set("return_to", new URL(safeStudioReturnPath(returnPath), window.location.origin).toString());
  const normalizedToken = turnstileToken.trim();
  if (normalizedToken) url.searchParams.set("turnstile_token", normalizedToken);
  return url.toString();
}
