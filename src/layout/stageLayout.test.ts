import { describe, expect, it } from "vitest";
import { resolveEffectiveStageLayout, stageGridRows } from "./stageLayout";
import studioStyles from "../styles/index.css?raw";

describe("resolveEffectiveStageLayout", () => {
  it("provides the exact centered 1-9 row contract", () => {
    expect(Array.from({ length: 9 }, (_, index) => stageGridRows(index + 1))).toEqual([[1], [2], [2, 1], [2, 2], [3, 2], [3, 3], [3, 3, 1], [3, 3, 2], [3, 3, 3]]);
  });
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

describe("Stage workspace CSS contract", () => {
  it("keeps the Stage 16:9 and gives two participants equal full-height columns", () => {
    expect(studioStyles).toMatch(/\.program-canvas,[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(studioStyles).toContain('.program-canvas[data-participant-count="2"] .program-stage-grid');
    expect(studioStyles).toMatch(/data-participant-count="2"[\s\S]*grid-template-columns:\s*repeat\(2/);
    expect(studioStyles).toMatch(/data-participant-count="2"[\s\S]*height:\s*100%/);
  });

  it("centers explicit rows and distinguishes Runtime Fill/Fit geometry", () => {
    expect(studioStyles).toMatch(/\.program-stage-row\s*\{[^}]*justify-content:\s*center/);
    expect(studioStyles).toMatch(/data-slot-sizing="fit"[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(studioStyles).toMatch(/program-stage-row\s*>\s*\.participant-tile[\s\S]*height:\s*100%/);
  });

  it("contains overlay/outside presentation strips at every edge", () => {
    expect(studioStyles).toContain(".program-canvas--presentation.presentation-overlay.edge-top");
    expect(studioStyles).toContain(".program-canvas--presentation.presentation-overlay.edge-bottom");
    expect(studioStyles).toContain(".program-canvas--presentation.presentation-overlay:is(.edge-left,.edge-right)");
    expect(studioStyles).toContain(".program-canvas--presentation.presentation-outside:is(.edge-top,.edge-bottom)");
    expect(studioStyles).toContain(".program-canvas--presentation.presentation-outside:is(.edge-left,.edge-right)");
  });

  it("pins sidebar chrome, stretches the room panel, portals tooltips, and doubles only exit", () => {
    expect(studioStyles).toMatch(/\.studio-shell\s*\{[^}]*height:\s*100dvh/);
    expect(studioStyles).toMatch(/\.workspace-side-panel\s*\{[^}]*height:\s*100%[^}]*max-height:\s*none/);
    expect(studioStyles).toMatch(/\.studio-tooltip-portal\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*1000/);
    expect(studioStyles).toMatch(/\.room-exit-button\s*>\s*\.studio-icon\s*\{[^}]*width:\s*3\.4rem[^}]*height:\s*3\.4rem/);
  });
});
