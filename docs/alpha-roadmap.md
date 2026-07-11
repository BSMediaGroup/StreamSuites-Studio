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

No Admin Dashboard management UI, self-service application, room, guest invite, or media behavior is delivered by this phase.

## 3. Runtime-owned rooms and guest invites — planned

- add room and invitation contracts to Runtime/Auth
- enforce room role, tier, permission, and invite-expiry server-side in addition to the implemented ALPHA entry policy
- keep guest permission temporary and room-scoped
- target a maximum initial on-stage size of nine

## 4. Mocked stage and production controls — planned

- build interactive layout and control behavior without claiming live media
- validate keyboard, screen-reader, mobile, and reduced-motion use
- keep mock UI state clearly separate from authoritative room state

## 5. Cloudflare Realtime media — planned

- integrate camera, microphone, and screen sharing through Cloudflare Realtime SFU/TURN
- request room/media authorization from Runtime/Auth
- keep audio and video transport outside the Python runtime
- verify real browser permission, reconnect, device-change, and participant behavior

## 6. OBS-capturable program output — planned

- add a dedicated clean program view for OBS capture
- separate operator chrome from the captured output
- validate aspect ratios, safe areas, audio routing, and recovery behavior

This is the expected early ALPHA final-output strategy before server-side egress exists.

## 7. Destinations and recording foundations — planned

- define verified provider adapters only after their actual contracts are inspected
- keep credentials and stream keys in secure server-side configuration
- add truthful destination and recording readiness states

## 8. LiveKit and Egress migration — later planned

- migrate the production media path to self-hosted LiveKit
- introduce Egress for production output and recording where approved
- preserve Runtime/Auth room, permission, invite, token, audit, and persistence authority

## 9. Existing StreamSuites tools as Studio capabilities — later planned

- chat and trigger tooling
- alerts
- clips
- polls and tallies
- games
- creator automation

Existing tools remain intact in their current repositories and runtime modules until an explicit integration task connects them to Studio.
