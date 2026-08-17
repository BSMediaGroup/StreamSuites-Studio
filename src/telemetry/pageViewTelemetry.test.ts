import { describe, expect, it, vi } from "vitest";
import { createStudioPageViewReporter, normalizeStudioPageRoute } from "./pageViewTelemetry";

describe("Studio page-view telemetry", () => {
  it("normalizes room and invite identifiers without retaining query or secret state", () => {
    expect(normalizeStudioPageRoute("/studio/rooms/private-room?stream_key=secret")).toBe("/studio/rooms/:room");
    expect(normalizeStudioPageRoute("/join/private-invite#participant")).toBe("/join/:invite");
    expect(normalizeStudioPageRoute("/studio?scene=two")).toBe("/studio");
    expect(normalizeStudioPageRoute("/unknown/private-value")).toBe("/other");
  });

  it("reports only distinct page routes and ignores repeated media-state renders", () => {
    const transport = vi.fn();
    const report = createStudioPageViewReporter(transport);
    expect(report("/studio/rooms/room-one")).toBe(true);
    expect(report("/studio/rooms/room-one?scene=one")).toBe(false);
    expect(report("/studio/rooms/room-one?source=camera")).toBe(false);
    expect(report("/studio")).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(String(transport.mock.calls[0][1]));
    expect(payload).toMatchObject({ surface: "studio", path: "/studio/rooms/:room" });
    expect(Object.keys(payload).sort()).toEqual(["event_id", "path", "surface"]);
    expect(JSON.stringify(payload)).not.toContain("room-one");
  });

  it("localizes transport failures", () => {
    const report = createStudioPageViewReporter(() => {
      throw new Error("offline");
    });
    expect(() => report("/studio")).not.toThrow();
  });
});
