import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ContextualNoticeStack } from "./ContextualNoticeStack";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("announces, pauses, resumes, and dismisses timed notices without a layout row", () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  render(<ContextualNoticeStack notices={[{ id: 1, message: "Room details saved.", tone: "success" }]} duration={3000} onDismiss={dismiss} />);
  const region = screen.getByRole("status", { name: "Room notices" });
  expect(region).toHaveAttribute("aria-live", "polite");
  fireEvent.pointerEnter(screen.getByText("Room details saved.").closest("article")!);
  act(() => vi.advanceTimersByTime(5000));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.pointerLeave(screen.getByText("Room details saved.").closest("article")!);
  act(() => vi.advanceTimersByTime(3000));
  expect(dismiss).toHaveBeenCalledWith(1);
});

it("keeps manual notices until their accessible close control is used", () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  render(<ContextualNoticeStack notices={[{ id: 2, message: "Media warning", tone: "warning" }]} duration="manual" onDismiss={dismiss} />);
  act(() => vi.advanceTimersByTime(20000));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
  expect(dismiss).toHaveBeenCalledWith(2);
});
