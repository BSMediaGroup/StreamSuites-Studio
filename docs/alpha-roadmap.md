# StreamSuites Studio ALPHA roadmap

Every phase below is additive. A phase is not shipped until its real authority and media paths are implemented and validated.

## 1. Scaffold and design foundation — complete

- React, TypeScript, and Vite application foundation
- responsive landing, access, Studio-shell, invite-entry, and not-found routes
- reusable layout and UI primitives
- provisional typed integration seams
- Cloudflare Pages build and SPA fallback
- architecture and roadmap documentation

No rooms, media, broadcast output, or recording were delivered by this phase.

## 2. Existing Auth/session bridge and closed-ALPHA access — complete

- connect to the existing StreamSuites Runtime/Auth session contract
- map confirmed server responses through a narrow Studio adapter
- preserve server-backed cookie/session truth
- reuse existing admin, creator, developer, and public account types
- fail closed when Runtime/Auth is unavailable or access is not granted
- protect `/studio`, provide real Auth entry/logout, and distinguish denied from unavailable
- persist runtime-owned non-admin grants with a transactional 25-user cap and admin management API foundation
- provide accessible dark/light modes with dark as default and use the verified Studio logo asset

No self-service application, room, guest invite, or media behavior was delivered by this phase. The existing Admin Dashboard grant-management surface remains separate and preserved.

## 3. Runtime-owned rooms and guest invites — complete

- persist room ownership plus draft/open/closed/ended lifecycle in Runtime/Auth
- authorize admins globally and active-granted creator/developer-capable owners only for their rooms, while public accounts remain invite participants
- retain internal UUIDs while publishing immutable eight-character room codes and stable nine-character HMAC-derived invite codes with temporary UUID-route compatibility
- support single-use, capped, and open invitations with transactional entrant counts, authorized re-copy, default 24-hour expiry, optional no-expiry, exhaustion, revocation, and rate-limited entry
- create separate temporary room-scoped guest sessions without replacing the shared account cookie
- persist canonical backstage/on_stage/denied/removed/left/expired participant location, repeatably migrate legacy waiting/admitted rows, and expose permission-aware guest-self plus director/cohost management APIs
- enforce a transactional maximum of nine total visible Stage slots, reserving one for the host/director and permitting at most eight additional guests or cohosts; Backstage does not count, ordinary guests can self-Backstage but cannot self-admit, and cohosts can move themselves both ways
- ship the room dashboard, protected management workspace, and real join/lobby UI without claiming media connectivity
- persist monotonic safe room events and expose credentialed host/cohost and guest-isolated SSE with replay, heartbeat, reconnect, and disconnected-only fallback polling
- support normalized guest display names, optional subtitles, visual initials colors, CDN-backed room-only WebP fallback avatars, intended microphone/camera state, persistent Stage order, and Runtime-owned Grid/Interview/Spotlight/Presentation state
- support room-session cohosts plus authenticated permanent cohost invitation/acceptance/decline/revoke with all-room and selected-room scope
- expose pending permanent-cohost requests in the signed-in header with recipient accept/decline and pending count; keep permanent authority inactive until acceptance

No camera, microphone, screen sharing, media track, broadcast output, or recording was delivered by this phase.

## 4. Pre-media stage and production controls — complete

