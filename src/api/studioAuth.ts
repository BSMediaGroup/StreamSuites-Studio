import { publicStudioConfig } from "../config/env";
import { DEFAULT_ROOM_BRANDING, STUDIO_ADDITIONAL_STAGE_CAPACITY, STUDIO_DIRECTOR_STAGE_SLOTS, STUDIO_TOTAL_STAGE_CAPACITY } from "../domain/studio";
import type { BuiltInStageLayout, CustomLayout, GuestLobbyState, GuestRoomView, InviteValidation, ParticipantLabelMode, PresentationSource, RoomAsset, RoomAssetCategory, RoomBranding, RoomInvite, RoomLifecycle, RoomPresentation, RoomSummary, StageLayout, StreamSuitesAccountType, StudioGuest, StudioAccessState, AuthAccessGateState, StudioSessionAccount, CohostRelationship, CohostScope, InvitePolicy, RoomCohosts, RoomConnectionState, RoomPermissions } from "../domain/studio";
import type { SafeApiError } from "./contracts";

const ACCOUNT_TYPES = new Set<StreamSuitesAccountType>(["admin", "creator", "developer", "public"]);

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

function safeCdnAvatarUrl(value: unknown): string | null {
  const candidate = stringOrNull(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate, `${publicStudioConfig.runtimeApiBaseUrl}/`);
    return parsed.protocol === "https:" && parsed.hostname === "cdn.streamsuites.app" ? parsed.toString() : null;
  } catch {
    return null;
  }
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
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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

export interface StudioMediaStatus {
  provider: "cloudflare_realtimekit";
  enabled: boolean;
  configured: boolean;
  meetingProvisioned: boolean;
  participantMapped: boolean;
  reasonCode: string;
  reconciliationRequired: boolean;
  reconciliationReason: string | null;
  participantBindings: StudioMediaParticipantBinding[];
}

export interface StudioMediaParticipantBinding {
  runtimeParticipantId: string;
  customParticipantId: string;
}

export interface StudioMediaSession {
  provider: "cloudflare_realtimekit";
  authToken: string;
  runtimeParticipantId: string;
  participantBindings: StudioMediaParticipantBinding[];
  runtime: Record<string, unknown>;
}

export async function loadStudioMediaStatus(roomId: string, signal?: AbortSignal): Promise<StudioMediaStatus> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/status`, { signal });
  const media = isRecord(payload.media) ? payload.media : {};
  const participantBindings = Array.isArray(media.participant_bindings) ? media.participant_bindings.flatMap((item) => {
    if (!isRecord(item)) return [];
    const runtimeParticipantId = stringOrNull(item.runtime_participant_id), customParticipantId = stringOrNull(item.custom_participant_id);
    return runtimeParticipantId && customParticipantId ? [{ runtimeParticipantId, customParticipantId }] : [];
  }) : [];
  return { provider: "cloudflare_realtimekit", enabled: media.enabled === true, configured: media.configured === true,
    meetingProvisioned: media.meeting_provisioned === true, participantMapped: media.participant_mapped === true,
    reasonCode: stringOrNull(media.reason_code) ?? "unavailable",
    reconciliationRequired: media.reconciliation_required === true,
    reconciliationReason: stringOrNull(media.reconciliation_reason), participantBindings };
}

export async function createStudioMediaSession(roomId: string, signal?: AbortSignal): Promise<StudioMediaSession> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/session`, { method: "POST", signal });
  const media = isRecord(payload.media_session) ? payload.media_session : {};
  const token = stringOrNull(media.auth_token), runtimeId = stringOrNull(media.runtime_participant_id);
  const participantBindings = Array.isArray(media.participant_bindings) ? media.participant_bindings.flatMap((item) => {
    if (!isRecord(item)) return [];
    const runtimeParticipantId = stringOrNull(item.runtime_participant_id), customParticipantId = stringOrNull(item.custom_participant_id);
    return runtimeParticipantId && customParticipantId ? [{ runtimeParticipantId, customParticipantId }] : [];
  }) : [];
  if (!token || !runtimeId) throw new StudioApiError(requestError("invalid_media_session", "Runtime/Auth returned incomplete media initialization data."));
  return { provider: "cloudflare_realtimekit", authToken: token, runtimeParticipantId: runtimeId, participantBindings,
    runtime: isRecord(media.runtime) ? media.runtime : {} };
}

export async function refreshStudioMediaSession(roomId: string, signal?: AbortSignal): Promise<string> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/refresh`, { method: "POST", signal });
  const media = isRecord(payload.media_session) ? payload.media_session : {};
  const token = stringOrNull(media.auth_token);
  if (!token) throw new StudioApiError(requestError("invalid_media_session", "Runtime/Auth returned an invalid refreshed media token."));
  return token;
}

export async function updateOwnStudioMediaIntent(roomId: string, intent: { microphoneMuted?: boolean; cameraHidden?: boolean; screenSharing?: boolean }, signal?: AbortSignal): Promise<void> {
  await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/intent`, { method: "POST", body: JSON.stringify({
    ...(intent.microphoneMuted === undefined ? {} : { microphone_muted: intent.microphoneMuted }),
    ...(intent.cameraHidden === undefined ? {} : { camera_hidden: intent.cameraHidden }),
    ...(intent.screenSharing === undefined ? {} : { screen_sharing: intent.screenSharing }),
  }), signal });
}

