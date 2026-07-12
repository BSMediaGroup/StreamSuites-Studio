# StreamSuites Studio

> **Status: ALPHA room-authority foundation — closed access, pre-media**
> **Flagship surface:** <https://studio.streamsuites.app>
> **Deployment target:** Cloudflare Pages

StreamSuites Studio is the flagship browser livestream-production surface for the wider StreamSuites system. This client authenticates through the existing Runtime/Auth session authority and now consumes runtime-owned closed-ALPHA access, persistent rooms, secure guest invitations, temporary guest sessions, and lobby/admission decisions. It still does not provide media, broadcasting, or recording.

Admins are eligible automatically. Non-admin accounts require an explicit active grant, with no more than 25 enabled invited non-admin grants. Admins may own/manage any room; creator/developer-capable accounts with active Studio access may own their rooms. Public accounts may participate through valid invitations without becoming creators or owners. Runtime/Auth transactionally enforces nine admitted guest stage slots, with the host/director outside those slots and no nine-person limit on the waiting lobby.

## Current implementation

- React + TypeScript + Vite application foundation
- clean browser routes with a Cloudflare Pages SPA fallback
- responsive public shell and access-protected Studio workspace shell
- credentialed `GET /auth/session` and `GET /api/studio/access` bridge with typed normalization
- existing Google, GitHub, Discord, X, Twitch, and email/password Auth entry paths
- Runtime/Auth-owned Cloudflare Turnstile protection for all five OAuth starts and password login, with ephemeral in-memory tokens only
- Runtime/Auth-owned `GET /auth/access-state` and `POST /auth/debug/unlock` development/maintenance gate parity, using only the signed short-lived HttpOnly bypass cookie issued by Runtime
- provider SVG icons, the Studio favicon, an overlap-safe animated loading bar, and a keyboard-accessible authenticated avatar menu
- Runtime/Auth logout through `POST /auth/logout`
- explicit loading, unauthenticated, allowed, denied, restricted, and unavailable states
- dark/light token system with dark as the first-visit default and theme-only local persistence
- the existing `assets/logos/sscmattesilver.webp` header logo in both themes
- reusable buttons, cards, status chips, empty states, and form fields
- runtime-backed room dashboard with create, loading, empty, error, public-participant, lifecycle, and safe count states
- protected `/studio/rooms/:roomId` management workspace for details, lifecycle, one-time invite creation, revocation, lobby admission/denial, and admitted-guest removal
- real `/join/:inviteCode` validation, display-name entry, waiting/admitted/denied/removed/left/expired states, refresh, and leave flow
- one-time raw invite links held only in component memory, cleared by reload/navigation, and never persisted; guest credentials remain in Runtime/Auth's separate HttpOnly cookie
- confirmed typed boundaries for Runtime/Auth sessions, Studio access, rooms, invites, lobby entries, guest self-state, media direction, and runtime-version view models
- focused tests for auth/access normalization, safe return paths, no authorized-shell flash, theme accessibility/persistence, invite-code safety, and runtime-version parsing
- architecture and phased ALPHA roadmap documentation

### Routes

| Route | Current behavior |
| --- | --- |
| `/` | Closed-ALPHA product and access overview. |
| `/login` | Uses the existing Turnstile-protected StreamSuites OAuth or email/password login, then checks runtime-owned Studio access. |
| `/studio` | Fails closed until session/access are confirmed; admins and eligible creators manage runtime-owned rooms while public accounts receive truthful invite-participation guidance. |
| `/studio/rooms/:roomId` | Protected owner/admin room lifecycle, invite, and lobby authority workspace. |
| `/join/:inviteCode` | Validates the code through Runtime/Auth in a POST body and provides the temporary pre-media guest/lobby flow. |
| `*` | Not-found surface. |

## Not implemented

The following are explicitly not shipped:

- media-provider room tokens or connectivity
- camera, microphone, screen share, WebRTC, TURN, or SFU behavior
- Cloudflare Realtime credentials or media integration
- LiveKit, Egress, recording, RTMP, or provider destination integration
- active participants, chat, alerts, clips, polls, games, automation, or analytics
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

The shell loader is a reference-counted in-memory UI signal derived from auth/access resolution and room, invite, login, bypass, and OAuth-start activity. It occupies a fixed four-pixel row directly under each header, remains idle when no work is active, and uses a non-animated full-width treatment under reduced-motion preferences. The signed-in header menu uses only the Runtime session display name, avatar, account type, and tier; it provides a local initial fallback and Runtime-owned logout without inventing account routes.

## Authority boundaries

StreamSuites remains the single authority for runtime state, Auth API behavior, accounts, sessions, roles, tiers, permissions, room orchestration, invitations, access control, token minting, alerts, audit state, persistence, exports, and canonical version/build metadata.

Studio is a client/UI surface only. It validates confirmed current-session, access, room, invite, and lobby payloads through the existing typed adapter and never persists canonical account, session, grant, role, tier, room, invite, or lobby state in `localStorage`. The only persisted browser preference is `streamsuites_studio_theme`.

Invite codes are sent to Runtime/Auth only in JSON POST bodies. A newly created raw code/link is displayed once from the creation response, kept only in component memory, and cannot be retrieved from invite lists. Studio never writes it to local/session storage or logs. Temporary guest authority is represented only by Runtime/Auth's `streamsuites_studio_guest` HttpOnly cookie: production uses the shared `.streamsuites.app` scope with `Secure`, `SameSite=Lax`, and `/`; localhost/private development follows the runtime's host-only non-Secure convention. Its implemented lifetime is 12 hours, and it never overwrites `streamsuites_session`.

The Runtime/Auth repository owns the persistent grant table and admin management endpoints. Admin accounts do not consume tester slots. Creator, developer, and public accounts keep their existing classifications and require an enabled grant. Access is re-evaluated server-side; unavailable Runtime/Auth is shown as unavailable rather than denied.

The canonical runtime version is defined by `StreamSuites/runtime/version.py` and exported through `StreamSuites/runtime/exports/version.json`. This package uses `0.0.0` only as private npm metadata; it is not a Studio product version. The UI shows the ALPHA stage only. Numeric version hydration is pending confirmation of the deployed Studio-safe publication/CORS path for the existing runtime export contract.

See [System architecture](docs/system-architecture.md) for the complete boundary diagram.

## Media direction

The intended initial ALPHA media path is browser-to-browser media through Cloudflare Realtime SFU/TURN. The planned production migration is self-hosted LiveKit plus Egress. Neither path is implemented here.

The Python runtime/Auth API will orchestrate rooms, permissions, invitations, access, and token minting, but audio and video must bypass the Python runtime. During early ALPHA, final output is expected to use an OBS-capturable program view before server-side egress exists.

## Roadmap

The roadmap is phased and describes planned work, not current capability:

1. frontend scaffold and design foundation — **complete**
2. existing StreamSuites Auth/session bridge and closed-ALPHA access authority — **current milestone complete**
3. runtime-owned Studio rooms, guest invites, temporary sessions, and lobby admission — **current milestone complete**
4. pre-media stage and production-control interactions
5. Cloudflare Realtime camera, microphone, and screen share
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
│   │   ├── TurnstileWidget.test.tsx
│   │   ├── TurnstileWidget.tsx
│   │   ├── shell/
│   │   │   ├── SiteShell.tsx
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
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.test.tsx
│   │   ├── LoginPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── RoomManagementPage.tsx
│   │   ├── StudioPage.test.tsx
│   │   ├── StudioRooms.test.tsx
│   │   └── StudioPage.tsx
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
