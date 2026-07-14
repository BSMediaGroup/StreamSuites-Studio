import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PresentationProvider } from "../../presentation/PresentationProvider";
import { STUDIO_PRESENTATION_STORAGE_KEY } from "../../presentation/presentationPreferences";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { StudioShell } from "./StudioShell";

vi.mock("../StudioAccountMenu", () => ({ StudioAccountMenu: () => <button type="button">Account</button> }));
vi.mock("../AuthAccessBanner", () => ({ AuthAccessBanner: () => null }));

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });

it("restores the expanded primary sidebar and its independent bottom toggle", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  fireEvent.click(screen.getByRole("button", { name: "Collapse Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  fireEvent.click(screen.getByRole("button", { name: "Expand Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  expect(shell).not.toHaveClass("studio-shell--sidebar-hidden");
});

it("keeps lobby sidebar display controls separate from contextual preferences", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByLabelText("Hidden"));
  expect(shell).toHaveClass("studio-shell--sidebar-hidden");
  fireEvent.click(screen.getByRole("button", { name: "Restore Studio sidebar" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");

  fireEvent.click(screen.getByLabelText("Slim"));
  expect(shell).toHaveClass("studio-shell--header-slim");
  fireEvent.click(screen.getByLabelText("Auto-hide"));
  expect(JSON.parse(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY)!)).toEqual({ sidebar: "collapsed", header: "auto-hide", cinematic: "off", noticeDuration: 5000 });
});

it("uses route-specific primary navigation in rooms without contextual shortcuts", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell roomWorkspace><p>Room Stage</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Room Stage").closest(".studio-shell")!;
  expect(screen.getByRole("complementary", { name: "Studio workspace" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to Rooms" })).toHaveAttribute("href", "/studio");
  expect(screen.queryByRole("button", { name: /Brand/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Media/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Hide contextual panel" }));
  expect(shell).toHaveClass("studio-shell--context-panel-hidden");
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  expect(screen.getByRole("complementary", { name: "Studio workspace" })).toBeInTheDocument();
});

it("keeps the original lobby product destinations out of active-room content", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Lobby</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  expect(screen.getByRole("link", { name: "Studio" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Brand, unavailable, later" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Back to Rooms" })).not.toBeInTheDocument();
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
