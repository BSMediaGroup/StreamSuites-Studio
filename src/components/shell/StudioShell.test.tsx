import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchRuntimeVersion } from "../../api/runtimeVersion";
import { PresentationProvider } from "../../presentation/PresentationProvider";
import { STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY, STUDIO_PRESENTATION_STORAGE_KEY, parseContextSidebarMode } from "../../presentation/presentationPreferences";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { StudioFooter } from "../StudioFooter";
import { STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY, StudioShell, parsePrimarySidebarMode } from "./StudioShell";

vi.mock("../../api/runtimeVersion", () => ({ fetchRuntimeVersion: vi.fn() }));
vi.mock("../StudioAccountMenu", () => ({ StudioAccountMenu: () => <button type="button">Account</button> }));
vi.mock("../AuthAccessBanner", () => ({ AuthAccessBanner: () => null }));
vi.mock("../CohostRequests", () => ({ CohostRequests: () => <button type="button">Requests</button> }));

function FooterRouteHarness() {
  const navigate = useNavigate();
  return <><StudioFooter /><button type="button" onClick={() => navigate("/studio/rooms/fixture")}>Navigate to room</button></>;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchRuntimeVersion).mockResolvedValue({ ok: true, value: { version: "0.5.0-alpha", build: "fixture-build", source: "runtime" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); window.localStorage.clear(); });

it("uses one Public-pattern footer status widget with dismissible route-safe behavior", async () => {
  const rendered = render(<MemoryRouter initialEntries={["/studio"]}><FooterRouteHarness /></MemoryRouter>);
  expect(await screen.findByRole("link", { name: "v0.5.0-alpha" })).toBeInTheDocument();

  const footer = rendered.container.querySelector(".studio-global-footer.footer-shell")!;
  const bar = footer.querySelector(".footer-bar")!;
  expect(Array.from(bar.children).map((child) => child.className)).toEqual(["footer-links", "footer-copyright", "footer-meta"]);
  expect(footer.querySelectorAll(".ss-status-indicator")).toHaveLength(1);
  expect(footer.querySelector(".studio-runtime-status")).not.toBeInTheDocument();
  expect(footer.querySelector(".footer-links")).toHaveTextContent("/support/privacy/about");
  expect(footer).toHaveTextContent("© 2026 Brainstream Media Group");
  expect(footer).toHaveTextContent("Build fixture-build");

  const trigger = screen.getByRole("button", { name: "Service status details" });
  const details = footer.querySelector<HTMLElement>(".ss-status-details")!;
  const status = footer.querySelector<HTMLElement>(".ss-status-indicator")!;
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(details).not.toBeVisible();
  fireEvent.focus(trigger);
  expect(details).not.toBeVisible();

  fireEvent.click(trigger);
  expect(details).toBeVisible();
  expect(footer.querySelectorAll(".ss-status-details")).toHaveLength(1);
  fireEvent.pointerLeave(status);
  expect(details).not.toBeVisible();

  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(details).not.toBeVisible();
  await waitFor(() => expect(trigger).toHaveFocus());

  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(details).not.toBeVisible();

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Navigate to room" }));
  expect(details).not.toBeVisible();
});

