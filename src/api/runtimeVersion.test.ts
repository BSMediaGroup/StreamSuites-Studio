import { describe, expect, it } from "vitest";
import { parseRuntimeVersion } from "./runtimeVersion";

describe("parseRuntimeVersion", () => {
  it("accepts the confirmed runtime export shape", () => {
    expect(
      parseRuntimeVersion({
        version: "0.5.0-alpha",
        build: "2026.06.22+001",
        source: "runtime",
      }),
    ).toEqual({
      version: "0.5.0-alpha",
      build: "2026.06.22+001",
      source: "runtime",
    });
  });

  it("rejects a downstream-owned or malformed version", () => {
    expect(parseRuntimeVersion({ version: "studio-1", source: "studio" })).toBeNull();
    expect(parseRuntimeVersion(null)).toBeNull();
  });
});
