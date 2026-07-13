# StreamSuites Studio system architecture

## Status

This document separates implemented private-room RealtimeKit media from planned output/broadcast infrastructure. Lines marked planned must not be interpreted as working integration.

## Authority and media paths

```mermaid
flowchart LR
    User["Creator or invited guest"]
    Studio["Studio browser client<br/>current: Auth, shell, private room media,<br/>live Stage/Backstage, invites and control dock"]

    subgraph Runtime["StreamSuites runtime/Auth authority"]
        Auth["Accounts, shared sessions, roles, tiers,<br/>Studio ALPHA grants and admin APIs"]
        Rooms["Implemented short-code rooms and invites,<br/>temporary guests, cohosts, events and lobby admission"]
        MediaTokens["Implemented media mapping,<br/>participant-token and intent authority"]
        State["Canonical state, persistence,<br/>exports and version"]
    end

    subgraph InitialMedia["Current ALPHA private-room media path"]
        Realtime["Cloudflare RealtimeKit<br/>SFU/TURN"]
    end

    subgraph ProductionMedia["Later production media path - planned"]
        LiveKit["Self-hosted LiveKit"]
        Egress["Egress"]
    end

    OBS["OBS program capture<br/>planned early ALPHA output"]
    Destinations["Public broadcast destinations<br/>planned"]

    User --> Studio
    Studio -->|"credentialed session + access requests"| Auth
    Studio -->|"credentialed room/invite/cohost/lobby requests and SSE"| Rooms
    Auth --> State
    Rooms --> State
    MediaTokens --> State

    Studio -->|"private audio/video; bypasses runtime"| Realtime
    Studio -. "planned program view" .-> OBS
    OBS -. "operator-configured output" .-> Destinations

    Studio -. "later media path" .-> LiveKit
    LiveKit -.-> Egress
    Egress -.-> Destinations
```

## Non-negotiable boundaries

- Studio is a browser client and never becomes a source of canonical account, access, room, invite, permission, token, alert, audit, or version state.
- StreamSuites Runtime/Auth owns those decisions and their persistence.
- Existing admin, creator, developer, and public account types are reused; no Studio-only account authority is introduced.
- Admins are Studio-eligible automatically. Non-admin eligibility comes from an enabled grant keyed to the stable account ID, with a transactional maximum of 25 enabled invited grants. Grants never change role, tier, creator capability, or public-profile state.
- `GET /api/studio/access` re-evaluates live session/account/grant truth and fails closed. Admin management is provided by `GET`/`POST /api/admin/studio/access` and `PATCH`/`DELETE /api/admin/studio/access/{account_id}` using existing admin authorization, audit, and alert-event seams.
- Guest access is implemented as a temporary room-scoped identity granted through Runtime/Auth-validated short invitation links. Guests may join without an account. After embedded password/OAuth completion, Studio refreshes the same route and Runtime alone derives the account link from the shared session cookie; no client account ID proves identity. Untouched account name/CDN-avatar fields hydrate the room form, explicit draft edits win, and room overrides never mutate the account. Canonical invite codes are context-separated HMAC derivatives that Runtime/Auth can regenerate for authorized copying; only hashes are indexed and guest credentials remain hash-only.
- Room events are persisted with monotonic IDs before an in-process signal wakes credentialed SSE streams. Studio treats every event as an invalidation hint, coalesces refetches, and polls only while SSE is disconnected.
- Session cohosts are room/guest scoped and expire with that authority. Permanent cohost relationships require an authenticated invited account and remain separately scoped to all director rooms or selected internal room IDs; neither path changes roles, tiers, ownership, grants, billing, or public profiles.
- The separate `streamsuites_studio_guest` HttpOnly cookie lasts up to 12 hours, never overwrites `streamsuites_session`, uses shared secure production scope, and follows the existing host-only local/private development policy.
- Room lifecycle is `draft`, `open`, `closed`, and final `ended`. Owner/admin controls and `BEGIN IMMEDIATE` admission transactions enforce nine total visible Stage slots: the host/director reserves one and no more than eight additional guests or cohosts may be on Stage. Backstage capacity remains separate, and moving someone Backstage immediately frees one additional Stage slot.
- Runtime/Auth may authorize and mint media access, but the Python runtime does not carry audio or video packets.
- Cloudflare RealtimeKit Core 2.0.0 is the initial ALPHA media transport; Runtime/Auth owns mappings and participant-token issuance while Studio owns the custom media UI.
- Self-hosted LiveKit plus Egress is the later planned production media path, not the current implementation.
- Public viewers are broadcast-destination audiences and are not placed in Studio WebRTC rooms.
- No provider API detail is assumed until its contract is verified in the implementation phase that needs it.

## Current frontend integration

