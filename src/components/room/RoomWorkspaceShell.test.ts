import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import shellSource from "../shell/StudioShell.tsx?raw";
import edgeSidebarSource from "../shell/StudioEdgeSidebar.tsx?raw";
import viewSource from "../ViewOptionsMenu.tsx?raw";
import preferencesSource from "../../presentation/presentationPreferences.ts?raw";
import roomStyles from "../../styles/room-workspace.css?raw";

describe("shared active-room edge sidebar and Stage geometry contract", () => {
  it("uses the same mirrored component for both shell edges", () => {
    expect(shellSource).toContain("<StudioEdgeSidebar");
    expect(shellSource).toContain('edge="left"');
    expect(roomSource).toContain("<StudioEdgeSidebar");
    expect(roomSource).toContain('edge="right"');
    expect(edgeSidebarSource).toContain("studio-edge-sidebar__rail");
    expect(edgeSidebarSource).toContain("studio-edge-sidebar__panel");
    expect(edgeSidebarSource).toContain("studio-edge-sidebar__header");
    expect(edgeSidebarSource).toContain("studio-edge-sidebar__body");
  });

  it("portals the right edge into the shell grid instead of the production or Stage DOM", () => {
    expect(roomSource).toContain("<StudioEdgeSidebarPortal>");
    expect(edgeSidebarSource).toContain('closest<HTMLElement>(".studio-shell")');
    expect(edgeSidebarSource).toContain("createPortal(children, shell)");
    expect(roomStyles).toContain('"left-sidebar main right-sidebar"');
    expect(roomStyles).toContain("grid-area: right-sidebar");
    expect(roomSource.indexOf("<StudioEdgeSidebarPortal>")).toBeGreaterThan(roomSource.indexOf('className="program-stage-viewport"'));
  });

  it("gives both edges equal full-height fixed rails, independent scroll bodies, and final-row square toggles", () => {
    expect(roomStyles).toMatch(/\.studio-edge-sidebar\s*\{[\s\S]*position:\s*relative[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/);
    expect(roomStyles).toMatch(/studio-edge-sidebar__rail[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto/);
    expect(roomStyles).toMatch(/studio-edge-sidebar__body[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(roomStyles).toMatch(/studio-edge-sidebar__toggle[^}]*grid-row:\s*2[^}]*align-self:\s*end/);
    expect(roomStyles).toMatch(/studio-edge-sidebar__section,[\s\S]*studio-edge-sidebar__toggle[\s\S]*width:\s*46px[\s\S]*height:\s*46px/);
    expect(edgeSidebarSource).toContain('`${pinned ? "Collapse" : "Expand"} ${edge} sidebar`');
  });

  it("defaults both edges collapsed and keeps hover, pinned, and hidden tracks independent", () => {
    expect(shellSource).toContain('return "collapsed"');
    expect(preferencesSource).toContain('sidebar: "collapsed"');
    expect(roomStyles).toContain("--studio-left-sidebar-track: 64px");
    expect(roomStyles).toContain("--studio-right-sidebar-track: 64px");
    expect(roomStyles).toContain("--studio-left-sidebar-track: 424px");
    expect(roomStyles).toContain("--studio-right-sidebar-track: 424px");
    expect(roomStyles).toContain("--studio-left-sidebar-track: 0px");
    expect(roomStyles).toContain("--studio-right-sidebar-track: 0px");
    expect(roomStyles).toMatch(/is-collapsed\.is-temporarily-expanded \.studio-edge-sidebar__panel\s*\{[^}]*position:\s*absolute/);
    expect(viewSource).toContain("Hide primary sidebar");
    expect(viewSource).toContain("Hide room production sidebar");
  });

  it("restores the uncapped center track and one maximum contained 16:9 Stage contract", () => {
    expect(roomStyles).toContain("grid-template-columns: var(--studio-left-sidebar-track) minmax(0, 1fr) var(--studio-right-sidebar-track)");
    expect(roomStyles).toContain("max-width: none");
    expect(roomStyles).toContain("container-type: size");
    expect(roomStyles).toContain("width: min(100cqw, calc((100cqh - 58px) * 16 / 9))");
    expect(roomStyles).toContain("height: min(calc(100cqw * 9 / 16), calc(100cqh - 58px))");
    expect(roomStyles).toContain("aspect-ratio: 16 / 9");
    expect(roomStyles).toContain(".program-panel__toolbar,\n.program-stage-viewport");
    expect(roomSource.indexOf('className="backstage-tray"')).toBeGreaterThan(roomSource.indexOf('className="control-dock"'));
  });

  it("preserves production content, stable media identity, nine slots, Fill/Fit, and OFF AIR truth", () => {
    for (const token of ["Backstage", "Invites", "Room", "Branding", "Media", "CO-HOSTS", "CustomLayoutsSection", "RoomBrandingPanel", "RoomMediaPanel"]) expect(roomSource).toContain(token);
    expect(roomSource.indexOf("useStudioMedia(roomId")).toBeLessThan(roomSource.indexOf("<StudioShell roomWorkspace"));
    expect(roomSource).toContain("key={guest.id}");
    expect(roomSource).toContain(".slice(0, 9)");
    expect(roomSource).toContain("Fill guest media slots");
    expect(roomSource).toContain("Fit guest media slots");
    expect(roomSource).toContain("OFF AIR");
    expect(roomSource).toContain('<Button disabled title="Output integration not connected"');
  });
});
