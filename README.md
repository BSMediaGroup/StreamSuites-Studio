# StreamSuites Studio

> **Status: ALPHA private-room media workspace — closed access**
> **Flagship surface:** <https://studio.streamsuites.app>
> **Deployment target:** Cloudflare Pages

StreamSuites Studio is the flagship browser livestream-production surface for the wider StreamSuites system. It consumes Runtime/Auth-owned access, rooms, separate broadcast details/schedules/visibility, versioned thumbnails, safe destination readiness, guest/cohost/Stage decisions, branding, RealtimeKit mappings, and participant tokens. It stores no canonical room configuration, does not broadcast or record, and remains OFF AIR.

Current rooms also consume Runtime/Auth-owned private text history and unread cursors. Chat opens inside the existing right production sidebar from a Requests-matched header shortcut and provides Private/Public tabs. Private chat is functional for directors, cohosts, and current Backstage/on-Stage guests; Public is a truthful provider connection/capability foundation with outbound delivery disabled.

Admins are eligible automatically. Non-admin accounts require an explicit active grant, with no more than 25 enabled invited non-admin grants. Admins may own/manage any room; creator/developer-capable accounts with active Studio access may own their rooms. Public accounts may participate through valid invitations without becoming creators or owners. Runtime/Auth transactionally enforces nine total visible Stage slots: the host/director reserves one and at most eight additional guests or cohosts may be on Stage. Backstage does not count toward that limit.

## Current implementation

