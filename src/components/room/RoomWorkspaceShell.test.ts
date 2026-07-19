import { describe, expect, it } from "vitest";
import roomSource from "../../pages/RoomManagementPage.tsx?raw";
import shellSource from "../shell/StudioShell.tsx?raw";
import edgeSidebarSource from "../shell/StudioEdgeSidebar.tsx?raw";
import viewSource from "../ViewOptionsMenu.tsx?raw";
import preferencesSource from "../../presentation/presentationPreferences.ts?raw";
import roomStyles from "../../styles/room-workspace.css?raw";
import requestSource from "../CohostRequests.tsx?raw";
import footerSource from "../StudioFooter.tsx?raw";
import sharedStyles from "../../styles/index.css?raw";
import tokens from "../../styles/tokens.css?raw";

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
    expect(roomStyles).toContain(".studio-shell--room-workspace > .studio-edge-sidebar");
    expect(roomStyles).toContain("align-self: stretch");
    expect(roomStyles).toContain("justify-self: end");
    expect(roomStyles).toContain("overflow-x: clip");
  });

  it("uses the body overlay root and an explicit opaque Requests surface above shell chrome", () => {
    expect(requestSource).toContain("createPortal(");
    expect(requestSource).toContain("document.body");
    expect(requestSource).toContain('role="dialog"');
    expect(requestSource).toContain('querySelector<HTMLButtonElement>(".cohost-requests__trigger")?.focus()');
    expect(requestSource).toContain('event.key === "Escape"');
    expect(requestSource).toContain('document.addEventListener("pointerdown"');
    expect(sharedStyles).toContain("z-index: var(--z-studio-overlay)");
    expect(sharedStyles).toContain("background: var(--overlay-surface)");
    expect(sharedStyles).not.toMatch(/\.cohost-requests__panel[^}]*backdrop-filter/);
    expect(tokens.match(/--overlay-surface:\s*#[0-9a-f]{6}/gi)).toHaveLength(2);
    expect(tokens).toContain("--z-studio-modal: 400");
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
    expect(roomStyles).toMatch(/\.studio-edge-sidebar\s*\{[^}]*width:\s*calc\(var\(--studio-edge-rail-width\) \+ var\(--studio-edge-panel-width\)\)[^}]*gap:\s*0/);
    expect(roomStyles).toMatch(/is-collapsed\.is-temporarily-expanded \.studio-edge-sidebar__panel\s*\{[^}]*grid-column:\s*auto/);
    expect(roomStyles).toContain(".studio-edge-sidebar--left.is-collapsed.is-temporarily-expanded .studio-edge-sidebar__panel { right: auto; left: 100%; }");
    expect(roomStyles).toContain(".studio-edge-sidebar--right.is-collapsed.is-temporarily-expanded .studio-edge-sidebar__panel { right: 100%; left: auto; }");
    expect(roomStyles).toMatch(/\.studio-edge-sidebar__panel\s*\{[^}]*background:\s*var\(--sidebar-bg\)/);
    expect(roomStyles).toMatch(/\.studio-edge-sidebar__rail\s*\{[^}]*background:\s*var\(--sidebar-bg\)/);
    expect(viewSource).toContain("Hide primary sidebar");
    expect(viewSource).toContain("Hide room production sidebar");
  });

  it("ports the Public footer/status DOM and keeps its disclosures opaque and out of layout", () => {
    for (const className of ["footer-shell", "footer-bar", "footer-links", "footer-copyright", "footer-meta", "footer-status", "ss-status-indicator", "ss-status-toggle", "ss-status-dot", "ss-status-label", "ss-status-details", "ss-status-summary", "ss-status-link", "footer-version-tooltip-container", "footer-version-tooltip"]) {
      expect(footerSource).toContain(className);
    }
    expect(footerSource).not.toContain("studio-runtime-status");
    expect(footerSource).toContain("fetchRuntimeVersion");
    expect(footerSource).toContain("Build {build}");
    expect(footerSource).toContain("document.addEventListener(\"pointerdown\"");
    expect(footerSource).toContain("document.addEventListener(\"keydown\"");
    expect(footerSource).toContain("location.key");
    expect(sharedStyles).toMatch(/\.studio-global-footer \.footer-bar\s*\{[^}]*display:\s*grid[^}]*height:\s*42px/);
    expect(sharedStyles).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)");
    expect(sharedStyles).toContain("padding: 0 var(--footer-padding-x)");
    expect(sharedStyles).toMatch(/\.studio-global-footer \.ss-status-details\s*\{[^}]*position:\s*absolute/);
    expect(sharedStyles).toMatch(/\.studio-global-footer \.ss-status-details\s*\{[^}]*background:\s*var\(--studio-footer-status-panel\)/);
    expect(sharedStyles).toMatch(/\.footer-version-tooltip\s*\{[^}]*background:\s*var\(--studio-footer-status-panel\)/);
    expect(sharedStyles).not.toMatch(/\.studio-global-footer \.ss-status-details[^}]*backdrop-filter/);
    expect(sharedStyles.match(/--studio-footer-status-panel:\s*#[0-9a-f]{3,6}/gi)).toHaveLength(2);
    expect(tokens.match(/--overlay-surface:\s*#[0-9a-f]{6}/gi)).toHaveLength(2);
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
