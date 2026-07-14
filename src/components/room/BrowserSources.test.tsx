import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserSource } from "../../domain/studio";
import { BrowserSourceRenderer } from "./BrowserSourceRenderer";
import { BrowserSourcesPanel } from "./BrowserSourcesPanel";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), duplicate: vi.fn(), move: vi.fn(), refresh: vi.fn(), remove: vi.fn() }));
vi.mock("../../api/studioAuth", async (original) => ({ ...(await original<typeof import("../../api/studioAuth")>()), createStudioBrowserSource: api.create, updateStudioBrowserSource: api.update, duplicateStudioBrowserSource: api.duplicate, moveStudioBrowserSource: api.move, refreshStudioBrowserSource: api.refresh, deleteStudioBrowserSource: api.remove }));

const source: BrowserSource = { id: "browser-1", roomId: "room-1", displayName: "Scoreboard", sourceType: "browser", url: "https://overlay.example.test/score?token=secret", safeHost: "overlay.example.test", location: "backstage", viewportWidth: 1920, viewportHeight: 1080, refreshOnActivation: true, muted: true, interactive: true, visibilityScope: "production_only", scene: { x: .2, y: .2, width: .6, height: .6, zIndex: 30 }, opacity: 1, refreshRevision: 0, createdAt: "2026-07-14T00:00:00Z", updatedAt: "2026-07-14T00:00:00Z" };

afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.values(api).forEach((mock) => mock.mockReset()); });

describe("browser sources", () => {
  it("renders the persisted centered rectangle with a strict permission-denying sandbox", () => {
    render(<BrowserSourceRenderer source={{ ...source, location: "on_stage" }} mode="stage" />);
    const wrapper = screen.getByTestId("browser-source-stage"), iframe = screen.getByTitle("Scoreboard");
    expect(wrapper.getAttribute("style")).toContain("--browser-x: 0.2"); expect(wrapper.getAttribute("style")).toContain("--browser-width: 0.6"); expect(wrapper.getAttribute("style")).toContain("--browser-layer: 30");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    expect(iframe).not.toHaveAttribute("sandbox", expect.stringContaining("allow-same-origin"));
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(iframe).toHaveAttribute("allow", expect.stringContaining("camera 'none'"));
    expect(iframe).toHaveAttribute("allow", expect.stringContaining("autoplay 'none'"));
    expect(iframe).toHaveAttribute("loading", "eager");
  });

  it("does not instantiate disabled or restricted URL-omitted sources", () => {
    const { rerender } = render(<BrowserSourceRenderer source={{ ...source, location: "disabled" }} mode="preview" />);
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    rerender(<BrowserSourceRenderer source={{ ...source, url: null }} mode="stage" />);
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("keeps pointer interaction opt-in and exits interaction on Escape", () => {
    const exit = vi.fn(); render(<BrowserSourceRenderer source={{ ...source, location: "on_stage" }} mode="stage" interactionActive onExitInteraction={exit} />);
    expect(screen.getByTestId("browser-source-stage")).toHaveClass("is-interacting");
    expect(screen.getByRole("button", { name: "Exit interaction" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" }); expect(exit).toHaveBeenCalledTimes(1);
  });

  it("shows invalid URL state and creates only after canonical API success", async () => {
    const changed = vi.fn(), notice = vi.fn(); api.create.mockResolvedValue(source);
    render(<BrowserSourcesPanel roomId="room-1" sources={[]} canEdit onChanged={changed} onNotice={notice} />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Scores" } });
    fireEvent.change(screen.getByLabelText("HTTPS source URL"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Create browser source" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTPS"); expect(api.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("HTTPS source URL"), { target: { value: "https://overlay.example.test/scores" } });
    fireEvent.click(screen.getByRole("button", { name: "Create browser source" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1)); expect(changed).toHaveBeenCalledTimes(1); expect(notice).toHaveBeenCalledWith("Browser source created Backstage.");
  });

  it("offers edit, duplicate, refresh, disable, delete, compatibility help, and room visibility warning", () => {
    render(<BrowserSourcesPanel roomId="room-1" sources={[source]} canEdit onChanged={vi.fn()} onNotice={vi.fn()} />);
    for (const name of ["Edit", "Duplicate", "Refresh", "Disable", "Delete", "Open source"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByText(/Embedding may be blocked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" })); fireEvent.change(screen.getByLabelText("Visibility"), { target: { value: "room" } });
    expect(screen.getByText(/full URL will be shared/)).toBeInTheDocument();
  });
});
