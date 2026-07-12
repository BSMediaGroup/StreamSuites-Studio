# StreamSuites Studio

> **Status: ALPHA pre-media Studio workspace — closed access**
> **Flagship surface:** <https://studio.streamsuites.app>
> **Deployment target:** Cloudflare Pages

StreamSuites Studio is the flagship browser livestream-production surface for the wider StreamSuites system. This client authenticates through the existing Runtime/Auth session authority and now consumes runtime-owned closed-ALPHA access, persistent rooms, secure guest invitations, temporary guest sessions, and lobby/admission decisions. It still does not provide media, broadcasting, or recording.

Admins are eligible automatically. Non-admin accounts require an explicit active grant, with no more than 25 enabled invited non-admin grants. Admins may own/manage any room; creator/developer-capable accounts with active Studio access may own their rooms. Public accounts may participate through valid invitations without becoming creators or owners. Runtime/Auth transactionally enforces nine admitted guest stage slots, with the host/director outside those slots and no nine-person limit on the waiting lobby.

## Current implementation

- React + TypeScript + Vite application foundation
- clean browser routes with a Cloudflare Pages SPA fallback
- responsive public shell and access-protected Studio workspace shell
- persisted presentation-only shell preferences with expanded, compact icons-only, or hidden desktop navigation and standard, slim, or inactivity auto-hiding headers; mobile retains the explicit navigation drawer and treats auto-hide as slim
- credentialed `GET /auth/session` and `GET /api/studio/access` bridge with typed normalization
- existing Google, GitHub, Discord, X, Twitch, and email/password Auth entry paths
- Runtime/Auth-owned Cloudflare Turnstile protection for all five OAuth starts and password login, with ephemeral in-memory tokens only
- Runtime/Auth-owned `GET /auth/access-state` and `POST /auth/debug/unlock` development/maintenance gate parity, using only the signed short-lived HttpOnly bypass cookie issued by Runtime
- Vite-compiled Google, GitHub, Discord, X, and Twitch SVG icon-and-label OAuth buttons, the Studio favicon, an overlap-safe animated loading bar, and a keyboard-accessible authenticated avatar menu
- Runtime/Auth logout through `POST /auth/logout`
- explicit loading, unauthenticated, allowed, denied, restricted, and unavailable states
- dark/light token system with dark as the first-visit default and theme-only local persistence
- the existing `assets/logos/sscmattesilver.webp` header logo in both themes
- reusable buttons, cards, status chips, empty states, and form fields
- runtime-backed room dashboard with create, loading, empty, error, public-participant, lifecycle, safe count states, and an Enter-room-first card presentation
- protected `/studio/rooms/:roomId` pre-media production workspace with canonical short-code URLs, a 16:9 Stage/Program canvas, responsive real-time Backstage waiting/on-stage/cohost panels, policy-controlled reusable invites, room settings, lifecycle controls, and a production control dock
- route-scoped cinematic room mode with a stage-first canvas, compact truthful production state, waiting/on-stage badges, the existing authoritative Backstage/tools panel as a focus-managed drawer, obvious exit controls, and optional event-confirmed browser fullscreen
- Runtime-owned Grid, Interview, Spotlight, and Presentation layouts synchronized for authorized clients; Presentation truthfully shows `Presentation source not connected` until screen-share media exists
- truthful `OFF AIR` orientation with an inactive `00:00:00` timer and explanatory Go live dialog; camera, microphone, screen share, and live output controls remain explicitly unavailable
- credentialed room and guest SSE with live/reconnecting/fallback-polling/unavailable status, burst-coalesced authoritative refetch, bounded polling only while disconnected, and manual refresh as secondary recovery
- real `/join/:inviteCode` validation with an in-page reusable login sheet, bounded safe OAuth draft restoration, account-optional joining, visual keyboard-accessible initials colors, validated CDN-backed fallback avatar, and canonical Backstage/On Stage states
- guest room workspace showing the real safe Stage while the caller waits Backstage, a horizontal Backstage tray, permission-aware participant menus, self/cohost transitions, intended mic/camera state, drag and keyboard Stage ordering, and distinct move-Backstage versus remove-from-room actions
- single-use, capped, and open invite controls with 24-hour default expiry or no-expiry, use/status summaries, and securely regenerable canonical copy links; no invite code, guest credential, avatar binary, or cohost authority is stored in browser storage
- dedicated cohost management for the director, session cohosts, pending/accepted/declined/revoked permanent relationships, authenticated acceptance/decline, revoke actions, and all-current/future versus selected-room scope changes
- canonical Room ID chips, exact Stage/Backstage/Co-host label cleanup, committed sidebar SVG icons, avatar/name/role/tier account-chip parity, and a slim Runtime version/health footer across public and authenticated shells
- confirmed typed boundaries for Runtime/Auth sessions, Studio access, rooms, invites, lobby entries, guest self-state, media direction, and runtime-version view models
- focused tests for auth/access normalization, safe return paths, no authorized-shell flash, theme and presentation preference validation/persistence, shell modes, auto-hide behavior, cinematic/SSE continuity, fullscreen state/rejection, invite-code safety, and runtime-version parsing
- architecture and phased ALPHA roadmap documentation