- React + TypeScript + Vite application foundation
- clean browser routes with a Cloudflare Pages SPA fallback
- responsive public shell and access-protected Studio workspace shell
- separately namespaced, corruption-safe presentation preferences for the collapsed-by-default primary left sidebar and room-production right sidebar; each bottom control toggles only collapsed/pinned-expanded, View alone fully hides/restores either sidebar, and header/cinematic/notice preferences remain local-only
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
- complete Runtime-backed lobby Create/Edit forms for internal room identity, entry state, broadcast title/description, browser-timezone schedule, visibility, thumbnail upload/existing-asset selection/preview/replacement/removal, and secret-free destination readiness
- compact responsive room cards with 16:9 CDN/fallback thumbnail, room and broadcast identity, description, code, lifecycle, schedule, visibility, Stage/Backstage counts, destination readiness, timestamp, and preserved Open/Edit/Delete actions
- protected `/studio/rooms/:roomId` production workspace with canonical short-code URLs, the original full-height primary Studio sidebar on the far left, a viewport-fitted 16:9 Stage/Program canvas, real RealtimeKit media, an independent full-height right contextual Backstage/on-stage/cohost/invite/room/Branding/Media system, scrolling Backstage below the Stage, lifecycle controls, and the existing production dock
- route-scoped cinematic room mode with a stage-first canvas, compact truthful production state, waiting/on-stage badges, the existing authoritative Backstage/tools panel as a focus-managed drawer, obvious exit controls, and optional event-confirmed browser fullscreen
- Runtime-owned requested Auto, Grid, Interview, Spotlight, Presentation, and Custom layouts. Auto derives Presentation for an active share, Spotlight for an explicit spotlight or one participant, Interview for two, and Grid for three through nine while leaving requested mode `auto`; a room may save, name, select, reorder, and delete up to eight stable-ID custom snapshots of resolved built-in modes
- Runtime-owned `name_and_subtitle`, `name_only`, and `hidden` broadcast-label visibility with management identity preserved, plus a working Room Settings custom-layout manager and an unclipped keyboard/focus-safe Custom selector using the exact existing slot 1–8 icon pairs
- a working room Branding panel for solid/gradient/CDN-image Stage backgrounds, logo/bug placement/size/opacity, badge/subtitle styling, editor-only safe area, live Stage preview, canonical save/reset, and pending/error recovery
- a working room Media panel with separate PNG/JPEG/WebP asset tools and Runtime-owned Browser Sources tools for HTTPS create/edit/duplicate/refresh/disable/delete, visibility warnings, compatibility help, and Backstage-first placement
- explicit device preflight with SDK device selectors, local camera preview, microphone activity, device-off choices, join-without-devices, secure-context/support checks, and permission/device error states
- compact 16:9 Backstage camera thumbnails that reuse each connected participant's existing main-room RealtimeKit video track, with camera-off/reconnecting avatar fallback and no separate preview session
- SDK-registered local and remote video, SDK-managed remote audio with autoplay recovery, actual microphone/camera state, active-speaker indication, and stable guest-keyed tiles across Stage reordering
- one room-scoped director or guest media lifecycle with Strict Mode initialization guards, listener cleanup, token refresh, reconnect state, Runtime mapping refresh, and memory-only participant tokens
- Runtime-first Stage/Backstage synchronization, guest/cohost preset reconciliation, permission-checked host force-mute/video-disable, and reconciliation-required state on provider failure
- truthful `OFF AIR` orientation with an inactive `00:00:00` timer and disabled output integration; media connection does not imply broadcast
- credentialed room and guest SSE with live/reconnecting/fallback-polling/unavailable status, burst-coalesced authoritative refetch, bounded polling only while disconnected, and manual refresh as secondary recovery
- real `/join/:inviteCode` validation with an in-page reusable login sheet, bounded safe OAuth draft restoration, account-optional joining, visual keyboard-accessible initials colors, validated CDN-backed fallback avatar, and canonical Backstage/On Stage states
- canonical room-avatar hydration shared by Stage and Backstage, a signed-in header Requests inbox for permanent-cohost accept/decline, compact invite cards with usable-only copy plus separate revoke/delete actions, and lobby room edit/typed-confirmation delete controls
- authenticated invite hydration that merges Runtime account display/CDN-avatar details into untouched fields, preserves explicit room edits across password/OAuth, visibly identifies the linked public account, and sends no client-claimed account ID
- guest room workspace using the same media lifecycle: Backstage receives Stage audio/video plus private preview without self-admission; on-stage guests publish permitted local choices, may self-Backstage, and cohosts retain only Runtime-granted authority
- single-use, capped, and open invite controls with 24-hour default expiry or no-expiry, use/status summaries, and securely regenerable canonical copy links; no invite code, guest credential, avatar binary, or cohost authority is stored in browser storage
- dedicated cohost management for the director, session cohosts, pending/accepted/declined/revoked permanent relationships, authenticated acceptance/decline, revoke actions, and all-current/future versus selected-room scope changes
- a compact room header with Room ID beside `ROOM DETAILS`, one confirmed Room Actions menu, far-right non-wrapping OFF AIR controls, an icon-over-label Rooms exit, and no duplicate lifecycle row or green-dot Live label
- one theme-aware CSS-mask/currentColor icon renderer with regular/filled state switching; a Public-shell-parity account chip with the same single allowed role-or-tier badge suppression; and fixed/scrollable/bottom-pinned global sidebar regions
- one shared mirrored `StudioEdgeSidebar` shell for both full-height desktop edges on active-room routes. The primary left instance opens dedicated, independently scrolling Studio/Rooms, Brand, Media, restored Destinations, and Settings panels; the direct shell-sibling right instance opens Backstage, Invites, Room/custom-layout, Branding, and Media/browser-source content and is no longer nested in the production/Stage workspace. Both use the same fixed 64px rail, directly adjacent 360px panel, fixed heading, `minmax(0, 1fr)` scroll body, and 46px square final-row toggle. First-time state is collapsed on both sides; hover/focus expansion attaches at the rail edge without a transparent or pointer-dead strip and without changing Stage geometry, pinning alone reserves exactly the 424px rail-plus-panel track, and View hiding releases only the selected edge
- the uncapped `minmax(0, 1fr)` center track gives the Stage the maximum 16:9 rectangle permitted by live center width and shell height. The Stage toolbar and output use the same measured width, the centered production dock does not cap the Stage, Backstage continues below the viewport region, and collapsed hover overlays do not remount RealtimeKit media
- bounded local MCP geometry verification at 1366×768 measured equal 63.99×656.91 edge shells, equal 45.99px square toggles with 7.99px bottom insets, an uncapped collapsed Stage of 718.61×404.22 (1.77777), 0px toolbar-edge mismatch, 0px hover geometry change, and a pinned Stage of 691.16×388.77; the document had no horizontal overflow and the controlled fixture produced no console warning/error or failed request
- a Studio-local port of Public's current footer bar/status DOM, link order, spacing, separators, typography, status trigger, version/build tooltip, and responsive stacking. Its single Runtime/Auth disclosure is closed initially, uses opaque dark/light surfaces, and dismisses on pointer leave, blur, Escape, outside pointer input, Runtime state change, route change, or unmount; it remains a shell grid row and cannot overlap either sidebar toggle, the production dock, or Stage
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

