import { publicStudioConfig } from "../config/env";
import type {
  GuestLobbyState,
  InviteValidation,
  RoomInvite,
  RoomLifecycle,
  RoomSummary,
  StreamSuitesAccountType,
  StudioGuest,
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

export class StudioApiError extends Error implements SafeApiError {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(error: SafeApiError) {
    super(error.message);
    this.name = "StudioApiError";
    this.code = error.code;
    this.status = error.status;
    this.retryable = error.retryable;
  }
}

async function studioRequest(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StudioApiError(requestError("runtime_request_failed", "Runtime/Auth is currently unavailable."));
  }
  const payload = await readPayload(response);
  if (!response.ok || !isRecord(payload)) {
    const code = isRecord(payload) ? stringOrNull(payload.error_code ?? payload.reason_code) : null;
    const message = isRecord(payload) ? stringOrNull(payload.error) : null;
    throw new StudioApiError(requestError(code ?? "studio_request_failed", message ?? "Runtime/Auth rejected the Studio request.", response.status));
  }
  return payload;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roomLifecycle(value: unknown): RoomLifecycle {
  return value === "open" || value === "closed" || value === "ended" ? value : "draft";
}

function normalizeRoom(value: unknown): RoomSummary {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_room_response", "Runtime/Auth returned invalid room data."));
  const id = stringOrNull(value.id);
  const title = stringOrNull(value.title);
  const ownerAccountId = stringOrNull(value.owner_account_id);
  const createdAt = stringOrNull(value.created_at);
  const updatedAt = stringOrNull(value.updated_at);
  if (!id || !title || !ownerAccountId || !createdAt || !updatedAt) {
    throw new StudioApiError(requestError("invalid_room_response", "Runtime/Auth returned incomplete room data."));
  }
  return {
    id,
    title,
    ownerAccountId,
    description: stringOrNull(value.description),
    lifecycleState: roomLifecycle(value.lifecycle_state),
    maxGuestStageOccupants: numberOr(value.max_guest_stage_occupants, 9),
    waitingGuestCount: numberOr(value.waiting_guest_count),
    admittedGuestCount: numberOr(value.admitted_guest_count),
    createdAt,
    updatedAt,
    openedAt: stringOrNull(value.opened_at),
    endedAt: stringOrNull(value.ended_at),
  };
}

function normalizeInvite(value: unknown): RoomInvite {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth returned invalid invite data."));
  const id = stringOrNull(value.id);
  const roomId = stringOrNull(value.room_id);
  const createdAt = stringOrNull(value.created_at);
  const updatedAt = stringOrNull(value.updated_at);
  if (!id || !roomId || !createdAt || !updatedAt) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth returned incomplete invite data."));
  return { id, roomId, label: stringOrNull(value.label), active: value.active === true, expiresAt: stringOrNull(value.expires_at), createdAt, updatedAt, revokedAt: stringOrNull(value.revoked_at) };
}

function normalizeGuest(value: unknown): StudioGuest {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_guest_response", "Runtime/Auth returned invalid guest data."));
  const id = stringOrNull(value.id);
  const roomId = stringOrNull(value.room_id);
  const displayName = stringOrNull(value.display_name);
  const state = stringOrNull(value.state) as GuestLobbyState | null;
  const createdAt = stringOrNull(value.created_at);
  const updatedAt = stringOrNull(value.updated_at);
  const expiresAt = stringOrNull(value.expires_at);
  if (!id || !roomId || !displayName || !state || !createdAt || !updatedAt || !expiresAt) throw new StudioApiError(requestError("invalid_guest_response", "Runtime/Auth returned incomplete guest data."));
  const room = isRecord(value.room) ? {
    id: stringOrNull(value.room.id) ?? roomId,
    title: stringOrNull(value.room.title) ?? "Studio room",
    description: stringOrNull(value.room.description),
    lifecycleState: roomLifecycle(value.room.lifecycle_state),
  } : undefined;
  return { id, roomId, displayName, accountId: stringOrNull(value.account_id), state, createdAt, updatedAt, expiresAt, admittedAt: stringOrNull(value.admitted_at), deniedAt: stringOrNull(value.denied_at), removedAt: stringOrNull(value.removed_at), leftAt: stringOrNull(value.left_at), room };
}

function body(value: object): string {
  return JSON.stringify(value);
}

export async function listStudioRooms(signal?: AbortSignal): Promise<RoomSummary[]> {
  const payload = await studioRequest("/api/studio/rooms", { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeRoom) : [];
}

export async function createStudioRoom(input: { title: string; description?: string }, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom((await studioRequest("/api/studio/rooms", { method: "POST", body: body(input), signal })).room);
}

export async function loadStudioRoom(roomId: string, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}`, { signal })).room);
}

export async function updateStudioRoom(roomId: string, input: { title?: string; description?: string | null }, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}`, { method: "PATCH", body: body(input), signal })).room);
}

export async function transitionStudioRoom(roomId: string, action: "open" | "close" | "end", signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/${action}`, { method: "POST", signal })).room);
}

export async function listStudioInvites(roomId: string, signal?: AbortSignal): Promise<RoomInvite[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites`, { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeInvite) : [];
}

export async function createStudioInvite(roomId: string, input: { label?: string; expires_at?: string }, signal?: AbortSignal): Promise<{ invite: RoomInvite; inviteCode: string }> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites`, { method: "POST", body: body(input), signal });
  const inviteCode = stringOrNull(payload.invite_code);
  if (!inviteCode) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth did not return the one-time invite code."));
  return { invite: normalizeInvite(payload.invite), inviteCode };
}

export async function revokeStudioInvite(roomId: string, inviteId: string, signal?: AbortSignal): Promise<RoomInvite> {
  return normalizeInvite((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE", signal })).invite);
}

export async function validateStudioInvite(inviteCode: string, signal?: AbortSignal): Promise<InviteValidation> {
  const payload = await studioRequest("/api/studio/invites/validate", { method: "POST", body: body({ invite_code: inviteCode }), signal });
  if (!isRecord(payload.room)) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth returned invalid room identity."));
  return { room: { id: stringOrNull(payload.room.id) ?? "", title: stringOrNull(payload.room.title) ?? "Studio room", description: stringOrNull(payload.room.description), lifecycleState: roomLifecycle(payload.room.lifecycle_state) }, expiresAt: stringOrNull(payload.expires_at) };
}

export async function joinStudioInvite(inviteCode: string, displayName: string, signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest("/api/studio/invites/join", { method: "POST", body: body({ invite_code: inviteCode, display_name: displayName }), signal })).guest);
}

export async function loadStudioGuestSession(signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest("/api/studio/guest/session", { signal })).guest);
}

export async function leaveStudioGuestSession(signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest("/api/studio/guest/leave", { method: "POST", signal })).guest);
}

export async function listStudioLobby(roomId: string, signal?: AbortSignal): Promise<StudioGuest[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/lobby`, { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeGuest) : [];
}

export async function transitionStudioGuest(roomId: string, guestId: string, action: "admit" | "deny" | "remove", signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/lobby/${encodeURIComponent(guestId)}/${action}`, { method: "POST", signal })).guest);
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
