# Cloudflare RealtimeKit media

Studio uses `@cloudflare/realtimekit` and `@cloudflare/realtimekit-react` 2.0.0 Core SDK APIs beneath the existing custom Stage, Backstage, presentation, cinematic, fullscreen, account, and footer UI. It never uses the prebuilt UI Kit.

An explicit Connect media action requests a participant token from Runtime/Auth, initializes one in-memory client with camera and microphone off, and joins the mapped meeting. Microphone, camera, and screen controls call the SDK only while connected. Participant tokens are never written to browser storage, URLs, logs, or analytics. Cleanup leaves the provider meeting without removing canonical room/lobby identity.

Runtime/Auth remains authoritative for identity, Stage/Backstage, ordering, capacity, cohosts, permissions, intended media state, and presentation. Presets provide defense in depth and never grant StreamSuites authority. A provider failure is a media error, not a room-state mutation.

The Cloudflare RealtimeKit preset Grid Size remains `9`. Studio renders no more than nine visible Stage tiles total: one director slot plus eight additional guest/cohost slots across Grid, Interview, Spotlight, Presentation, fullscreen, and cinematic modes. Backstage does not count. Runtime reconciliation excludes excess provider presence rather than adopting it as canonical Stage state.

Media connected and broadcast live are separate states. Studio remains OFF AIR. Recording, RTMP, SRT, HLS, Cloudflare Stream delivery, LiveKit, and Egress are not implemented. The later self-hosted LiveKit/Egress migration remains planned.
