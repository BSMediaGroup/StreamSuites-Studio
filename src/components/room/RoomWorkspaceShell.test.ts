import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import shellSource from "../shell/StudioShell.tsx?raw";
import roomStyles from "../../styles/room-workspace.css?raw";

describe("room workspace shell contract", () => {
  it("restores the canonical contextual panel to the right of the Stage without a duplicate rail", () => {
    expect(roomStyles).toContain(".production-workspace.is-panel-expanded { grid-template-columns: minmax(0, 1fr) 424px; }");
    expect(roomStyles).toContain(".production-workspace .program-panel");
    expect(roomStyles).toMatch(/\.workspace-side-panel[^}]*grid-column:\s*2/);
    expect(roomSource).toContain('aria-label="Room production sidebar"');
    expect(roomSource).toContain('className="workspace-panel-rail"');
    expect(roomSource).toContain('className="workspace-panel-content"');
    expect(shellSource.match(/<aside/g)).toHaveLength(1);
    expect(roomSource.match(/<aside/g)).toHaveLength(1);
    expect(shellSource).toContain('aria-label="Primary Studio sidebar"');
  });

  it("keeps hover expansion ephemeral while pinned and hidden widths remain explicit", () => {
    expect(roomStyles).toMatch(/\.workspace-side-panel\.is-collapsed\.is-peeking\s*\{[^}]*position:\s*absolute/);
    expect(roomStyles).toContain(".production-workspace.is-panel-collapsed { grid-template-columns: minmax(0, 1fr) 64px; }");
    expect(roomStyles).toContain(".production-workspace.is-panel-hidden { grid-template-columns: minmax(0, 1fr) 0; gap: 0; }");
    expect(roomSource).toContain('preferences.sidebar === "collapsed"');
    expect(roomSource).toContain('setSidebar("collapsed")');
  });

  it("uses dedicated vertical right panels with no compressed horizontal top-level tabs", () => {
    expect(roomSource).not.toContain("workspace-tabs");
    expect(roomSource).not.toContain("scrollPanelTabs");
    expect(roomSource).toContain('aria-label={`Open ${panelLabels[item]} panel`}');
    expect(roomSource).toContain('<h2>{panelLabels[panel]}</h2>');
    expect(roomStyles).toMatch(/\.workspace-panel-rail[^}]*flex-direction:\s*column/);
    expect(roomStyles).toContain(".room-workspace { display: block; max-width: 100%; min-height: 100%; overflow-x: clip; }");
  });

  it("keeps left and right overlay and pinned geometry independent", () => {
    expect(roomStyles).toContain(".studio-shell--sidebar-collapsed { grid-template-columns: 64px minmax(0, 1fr); }");
    expect(roomStyles).toContain(".studio-shell--sidebar-expanded { grid-template-columns: 424px minmax(0, 1fr); }");
    expect(roomStyles).toMatch(/studio-shell--sidebar-peeking[^}]*position:\s*absolute/);
    expect(roomStyles).toContain(".production-workspace.is-panel-collapsed { grid-template-columns: minmax(0, 1fr) 64px; }");
    expect(roomStyles).toContain(".production-workspace.is-panel-expanded { grid-template-columns: minmax(0, 1fr) 424px; }");
    expect(roomStyles).toMatch(/\.workspace-side-panel\.is-collapsed\.is-peeking[^}]*position:\s*absolute/);
    expect(roomSource).toContain("Collapse room production sidebar");
    expect(shellSource).toContain("Collapse Studio sidebar");
  });

  it("fits a 16:9 Stage by both container dimensions and lets Backstage follow the viewport", () => {
    expect(roomStyles).toContain("container-type: size");
    expect(roomStyles).toContain("width: min(100cqw, calc(100cqh * 16 / 9))");
    expect(roomStyles).toContain("height: min(100cqh, calc(100cqw * 9 / 16))");
    expect(roomSource.indexOf('className="backstage-tray"')).toBeGreaterThan(roomSource.indexOf('className="control-dock"'));
  });

  it("keeps the media hook and stable participant identity outside panel state", () => {
    expect(roomSource.indexOf("useStudioMedia(roomId")).toBeLessThan(roomSource.indexOf("<StudioShell roomWorkspace"));
    expect(roomSource).toContain("key={guest.id}");
    expect(roomSource).toContain("ContextualNoticeStack");
    expect(roomSource).toContain(".slice(0, 9)");
  });
});
