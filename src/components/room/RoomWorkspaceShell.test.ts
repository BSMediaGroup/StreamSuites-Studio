import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import shellSource from "../shell/StudioShell.tsx?raw";
import footerSource from "../StudioFooter.tsx?raw";
import sharedStyles from "../../styles/index.css?raw";
import roomStyles from "../../styles/room-workspace.css?raw";
import tokens from "../../styles/tokens.css?raw";

describe("room workspace shell contract", () => {
  it("restores the canonical contextual panel to the right of the Stage without a duplicate rail", () => {
    expect(roomStyles).toContain(".room-workspace.is-panel-expanded .room-viewport { grid-template-columns: minmax(0, 1fr) 424px; }");
    expect(roomStyles).toMatch(/production-workspace\.is-panel-hidden\s*\{\s*display:\s*contents/);
    expect(roomStyles).toContain(".production-workspace .program-panel");
    expect(roomStyles).toMatch(/\.workspace-side-panel[^}]*grid-column:\s*2[^}]*grid-row:\s*1 \/ -1/);
    expect(roomSource).toContain('aria-label="Room production sidebar"');
    expect(roomSource).toContain('className="workspace-panel-rail"');
    expect(roomSource).toContain('className="workspace-panel-content"');
    expect(shellSource.match(/<aside/g)).toHaveLength(1);
    expect(roomSource.match(/<aside/g)).toHaveLength(1);
    expect(shellSource).toContain('aria-label="Primary Studio sidebar"');
  });

  it("keeps hover expansion ephemeral while pinned and hidden widths remain explicit", () => {
    expect(roomStyles).toMatch(/\.workspace-side-panel\.is-collapsed\.is-peeking\s*\{[^}]*position:\s*absolute/);
    expect(roomStyles).toContain("grid-template-columns: minmax(0, 1fr) 64px");
    expect(roomStyles).toContain(".room-workspace.is-panel-hidden .room-viewport { grid-template-columns: minmax(0, 1fr) 0; column-gap: 0; }");
    expect(roomSource).toContain('preferences.sidebar === "collapsed"');
    expect(roomSource).toContain('setSidebar("collapsed")');
  });

  it("uses dedicated vertical right panels with no compressed horizontal top-level tabs", () => {
    expect(roomSource).not.toContain("workspace-tabs");
    expect(roomSource).not.toContain("scrollPanelTabs");
    expect(roomSource).toContain('aria-label={`Open ${panelLabels[item]} panel`}');
    expect(roomSource).toContain('{panelLabels[panel].toUpperCase()}');
    expect(roomSource).not.toContain('<h2>{panelLabels[panel]}</h2>');
    expect(roomStyles).toMatch(/\.workspace-panel-rail[^}]*flex-direction:\s*column/);
    expect(roomStyles).toMatch(/\.room-workspace[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  });

  it("keeps left and right overlay and pinned geometry independent", () => {
    expect(roomStyles).toContain(".studio-shell--sidebar-collapsed { grid-template-columns: 64px minmax(0, 1fr); }");
    expect(roomStyles).toContain(".studio-shell--sidebar-expanded { grid-template-columns: 424px minmax(0, 1fr); }");
    expect(roomStyles).toMatch(/studio-shell--sidebar-peeking[^}]*position:\s*absolute/);
    expect(roomStyles).toContain("grid-template-columns: minmax(0, 1fr) 64px");
    expect(roomStyles).toContain(".room-workspace.is-panel-expanded .room-viewport { grid-template-columns: minmax(0, 1fr) 424px; }");
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

  it("keeps both panel bodies independently scrollable and both bottom toggles square", () => {
    expect(roomStyles).toMatch(/studio-sidebar__scroll[^}]*overflow-y:\s*auto/);
    expect(roomStyles).toMatch(/workspace-panel-content > \.backstage-panel[\s\S]*overflow-y:\s*auto/);
    expect(roomStyles).toContain("width: 46px; height: 46px; min-height: 46px");
    expect(roomStyles).toMatch(/workspace-panel-rail[^}]*justify-content:\s*space-between/);
  });

  it("uses shared positive and destructive contrast tokens", () => {
    expect(tokens).toContain("--danger-contrast:");
    expect(sharedStyles).toMatch(/button--quiet:not\(\.button--destructive\)[\s\S]*background:\s*var\(--accent\)[\s\S]*color:\s*var\(--accent-contrast\)/);
    expect(sharedStyles).toMatch(/button--destructive:not\(:disabled\):hover[\s\S]*background:\s*var\(--danger\)[\s\S]*color:\s*var\(--danger-contrast\)/);
  });

  it("aligns the Stage rail with the Stage and exposes canonical Fill/Fit in Room", () => {
    expect(roomStyles).toContain(".program-panel__toolbar,\n.program-stage-viewport { width: 100%; min-width: 0; }");
    expect(roomSource).toContain("Fill guest media slots");
    expect(roomSource).toContain("Fit guest media slots");
    expect(roomSource).toContain("room.presentation.guestSlotSizing === value");
    expect(roomSource).toContain("changePresentationSetting({ guestSlotSizing: value })");
  });

  it("ports the Public footer bar, version tooltip, and Runtime/Auth status contract", () => {
    for (const token of ["footer-shell", "footer-bar", "footer-links", "footer-copyright", "footer-meta", "footer-status", "footer-version-tooltip"]) expect(footerSource).toContain(token);
    expect(footerSource).toContain("Runtime/Auth");
    expect(sharedStyles).toContain("height: 36px");
    expect(sharedStyles).toContain("backdrop-filter: blur(16px)");
  });

  it("keeps the media hook and stable participant identity outside panel state", () => {
    expect(roomSource.indexOf("useStudioMedia(roomId")).toBeLessThan(roomSource.indexOf("<StudioShell roomWorkspace"));
    expect(roomSource).toContain("key={guest.id}");
    expect(roomSource).toContain("ContextualNoticeStack");
    expect(roomSource).toContain(".slice(0, 9)");
  });
});
