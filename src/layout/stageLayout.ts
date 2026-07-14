import type { BuiltInStageLayout, StageLayout } from "../domain/studio";

export type EffectiveStageLayout = BuiltInStageLayout;

export const GUEST_GRID_ROWS: Readonly<Record<number, readonly number[]>> = {
  1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [3, 3, 1], 8: [3, 3, 2], 9: [3, 3, 3],
};

export function stageGridRows(participantCount: number): readonly number[] {
  return GUEST_GRID_ROWS[Math.max(1, Math.min(9, Math.trunc(participantCount)))] ?? GUEST_GRID_ROWS[1];
}

export function resolveEffectiveStageLayout({ requested, activeScreenShare, explicitSpotlight, participantCount, customBaseMode = "grid" }: {
  readonly requested: StageLayout;
  readonly activeScreenShare: boolean;
  readonly explicitSpotlight: boolean;
  readonly participantCount: number;
  readonly customBaseMode?: BuiltInStageLayout;
}): EffectiveStageLayout {
  if (requested === "custom") return customBaseMode;
  if (requested !== "auto") return requested;
  if (activeScreenShare) return "presentation";
  if (explicitSpotlight) return "spotlight";
  if (participantCount <= 1) return "spotlight";
  if (participantCount === 2) return "interview";
  return "grid";
}
