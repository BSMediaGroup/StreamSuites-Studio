import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import shellSource from "../shell/StudioShell.tsx?raw";
import roomStyles from "../../styles/room-workspace.css?raw";

describe("room workspace shell contract", () => {
  it("restores the canonical contextual panel to the right of the Stage without a duplicate rail", () => {
    expect(roomStyles).toContain(".production-workspace.is-panel-expanded { grid-template-columns: minmax(0, 1fr) 360px; }");
    expect(roomStyles).toContain(".production-workspace .program-panel");
    expect(roomStyles).toMatch(/\.workspace-side-panel[^}]*grid-column:\s*2/);
    expect(roomSource).toContain('aria-label="Contextual room controls"');
    expect(roomSource).not.toContain("workspace-panel-rail");
    expect(shellSource.match(/<aside/g)).toHaveLength(1);
    expect(roomSource.match(/<aside/g)).toHaveLength(1);
    expect(shellSource).toContain('aria-label="Studio workspace"');
  });

  it("keeps hover expansion ephemeral while pinned and hidden widths remain explicit", () => {
    expect(roomStyles).toMatch(/\.workspace-side-panel\.is-collapsed\.is-peeking\s*\{[^}]*position:\s*absolute/);
    expect(roomStyles).toContain(".production-workspace.is-panel-collapsed { grid-template-columns: minmax(0, 1fr) 64px; }");
    expect(roomStyles).toContain(".production-workspace.is-panel-hidden { grid-template-columns: minmax(0, 1fr) 0; gap: 0; }");
    expect(roomSource).toContain('preferences.sidebar === "collapsed"');
    expect(roomSource).toContain('setSidebar("collapsed")');
  });

  it("keeps right-panel tabs readable in one horizontally scrollable row", () => {
    expect(roomSource).toContain('className="workspace-tabs__scroll"');
    expect(roomSource).toContain('aria-label="Previous room panels"');
    expect(roomSource).toContain('aria-label="Next room panels"');
    expect(roomSource).toContain("scrollPanelTabs(-1)");
    expect(roomSource).toContain("scrollPanelTabs(1)");
    expect(roomSource).toContain("scrollIntoView?.");
    expect(roomStyles).toMatch(/\.workspace-tabs__scroll[^}]*flex-wrap:\s*nowrap/);
    expect(roomStyles).toMatch(/\.workspace-tabs__scroll[^}]*overflow-x:\s*auto/);
    expect(roomStyles).toMatch(/\.workspace-tabs \.workspace-tabs__scroll > button[^}]*min-width:\s*88px/);
    expect(roomStyles).toContain("grid-template-columns: 30px minmax(0, 1fr) 30px");
    expect(roomStyles).toContain("overflow-x: clip");
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
