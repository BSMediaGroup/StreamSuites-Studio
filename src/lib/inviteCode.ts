export interface InviteCodeCheck {
  readonly normalized: string;
  readonly isSafeFormat: boolean;
}

const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{4,96}$/;

export function checkInviteCode(value: string | undefined): InviteCodeCheck {
  const normalized = value?.trim() ?? "";
  return {
    normalized,
    isSafeFormat: INVITE_CODE_PATTERN.test(normalized),
  };
}
