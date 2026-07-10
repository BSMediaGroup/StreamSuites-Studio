import { describe, expect, it } from "vitest";
import { checkInviteCode } from "./inviteCode";

describe("checkInviteCode", () => {
  it("accepts a browser-safe example code", () => {
    expect(checkInviteCode(" example-code ")).toEqual({
      normalized: "example-code",
      isSafeFormat: true,
    });
  });

  it("rejects markup and does not transform it", () => {
    expect(checkInviteCode("<script>")).toEqual({
      normalized: "<script>",
      isSafeFormat: false,
    });
  });

  it("rejects missing and oversized codes", () => {
    expect(checkInviteCode(undefined).isSafeFormat).toBe(false);
    expect(checkInviteCode("x".repeat(97)).isSafeFormat).toBe(false);
  });
});