- `src/config/env.ts` accepts a public Runtime/Auth override, with established production/local fallbacks, plus the optional runtime-version URL.
- `src/api/studioAuth.ts` validates Auth/access plus room, invite-policy, guest-profile, cohost, presentation, SSE, and lobby contracts, always sends credentials, supports cancellation, and normalizes machine-readable errors.
- `/login` uses existing Runtime/Auth OAuth and email/password paths with a validated same-origin return target. `/join/:inviteCode` reuses that implementation inside a focus-trapped sheet; safe display name, subtitle, and supported initials color may cross OAuth in a namespaced 15-minute `sessionStorage` draft, while credentials, challenge/bypass values, invite code, avatar bytes, cookies, and authority never do. Password completion refreshes Auth in place and OAuth returns to the exact invite route.
- The room dashboard, media workspace, and guest join flow hold fetched server state only in React memory. No room, lobby, invite code, participant token, guest credential, avatar binary, or cohost authority is persisted or logged by Studio.
- `/studio` presents Runtime room summaries with canonical Room ID chips. `/studio/rooms/:roomId` dispatches to director/cohost management or the current guest's safe Stage/Backstage workspace, canonicalizes old UUID URLs, and exposes only permission-summary-approved participant, ordering, presentation, invite, and cohost actions. Guest joins navigate into this route rather than remaining on a text waiting page.
- `PresentationProvider` owns one validated local object for expanded/compact/hidden desktop navigation, standard/slim/auto-hide headers, and off/on cinematic presentation. Those modes change layout classes without remounting the room route or reconnecting SSE. Corrupt fields fall back independently; no room, guest, invite, permission, event, or media value is accepted into that storage object.
- Cinematic presentation is active only for the protected room workspace. It retains room identity, lifecycle/broadcast truth, `OFF AIR`, connection state, arrival counts, layouts, and the production dock while promoting the same Backstage/invite/settings panel and handlers into a focus-managed overlay. It does not create a second lobby store.
- Browser fullscreen is an optional, explicit room action using the standard Fullscreen API. Support and `fullscreenchange` determine the visible state; requests may enable cinematic presentation but do not overwrite saved sidebar/header modes, and rejected requests are reported without claiming success.
- Requested Auto, Grid, Interview, Spotlight, and Presentation layout plus valid spotlight/presentation participant selection are Runtime-owned and SSE synchronized. Runtime persists and emits `auto`; Studio alone derives the effective layout in priority order from active screen share, explicit spotlight, then one/two/three-to-nine participant count. Drag and keyboard Stage order changes submit the exact stable-ID set and roll back on failure.
- The compact room workspace removes the duplicate full-width lifecycle row in favor of one confirmed header Room Actions menu and removes the duplicate left room rail in favor of the existing right panel's collapsed icon rail. The expanded/collapsed panel is one presentation state; shortcuts expand the matching authoritative Backstage, Invites, or Room content. The one-row dock scrolls horizontally behind fixed edge arrows instead of wrapping.
- Stage media components keep stable participant keys inside a centered 16:9 output. Exactly two visible participants fill equal full-height columns; usable camera video hides the central fallback while the separate name/subtitle overlay remains. Presentation keeps the screen at `object-fit: contain`. Participant actions and delayed icon tooltips render through viewport-colliding document portals so Stage/panel/dock overflow cannot clip them.
- Explicit preflight uses RealtimeKit device APIs and requests permission only after user action. The 2.0.0 client enables `experimentalAudioPlayback`; SDK audio play is allowed only after initialization/join with a present audio manager on the current lifecycle generation. Missing audio and expected autoplay rejection become localized recovery UI, and a replaced meeting cannot receive stale calls. Local/remote video registration, active speaker, screen sharing, Stage synchronization, and guest lifecycle sit beneath the existing workspace. SDK media changes precede Runtime intent updates; `OFF AIR`, inactive `00:00:00`, and disabled Go live remain separate output truth.
- No canonical auth/access state, Turnstile token, bypass code, bypass flag, room/invite/guest/cohost/permission state, or SSE/media state is saved to browser storage. The bypass response expiry and Turnstile completion live only in component memory; the authoritative bypass is Runtime's HttpOnly cookie. `streamsuites_studio_theme` and validated `streamsuites_studio_presentation` display modes are the only local preferences.
- Turnstile script/config loading is shared, one render generation owns the visible widget, and normal auth/access/form rerenders cannot recreate it. The shell loading bar uses reference-counted transient UI activity and does not participate in the widget lifecycle.
- The authenticated topbar menu renders only safe session fields already returned by Runtime/Auth and ports Public's unified avatar/name/allowed-badge chip, one-role-or-tier suppression, dropdown geometry, and keyboard/outside-click/focus behavior. The exact committed Public badge assets remain multicolor images; monochrome workspace controls use the reusable CSS-mask/currentColor renderer and never globally invert assets.
- `src/api/runtimeVersion.ts` validates the existing runtime-owned `version.json` shape. The global footer hydrates the configured export and performs one established `/api/health` check per shell mount, with loading/online/degraded states and no aggressive poll.
- `src/domain/studio.ts` contains confirmed normalized session/access, room, invite, and guest view models plus media direction models. These client view models are not backend schemas.

## Theme and brand

- Dark is the first-visit default; light mode is token-driven across all routes and reusable components.
- The accessible header switch persists only the theme choice and an early head script applies it before React/CSS render.
- Headers use the existing `assets/logos/sscmattesilver.webp` asset in both modes.
- The document favicon is `/assets/icons/studiofavicon.ico`; OAuth buttons import the committed `assets/icons/google.svg`, `github.svg`, `discord.svg`, `x.svg`, and `twitch.svg` files so Vite fingerprints and emits real production-build asset URLs. The files match Public's working provider assets.

## Early ALPHA output

Before server-side egress exists, the approved direction is a dedicated browser program view that OBS can capture. That view, its clean-feed behavior, and any destination configuration remain future work.