export async function reportStudioMediaFailure(roomId: string, reasonCode: string, signal?: AbortSignal): Promise<void> {
  await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/failure`, { method: "POST", body: JSON.stringify({ reason_code: reasonCode }), signal });
}

export async function leaveStudioMediaSession(roomId: string, signal?: AbortSignal): Promise<void> {
  await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/media/leave`, { method: "POST", signal });
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roomLifecycle(value: unknown): RoomLifecycle {
  return value === "open" || value === "closed" || value === "ended" ? value : "draft";
}

function stageLayout(value: unknown): StageLayout {
  return value === "auto" || value === "custom" || value === "interview" || value === "spotlight" || value === "presentation" ? value : "grid";
}

function builtInStageLayout(value: unknown): BuiltInStageLayout {
  return value === "interview" || value === "spotlight" || value === "presentation" ? value : "grid";
}

function participantLabelMode(value: unknown): ParticipantLabelMode {
  return value === "name_only" || value === "hidden" ? value : "name_and_subtitle";
}

export function defaultRoomBranding(): RoomBranding {
  return structuredClone(DEFAULT_ROOM_BRANDING);
}

function normalizeCustomLayout(value: unknown): CustomLayout {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_custom_layout_response", "Runtime/Auth returned invalid custom layout data."));
  const id = stringOrNull(value.id), roomId = stringOrNull(value.room_id), displayName = stringOrNull(value.display_name), createdAt = stringOrNull(value.created_at), updatedAt = stringOrNull(value.updated_at);
  if (!id || !roomId || !displayName || !createdAt || !updatedAt) throw new StudioApiError(requestError("invalid_custom_layout_response", "Runtime/Auth returned incomplete custom layout data."));
  return { id, roomId, displayName, sortOrder: numberOr(value.sort_order), baseLayoutMode: builtInStageLayout(value.base_layout_mode), createdAt, updatedAt };
}

function normalizeBranding(value: unknown): RoomBranding {
  const defaults = defaultRoomBranding(), item = isRecord(value) ? value : {};
  const background = isRecord(item.stage_background) ? item.stage_background : {};
  const logo = isRecord(item.logo) ? item.logo : {};
  const badge = isRecord(item.name_badge) ? item.name_badge : {};
  const subtitle = isRecord(item.subtitle) ? item.subtitle : {};
  return {
    version: 1,
    stageBackground: {
      mode: background.mode === "gradient" || background.mode === "image" ? background.mode : "solid",
      color: stringOrNull(background.color) ?? defaults.stageBackground.color,
      gradientColor: stringOrNull(background.gradient_color) ?? defaults.stageBackground.gradientColor,
      imageAssetId: stringOrNull(background.image_asset_id), imageUrl: safeCdnAvatarUrl(background.image_url),
      imageFit: background.image_fit === "contain" ? "contain" : "cover",
      imagePosition: background.image_position === "top" || background.image_position === "bottom" ? background.image_position : "center",
    },
    logo: { assetId: stringOrNull(logo.asset_id), url: safeCdnAvatarUrl(logo.url), position: logo.position === "top-left" || logo.position === "bottom-left" || logo.position === "bottom-right" ? logo.position : "top-right", size: logo.size === "small" || logo.size === "large" ? logo.size : "medium", opacity: numberOr(logo.opacity, 1) },
    nameBadge: { backgroundColor: stringOrNull(badge.background_color) ?? defaults.nameBadge.backgroundColor, textColor: stringOrNull(badge.text_color) ?? defaults.nameBadge.textColor, accentColor: stringOrNull(badge.accent_color) ?? defaults.nameBadge.accentColor, opacity: numberOr(badge.opacity, defaults.nameBadge.opacity), density: badge.density === "compact" ? "compact" : "standard", shape: badge.shape === "square" || badge.shape === "rounded" ? badge.shape : "subtle-rounded", position: badge.position === "lower-right" ? "lower-right" : "lower-left" },
    subtitle: { mode: subtitle.mode === "separate" ? "separate" : "inherit", textColor: stringOrNull(subtitle.text_color) ?? defaults.subtitle.textColor, opacity: numberOr(subtitle.opacity, defaults.subtitle.opacity), textScale: "smaller" },
    safeAreaVisible: item.safe_area_visible !== false,
  };
}

function normalizePresentation(value: unknown): RoomPresentation {
  const item = isRecord(value) ? value : {};
  const customLayouts = Array.isArray(item.custom_layouts) ? item.custom_layouts.map(normalizeCustomLayout) : [];
  return {
    participantLabelMode: participantLabelMode(item.participant_label_mode), layoutMode: stageLayout(item.layout_mode),
    selectedCustomLayoutId: stringOrNull(item.selected_custom_layout_id), effectiveLayoutMode: builtInStageLayout(item.effective_layout_mode), customLayouts,
    spotlightGuestId: stringOrNull(item.spotlight_guest_id), presentationGuestId: stringOrNull(item.presentation_guest_id),
    guestSlotSizing: item.guest_slot_sizing === "fit" ? "fit" : "fill",
    participantMode: item.presentation_participant_mode === "outside" ? "outside" : "overlay",
    participantEdge: item.presentation_participant_edge === "top" || item.presentation_participant_edge === "left" || item.presentation_participant_edge === "right" ? item.presentation_participant_edge : "bottom",
  };
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
    maxGuestStageOccupants: numberOr(value.max_guest_stage_occupants, STUDIO_ADDITIONAL_STAGE_CAPACITY),
    totalStageCapacity: numberOr(value.total_stage_capacity, STUDIO_TOTAL_STAGE_CAPACITY),
    reservedDirectorStageSlots: numberOr(value.reserved_director_stage_slots, STUDIO_DIRECTOR_STAGE_SLOTS),
    maxAdditionalStageParticipants: numberOr(value.max_additional_stage_participants, numberOr(value.max_guest_stage_occupants, STUDIO_ADDITIONAL_STAGE_CAPACITY)),
    waitingGuestCount: numberOr(value.waiting_guest_count),
    admittedGuestCount: numberOr(value.admitted_guest_count),
    backstageGuestCount: numberOr(value.backstage_guest_count, numberOr(value.waiting_guest_count)),
    onStageGuestCount: numberOr(value.on_stage_guest_count, numberOr(value.admitted_guest_count)),
    presentation: normalizePresentation(value.presentation),
    branding: normalizeBranding(value.branding),
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
  const policyType = value.policy_type === "single_use" || value.policy_type === "capped" ? value.policy_type : "open";
  return {
    id,
    roomId,
    label: stringOrNull(value.label),
    active: value.active === true,
    inviteCode: stringOrNull(value.invite_code) ?? "",
    policyType,
    maxUses: typeof value.max_uses === "number" ? value.max_uses : null,
    successfulUseCount: numberOr(value.successful_use_count),
    permanent: value.permanent === true,
    exhausted: value.exhausted === true,
    expiresAt: stringOrNull(value.expires_at),
    createdAt,
    updatedAt,
    revokedAt: stringOrNull(value.revoked_at),
  };
}

