import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOAuthLoginUrl,
  loadStudioAccess,
  normalizeStudioAccess,
  safeStudioReturnPath,
} from "./studioAuth";

const sessionPayload = {
  authenticated: true,
  user: {
    internal_id: "account-1",
    user_code: "ABC1234",
    display_name: "Alpha Tester",
    avatar_url: null,
    role: "creator",
    tier: "CORE",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Studio Runtime/Auth adapter", () => {
  it("normalizes allowed, denied, restricted, and unavailable access without inventing fields", () => {
    expect(
      normalizeStudioAccess(
        sessionPayload,
        {
          authenticated: true,
          access_allowed: true,
          reason_code: "alpha_grant_active",
          stage: "ALPHA",
          active_tester_limit: 25,
        },
        200,
      ),
    ).toMatchObject({ status: "allowed", reasonCode: "alpha_grant_active" });

    expect(
      normalizeStudioAccess(
        sessionPayload,
        { authenticated: true, access_allowed: false, reason_code: "alpha_grant_required" },
        403,
      ).status,
    ).toBe("denied");
    expect(
      normalizeStudioAccess(
        sessionPayload,
        { authenticated: true, access_allowed: false, reason_code: "account_suspended" },
        403,
      ).status,
    ).toBe("restricted");
    expect(normalizeStudioAccess(sessionPayload, null, 503).status).toBe("unavailable");
  });

  it("uses credentialed session and access requests in order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sessionPayload), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            access_allowed: true,
            reason_code: "alpha_grant_active",
            stage: "ALPHA",
            active_tester_limit: 25,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadStudioAccess()).resolves.toMatchObject({ status: "allowed" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/auth/session"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/studio/access"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("keeps return targets on the current Studio origin", () => {
    expect(safeStudioReturnPath("/studio?view=main#stage")).toBe("/studio?view=main#stage");
    expect(safeStudioReturnPath("https://evil.example/path")).toBe("/studio");
    expect(safeStudioReturnPath("/login")).toBe("/studio");
    const oauthUrl = new URL(buildOAuthLoginUrl("google", "/studio"));
    expect(oauthUrl.pathname).toBe("/auth/login/google");
    expect(oauthUrl.searchParams.get("surface")).toBe("studio");
    expect(new URL(oauthUrl.searchParams.get("return_to")!).origin).toBe(window.location.origin);
  });
});
