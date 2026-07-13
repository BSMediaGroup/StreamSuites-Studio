import { describe, expect, it } from "vitest";
import { resolveEffectiveStageLayout } from "./stageLayout";

describe("resolveEffectiveStageLayout", () => {
  it.each([
    [1, "spotlight"],
    [2, "interview"],
    [3, "grid"],
    [4, "grid"],
    [5, "grid"],
    [6, "grid"],
    [7, "grid"],
    [8, "grid"],
    [9, "grid"],
  ] as const)("derives the Auto arrangement for %i Stage participants", (participantCount, expected) => {
    expect(resolveEffectiveStageLayout({ requested: "auto", activeScreenShare: false, explicitSpotlight: false, participantCount })).toBe(expected);
  });

  it("prioritizes a live screen share, then returns to the count-derived layout", () => {
    expect(resolveEffectiveStageLayout({ requested: "auto", activeScreenShare: true, explicitSpotlight: false, participantCount: 4 })).toBe("presentation");
    expect(resolveEffectiveStageLayout({ requested: "auto", activeScreenShare: false, explicitSpotlight: false, participantCount: 4 })).toBe("grid");
  });

  it("prioritizes an explicit spotlight after screen sharing", () => {
    expect(resolveEffectiveStageLayout({ requested: "auto", activeScreenShare: false, explicitSpotlight: true, participantCount: 7 })).toBe("spotlight");
  });

  it("leaves explicit Runtime modes unchanged", () => {
    for (const requested of ["grid", "interview", "spotlight", "presentation"] as const) {
      expect(resolveEffectiveStageLayout({ requested, activeScreenShare: true, explicitSpotlight: true, participantCount: 9 })).toBe(requested);
    }
  });
});
