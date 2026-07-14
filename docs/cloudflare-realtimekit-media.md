# Cloudflare RealtimeKit media

Studio uses installed `@cloudflare/realtimekit` and `@cloudflare/realtimekit-react` 2.0.0 beneath the existing room UI. Runtime/Auth remains canonical for room membership, guest/cohost permission, Stage/Backstage, Stage order/capacity, presentation mode, mappings, participant-token issue/refresh, intent, and reconciliation. RealtimeKit transports private room tracks only.

Screen-share publication now registers a safe, stable Runtime presentation source that begins Backstage. The current registered RealtimeKit video track is reused for preview and Stage `object-fit: contain`; moving between Backstage and Stage changes only Runtime source location and does not reconnect the meeting or stop capture. Presenter stop/leave and room end clear stale source authority. One active provider share is supported, source records never contain track/token/provider credentials, participant capacity remains nine, and Studio remains OFF AIR. Overlay/outside edge placement affects camera presentation only; media still bypasses Python.

## Device preflight and lifecycle

`Connect media` is the only path that provisions a participant and touches devices. It opens preflight, initializes one room-scoped SDK client with audio/video defaults off and `modules.experimentalAudioPlayback` enabled, obtains devices through `self.getAllDevices()`, selects with `self.setDevice()`, and uses `self.enableVideo()`/`enableAudio()` for the real preview and meter. Supported browsers expose speaker selection only when the initialized audio manager exists.

Preflight supports camera/microphone choices, join without devices, no-device, denied, busy, disconnected, unsupported-browser, and insecure-context states. Preview tracks are disabled and the unjoined client leaves on cancel/unmount. Strict Mode refs prevent duplicate initialization/join. Connected is shown only after `client.join()` resolves.

The lifecycle registers one listener set for self media, joined participants, socket state, active speaker, screen-share end, and autoplay error, and removes the same listeners on meeting change/unmount. Participant tokens stay inside function scope; the SDK error callback requests a Runtime refresh only while authority remains valid, leaves the expired client, and creates one replacement client at a time without remounting room SSE. A monotonically invalidated lifecycle generation gates async callbacks and `.play()`: initialization and join must be complete, `self.roomJoined` and the audio manager must exist, and the client must still be current. Missing audio never calls `.play()`; autoplay rejection exposes `Enable audio`; expected media-element playback or registration failure remains local to the media surface.

## Rendering and controls

- Local and remote camera elements use `registerVideoElement()` and `deregisterVideoElement()` with `object-fit: cover`; a live registered track removes the central avatar/status fallback while the independent name/subtitle label overlay remains. Camera-off, reconnecting, and provider-missing states restore the accurate fallback.
- Remote audio uses `audio.addParticipantTrack()`, `removeParticipantTrack()`, and `audio.play()`. Autoplay rejection exposes `Enable audio`.
- Local microphone/camera controls call SDK enable/disable first and commit Runtime media intent only after success. A failed Runtime commit rolls the SDK state back.
- Host operations call Runtime permission/mutation paths first. They may call remote `disableAudio()` or `disableVideo()` but never force-enable hardware.
- Active speaker uses `participants.activeSpeaker` as a subtle reduced-motion-compatible marker and never changes or persists Stage order.

## Stage, guests, and Presentation

Runtime Stage mutations succeed before provider operations. Directors/cohosts use `stage.grantAccess()` or `stage.kick()` for mapped remote participants; the affected client follows canonical SSE state with `stage.join()` or `stage.leave()`. Provider failure marks reconciliation-required and cannot expand Runtime's nine total Stage slots (one director plus eight additional participants).

`GuestRoomWorkspace` uses the same hook and mapping store. Backstage guests receive Stage audio/video, may run preflight and keep a local preview, and cannot self-admit. Backstage cards register the participant's existing main-room RealtimeKit camera track as a compact 16:9 thumbnail when it is live, with the avatar retained when the camera is off or unavailable. This does not create a second meeting, token, capture, audio element, or authorization layer: participants already admitted to the private room may receive the same room track. On-stage guests publish permitted choices and may self-Backstage. Cohost self-stage remains limited to Runtime-granted permission/preset. Requested `auto` remains Runtime-owned while both host and guest workspaces derive the same effective layout; Custom resolves through the selected Runtime-owned built-in snapshot. The derivation never mutates provider state.

Screen share starts only from an explicit authorized on-stage action using `self.enableScreenShare()`. One active share is accepted by default. Local/remote SDK screen tracks render as the main manual or effective-Auto Presentation surface with `object-fit: contain`; participant camera elements retain stable keys in the compact filmstrip. SDK/browser stop and disconnect clear the rendered source and, when requested mode is Auto, return to the count-derived layout without inventing a sharing state.

The workspace reflow changes only presentation chrome around the media elements. Device preflight, SDK client/token refresh, local/remote audio/video registration, active speaker, provider Stage/Backstage synchronization, screen sharing, and host disable operations remain in the existing hook/elements. Participant-label visibility and badge style are overlay props; solid/gradient/CDN-image backgrounds and the logo/bug are pointer-transparent Stage decoration. These settings do not replace the meeting, request devices, deregister video, or change stable participant keys. The Stage output stays centered at 16:9; two visible participants use two equal full-height columns; screen share remains `object-fit: contain`; and custom-layout selection may reflow the same media elements without remounting them.

Media connected and broadcast live are separate states. Studio remains OFF AIR. Recording, RTMP, SRT, HLS, Cloudflare Stream delivery, webhooks, public broadcasting, LiveKit, and Egress were not added.
