export type StreamSuitesAccountType = "admin" | "creator" | "developer" | "public";

export interface StudioSessionAccount {
  readonly id: string;
  readonly userCode: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly accountType: StreamSuitesAccountType;
  readonly tier: string | null;
}

export type StudioAccessStatus = "loading" | "unauthenticated" | "unavailable" | "denied" | "restricted" | "allowed";

export interface StudioAccessState {
  readonly status: StudioAccessStatus;
  readonly source: "runtime-auth";
  readonly reasonCode: string;
  readonly account: StudioSessionAccount | null;
  readonly stage: "ALPHA";
  readonly activeTesterLimit: number;
  readonly errorMessage?: string;
}

export type AuthAccessMode = "normal" | "maintenance" | "development";

export interface AuthAccessGateState {
  readonly status: "loading" | "ready" | "unavailable";
  readonly mode: AuthAccessMode;
  readonly message: string;
  readonly showLockoutBanner: boolean;
  readonly loginAllowed: boolean;
  readonly bypassEnabled: boolean;
  readonly bypassUnlocked: boolean;
  readonly unlockExpiresAt: string | null;
}

export type RoomLifecycle = "draft" | "open" | "closed" | "ended";

export const STUDIO_TOTAL_STAGE_CAPACITY = 9;
export const STUDIO_DIRECTOR_STAGE_SLOTS = 1;
export const STUDIO_ADDITIONAL_STAGE_CAPACITY = STUDIO_TOTAL_STAGE_CAPACITY - STUDIO_DIRECTOR_STAGE_SLOTS;

export interface RoomSummary {
  readonly id: string;
  readonly ownerAccountId: string;
  readonly title: string;
  readonly description: string | null;
  readonly lifecycleState: RoomLifecycle;
  readonly maxGuestStageOccupants: number;
  readonly totalStageCapacity: number;
  readonly reservedDirectorStageSlots: number;
  readonly maxAdditionalStageParticipants: number;
  readonly waitingGuestCount: number;
  readonly admittedGuestCount: number;
  readonly backstageGuestCount: number;
  readonly onStageGuestCount: number;
  readonly presentation: RoomPresentation;
  readonly branding: RoomBranding;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly openedAt: string | null;
  readonly endedAt: string | null;
}

export interface RoomChatMessage {
  readonly id: string;
  readonly roomId: string;
  readonly sender: { readonly participantId: string; readonly accountLinked: boolean; readonly displayName: string; readonly avatarUrl: string | null };
  readonly body: string | null;
  readonly createdAt: string;
  readonly deleted: boolean;
  readonly deletedAt: string | null;
  readonly moderationReasonCode: string | null;
}

export interface RoomChatPage {
  readonly items: readonly RoomChatMessage[];
  readonly hasMore: boolean;
  readonly beforeId: string | null;
  readonly unreadCount: number;
  readonly participantId: string;
  readonly maxLength: number;
}

export interface PublicChatCapability {
  readonly platform: string;
  readonly displayName: string;
  readonly configured: boolean;
  readonly connected: boolean;
  readonly actorIdentityConnected: boolean;
  readonly oauthSupported: boolean;
  readonly chatReadSupported: boolean;
  readonly chatWriteSupported: boolean;
  readonly currentlyImplemented: boolean;
  readonly requiredScopes: readonly string[];
  readonly connectionLabel: string;
  readonly actor: { readonly displayName: string | null; readonly avatarUrl: string | null } | null;
  readonly reasonCode: string;
  readonly reconnectRequired: boolean;
  readonly selectedRoomDestination: string | null;
  readonly authorizationUrl: string | null;
}

export interface PublicChatFoundation {
  readonly items: readonly PublicChatCapability[];
  readonly publicUnreadCount: 0;
  readonly sendingEnabled: false;
  readonly sendingReason: string;
}

export interface RoomPresentation {
  readonly participantLabelMode: ParticipantLabelMode;
  readonly layoutMode: StageLayout;
  readonly selectedCustomLayoutId: string | null;
  readonly effectiveLayoutMode: BuiltInStageLayout;
  readonly customLayouts: readonly CustomLayout[];
  readonly spotlightGuestId: string | null;
  readonly presentationGuestId: string | null;
  readonly guestSlotSizing: "fill" | "fit";
  readonly participantMode: "overlay" | "outside";
  readonly participantEdge: "top" | "bottom" | "left" | "right";
}

