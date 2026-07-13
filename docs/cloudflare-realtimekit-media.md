# Cloudflare RealtimeKit media

Studio uses installed `@cloudflare/realtimekit` and `@cloudflare/realtimekit-react` 2.0.0 beneath the existing room UI. Runtime/Auth remains canonical for room membership, guest/cohost permission, Stage/Backstage, Stage order/capacity, presentation mode, mappings, participant-token issue/refresh, intent, and reconciliation. RealtimeKit transports private room tracks only.

## Device preflight and lifecycle

`Connect media` is the only path that provisions a participant and touches devices. It opens preflight, initializes one room-scoped SDK client with audio/video defaults off, obtains devices through `self.getAllDevices()`, selects with `self.setDevice()`, and uses `self.enableVideo()`/`enableAudio()` for the real preview and meter. Supported browsers also expose speaker selection through `audio.setSpeakerDevice()`.

Preflight supports camera/microphone choices, join without devices, no-device, denied, busy, disconnected, unsupported-browser, and insecure-context states. Preview tracks are disabled and the unjoined client leaves on cancel/unmount. Strict Mode refs prevent duplicate initialization/join. Connected is shown only after `client.join()` resolves.

The lifecycle registers one listener set for self media, joined participants, socket state, active speaker, screen-share end, and autoplay error, and removes the same listeners on meeting change/unmount. Participant tokens stay inside function scope; the SDK error callback requests a Runtime refresh only while authority remains valid, leaves the expired client, and creates one replacement client at a time without remounting room SSE.

## Rendering and controls

- Local and remote camera elements use `registerVideoElement()` and `deregisterVideoElement()` with `object-fit: cover`; fallback avatars remain when usable video is absent.
- Remote audio uses `audio.addParticipantTrack()`, `removeParticipantTrack()`, and `audio.play()`. Autoplay rejection exposes `Enable audio`.
- Local microphone/camera controls call SDK enable/disable first and commit Runtime media intent only after success. A failed Runtime commit rolls the SDK state back.
- Host operations call Runtime permission/mutation paths first. They may call remote `disableAudio()` or `disableVideo()` but never force-enable hardware.
- Active speaker uses `participants.activeSpeaker` as a subtle reduced-motion-compatible marker and never changes or persists Stage order.

## Stage, guests, and Presentation

Runtime Stage mutations succeed before provider operations. Directors/cohosts use `stage.grantAccess()` or `stage.kick()` for mapped remote participants; the affected client follows canonical SSE state with `stage.join()` or `stage.leave()`. Provider failure marks reconciliation-required and cannot expand Runtime's nine total Stage slots (one director plus eight additional participants).

`GuestRoomWorkspace` uses the same hook and mapping store. Backstage guests receive Stage audio/video, may run preflight and keep a private preview, and cannot self-admit. On-stage guests publish permitted choices and may self-Backstage. Cohost self-stage remains limited to Runtime-granted permission/preset.

Screen share starts only from an explicit authorized on-stage action using `self.enableScreenShare()`. One active share is accepted by default. Local/remote SDK screen tracks render as the main manual Presentation surface with `object-fit: contain`; participant cameras remain present. SDK/browser stop and disconnect clear the rendered source and update Runtime intent without inventing a sharing state.

Media connected and broadcast live are separate states. Studio remains OFF AIR. Recording, RTMP, SRT, HLS, Cloudflare Stream delivery, webhooks, public broadcasting, LiveKit, and Egress were not added.
