import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import roomStyles from "../../styles/room-workspace.css?raw";

describe("room workspace shell contract", () => {
  it("places the canonical contextual panel before the Stage and removes the desktop right-panel grid", () => {
    expect(roomStyles).toContain(".production-workspace.is-panel-expanded { grid-template-columns: 360px minmax(0, 1fr); }");
    expect(roomStyles).toContain(".production-workspace .program-panel");
    expect(roomStyles).toMatch(/\.workspace-side-panel[^}]*grid-column:\s*1/);
    expect(roomSource).toContain('aria-label="Contextual room controls"');
    expect(roomSource).not.toContain("workspace-panel-rail");
  });

  it("keeps hover expansion ephemeral while pinned and hidden widths remain explicit", () => {
    expect(roomStyles).toMatch(/\.workspace-side-panel\.is-collapsed\.is-peeking\s*\{[^}]*position:\s*absolute/);
    expect(roomStyles).toContain(".production-workspace.is-panel-collapsed { grid-template-columns: 64px minmax(0, 1fr); }");
    expect(roomStyles).toContain(".production-workspace.is-panel-hidden { grid-template-columns: 0 minmax(0, 1fr); gap: 0; }");
    expect(roomSource).toContain('preferences.sidebar === "collapsed"');
    expect(roomSource).toContain('setSidebar("collapsed")');
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
    expect(roomSource).toContain("Stable guest keys preserve registered media elements");
    expect(roomSource).toContain("ContextualNoticeStack");
  });
});