export interface PresentationSource {
  readonly id: string; readonly roomId: string; readonly sourceType: "screen_share";
  readonly ownerParticipantId: string; readonly displayName: string;
  readonly location: "backstage" | "on_stage" | "stopped";
  readonly createdAt: string; readonly updatedAt: string; readonly startedAt: string; readonly stoppedAt: string | null;
}

export type BrowserSourceLocation = "backstage" | "on_stage" | "disabled";
export type BrowserSourceVisibility = "production_only" | "room";

export interface BrowserSource {
  readonly id: string;
  readonly roomId: string;
  readonly displayName: string;
  readonly sourceType: "browser";
  readonly url: string | null;
  readonly safeHost: string | null;
  readonly location: BrowserSourceLocation;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly refreshOnActivation: boolean;
  readonly muted: boolean;
  readonly interactive: boolean;
  readonly visibilityScope: BrowserSourceVisibility;
  readonly scene: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly zIndex: number };
  readonly opacity: number;
  readonly refreshRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ParticipantLabelMode = "name_and_subtitle" | "name_only" | "hidden";
export type BuiltInStageLayout = "grid" | "interview" | "spotlight" | "presentation";
export type StageLayout = "auto" | "custom" | BuiltInStageLayout;

export interface CustomLayout {
  readonly id: string;
  readonly roomId: string;
  readonly displayName: string;
  readonly sortOrder: number;
  readonly baseLayoutMode: BuiltInStageLayout;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RoomBranding {
  readonly version: 1;
  readonly stageBackground: {
    readonly mode: "solid" | "gradient" | "image";
    readonly color: string;
    readonly gradientColor: string;
    readonly imageAssetId: string | null;
    readonly imageUrl: string | null;
    readonly imageFit: "cover" | "contain";
    readonly imagePosition: "center" | "top" | "bottom";
  };
  readonly logo: {
    readonly assetId: string | null;
    readonly url: string | null;
    readonly position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    readonly size: "small" | "medium" | "large";
    readonly opacity: number;
  };
  readonly nameBadge: {
    readonly backgroundColor: string;
    readonly textColor: string;
    readonly accentColor: string;
    readonly opacity: number;
    readonly density: "compact" | "standard";
    readonly shape: "square" | "subtle-rounded" | "rounded";
    readonly position: "lower-left" | "lower-right";
  };
  readonly subtitle: {
    readonly mode: "inherit" | "separate";
    readonly textColor: string;
    readonly opacity: number;
    readonly textScale: "smaller";
  };
  readonly safeAreaVisible: boolean;
}

export const DEFAULT_ROOM_BRANDING: RoomBranding = {
  version: 1,
  stageBackground: { mode: "solid", color: "#090c11", gradientColor: "#151a22", imageAssetId: null, imageUrl: null, imageFit: "cover", imagePosition: "center" },
  logo: { assetId: null, url: null, position: "top-right", size: "medium", opacity: 1 },
  nameBadge: { backgroundColor: "#080b10", textColor: "#ffffff", accentColor: "#8cc736", opacity: 0.9, density: "standard", shape: "subtle-rounded", position: "lower-left" },
  subtitle: { mode: "inherit", textColor: "#d7dee8", opacity: 0.82, textScale: "smaller" },
  safeAreaVisible: true,
};

export type RoomAssetCategory = "logo" | "stage_background" | "overlay" | "holding" | "presentation_placeholder";

export interface RoomAsset {
  readonly id: string;
  readonly roomId: string;
  readonly category: RoomAssetCategory;
  readonly displayName: string;
  readonly url: string;
  readonly mimeType: "image/webp";
  readonly width: number;
  readonly height: number;
  readonly fileSize: number;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RoomPermissions {
  readonly owner: boolean;
  readonly admin: boolean;
  readonly sessionCohost: boolean;
  readonly permanentCohost: boolean;
  readonly pendingPermanentCohost: boolean;
  readonly manageBackstage: boolean;
  readonly manageParticipants: boolean;
  readonly reorderStage: boolean;
  readonly updateMediaIntent: boolean;
  readonly selfBackstage: boolean;
  readonly selfStage: boolean;
  readonly manageInvites: boolean;
  readonly updateRoom: boolean;
  readonly updatePresentation: boolean;
  readonly updateBranding: boolean;
  readonly manageAssets: boolean;
  readonly manageBrowserSources: boolean;
  readonly manageCustomLayouts: boolean;
  readonly managePermanentCohosts: boolean;
  readonly endRoom: boolean;
}

export type InvitePolicy = "single_use" | "capped" | "open";

export interface RoomInvite {
  readonly id: string;
  readonly roomId: string;
  readonly label: string | null;
  readonly active: boolean;
  readonly inviteCode: string;
  readonly policyType: InvitePolicy;
  readonly maxUses: number | null;
  readonly successfulUseCount: number;
  readonly permanent: boolean;
  readonly exhausted: boolean;
  readonly expired: boolean;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revokedAt: string | null;
}

export interface InviteValidation {
  readonly room: Pick<RoomSummary, "id" | "title" | "description" | "lifecycleState">;
  readonly expiresAt: string | null;
  readonly invite: RoomInvite;
  readonly director: {
    readonly id: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
  } | null;
}

export type GuestLobbyState = "backstage" | "on_stage" | "denied" | "removed" | "left" | "expired";

export interface StudioGuest {
  readonly id: string;
  readonly roomId: string;
  readonly displayName: string;
  readonly subtitle: string | null;
  readonly avatarUrl: string | null;
  readonly avatarColor: string;
  readonly signedIn: boolean;
  readonly accountUserCode: string | null;
  readonly linkedAccount: {
    readonly userCode: string | null;
    readonly displayName: string | null;
    readonly avatarUrl: string | null;
  } | null;
  readonly avatarSource: "room_override" | "linked_account" | "initials";
  readonly sessionCohost: boolean;
  readonly pendingPermanentCohost: boolean;
  readonly accountId: string | null;
  readonly state: GuestLobbyState;
  readonly microphoneMuted: boolean;
  readonly cameraHidden: boolean;
  readonly stagePosition: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly admittedAt: string | null;
  readonly deniedAt: string | null;
  readonly removedAt: string | null;
  readonly leftAt: string | null;
  readonly room?: InviteValidation["room"];
}

export interface GuestRoomView {
  readonly room: NonNullable<StudioGuest["room"]> & {
    readonly presentation: RoomPresentation;
    readonly branding: RoomBranding;
    readonly totalStageCapacity: number;
    readonly reservedDirectorStageSlots: number;
    readonly maxAdditionalStageParticipants: number;
  };
  readonly self: StudioGuest;
  readonly stage: readonly StudioGuest[];
  readonly permissions: RoomPermissions;
}

export type RoomConnectionState = "live" | "reconnecting" | "fallback polling" | "unavailable";
export type CohostScope = "all_rooms" | "selected_rooms";
export type CohostRelationshipStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface SafeAccountSummary {
  readonly id: string;
  readonly userCode?: string | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface CohostRelationship {
  readonly id: string;
  readonly director: SafeAccountSummary | null;
  readonly cohost: SafeAccountSummary | null;
  readonly status: CohostRelationshipStatus;
  readonly scopeType: CohostScope;
  readonly roomIds: readonly string[];
  readonly room: { readonly id: string; readonly title: string } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
}

export interface RoomCohosts {
  readonly director: SafeAccountSummary | null;
  readonly session: readonly StudioGuest[];
  readonly permanent: readonly CohostRelationship[];
  readonly permissions: RoomPermissions;
}

export type MediaProviderId = "cloudflare-realtime" | "livekit";

export interface MediaProviderDirection {
  readonly id: MediaProviderId;
  readonly role: "initial-alpha" | "planned-production";
  readonly transportsMediaOutsideRuntime: true;
}

export const mediaProviderDirection: readonly MediaProviderDirection[] = [
  {
    id: "cloudflare-realtime",
    role: "initial-alpha",
    transportsMediaOutsideRuntime: true,
  },
  {
    id: "livekit",
    role: "planned-production",
    transportsMediaOutsideRuntime: true,
  },
] as const;