### Routes

| Route | Current behavior |
| --- | --- |
| `/` | Closed-ALPHA product and access overview. |
| `/login` | Uses the existing Turnstile-protected StreamSuites OAuth or email/password login, then checks runtime-owned Studio access. |
| `/studio` | Fails closed until session/access are confirmed; admins and eligible creators create rooms and use the primary Enter room flow while public accounts receive truthful invite-participation guidance. |
| `/studio/rooms/:roomId` | Canonical short-code room workspace: director/cohost management when authorized, otherwise the caller's guest-safe Stage/Backstage experience. UUID host routes remain temporarily accepted and are replaced with the short code. |
| `/join/:inviteCode` | Validates the short code through Runtime/Auth, preserves the invitation while embedded Auth runs, restores safe OAuth draft fields, and joins anonymously or signed in before navigating to the room. |
| `*` | Not-found surface. |

## Not implemented

The following are explicitly not shipped:

- media-provider room tokens or connectivity
- camera, microphone, screen share, WebRTC, TURN, or SFU behavior
- Cloudflare Realtime credentials or media integration
- LiveKit, Egress, recording, RTMP, or provider destination integration
- real audio/video tracks, chat, alerts, clips, polls, games, automation, or analytics
- an OBS program-output route or server-side broadcast output
- deployment, DNS, Pages project, or account-specific Cloudflare configuration

## Local setup

Requirements:

- Node.js 20 or newer
- npm

From this repository root:

```powershell
npm install
npm run dev
```

Available package commands:

```powershell
npm run check
npm run lint
npm test
npm run build
npm run preview
```

The production build is written to `dist/`. Cloudflare Pages should use `npm run build` as the build command and `dist` as the output directory. `public/_redirects` provides direct-load SPA fallback behavior.

`VITE_RUNTIME_API_BASE_URL` is the public Runtime/Auth origin. The client falls back to `https://api.streamsuites.app` in production and `http://127.0.0.1:18087` on Vite localhost, while remaining configurable for Pages. `VITE_RUNTIME_VERSION_URL` stays optional. Every `VITE_*` value is browser-public; secrets, provider credentials, room tokens, API tokens, and Cloudflare identifiers must never be placed there.

Turnstile uses the same runtime-owned configuration as Public, Creator, Dashboard, and Developer: Studio fetches `GET /auth/turnstile/config` from `VITE_RUNTIME_API_BASE_URL`, renders the returned public site key, and sends the ephemeral `turnstile_token` only to the selected Auth start. The Runtime/Auth environment variables remain `CLOUDFLARE_TURNSTILE_SITEKEY`, `CLOUDFLARE_TURNSTILE_SECRET`, and the existing `CLOUDFLARE_TURNSTILE_ENABLED` switch. There is deliberately no Studio `VITE_*` site-key variable and no Turnstile secret in Cloudflare Pages.

The challenge uses Cloudflare's supported dark appearance in Studio dark mode and light appearance in light mode. A render-generation guard keeps one widget active, prevents ordinary React/auth/access rerenders from replacing it, and allows only an explicit theme change, retry, or unmount to recreate it. A completed token remains in component memory until expiry, provider failure, a consumed login attempt, backend rejection, or deliberate widget replacement; it is never written to local/session storage or Studio route state. Runtime/Auth must be deployed, reachable, and configured with the site key and secret for a real production challenge/login test.