- present existing rooms with a primary Enter room action while ended rooms remain visibly unavailable
- render a responsive Stage output with confirmed host/on-stage identities, a Presentation placeholder, meaningful empty positions, safe-area guides, and explicit awaiting-media treatment
- show a horizontal Backstage tray below Stage plus the original primary left Studio navigation and a separate right contextual management panel, with Runtime-backed Stage/Backstage moves, deny/kick distinction, intended mic/camera controls, capacity conflicts, and pending states
- integrate policy-controlled reusable invite links, revocation/exhaustion, confirmed room/presentation settings, scoped cohost controls, and lifecycle controls into the room workspace
- distinguish retained invite revocation from permanent deletion, and expose canonical lobby room edit plus owner-only typed-confirmation room deletion
- surface live connection state, immediate Backstage arrivals/profile/status updates, accessible announcements, waiting/on-stage/cohost sections, and account-optional guest identity editing
- synchronize requested Auto, Grid, Interview, Spotlight, and Presentation layouts plus drag/keyboard Stage order; derive Auto locally from real screen share, explicit spotlight, or the current 1–9 count without claiming broadcast output
- orient future production work with a control dock, truthful `OFF AIR` state, inactive timer, unavailable media controls, and explanatory Go live dialog
- validate keyboard-accessible controls, mobile stacking, light/dark themes, and reduced-motion behavior while keeping local interaction state separate from authoritative Runtime/Auth room state
- ship independent collapsed/expanded primary-left and room-production-right sidebar presentation with separate validated keys, View-only hiding, standard/slim/auto-hide headers, and local contextual-notice duration while preserving the responsive drawers
- provide a room-scoped cinematic Stage mode, waiting-count-aware right contextual drawer using the existing authoritative state/actions, compact truthful production dock, `F` shortcut, focus/Escape recovery, and optional `fullscreenchange`-confirmed browser fullscreen
- preserve invite drafts through the embedded Auth sheet/OAuth return, route joined guests into the canonical room workspace, provide permission-aware participant menus and dedicated cohost scope/revoke management, and align Room ID/account badge/sidebar/footer shell details with established surfaces
- compact the completed media workspace without replacing its lifecycle: one mirrored `StudioEdgeSidebar` component now supplies both full-height shell-sibling edges, fixed rails, independently scrolling bodies, and final-row 46px square toggles; every left section retains dedicated local content including Destinations; both first-time states are collapsed, hover/focus expansion overlays without geometry changes, pinning alone reserves its edge track, and View alone hides/restores each side; the right production edge is outside the center/Stage DOM; the uncapped center chooses the largest fitted 16:9 Stage with an exactly aligned toolbar while Backstage follows below; the right Room panel exposes canonical Fill/Fit; Public footer structure/status/version-tooltip parity is Studio-local; contextual notices overlay without media reflow; and only the production dock retains horizontal overflow controls
- complete the bounded desktop geometry acceptance at 1366×768 with controlled local fixtures: equal full-height edge rectangles and toggle bottoms, sub-8px toggle insets, internal right-panel scrolling without rail/toggle/page movement, 0px Stage change for either hover overlay, 16:9 Stage shrink/restore for either pinned edge, exact toolbar/output edges, visible footer, no horizontal overflow, and one clean console/network inspection

No camera, microphone, screen sharing, media tracks, WebRTC, Cloudflare Realtime connection, recording, or broadcast output was delivered by this phase; private-room media was completed separately in phase 5.

## 5. Cloudflare RealtimeKit Core media — complete for private room media

- completed Backstage-first presentation-source staging for the current single active screen share, including Runtime-owned Fill/Fit and overlay/outside edge settings, exact centered 1–9 camera rows, director/cohost Stage placement, presenter-only capture start/stop, and stable existing media elements
- next after the completed browser-source foundation: granular freeform placement; recording, destinations/output, webhooks, LiveKit, and Egress remain later milestones

- connect through Runtime/Auth-issued and refreshed participant tokens held only in memory
- provide explicit device preflight, local preview, SDK device selection, device-off join, and permission/device error states
- register/deregister real local and remote video, play remote audio with autoplay recovery, and show actual media/reconnect/active-speaker state without changing Stage order
- use the same lifecycle in the guest workspace so Backstage receives Stage media without publication and on-stage guests publish only after Runtime admission
- apply Runtime-first Stage/Backstage, guest/cohost preset, host force-disable, provider removal, and reconciliation-required flows while preserving nine total Stage slots
- render participant-initiated RealtimeKit screen sharing in manual Presentation layout while retaining camera tiles
- keep audio and video outside Python and keep Studio OFF AIR
- keep private room text, unread, moderation, and delivery authority in Runtime/Auth while using the existing room SSE stream
- expose public-provider connection/capability truth without claiming external feed ingestion or outbound message delivery
- harden the installed 2.0.0 playback lifecycle against missing/replaced audio managers, keep autoplay failure recoverable, separate live camera surfaces from fallback identity, retain a 16:9 Stage with full-height two-person columns, and preserve the privacy boundary by exposing no director-visible Backstage preview until a scoped transport is designed

