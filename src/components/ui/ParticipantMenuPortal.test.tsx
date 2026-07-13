import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantMenuPortal } from "./ParticipantMenuPortal";

afterEach(cleanup);

describe("ParticipantMenuPortal", () => {
  it("renders at document level, supports keyboard movement, Escape, and focus restoration", async () => {
    const remove = vi.fn();
    const { container } = render(<div className="clipping-parent"><ParticipantMenuPortal participantName="Guest" items={[{ label: "Move Backstage", onSelect: vi.fn() }, { label: "Remove from room", destructive: true, onSelect: remove }]} /></div>);
    const trigger = screen.getByRole("button", { name: "Actions for Guest" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Actions for Guest" });
    expect(menu.parentElement).toBe(document.body);
    expect(container.querySelector("[role='menu']")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Move Backstage" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Remove from room" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("runs a touch-safe menu action and closes", () => {
    const action = vi.fn();
    render(<ParticipantMenuPortal participantName="Guest" items={[{ label: "Remove from room", destructive: true, onSelect: action }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Guest" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from room" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