function normalizeGuest(value: unknown): StudioGuest {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_guest_response", "Runtime/Auth returned invalid guest data."));
  const id = stringOrNull(value.id);
  const roomId = stringOrNull(value.room_id);
  const displayName = stringOrNull(value.display_name);
  const rawState = stringOrNull(value.state);
  const state = (rawState === "waiting" ? "backstage" : rawState === "admitted" ? "on_stage" : rawState) as GuestLobbyState | null;
  const createdAt = stringOrNull(value.created_at);
  const updatedAt = stringOrNull(value.updated_at);
  const expiresAt = stringOrNull(value.expires_at);
  if (!id || !roomId || !displayName || !state || !createdAt || !updatedAt || !expiresAt) throw new StudioApiError(requestError("invalid_guest_response", "Runtime/Auth returned incomplete guest data."));
  const room = isRecord(value.room)
    ? {
        id: stringOrNull(value.room.id) ?? roomId,
        title: stringOrNull(value.room.title) ?? "Studio room",
        description: stringOrNull(value.room.description),
        lifecycleState: roomLifecycle(value.room.lifecycle_state),
        presentation: normalizePresentation(value.room.presentation),
        branding: normalizeBranding(value.room.branding),
      }
    : undefined;
  const rawAvatarUrl = safeCdnAvatarUrl(value.avatar_url);
  const linkedAccount = isRecord(value.linked_account) ? value.linked_account : null;
  const avatarSource = value.avatar_source === "room_override" || value.avatar_source === "linked_account" ? value.avatar_source : "initials";
  return {
    id,
    roomId,
    displayName,
    subtitle: stringOrNull(value.subtitle),
    avatarUrl: rawAvatarUrl,
    avatarColor: stringOrNull(value.avatar_color) ?? "blue",
    signedIn: value.signed_in === true,
    accountUserCode: stringOrNull(value.account_user_code),
    linkedAccount: linkedAccount ? {
      userCode: stringOrNull(linkedAccount.user_code),
      displayName: stringOrNull(linkedAccount.display_name),
      avatarUrl: safeCdnAvatarUrl(linkedAccount.avatar_url),
    } : null,
    avatarSource,
    sessionCohost: value.session_cohost === true,
    pendingPermanentCohost: value.pending_permanent_cohost === true,
    accountId: stringOrNull(value.account_id),
    state,
    microphoneMuted: value.microphone_muted === true,
    cameraHidden: value.camera_hidden === true,
    stagePosition: typeof value.stage_position === "number" ? value.stage_position : null,
    createdAt,
    updatedAt,
    expiresAt,
    admittedAt: stringOrNull(value.admitted_at),
    deniedAt: stringOrNull(value.denied_at),
    removedAt: stringOrNull(value.removed_at),
    leftAt: stringOrNull(value.left_at),
    room,
  };
}

function normalizeAccount(value: unknown) {
  if (!isRecord(value)) return null;
  const id = stringOrNull(value.id);
  if (!id) return null;
  return {
    id,
    userCode: stringOrNull(value.user_code),
    displayName: stringOrNull(value.display_name) ?? "StreamSuites account",
    avatarUrl: safeCdnAvatarUrl(value.avatar_url),
  };
}

function normalizePermissions(value: unknown): RoomPermissions {
  const item = isRecord(value) ? value : {};
  return {
    owner: item.owner === true,
    admin: item.admin === true,
    sessionCohost: item.session_cohost === true,
    permanentCohost: item.permanent_cohost === true,
    pendingPermanentCohost: item.pending_permanent_cohost === true,
    manageBackstage: item.manage_backstage === true,
    manageParticipants: item.manage_participants === true || item.manage_backstage === true,
    reorderStage: item.reorder_stage === true,
    updateMediaIntent: item.update_media_intent === true,
    selfBackstage: item.self_backstage === true,
    selfStage: item.self_stage === true,
    manageInvites: item.manage_invites === true,
    updateRoom: item.update_room === true,
    updatePresentation: item.update_presentation === true,
    updateBranding: item.update_branding === true,
    manageAssets: item.manage_assets === true,
    manageCustomLayouts: item.manage_custom_layouts === true,
    managePermanentCohosts: item.manage_permanent_cohosts === true,
    endRoom: item.end_room === true,
  };
}