- Cloudflare API credentials in the browser; participant tokens are issued privately by Runtime/Auth and held only in memory
- LiveKit, Egress, recording, RTMP, SRT, HLS, Cloudflare Stream, webhooks, public broadcasting, or provider destinations
- chat, alerts, clips, polls, games, automation, or analytics integration
- an OBS program-output route or server-side broadcast output
- freeform browser-source/custom-layout drag/resize, snapping, z-order editing, crop, rotation, or a complete brand-kit system
- an isolated or director-only Backstage camera transport separate from the existing private room meeting
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

The shell loader is a reference-counted in-memory UI signal derived from auth/access resolution and room, invite, login, bypass, and OAuth-start activity. It occupies a fixed four-pixel row directly under each header—including when auto-hide or cinematic chrome retracts—remains idle when no work is active, and uses a non-animated full-width treatment under reduced-motion preferences. The signed-in header menu uses only the Runtime session display name, avatar, account type, and tier; it provides a local initial fallback and Runtime-owned logout without inventing account routes. The adjacent View menu changes validated local panel visibility, notice duration, header, and cinematic preferences. `F` toggles cinematic mode outside editable controls; Escape closes the active menu or cinematic drawer first.

## Authority boundaries

StreamSuites remains the single authority for runtime state, Auth API behavior, accounts, sessions, roles, tiers, permissions, room orchestration, invitations, access control, token minting, alerts, audit state, persistence, exports, and canonical version/build metadata.

Studio is a client/UI surface only. It validates confirmed current-session, access, room, invite, and lobby payloads through the existing typed adapter and never persists canonical account, session, grant, role, tier, room, invite, lobby, permission, SSE, or media state in `localStorage`. The only persisted browser values are validated display preferences: `streamsuites_studio_theme`, `streamsuites_studio_primary_sidebar`, `streamsuites_studio_room_production_sidebar`, and the compatibility `streamsuites_studio_presentation` object containing contextual-panel, header, cinematic, and notice-duration modes.

Runtime-owned Stage settings now select Fill (adaptive media-card regions) or Fit (equal 16:9 camera slots). The centered one-through-nine rows are `1`, `2`, `2+1`, `2+2`, `3+2`, `3+3`, `3+3+1`, `3+3+2`, and `3+3+3`. RealtimeKit screen shares and custom browser sources both begin Backstage under separate lifecycles. Authorized directors/cohosts may place browser sources at their persisted centered normalized rectangle without stopping/remounting participant media. Browser sources do not consume participant slots, carry audio through RealtimeKit/Python, or bypass provider embedding restrictions. Freeform geometry remains deferred and Studio remains OFF AIR.

Browser fullscreen is never a stored preference or inferred success state. A room-only user action targets the Studio workspace through the standard Fullscreen API, actual state follows `fullscreenchange`, rejection leaves cinematic mode usable, and browser/Escape exit does not silently rewrite the saved sidebar or header choices.

Invite codes are sent to Runtime/Auth only in JSON POST bodies. Authorized invite lists return the stable short canonical code derived by Runtime/Auth so an active link can be copied again; Studio holds that response only in React memory and never writes it to local/session storage or logs. Temporary guest authority is represented only by Runtime/Auth's `streamsuites_studio_guest` HttpOnly cookie: production uses the shared `.streamsuites.app` scope with `Secure`, `SameSite=Lax`, and `/`; localhost/private development follows the runtime's host-only non-Secure convention. Its implemented lifetime is 12 hours, and it never overwrites `streamsuites_session`.

The Runtime/Auth repository owns the persistent grant table and admin management endpoints. Admin accounts do not consume tester slots. Creator, developer, and public accounts keep their existing classifications and require an enabled grant. Access is re-evaluated server-side; unavailable Runtime/Auth is shown as unavailable rather than denied.

The canonical runtime version is defined by `StreamSuites/runtime/version.py` and exported through `StreamSuites/runtime/exports/version.json`. This package uses `0.0.0` only as private npm metadata; it is not a Studio product version. The Public-pattern footer hydrates the configured Runtime export and checks the established Auth health route once per shell mount, distinguishing loading, online, and degraded/unavailable state without aggressive polling; its local status disclosure and version/build tooltip do not import or execute Public source at runtime.