it("removes status dismissal listeners when the footer unmounts", async () => {
  const remove = vi.spyOn(document, "removeEventListener");
  const rendered = render(<MemoryRouter><StudioFooter /></MemoryRouter>);
  await screen.findByRole("link", { name: "v0.5.0-alpha" });
  fireEvent.click(screen.getByRole("button", { name: "Service status details" }));
  rendered.unmount();
  expect(remove).toHaveBeenCalledWith("pointerdown", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  remove.mockRestore();
});

it("defaults the primary sidebar to collapsed and its bottom toggle only pins or collapses it", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  fireEvent.click(screen.getByRole("button", { name: "Expand left sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  fireEvent.click(screen.getByRole("button", { name: "Collapse left sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  expect(shell).not.toHaveClass("studio-shell--sidebar-hidden");
});

it("keeps lobby product sections in dedicated left panels and restores Destinations", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const expectations = { Studio: "Room lobby", Brand: "Brand library foundation", Media: "Media library foundation", Destinations: "No destinations connected", Settings: "Studio display settings" } as const;
  for (const [section, content] of Object.entries(expectations)) {
    fireEvent.click(screen.getByRole("button", { name: `Open ${section} panel` }));
    const panel = screen.getByRole("region", { name: `${section} panel` });
    expect(panel).toHaveTextContent(content);
    expect(within(panel).queryByRole("heading", { level: 2, name: section })).not.toBeInTheDocument();
    if (section === "Destinations") expect(panel).toHaveTextContent("Studio remains OFF AIR");
  }
  expect(screen.getByRole("complementary", { name: "Primary Studio sidebar" })).not.toHaveTextContent(/use the right|open the production panel|manage this elsewhere/i);
  expect(screen.queryByText("Later")).not.toBeInTheDocument();
});

it("uses in-room left content without moving contextual room tools into it", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell roomWorkspace><p>Room Stage</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Room Stage").closest(".studio-shell")!;
  expect(screen.getByRole("complementary", { name: "Primary Studio sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open Rooms panel" })).toBeInTheDocument();
  for (const section of ["Brand", "Media", "Destinations", "Settings"]) expect(screen.getByRole("button", { name: `Open ${section} panel` })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Backstage panel/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Invites panel/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Studio rooms" })).toHaveAttribute("href", "/studio");

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Hide room production sidebar" }));
  expect(shell).toHaveClass("studio-shell--context-panel-hidden");
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
});

it("places the room Chat shortcut directly beside Requests with a capped private unread badge", () => {
  const openChat = vi.fn();
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell roomWorkspace chatUnreadCount={104} onOpenChat={openChat}><p>Room Stage</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const requests = screen.getByRole("button", { name: "Requests" });
  const chat = screen.getByRole("button", { name: "Open room chat" });
  expect(requests.nextElementSibling).toBe(chat);
  expect(chat).toHaveClass("cohost-requests__trigger");
  expect(chat).toHaveTextContent("99+");
  fireEvent.click(chat);
  expect(openChat).toHaveBeenCalledOnce();
});

it("temporarily expands the left panel without changing its persisted collapsed state", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Lobby</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Lobby").closest(".studio-shell")!;
  fireEvent.pointerEnter(screen.getByRole("complementary", { name: "Primary Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-peeking");
  expect(JSON.parse(window.localStorage.getItem(STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY)!)).toEqual({ mode: "collapsed" });
});

it("hides and restores the left sidebar only through View and uses corruption-safe independent keys", () => {
  expect(parsePrimarySidebarMode("broken")).toBe("collapsed");
  expect(parseContextSidebarMode('{"mode":"broken"}')).toBe("collapsed");
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell roomWorkspace><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;
  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Hide primary sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-hidden");
  fireEvent.click(screen.getByRole("button", { name: "Restore Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  expect(window.localStorage.getItem(STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY)).not.toBeNull();
  expect(window.localStorage.getItem(STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY)).not.toBeNull();
});

it("delays auto-hide, stays visible while View is open, and reveals from the top activation strip", () => {
  vi.useFakeTimers();
  window.localStorage.setItem(STUDIO_PRESENTATION_STORAGE_KEY, JSON.stringify({ sidebar: "expanded", header: "auto-hide", cinematic: "off", noticeDuration: 5000 }));
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  act(() => vi.advanceTimersByTime(2500));
  expect(shell).not.toHaveClass("studio-shell--header-hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  act(() => vi.advanceTimersByTime(1900));
  expect(shell).toHaveClass("studio-shell--header-hidden");
  fireEvent.pointerEnter(screen.getByRole("button", { name: "Reveal Studio header" }));
  expect(shell).not.toHaveClass("studio-shell--header-hidden");
});