function normalizeRelationship(value: unknown): CohostRelationship {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_cohost_response", "Runtime/Auth returned invalid cohost data."));
  const id = stringOrNull(value.id);
  if (!id) throw new StudioApiError(requestError("invalid_cohost_response", "Runtime/Auth returned incomplete cohost data."));
  const status = value.status === "accepted" || value.status === "declined" || value.status === "revoked" ? value.status : "pending";
  return {
    id,
    director: normalizeAccount(value.director),
    cohost: normalizeAccount(value.cohost),
    status,
    scopeType: value.scope_type === "all_rooms" ? "all_rooms" : "selected_rooms",
    roomIds: Array.isArray(value.room_ids) ? value.room_ids.filter((item): item is string => typeof item === "string") : [],
    createdAt: stringOrNull(value.created_at) ?? "",
    updatedAt: stringOrNull(value.updated_at) ?? "",
  };
}

function body(value: object): string {
  return JSON.stringify(value);
}

export async function listStudioRooms(signal?: AbortSignal): Promise<RoomSummary[]> {
  const payload = await studioRequest("/api/studio/rooms", { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeRoom) : [];
}

export async function createStudioRoom(input: { title: string; description?: string }, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom(
    (
      await studioRequest("/api/studio/rooms", {
        method: "POST",
        body: body(input),
        signal,
      })
    ).room,
  );
}

export async function loadStudioRoom(roomId: string, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom(
    (
      await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}`, {
        signal,
      })
    ).room,
  );
}

export async function loadStudioRoomContext(roomId: string, signal?: AbortSignal): Promise<{ room: RoomSummary; permissions: RoomPermissions }> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}`, { signal });
  return {
    room: normalizeRoom(payload.room),
    permissions: normalizePermissions(payload.permissions),
  };
}

export async function updateStudioRoom(roomId: string, input: { title?: string; description?: string | null }, signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom(
    (
      await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        body: body(input),
        signal,
      })
    ).room,
  );
}

export async function transitionStudioRoom(roomId: string, action: "open" | "close" | "end", signal?: AbortSignal): Promise<RoomSummary> {
  return normalizeRoom((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/${action}`, { method: "POST", signal })).room);
}

export async function listStudioInvites(roomId: string, signal?: AbortSignal): Promise<RoomInvite[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites`, { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeInvite) : [];
}

export async function createStudioInvite(
  roomId: string,
  input: {
    label?: string;
    expires_at?: string;
    permanent?: boolean;
    policy_type?: InvitePolicy;
    max_uses?: number;
  },
  signal?: AbortSignal,
): Promise<{ invite: RoomInvite; inviteCode: string }> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites`, { method: "POST", body: body(input), signal });
  const inviteCode = stringOrNull(payload.invite_code);
  if (!inviteCode) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth did not return the canonical invite code."));
  return { invite: normalizeInvite(payload.invite), inviteCode };
}

export async function revokeStudioInvite(roomId: string, inviteId: string, signal?: AbortSignal): Promise<RoomInvite> {
  return normalizeInvite((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE", signal })).invite);
}

export async function validateStudioInvite(inviteCode: string, signal?: AbortSignal): Promise<InviteValidation> {
  const payload = await studioRequest("/api/studio/invites/validate", {
    method: "POST",
    body: body({ invite_code: inviteCode }),
    signal,
  });
  if (!isRecord(payload.room)) throw new StudioApiError(requestError("invalid_invite_response", "Runtime/Auth returned invalid room identity."));
  const invite = normalizeInvite(payload.invite);
  return {
    room: {
      id: stringOrNull(payload.room.id) ?? "",
      title: stringOrNull(payload.room.title) ?? "Studio room",
      description: stringOrNull(payload.room.description),
      lifecycleState: roomLifecycle(payload.room.lifecycle_state),
    },
    expiresAt: stringOrNull(payload.expires_at),
    invite,
    director: normalizeAccount(payload.room.director),
  };
}

export async function joinStudioInvite(inviteCode: string, profile: string | { displayName: string; subtitle?: string; avatarColor?: string }, signal?: AbortSignal): Promise<StudioGuest> {
  const normalized = typeof profile === "string" ? { displayName: profile } : profile;
  return normalizeGuest(
    (
      await studioRequest("/api/studio/invites/join", {
        method: "POST",
        body: body({
          invite_code: inviteCode,
          display_name: normalized.displayName,
          subtitle: normalized.subtitle,
          avatar_color: normalized.avatarColor,
        }),
        signal,
      })
    ).guest,
  );
}

export async function updateStudioGuestProfile(input: { displayName: string; subtitle?: string; avatarColor?: string }, signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest(
    (
      await studioRequest("/api/studio/guest/profile", {
        method: "PATCH",
        body: body({
          display_name: input.displayName,
          subtitle: input.subtitle,
          avatar_color: input.avatarColor,
        }),
        signal,
      })
    ).guest,
  );
}

export async function uploadStudioGuestAvatar(file: File, signal?: AbortSignal): Promise<StudioGuest> {
  const form = new FormData();
  form.append("file", file);
  return normalizeGuest(
    (
      await studioRequest("/api/studio/guest/avatar", {
        method: "POST",
        body: form,
        signal,
      })
    ).guest,
  );
}

export async function removeStudioGuestAvatar(signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest(
    (
      await studioRequest("/api/studio/guest/avatar", {
        method: "DELETE",
        signal,
      })
    ).guest,
  );
}

export async function loadStudioGuestSession(signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest("/api/studio/guest/session", { signal })).guest);
}

export async function loadStudioGuestRoomView(signal?: AbortSignal): Promise<GuestRoomView> {
  const payload = await studioRequest("/api/studio/guest/session", { signal });
  const view = payload.room_view;
  if (!isRecord(view) || !isRecord(view.room) || !Array.isArray(view.stage)) {
    throw new StudioApiError(requestError("invalid_guest_room_response", "Runtime/Auth returned an invalid guest room view."));
  }
  const self = normalizeGuest(view.self ?? payload.guest);
  return {
    room: {
      id: stringOrNull(view.room.id) ?? self.roomId,
      title: stringOrNull(view.room.title) ?? "Studio room",
      description: stringOrNull(view.room.description),
      lifecycleState: roomLifecycle(view.room.lifecycle_state),
      totalStageCapacity: numberOr(view.room.total_stage_capacity, STUDIO_TOTAL_STAGE_CAPACITY),
      reservedDirectorStageSlots: numberOr(view.room.reserved_director_stage_slots, STUDIO_DIRECTOR_STAGE_SLOTS),
      maxAdditionalStageParticipants: numberOr(view.room.max_additional_stage_participants, STUDIO_ADDITIONAL_STAGE_CAPACITY),
      presentation: normalizePresentation(view.room.presentation),
      branding: normalizeBranding(view.room.branding),
    },
    self,
    stage: view.stage.map(normalizeGuest),
    permissions: normalizePermissions(view.permissions),
  };
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

export async function moveStudioParticipant(roomId: string, guestId: string, location: "stage" | "backstage", signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(guestId)}/${location}`, { method: "POST", signal })).guest);
}

