# Bump Notes

## CURRENT VER= 0.5.0-alpha / PENDING VER= 0.5.1-alpha

- Studio version authority: StreamSuites Runtime remains the sole product version source. This private package uses `0.0.0` only as non-authoritative npm metadata; the UI shows the ALPHA stage while numeric hydration waits for a confirmed Studio-safe publication path for the runtime `version.json` export.
- Initial frontend scaffold: added a React + TypeScript + Vite foundation with application bootstrap, clean browser routing, reusable public and Studio shells, focused UI primitives, provisional Runtime/Auth adapters and domain types, tokenized responsive dark styling, and focused tests.
- Initial routes: added `/`, `/login`, `/studio`, `/join/:inviteCode`, and a not-found route. Each surface is explicit about closed access and unavailable backend/media behavior; no fake authenticated state, active rooms, participants, analytics, broadcasts, or invite validation is shown.
- Cloudflare Pages readiness: added the `dist` production build target, `public/_redirects` SPA fallback, and a public-safe `.env.example` without secrets, account IDs, credentials, or tokens. No Pages project, DNS, deployment, or account-specific configuration was created.
- Documentation milestone: replaced the placeholder README with current capability, non-capability, setup, authority, media-direction, OBS-output, roadmap, and complete scaffold-tree documentation; added focused system-architecture and ALPHA-roadmap documents.
- Explicit non-capability note: authentication, room APIs, invite validation, WebRTC, Cloudflare Realtime integration, LiveKit, Egress, broadcasting, provider destinations, recording, and OBS program output are not implemented in this milestone.
- Human note: Studio now has an honest, testable flagship-product shell ready for the next existing-Auth/session bridge task, while Runtime/Auth keeps all canonical authority and media remains outside the Python runtime.
