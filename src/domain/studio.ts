export type StreamSuitesAccountType = "admin" | "creator" | "developer" | "public";

export interface StudioSessionAccount {
  readonly id: string;
  readonly userCode: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly accountType: StreamSuitesAccountType;
  readonly tier: string | null;
}

export type StudioAccessStatus =
  | "loading"
  | "unauthenticated"
  | "unavailable"
  | "denied"
  | "restricted"
  | "allowed";

export interface StudioAccessState {
  readonly status: StudioAccessStatus;
  readonly source: "runtime-auth";
  readonly reasonCode: string;
  readonly account: StudioSessionAccount | null;
  readonly stage: "ALPHA";
  readonly activeTesterLimit: number;
  readonly errorMessage?: string;
}

export type RoomLifecycle = "draft" | "ready" | "active" | "ended";

export interface RoomSummary {
  readonly id: string;
  readonly displayName: string;
  readonly lifecycle: RoomLifecycle;
}

export type GuestInviteValidation =
  | "unchecked"
  | "checking"
  | "valid"
  | "invalid"
  | "expired";

export interface GuestInvite {
  readonly code: string;
  readonly validation: GuestInviteValidation;
  readonly room?: RoomSummary;
  readonly expiresAt?: string;
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