export async function moveStudioGuestSelf(location: "stage" | "backstage", signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest(`/api/studio/guest/${location}`, { method: "POST", signal })).guest);
}

export async function updateStudioMediaIntent(input: { roomId?: string; guestId?: string; microphoneMuted?: boolean; cameraHidden?: boolean }, signal?: AbortSignal): Promise<StudioGuest> {
  const path = input.roomId && input.guestId
    ? `/api/studio/rooms/${encodeURIComponent(input.roomId)}/participants/${encodeURIComponent(input.guestId)}/media-intent`
    : "/api/studio/guest/media-intent";
  return normalizeGuest((await studioRequest(path, { method: "PATCH", body: body({
    ...(input.microphoneMuted === undefined ? {} : { microphone_muted: input.microphoneMuted }),
    ...(input.cameraHidden === undefined ? {} : { camera_hidden: input.cameraHidden }),
  }), signal })).guest);
}

export async function reorderStudioStage(roomId: string, guestIds: readonly string[], signal?: AbortSignal): Promise<StudioGuest[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/stage/order`, { method: "PATCH", body: body({ guest_ids: guestIds }), signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeGuest) : [];
}

export async function updateStudioPresentation(roomId: string, input: { participantLabelMode?: ParticipantLabelMode; layoutMode?: StageLayout; selectedCustomLayoutId?: string | null; spotlightGuestId?: string | null; presentationGuestId?: string | null; guestSlotSizing?: "fill" | "fit"; participantMode?: "overlay" | "outside"; participantEdge?: "top" | "bottom" | "left" | "right" }, signal?: AbortSignal): Promise<RoomSummary> {
  const normalized = input;
  return normalizeRoom(
    (
      await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/presentation`, {
        method: "PATCH",
        body: body({
          ...(normalized.participantLabelMode === undefined ? {} : { participant_label_mode: normalized.participantLabelMode }),
          ...(normalized.layoutMode === undefined ? {} : { layout_mode: normalized.layoutMode }),
          ...(normalized.selectedCustomLayoutId === undefined ? {} : { selected_custom_layout_id: normalized.selectedCustomLayoutId }),
          ...(normalized.spotlightGuestId === undefined ? {} : { spotlight_guest_id: normalized.spotlightGuestId }),
          ...(normalized.presentationGuestId === undefined ? {} : { presentation_guest_id: normalized.presentationGuestId }),
          ...(normalized.guestSlotSizing === undefined ? {} : { guest_slot_sizing: normalized.guestSlotSizing }),
          ...(normalized.participantMode === undefined ? {} : { presentation_participant_mode: normalized.participantMode }),
          ...(normalized.participantEdge === undefined ? {} : { presentation_participant_edge: normalized.participantEdge }),
        }),
        signal,
      })
    ).room,
  );
}

function normalizePresentationSource(value: unknown): PresentationSource {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_presentation_source", "Runtime/Auth returned invalid presentation source data."));
  const id = stringOrNull(value.id), roomId = stringOrNull(value.room_id), ownerParticipantId = stringOrNull(value.owner_participant_id), displayName = stringOrNull(value.display_name), createdAt = stringOrNull(value.created_at), updatedAt = stringOrNull(value.updated_at), startedAt = stringOrNull(value.started_at);
  if (!id || !roomId || !ownerParticipantId || !displayName || !createdAt || !updatedAt || !startedAt) throw new StudioApiError(requestError("invalid_presentation_source", "Runtime/Auth returned incomplete presentation source data."));
  return { id, roomId, ownerParticipantId, displayName, sourceType: "screen_share", location: value.location === "on_stage" || value.location === "stopped" ? value.location : "backstage", createdAt, updatedAt, startedAt, stoppedAt: stringOrNull(value.stopped_at) };
}
export async function loadPresentationSources(roomId: string, signal?: AbortSignal): Promise<PresentationSource[]> { const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/presentation-sources`, { signal }); return Array.isArray(payload.items) ? payload.items.map(normalizePresentationSource) : []; }
export async function registerPresentationSource(roomId: string, signal?: AbortSignal): Promise<PresentationSource> { return normalizePresentationSource((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/presentation-sources`, { method: "POST", signal })).source); }
export async function movePresentationSource(roomId: string, sourceId: string, location: "backstage" | "on_stage", signal?: AbortSignal): Promise<PresentationSource> { return normalizePresentationSource((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/presentation-sources/${encodeURIComponent(sourceId)}`, { method: "PATCH", body: body({ location }), signal })).source); }
export async function stopPresentationSource(roomId: string, sourceId: string, signal?: AbortSignal): Promise<PresentationSource> { return normalizePresentationSource((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/presentation-sources/${encodeURIComponent(sourceId)}`, { method: "DELETE", signal })).source); }

