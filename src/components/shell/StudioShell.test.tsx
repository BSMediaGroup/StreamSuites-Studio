import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PresentationProvider } from "../../presentation/PresentationProvider";
import { STUDIO_CONTEXT_SIDEBAR_STORAGE_KEY, STUDIO_PRESENTATION_STORAGE_KEY, parseContextSidebarMode } from "../../presentation/presentationPreferences";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { STUDIO_PRIMARY_SIDEBAR_STORAGE_KEY, StudioShell, parsePrimarySidebarMode } from "./StudioShell";

vi.mock("../StudioAccountMenu", () => ({ StudioAccountMenu: () => <button type="button">Account</button> }));
vi.mock("../AuthAccessBanner", () => ({ AuthAccessBanner: () => null }));

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });

it("defaults the primary sidebar to collapsed and its bottom toggle only pins or collapses it", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  fireEvent.click(screen.getByRole("button", { name: "Pin Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  fireEvent.click(screen.getByRole("button", { name: "Collapse Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  expect(shell).not.toHaveClass("studio-shell--sidebar-hidden");
});

it("keeps lobby product sections in dedicated left panels and restores Destinations", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  for (const section of ["Studio", "Brand", "Media", "Destinations", "Settings"]) expect(screen.getByRole("button", { name: `Open ${section} panel` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Destinations panel" }));
  expect(screen.getByRole("region", { name: "Destinations panel" })).toHaveTextContent("No destinations connected");
  expect(screen.getByRole("region", { name: "Destinations panel" })).toHaveTextContent("Studio remains OFF AIR");
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