Studio also consumes the established Runtime gate contract. `GET /auth/access-state` supplies the public-safe mode/message/banner/bypass flags. When development or maintenance mode is active and bypass is enabled, Studio submits `{ "code": "..." }` to `POST /auth/debug/unlock`, preserves the Runtime-issued `ss_auth_access_bypass` HttpOnly cookie through credentialed requests, refreshes the public-safe access state, and keeps only the returned expiry in component memory so the prompt returns when the short-lived unlock expires. `AUTH_ACCESS_MODE`, `AUTH_ACCESS_MESSAGE`, `AUTH_ACCESS_BYPASS_ENABLED`, `ADMIN_DEBUG_BYPASS_CODE`, `AUTH_ACCESS_BYPASS_TTL_MINUTES`, and `SHOW_LOCKOUT_BANNER` remain Runtime environment settings; the bypass code is never a Studio environment value and is never prefilled, logged, echoed, or persisted.

The shell loader is a reference-counted in-memory UI signal derived from auth/access resolution and room, invite, login, bypass, and OAuth-start activity. It occupies a fixed four-pixel row directly under each header—including when auto-hide or cinematic chrome retracts—remains idle when no work is active, and uses a non-animated full-width treatment under reduced-motion preferences. The signed-in header menu uses only the Runtime session display name, avatar, account type, and tier; it provides a local initial fallback and Runtime-owned logout without inventing account routes. The adjacent View menu changes validated local sidebar/header/cinematic preferences. `F` toggles cinematic mode outside editable controls; Escape closes the active menu or cinematic drawer first.

## Authority boundaries

StreamSuites remains the single authority for runtime state, Auth API behavior, accounts, sessions, roles, tiers, permissions, room orchestration, invitations, access control, token minting, alerts, audit state, persistence, exports, and canonical version/build metadata.

Studio is a client/UI surface only. It validates confirmed current-session, access, room, invite, and lobby payloads through the existing typed adapter and never persists canonical account, session, grant, role, tier, room, invite, lobby, permission, SSE, or media state in `localStorage`. The only persisted browser values are presentation preferences: `streamsuites_studio_theme` and the validated `streamsuites_studio_presentation` object containing sidebar, header, and cinematic modes.

Browser fullscreen is never a stored preference or inferred success state. A room-only user action targets the Studio workspace through the standard Fullscreen API, actual state follows `fullscreenchange`, rejection leaves cinematic mode usable, and browser/Escape exit does not silently rewrite the saved sidebar or header choices.

Invite codes are sent to Runtime/Auth only in JSON POST bodies. Authorized invite lists return the stable short canonical code derived by Runtime/Auth so an active link can be copied again; Studio holds that response only in React memory and never writes it to local/session storage or logs. Temporary guest authority is represented only by Runtime/Auth's `streamsuites_studio_guest` HttpOnly cookie: production uses the shared `.streamsuites.app` scope with `Secure`, `SameSite=Lax`, and `/`; localhost/private development follows the runtime's host-only non-Secure convention. Its implemented lifetime is 12 hours, and it never overwrites `streamsuites_session`.

The Runtime/Auth repository owns the persistent grant table and admin management endpoints. Admin accounts do not consume tester slots. Creator, developer, and public accounts keep their existing classifications and require an enabled grant. Access is re-evaluated server-side; unavailable Runtime/Auth is shown as unavailable rather than denied.

The canonical runtime version is defined by `StreamSuites/runtime/version.py` and exported through `StreamSuites/runtime/exports/version.json`. This package uses `0.0.0` only as private npm metadata; it is not a Studio product version. The slim footer hydrates the configured Runtime export and checks the established Auth health route once per shell mount, distinguishing loading, online, and degraded/unavailable state without aggressive polling.

See [System architecture](docs/system-architecture.md) for the complete boundary diagram.

## Media direction

The current Stage, Backstage tray, participant menus, ordering, layout, and intended microphone/camera controls are authoritative room-control UI but remain pre-media. The intended next ALPHA media path is browser-to-browser media through Cloudflare Realtime SFU/TURN. The planned production migration is self-hosted LiveKit plus Egress. Neither media path is implemented here.

The Python runtime/Auth API will orchestrate rooms, permissions, invitations, access, and token minting, but audio and video must bypass the Python runtime. During early ALPHA, final output is expected to use an OBS-capturable program view before server-side egress exists.