function serializeBranding(branding: RoomBranding) {
  return {
    stage_background: { mode: branding.stageBackground.mode, color: branding.stageBackground.color, gradient_color: branding.stageBackground.gradientColor, image_asset_id: branding.stageBackground.imageAssetId, image_fit: branding.stageBackground.imageFit, image_position: branding.stageBackground.imagePosition },
    logo: { asset_id: branding.logo.assetId, position: branding.logo.position, size: branding.logo.size, opacity: branding.logo.opacity },
    name_badge: { background_color: branding.nameBadge.backgroundColor, text_color: branding.nameBadge.textColor, accent_color: branding.nameBadge.accentColor, opacity: branding.nameBadge.opacity, density: branding.nameBadge.density, shape: branding.nameBadge.shape, position: branding.nameBadge.position },
    subtitle: { mode: branding.subtitle.mode, text_color: branding.subtitle.textColor, opacity: branding.subtitle.opacity, text_scale: branding.subtitle.textScale },
    safe_area_visible: branding.safeAreaVisible,
  };
}

export async function loadStudioBranding(roomId: string, signal?: AbortSignal): Promise<RoomBranding> {
  return normalizeBranding((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/branding`, { signal })).branding);
}

export async function updateStudioBranding(roomId: string, branding: RoomBranding | null, signal?: AbortSignal): Promise<RoomBranding> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/branding`, { method: "PATCH", body: body(branding ? { branding: serializeBranding(branding) } : { reset: true }), signal });
  return normalizeBranding(payload.branding);
}

function normalizeRoomAsset(value: unknown): RoomAsset {
  if (!isRecord(value)) throw new StudioApiError(requestError("invalid_room_asset_response", "Runtime/Auth returned invalid room asset data."));
  const id = stringOrNull(value.id), roomId = stringOrNull(value.room_id), displayName = stringOrNull(value.display_name), url = safeCdnAvatarUrl(value.url), createdAt = stringOrNull(value.created_at), updatedAt = stringOrNull(value.updated_at);
  const category = value.category as RoomAssetCategory;
  if (!id || !roomId || !displayName || !url || !createdAt || !updatedAt || !["logo", "stage_background", "overlay", "holding", "presentation_placeholder"].includes(category)) throw new StudioApiError(requestError("invalid_room_asset_response", "Runtime/Auth returned incomplete room asset data."));
  return { id, roomId, displayName, url, category, mimeType: "image/webp", width: numberOr(value.width), height: numberOr(value.height), fileSize: numberOr(value.file_size), sortOrder: numberOr(value.sort_order), createdAt, updatedAt };
}

export async function listStudioRoomAssets(roomId: string, signal?: AbortSignal): Promise<RoomAsset[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/assets`, { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeRoomAsset) : [];
}

export async function uploadStudioRoomAsset(roomId: string, file: File, category: RoomAssetCategory, signal?: AbortSignal): Promise<RoomAsset> {
  const form = new FormData(); form.append("file", file);
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/assets`, { method: "POST", body: form, headers: { "X-Studio-Asset-Category": category, "X-Studio-Asset-Name": file.name }, signal });
  return normalizeRoomAsset(payload.asset);
}

export async function updateStudioRoomAsset(roomId: string, assetId: string, changes: { displayName?: string; category?: RoomAssetCategory }, signal?: AbortSignal): Promise<RoomAsset> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/assets/${encodeURIComponent(assetId)}`, { method: "PATCH", body: body({ ...(changes.displayName === undefined ? {} : { display_name: changes.displayName }), ...(changes.category === undefined ? {} : { category: changes.category }) }), signal });
  return normalizeRoomAsset(payload.asset);
}

export async function deleteStudioRoomAsset(roomId: string, assetId: string, confirmAssignmentClear: boolean, signal?: AbortSignal): Promise<{ brandingAssignmentCleared: boolean }> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/assets/${encodeURIComponent(assetId)}`, { method: "DELETE", body: body({ confirm_assignment_clear: confirmAssignmentClear }), signal });
  return { brandingAssignmentCleared: payload.branding_assignment_cleared === true };
}

export async function listStudioCustomLayouts(roomId: string, signal?: AbortSignal): Promise<CustomLayout[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/custom-layouts`, { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeCustomLayout) : [];
}

export async function createStudioCustomLayout(roomId: string, effectiveLayoutMode: BuiltInStageLayout, signal?: AbortSignal): Promise<CustomLayout> {
  return normalizeCustomLayout((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/custom-layouts`, { method: "POST", body: body({ effective_layout_mode: effectiveLayoutMode }), signal })).layout);
}