Mocked SDK lifecycle, registration, intent-order, screen-share, Runtime provider transport, refresh, preset, cleanup, and capacity behavior is covered locally. Live configured Cloudflare/browser proof remains a deployment validation step.

## 6. Room production foundations — complete

- replace the subtitle-only presentation toggle with Runtime-owned `name_and_subtitle`, `name_only`, and `hidden` broadcast-label modes while preserving identity in management and accessibility surfaces
- provide room-level Branding for solid/gradient/selected-image Stage backgrounds, logo/bug placement, badge/subtitle styling, editor-only safe-area visibility, canonical save/reset, and live Stage preview
- manage room-owned logo, Stage-background, overlay, holding, and presentation-placeholder PNG/JPEG/WebP assets through validated, normalized, CDN-only Runtime records
- provide a portal-based Custom selector plus Room Settings management for up to eight stable-ID named/reorderable/deletable snapshots of Grid, Interview, Spotlight, or Presentation
- preserve stable RealtimeKit participant keys and registrations while label, branding, background, and built-in/custom layout presentation changes reflow around them

Custom geometry drag/resize, account-wide brand kits, director-visible Backstage preview transport, recording, destinations, broadcasting, and server-side egress were not delivered by this phase. Studio remains OFF AIR.

## 7. Runtime-owned custom browser sources — complete foundation

- added permission-gated Runtime/Auth browser-source records and APIs with Backstage/on-Stage/disabled lifecycle, duplication, manual/activation refresh revisions, room-end disable, safe SSE summaries, and no participant-capacity impact
- added HTTPS/private-network/userinfo/scheme validation without server-side fetch/proxy; `production_only` hides full URLs from ordinary guests while `room` intentionally shares them with a visible credential warning
- added a separate Browser Sources section to Media, lazy limited Backstage previews, stable-ID cards, canonical save/error behavior, and Stage rendering at a persisted centered normalized 60%-width 16:9 rectangle
- added a strict scripts-only iframe sandbox with no forms, same-origin, popups, downloads, top navigation, referrer, autoplay audio, device/geolocation/clipboard/payment/display permissions, plus authorized local interaction mode with Escape exit
- preserved the exact Fill/Fit participant grid, presentation sources, Branding, labels, custom snapshots, restored primary left navigation, independent right contextual panel, cinematic/fullscreen, existing RealtimeKit lifecycle, disabled Go Live, and OFF AIR

Freeform drag/resize, snapping guides, z-order editing UI, crop, rotation, animation, custom HTML/script input, public output, recording, destinations, webhooks, LiveKit, and Egress remain separate later milestones.

## 7. OBS-capturable program output — planned

- add a dedicated clean program view for OBS capture
- separate operator chrome from the captured output
- validate aspect ratios, safe areas, audio routing, and recovery behavior

This is the expected early ALPHA final-output strategy before server-side egress exists.

## 8. Destinations and recording foundations — planned

- define verified provider adapters only after their actual contracts are inspected
- keep credentials and stream keys in secure server-side configuration
- add truthful destination and recording readiness states

## 9. LiveKit and Egress migration — later planned

- migrate the production media path to self-hosted LiveKit
- introduce Egress for production output and recording where approved
- preserve Runtime/Auth room, permission, invite, token, audit, and persistence authority

## 10. Existing StreamSuites tools as Studio capabilities — later planned

- chat and trigger tooling
- alerts
- clips
- polls and tallies
- games
- creator automation

Existing tools remain intact in their current repositories and runtime modules until an explicit integration task connects them to Studio.
