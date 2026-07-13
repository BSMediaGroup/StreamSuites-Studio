import type { StageLayout } from "../domain/studio";

export type EffectiveStageLayout = Exclude<StageLayout, "auto">;

export function resolveEffectiveStageLayout({ requested, activeScreenShare, explicitSpotlight, participantCount }: {
  readonly requested: StageLayout;
  readonly activeScreenShare: boolean;
  readonly explicitSpotlight: boolean;
  readonly participantCount: number;
}): EffectiveStageLayout {
  if (requested !== "auto") return requested;
  if (activeScreenShare) return "presentation";
  if (explicitSpotlight) return "spotlight";
  if (participantCount <= 1) return "spotlight";
  if (participantCount === 2) return "interview";
  return "grid";
}
