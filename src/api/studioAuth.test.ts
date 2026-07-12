import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOAuthLoginUrl,
  loadStudioAccess,
  createStudioInvite,
  joinStudioInvite,
  listStudioRooms,
  loadTurnstileConfig,
  loadAuthAccessGate,
  loginWithPassword,
  normalizeStudioAccess,
  safeStudioReturnPath,
  unlockAuthAccess,
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
    expect(oauthUrl.searchParams.has("turnstile_token")).toBe(false);
    expect(new URL(oauthUrl.searchParams.get("return_to")!).origin).toBe(window.location.origin);
    expect(new URL(buildOAuthLoginUrl("twitch", "/studio", "oauth-token")).searchParams.get("turnstile_token")).toBe(
      "oauth-token",
    );
  });

  it("loads the runtime-owned public Turnstile configuration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          enabled: true,
          runtime_enabled: true,
          configured: true,
          sitekey: "public-site-key",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadTurnstileConfig()).resolves.toEqual({
      enabled: true,
      runtimeEnabled: true,
      configured: true,
      sitekey: "public-site-key",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/turnstile/config"),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("normalizes the Runtime access gate without persisting bypass state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mode: "development",
      message: "Restricted development access.",
      show_lockout_banner: true,
      login_allowed: false,
      bypass_enabled: true,
    }), { status: 200 })));

    await expect(loadAuthAccessGate()).resolves.toMatchObject({
      status: "ready",
      mode: "development",
      bypassEnabled: true,
      bypassUnlocked: false,
      showLockoutBanner: true,
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("uses the canonical debug unlock payload and keeps the code out of storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      unlocked: true,
      mode: "development",
      message: "Restricted development access.",
      expires_at: "2099-01-01T00:00:00Z",
      ttl_minutes: 15,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(unlockAuthAccess("private-code")).resolves.toMatchObject({
      ok: true,
      mode: "development",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({ code: "private-code" });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("maps invalid debug access codes to the canonical safe error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: "backend detail",
      error_code: "AUTH_BYPASS_INVALID_CODE",
    }), { status: 403 })));
    await expect(unlockAuthAccess("wrong-code")).resolves.toMatchObject({
      ok: false,
      error: { code: "AUTH_BYPASS_INVALID_CODE", message: "Invalid access code." },
    });
  });

  it("submits the ephemeral token under the canonical password-login field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginWithPassword("tester@example.com", "StrongPass123!", "fresh-token")).resolves.toEqual({
      ok: true,
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      email: "tester@example.com",
      password: "StrongPass123!",
      surface: "studio",
      turnstile_token: "fresh-token",
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("keeps invalid credentials distinct from backend Turnstile rejection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ reason: "turnstile_invalid", error: "provider detail" }),
          { status: 403 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginWithPassword("tester@example.com", "wrong", "token-1")).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_credentials", message: "Invalid email or password." },
    });
    await expect(loginWithPassword("tester@example.com", "wrong", "token-2")).resolves.toMatchObject({
      ok: false,
      error: { code: "turnstile_invalid", message: expect.not.stringContaining("provider detail") },
    });
  });

  it("normalizes room summaries and keeps credentials enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      items: [{
        id: "room-1",
        owner_account_id: "account-1",
        title: "Launch room",
        description: null,
        lifecycle_state: "open",
        max_guest_stage_occupants: 9,
        waiting_guest_count: 2,
        admitted_guest_count: 1,
        created_at: "2026-07-11T00:00:00Z",
        updated_at: "2026-07-11T00:01:00Z",
        opened_at: "2026-07-11T00:01:00Z",
        ended_at: null,
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listStudioRooms()).resolves.toEqual([
      expect.objectContaining({ id: "room-1", title: "Launch room", lifecycleState: "open", maxGuestStageOccupants: 9 }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/studio/rooms"), expect.objectContaining({ credentials: "include", cache: "no-store" }));
  });

  it("returns a newly created raw invite only from the creation response and never persists it", async () => {
    const rawCode = "one-time-secret-code";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      invite_code: rawCode,
      invite: { id: "invite-1", room_id: "room-1", label: null, active: true, expires_at: null, created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", revoked_at: null },
    }), { status: 201 })));
    await expect(createStudioInvite("room-1", {})).resolves.toMatchObject({ inviteCode: rawCode, invite: { id: "invite-1" } });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("joins through Runtime/Auth without receiving or storing a guest credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      guest: { id: "guest-1", room_id: "room-1", display_name: "Guest", account_id: null, state: "waiting", created_at: "2026-07-11T00:00:00Z", updated_at: "2026-07-11T00:00:00Z", expires_at: "2026-07-11T12:00:00Z", admitted_at: null, denied_at: null, removed_at: null, left_at: null },
    }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(joinStudioInvite("invite-code", "Guest")).resolves.toMatchObject({ id: "guest-1", state: "waiting" });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.credentials).toBe("include");
    expect(JSON.parse(String(request.body))).toEqual({ invite_code: "invite-code", display_name: "Guest" });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
