/**
 * Provisional frontend models only. Runtime/Auth remains authoritative and a
 * future adapter must map its confirmed response contracts into these shapes.
 */
export type StudioAccessStatus =
  | "unknown"
  | "signed_out"
  | "pending_validation"
  | "authorized"
  | "denied";

export interface StudioAccessState {
  readonly status: StudioAccessStatus;
  readonly source: "runtime-auth";
  readonly reason?: string;
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
