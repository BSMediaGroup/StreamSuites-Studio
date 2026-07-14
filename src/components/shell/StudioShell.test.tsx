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

it("defaults to collapsed and the bottom toggle only alternates collapsed and expanded", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  fireEvent.click(screen.getByRole("button", { name: "Expand panel" }));
  expect(shell).toHaveClass("studio-shell--sidebar-expanded");
  fireEvent.click(screen.getByRole("button", { name: "Collapse panel" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");
  expect(shell).not.toHaveClass("studio-shell--sidebar-hidden");
});

it("uses the View menu as the only full hide and restore path", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell><p>Workspace</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  const shell = screen.getByText("Workspace").closest(".studio-shell")!;

  fireEvent.click(screen.getByRole("button", { name: "View options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Hide contextual panel" }));
  expect(shell).toHaveClass("studio-shell--sidebar-hidden");
  expect(screen.queryByRole("button", { name: "Restore Studio sidebar" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Show contextual panel" }));
  expect(shell).toHaveClass("studio-shell--sidebar-collapsed");

  fireEvent.click(screen.getByLabelText("Slim"));
  expect(shell).toHaveClass("studio-shell--header-slim");
  fireEvent.click(screen.getByLabelText("Auto-hide"));
  expect(JSON.parse(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY)!)).toEqual({ sidebar: "collapsed", header: "auto-hide", cinematic: "off", noticeDuration: 5000 });
});

it("removes general product navigation from the room workspace shell", () => {
  render(<ThemeProvider><PresentationProvider><MemoryRouter><StudioShell roomWorkspace><p>Room Stage</p></StudioShell></MemoryRouter></PresentationProvider></ThemeProvider>);
  expect(screen.queryByRole("complementary", { name: "Studio workspace" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Expand panel" })).not.toBeInTheDocument();
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