## Roadmap

The roadmap is phased and describes planned work, not current capability:

1. frontend scaffold and design foundation — **complete**
2. existing StreamSuites Auth/session bridge and closed-ALPHA access authority — **current milestone complete**
3. runtime-owned Studio rooms, short-code invites, temporary sessions, lobby admission, real-time events, and cohosts — **current milestone complete**
4. polished pre-media stage, Backstage, guest identity, and production-control interactions — **current milestone complete**
5. Cloudflare Realtime camera, microphone, and screen share — **pending**
6. OBS-capturable program output
7. provider destinations and recording foundations
8. later self-hosted LiveKit and Egress migration
9. integration of existing StreamSuites chat, alerts, clips, polls, games, and automation

See [ALPHA roadmap](docs/alpha-roadmap.md) for acceptance boundaries per phase.

## Repository tree

The existing `assets/` foundation library is preserved and summarized by category. Every scaffold file created by this milestone is listed below.

```text
StreamSuites-Studio/
├── assets/                         # Existing shared foundation asset library
│   ├── backgrounds/
│   ├── css/
│   ├── data/
│   ├── fonts/
│   ├── games/
│   ├── icons/
│   ├── illustrations/
│   ├── js/
│   ├── logos/
│   ├── placeholders/
│   └── sounds/
├── docs/
│   ├── alpha-roadmap.md
│   └── system-architecture.md
├── public/
│   └── _redirects
├── src/
│   ├── api/
│   │   ├── contracts.ts
│   │   ├── runtimeVersion.test.ts
│   │   ├── runtimeVersion.ts
│   │   ├── studioAuth.test.ts
│   │   └── studioAuth.ts
│   ├── activity/
│   │   ├── GlobalActivityProvider.test.tsx
│   │   ├── GlobalActivityProvider.tsx
│   │   ├── GlobalLoadingBar.tsx
│   │   ├── globalActivityContext.ts
│   │   └── useGlobalActivity.ts
│   ├── app/
│   │   └── router.tsx
│   ├── auth/
│   │   ├── StudioAuthProvider.tsx
│   │   └── studioAuthContext.ts
│   ├── components/
│   │   ├── AuthAccessBanner.tsx
│   │   ├── StudioAccountMenu.test.tsx
│   │   ├── StudioAccountMenu.tsx
│   │   ├── InitialsColorPicker.tsx
│   │   ├── StudioFooter.tsx
│   │   ├── ViewOptionsMenu.tsx
│   │   ├── TurnstileWidget.test.tsx
│   │   ├── TurnstileWidget.tsx
│   │   ├── shell/
│   │   │   ├── SiteShell.tsx
│   │   │   ├── StudioShell.test.tsx
│   │   │   └── StudioShell.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── FormField.tsx
│   │   │   └── StatusChip.tsx
│   │   ├── BrandMark.tsx
│   │   └── ThemeToggle.tsx
│   ├── config/
│   │   └── env.ts
│   ├── domain/
│   │   └── studio.ts
│   ├── lib/
│   │   ├── inviteCode.test.ts
│   │   └── inviteCode.ts
│   ├── pages/
│   │   ├── JoinPage.tsx
│   │   ├── GuestRoomWorkspace.tsx
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.test.tsx
│   │   ├── LoginPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── RoomManagementPage.tsx
│   │   ├── StudioPage.test.tsx
│   │   ├── StudioRooms.test.tsx
│   │   └── StudioPage.tsx
│   ├── presentation/
│   │   ├── PresentationProvider.tsx
│   │   ├── presentationContext.ts
│   │   ├── presentationPreferences.test.ts
│   │   └── presentationPreferences.ts
│   ├── styles/
│   │   ├── index.css
│   │   └── tokens.css
│   ├── test/
│   │   └── setup.ts
│   ├── theme/
│   │   ├── ThemeProvider.test.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── themeContext.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.example
├── .gitignore
├── BUMP_NOTES.md
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

## Related repositories

- `StreamSuites` — authoritative runtime, Auth API, state, exports, and version
- `StreamSuites-Public` — public website
- `StreamSuites-Creator` — creator account surface
- `StreamSuites-Dashboard` — privileged admin web surface

All related surfaces remain separate deployments and must preserve the runtime authority boundary.
