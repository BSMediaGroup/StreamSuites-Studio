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
- generate high-entropy invitations, persist only secure hashes, return the raw code once, and support revocation plus optional expiry
- create separate temporary room-scoped guest sessions without replacing the shared account cookie
- persist waiting/admitted/denied/removed/left/expired lobby state and expose guest-self plus owner/admin management APIs
- enforce a transactional maximum of nine admitted guest stage occupants while keeping the host/director and waiting lobby outside that cap
- ship the room dashboard, protected management workspace, and real join/lobby UI without claiming media connectivity

No camera, microphone, screen sharing, media track, broadcast output, or recording was delivered by this phase.

## 4. Pre-media stage and production controls — planned

- build interactive layout and control behavior without claiming live media
- validate keyboard, screen-reader, mobile, and reduced-motion use
- keep local interaction state clearly separate from authoritative Runtime/Auth room state

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
