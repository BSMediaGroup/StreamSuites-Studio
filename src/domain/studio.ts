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

export interface RoomSummary {
  readonly id: string;
  readonly ownerAccountId: string;
  readonly title: string;
  readonly description: string | null;
  readonly lifecycleState: RoomLifecycle;
  readonly maxGuestStageOccupants: number;
  readonly waitingGuestCount: number;
  readonly admittedGuestCount: number;
  readonly presentation: RoomPresentation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly openedAt: string | null;
  readonly endedAt: string | null;
}

export interface RoomPresentation {
  readonly showParticipantSubtitles: boolean;
}

export interface RoomPermissions {
  readonly owner: boolean;
  readonly admin: boolean;
  readonly sessionCohost: boolean;
  readonly permanentCohost: boolean;
  readonly pendingPermanentCohost: boolean;
  readonly manageBackstage: boolean;
  readonly manageInvites: boolean;
  readonly updateRoom: boolean;
  readonly updatePresentation: boolean;
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

export type GuestLobbyState = "waiting" | "admitted" | "denied" | "removed" | "left" | "expired";

export interface StudioGuest {
  readonly id: string;
  readonly roomId: string;
  readonly displayName: string;
  readonly subtitle: string | null;
  readonly avatarUrl: string | null;
  readonly avatarColor: string;
  readonly signedIn: boolean;
  readonly sessionCohost: boolean;
  readonly pendingPermanentCohost: boolean;
  readonly accountId: string | null;
  readonly state: GuestLobbyState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly admittedAt: string | null;
  readonly deniedAt: string | null;
  readonly removedAt: string | null;
  readonly leftAt: string | null;
  readonly room?: InviteValidation["room"];
}

export type RoomConnectionState = "live" | "reconnecting" | "fallback polling" | "unavailable";
export type CohostScope = "all_rooms" | "selected_rooms";
export type CohostRelationshipStatus = "pending" | "accepted" | "declined" | "revoked";

export interface SafeAccountSummary {
  readonly id: string;
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
  readonly createdAt: string;
  readonly updatedAt: string;
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
