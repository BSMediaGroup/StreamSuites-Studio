import type { StudioAccessState } from "../domain/studio";

export interface SafeApiError {
  readonly code: string;
  readonly message: string;
  readonly status?: number;
  readonly retryable: boolean;
}

/** Raw runtime payloads remain unknown until an adapter validates them. */
export type RuntimePayload = unknown;

export interface CurrentSessionRequestContract {
  readonly method: "GET";
  readonly path: "/auth/session";
  readonly credentials: "include";
  readonly response: RuntimePayload;
}

export interface CurrentSessionAdapter {
  loadCurrentSession(signal?: AbortSignal): Promise<StudioAccessState>;
}

export const currentSessionRequest: CurrentSessionRequestContract = {
  method: "GET",
  path: "/auth/session",
  credentials: "include",
  response: undefined,
};
