import type { BuiltInStageLayout, StageLayout } from "../domain/studio";

export type EffectiveStageLayout = BuiltInStageLayout;

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
