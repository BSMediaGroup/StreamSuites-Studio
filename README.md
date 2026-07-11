# StreamSuites Studio

> **Status: ALPHA access foundation — closed, invite-only access**
> **Flagship surface:** <https://studio.streamsuites.app>
> **Deployment target:** Cloudflare Pages

StreamSuites Studio is the flagship browser livestream-production surface for the wider StreamSuites system. This client now authenticates through the existing Runtime/Auth session authority and consumes runtime-owned closed-ALPHA access decisions. It still does not provide working rooms, guest invitations, media, broadcasting, or recording.

Admins are eligible automatically. Non-admin accounts require an explicit active grant, with no more than 25 enabled invited non-admin grants. The planned initial on-stage size is a maximum of nine people; that capacity is a target, not shipped behavior.

## Current implementation

- React + TypeScript + Vite application foundation
- clean browser routes with a Cloudflare Pages SPA fallback
- responsive public shell and access-protected Studio workspace shell
- credentialed `GET /auth/session` and `GET /api/studio/access` bridge with typed normalization
- existing Google, GitHub, Discord, X, Twitch, and email/password Auth entry paths
- Runtime/Auth logout through `POST /auth/logout`
- explicit loading, unauthenticated, allowed, denied, restricted, and unavailable states
- dark/light token system with dark as the first-visit default and theme-only local persistence
- the existing `assets/logos/sscmattesilver.webp` header logo in both themes
- reusable buttons, cards, status chips, empty states, and form fields
- truthful landing, account-access, workspace-preview, invite-entry, and not-found states
- confirmed typed boundaries for Runtime/Auth sessions and Studio access plus provisional room, guest-invite, media-provider, and runtime-version view models
- focused tests for auth/access normalization, safe return paths, no authorized-shell flash, theme accessibility/persistence, invite-code safety, and runtime-version parsing
- architecture and phased ALPHA roadmap documentation

### Routes

| Route | Current behavior |
| --- | --- |
| `/` | Closed-ALPHA product and access overview. |
| `/login` | Uses existing StreamSuites OAuth or email/password login, then checks runtime-owned Studio access. |
| `/studio` | Fails closed until session and Studio access are confirmed; renders the existing truthful workspace only when allowed. |
| `/join/:inviteCode` | Safely displays a format-checked but explicitly unverified invite code. |
| `*` | Not-found surface. |

## Not implemented

The following are explicitly not shipped:

- Admin Dashboard UI for managing Studio grants
- Studio rooms, room permissions, guest invites, invite validation, or room tokens
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

## Authority boundaries

StreamSuites remains the single authority for runtime state, Auth API behavior, accounts, sessions, roles, tiers, permissions, room orchestration, invitations, access control, token minting, alerts, audit state, persistence, exports, and canonical version/build metadata.

Studio is a client/UI surface only. It validates the confirmed current-session and Studio-access payloads through a narrow adapter and never persists canonical account, session, grant, role, or tier state in `localStorage`. The only persisted browser preference is `streamsuites_studio_theme`.

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
3. runtime-owned Studio rooms and guest invites
4. mocked stage and production-control interactions
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
│   ├── app/
│   │   └── router.tsx
│   ├── auth/
│   │   ├── StudioAuthProvider.tsx
│   │   └── studioAuthContext.ts
│   ├── components/
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
│   │   ├── LoginPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── StudioPage.test.tsx
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