export async function updateStudioCustomLayout(roomId: string, layoutId: string, displayName: string, signal?: AbortSignal): Promise<CustomLayout> {
  return normalizeCustomLayout((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/custom-layouts/${encodeURIComponent(layoutId)}`, { method: "PATCH", body: body({ display_name: displayName }), signal })).layout);
}

export async function reorderStudioCustomLayouts(roomId: string, layoutIds: readonly string[], signal?: AbortSignal): Promise<CustomLayout[]> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/custom-layouts/reorder`, { method: "PUT", body: body({ layout_ids: layoutIds }), signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeCustomLayout) : [];
}

export async function deleteStudioCustomLayout(roomId: string, layoutId: string, signal?: AbortSignal): Promise<{ presentationFellBackToGrid: boolean }> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/custom-layouts/${encodeURIComponent(layoutId)}`, { method: "DELETE", body: body({}), signal });
  return { presentationFellBackToGrid: payload.presentation_fell_back_to_grid === true };
}

export async function loadRoomCohosts(roomId: string, signal?: AbortSignal): Promise<RoomCohosts> {
  const payload = await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/cohosts`, { signal });
  return {
    director: normalizeAccount(payload.director),
    session: Array.isArray(payload.session) ? payload.session.map(normalizeGuest) : [],
    permanent: Array.isArray(payload.permanent) ? payload.permanent.map(normalizeRelationship) : [],
    permissions: normalizePermissions(payload.permissions),
  };
}

export async function setSessionCohost(roomId: string, guestId: string, enabled: boolean, signal?: AbortSignal): Promise<StudioGuest> {
  return normalizeGuest((await studioRequest(`/api/studio/rooms/${encodeURIComponent(roomId)}/cohosts/session/${encodeURIComponent(guestId)}`, { method: enabled ? "POST" : "DELETE", signal })).guest);
}

export async function invitePermanentCohost(
  input: {
    roomId: string;
    guestId: string;
    scopeType: CohostScope;
    roomIds?: readonly string[];
  },
  signal?: AbortSignal,
): Promise<CohostRelationship> {
  return normalizeRelationship(
    (
      await studioRequest("/api/studio/cohosts/invitations", {
        method: "POST",
        body: body({
          room_id: input.roomId,
          guest_id: input.guestId,
          scope_type: input.scopeType,
          room_ids: input.roomIds ?? [],
        }),
        signal,
      })
    ).relationship,
  );
}

export async function listCohostRelationships(invitationsOnly = false, signal?: AbortSignal): Promise<CohostRelationship[]> {
  const payload = await studioRequest(invitationsOnly ? "/api/studio/cohosts/invitations" : "/api/studio/cohosts", { signal });
  return Array.isArray(payload.items) ? payload.items.map(normalizeRelationship) : [];
}

export async function respondCohostInvitation(id: string, response: "accept" | "decline", signal?: AbortSignal): Promise<CohostRelationship> {
  return normalizeRelationship((await studioRequest(`/api/studio/cohosts/invitations/${encodeURIComponent(id)}/${response}`, { method: "POST", signal })).relationship);
}

export async function updateCohostScope(id: string, scopeType: CohostScope, roomIds: readonly string[], signal?: AbortSignal): Promise<CohostRelationship> {
  return normalizeRelationship(
    (
      await studioRequest(`/api/studio/cohosts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: body({ scope_type: scopeType, room_ids: roomIds }),
        signal,
      })
    ).relationship,
  );
}

export async function revokeCohostRelationship(id: string, signal?: AbortSignal): Promise<CohostRelationship> {
  return normalizeRelationship(
    (
      await studioRequest(`/api/studio/cohosts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        signal,
      })
    ).relationship,
  );
}

export interface StudioEventConnection {
  readonly close: () => void;
}