See [System architecture](docs/system-architecture.md) for the complete boundary diagram.

## Media direction

The current Stage, Backstage tray, participant menus, ordering, label visibility, room branding, room assets, and custom layouts remain Runtime-authoritative. Cloudflare RealtimeKit Core 2.0.0 supplies explicit preflight, local/remote camera and audio, screen sharing, active speaker, Stage synchronization, reconnect/refresh, and host disable operations beneath the custom UI. Branding and layout reflow preserve stable participant-keyed media elements, while Presentation screen share remains `object-fit: contain`. The planned production migration remains self-hosted LiveKit plus Egress.

The Python runtime/Auth API will orchestrate rooms, permissions, invitations, access, and token minting, but audio and video must bypass the Python runtime. During early ALPHA, final output is expected to use an OBS-capturable program view before server-side egress exists.

## Roadmap

The roadmap is phased and describes planned work, not current capability:

1. frontend scaffold and design foundation — **complete**
2. existing StreamSuites Auth/session bridge and closed-ALPHA access authority — **current milestone complete**
3. runtime-owned Studio rooms, short-code invites, temporary sessions, lobby admission, real-time events, and cohosts — **current milestone complete**
4. polished pre-media stage, Backstage, guest identity, and production-control interactions — **current milestone complete**
5. Cloudflare RealtimeKit Core private-room media lifecycle — **current milestone complete**
6. room settings, Branding, Media, and eight-slot custom-layout foundations — **current milestone complete**
7. Runtime-owned sandboxed browser sources with default Stage placement — **current milestone complete**
8. OBS-capturable program output
9. provider destinations and recording foundations
10. later self-hosted LiveKit and Egress migration
11. integration of existing StreamSuites chat, alerts, clips, polls, games, and automation

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
│   ├── icons/                      # Public-parity badges plus Studio SVG families
│   │   └── ui/                     # exitroom, backstage, Stage move, dock navigation, roomprefs and layout icon pairs
│   ├── illustrations/
│   ├── js/
│   ├── logos/
│   ├── placeholders/
│   └── sounds/
├── docs/
│   ├── alpha-roadmap.md
│   ├── cloudflare-realtimekit-media.md
│   ├── room-chat.md
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
│   ├── branding/
│   │   └── StageBranding.tsx
│   ├── components/
│   │   ├── AuthAccessBanner.tsx
│   │   ├── CohostRequests.test.tsx
│   │   ├── CohostRequests.tsx
│   │   ├── StudioAccountMenu.test.tsx
│   │   ├── StudioAccountMenu.tsx
│   │   ├── InitialsColorPicker.tsx
│   │   ├── StudioFooter.tsx
│   │   ├── ViewOptionsMenu.tsx
│   │   ├── TurnstileWidget.test.tsx
│   │   ├── TurnstileWidget.tsx
│   │   ├── shell/
│   │   │   ├── SiteShell.tsx
│   │   │   ├── StudioEdgeSidebar.tsx
│   │   │   ├── StudioShell.test.tsx
│   │   │   └── StudioShell.tsx
│   │   ├── room/
│   │   │   ├── BrowserSourceRenderer.tsx
│   │   │   ├── BrowserSources.test.tsx
│   │   │   ├── BrowserSourcesPanel.tsx
│   │   │   ├── ContextualNoticeStack.test.tsx
│   │   │   ├── ContextualNoticeStack.tsx
│   │   │   ├── CustomLayoutControls.tsx
│   │   │   ├── RoomBrandingPanel.tsx
│   │   │   ├── RoomMediaPanel.tsx
│   │   │   ├── RoomProductionFoundations.test.tsx
│   │   │   └── RoomWorkspaceShell.test.ts
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── FormField.tsx
│   │   │   ├── ParticipantMenuPortal.test.tsx
│   │   │   ├── ParticipantMenuPortal.tsx
│   │   │   ├── StudioIcon.test.tsx
│   │   │   ├── StudioIcon.tsx
│   │   │   ├── TooltipPortal.tsx
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
│   ├── layout/
│   │   ├── stageLayout.test.ts
│   │   └── stageLayout.ts
│   ├── media/
│   │   ├── StudioMedia.test.tsx
│   │   ├── StudioMediaElements.tsx
│   │   └── useStudioMedia.ts
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
│   │   ├── room-workspace.css
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