export function connectStudioEvents(options: { roomId?: string; guest?: boolean; onState: (state: RoomConnectionState) => void; onEvent: (event: MessageEvent) => void }): StudioEventConnection {
  const path = options.guest ? "/api/studio/guest/events" : `/api/studio/rooms/${encodeURIComponent(options.roomId ?? "")}/events`;
  let closed = false;
  let source: EventSource | null = null;
  let reconnects = 0;
  let timer = 0;
  const eventNames = ["room.updated", "room.opened", "room.closed", "room.ended", "room.branding_updated", "room.asset_created", "room.asset_updated", "room.asset_deleted", "room.custom_layouts_updated", "room.presentation_updated", "room.presentation_source_created", "room.presentation_source_updated", "room.presentation_source_stopped", "participant.moved_stage", "participant.moved_backstage", "participant.media_intent_updated", "participant.profile_updated", "stage.order_updated", "presentation.layout_updated", "guest.denied", "guest.removed", "guest.left", "guest.expired", "invite.created", "invite.updated", "invite.revoked", "invite.exhausted", "cohost.session_granted", "cohost.session_revoked", "cohost.permanent_invited", "cohost.permanent_accepted", "cohost.permanent_declined", "cohost.permanent_revoked", "cohost.scope_updated"];
  const open = () => {
    if (closed) return;
    options.onState(reconnects ? "reconnecting" : "unavailable");
    source = new EventSource(apiUrl(path), { withCredentials: true });
    source.addEventListener("connected", () => {
      reconnects = 0;
      options.onState("live");
    });
    eventNames.forEach((name) => source?.addEventListener(name, options.onEvent as EventListener));
    source.onerror = () => {
      source?.close();
      if (closed) return;
      reconnects += 1;
      options.onState(reconnects >= 3 ? "fallback polling" : "reconnecting");
      window.clearTimeout(timer);
      timer = window.setTimeout(open, Math.min(1000 * 2 ** Math.min(reconnects, 4), 15000));
    };
  };
  open();
  return {
    close: () => {
      closed = true;
      window.clearTimeout(timer);
      source?.close();
    },
  };
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

const authAccessMessages = {
  normal: "Authentication is operating normally.",
  maintenance: "Authentication is temporarily unavailable while maintenance is in progress.",
  development: "Authentication is temporarily limited while development access mode is active.",
} as const;

export function createLoadingAuthAccessGateState(): AuthAccessGateState {
  return {
    status: "loading",
    mode: "normal",
    message: authAccessMessages.normal,
    showLockoutBanner: false,
    loginAllowed: false,
    bypassEnabled: false,
    bypassUnlocked: false,
    unlockExpiresAt: null,
  };
}

export async function loadAuthAccessGate(previous: AuthAccessGateState | null = null, signal?: AbortSignal): Promise<AuthAccessGateState> {
  try {
    const response = await fetch(apiUrl("/auth/access-state"), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    const payload = await readPayload(response);
    if (!response.ok || !isRecord(payload)) throw new Error("access_state_unavailable");
    const rawMode = stringOrNull(payload.mode)?.toLowerCase();
    const mode = rawMode === "maintenance" || rawMode === "development" ? rawMode : "normal";
    const bypassEnabled = mode !== "normal" && payload.bypass_enabled === true;
    const previousExpiry = previous?.unlockExpiresAt ?? null;
    const previousUnlockActive = Boolean(bypassEnabled && previous?.mode === mode && previous?.bypassUnlocked && previousExpiry && Date.parse(previousExpiry) > Date.now());
    return {
      status: "ready",
      mode,
      message: stringOrNull(payload.message) ?? authAccessMessages[mode],
      showLockoutBanner: payload.show_lockout_banner === true,
      loginAllowed: payload.login_allowed === true,
      bypassEnabled,
      bypassUnlocked: previousUnlockActive,
      unlockExpiresAt: previousUnlockActive ? previousExpiry : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ...createLoadingAuthAccessGateState(),
      status: "unavailable",
      message: "Runtime/Auth access state is currently unavailable.",
    };
  }
}

export async function unlockAuthAccess(
  code: string,
  signal?: AbortSignal,
): Promise<
  | {
      ok: true;
      mode: "maintenance" | "development";
      message: string;
      expiresAt: string;
    }
  | { ok: false; error: SafeApiError }
> {
  try {
    const response = await fetch(apiUrl("/auth/debug/unlock"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
      signal,
    });
    const payload = await readPayload(response);
    if (response.ok && isRecord(payload) && payload.unlocked === true) {
      const rawMode = stringOrNull(payload.mode);
      const expiresAt = stringOrNull(payload.expires_at);
      if ((rawMode === "maintenance" || rawMode === "development") && expiresAt) {
        return {
          ok: true,
          mode: rawMode,
          message: stringOrNull(payload.message) ?? authAccessMessages[rawMode],
          expiresAt,
        };
      }
    }
    const codeValue = isRecord(payload) ? stringOrNull(payload.error_code) : null;
    if (response.status === 403) {
      return {
        ok: false,
        error: requestError(codeValue ?? "AUTH_BYPASS_INVALID_CODE", "Invalid access code.", 403),
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        error: requestError(codeValue ?? "AUTH_BYPASS_RATE_LIMITED", "Too many attempts. Please wait and try again.", 429),
      };
    }
    return {
      ok: false,
      error: requestError(codeValue ?? "AUTH_BYPASS_UNAVAILABLE", "Unlock is unavailable right now.", response.status),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      ok: false,
      error: requestError("AUTH_BYPASS_REQUEST_FAILED", "Unlock is unavailable right now."),
    };
  }
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
    avatarUrl: safeCdnAvatarUrl(user.avatar_url ?? user.profile_image_url),
    accountType: type,
    tier: stringOrNull(user.tier ?? user.effective_tier),
  };
}

export function normalizeStudioAccess(sessionPayload: unknown, accessPayload: unknown, accessStatus: number): StudioAccessState {
  const account = parseSessionAccount(sessionPayload);
  if (!isRecord(accessPayload)) {
    return unavailable(requestError("invalid_access_response", "Runtime/Auth returned an invalid Studio access response."));
  }
  const reasonCode = stringOrNull(accessPayload.reason_code) ?? "access_unconfirmed";
  const testerLimit = typeof accessPayload.active_tester_limit === "number" && accessPayload.active_tester_limit > 0 ? accessPayload.active_tester_limit : 25;
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
      return unavailable(requestError("session_unavailable", "Runtime/Auth could not confirm the current StreamSuites session.", sessionResponse.status));
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
    return unavailable(requestError("runtime_request_failed", "Runtime/Auth is currently unavailable."));
  }
}

export async function loginWithPassword(email: string, password: string, turnstileToken: string, signal?: AbortSignal): Promise<{ ok: true } | { ok: false; error: SafeApiError }> {
  try {
    const body: Record<string, string> = { email, password, surface: "studio" };
    const normalizedToken = turnstileToken.trim();
    if (normalizedToken) body.turnstile_token = normalizedToken;
    const response = await fetch(apiUrl("/auth/login/password"), {
      method: "POST",
      credentials: "include",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (response.ok || response.type === "opaqueredirect" || [302, 303, 307, 308].includes(response.status)) {
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

export function buildOAuthLoginUrl(provider: OAuthProvider, returnPath: string, turnstileToken = ""): string {
  const url = new URL(oauthPaths[provider], `${publicStudioConfig.runtimeApiBaseUrl}/`);
  url.searchParams.set("surface", "studio");
  url.searchParams.set("return_to", new URL(safeStudioReturnPath(returnPath), window.location.origin).toString());
  const normalizedToken = turnstileToken.trim();
  if (normalizedToken) url.searchParams.set("turnstile_token", normalizedToken);
  return url.toString();
}
