import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientError, RTKParticipant, SocketConnectionState } from "@cloudflare/realtimekit";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import {
  createStudioMediaSession,
  leaveStudioMediaSession,
  loadStudioMediaStatus,
  refreshStudioMediaSession,
  reportStudioMediaFailure,
  updateOwnStudioMediaIntent,
  type StudioMediaParticipantBinding,
} from "../api/studioAuth";

export type StudioMediaConnection =
  | "idle"
  | "preflight"
  | "provisioning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "permission_error"
  | "provider_error"
  | "unavailable"
  | "reconciliation_required";

export interface StudioMediaDevices {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export interface StudioMediaOptions {
  location?: "on_stage" | "backstage";
  canScreenShare?: boolean;
}

function normalizedError(error: unknown): { state: StudioMediaConnection; reason: string; code: string } {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return { state: "permission_error", reason: "Camera or microphone permission was denied", code: "device_permission_denied" };
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { state: "permission_error", reason: "No requested camera or microphone is available", code: "device_not_found" };
  if (name === "NotReadableError" || name === "TrackStartError") return { state: "permission_error", reason: "A camera or microphone is already in use", code: "device_busy" };
  if (name === "OverconstrainedError") return { state: "permission_error", reason: "The selected device is no longer available", code: "device_disconnected" };
  const message = error instanceof Error ? error.message : "RealtimeKit media failed";
  return { state: "provider_error", reason: /token|unauthor/i.test(message) ? "Media access expired" : "RealtimeKit media could not connect", code: /token|unauthor/i.test(message) ? "provider_token_expired" : "provider_error" };
}

function bindingsMap(bindings: readonly StudioMediaParticipantBinding[]) {
  return new Map(bindings.map((binding) => [binding.customParticipantId, binding.runtimeParticipantId]));
}

type StudioMeeting = ReturnType<typeof useRealtimeKitClient>[0];
type ReadyStudioMeeting = Exclude<StudioMeeting, undefined>;
type AudioPlayback = ReadyStudioMeeting["audio"];

function audioPlayback(meeting: ReadyStudioMeeting | undefined): AudioPlayback | null {
  const candidate = (meeting as (ReadyStudioMeeting & { audio?: AudioPlayback }) | undefined)?.audio;
  return candidate && typeof candidate.play === "function" ? candidate : null;
}

export function useStudioMedia(roomId: string, options: StudioMediaOptions = {}) {
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [state, setState] = useState<StudioMediaConnection>("idle");
  const [reason, setReason] = useState("Checking media configuration");
  const [pending, setPending] = useState("");
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [devices, setDevices] = useState<StudioMediaDevices>({ cameras: [], microphones: [], speakers: [] });
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [cameraChoice, setCameraChoice] = useState(true);
  const [microphoneChoice, setMicrophoneChoice] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [activeRuntimeParticipantId, setActiveRuntimeParticipantId] = useState<string | null>(null);
  const [mediaRevision, setRevision] = useState(0);
  const [bindings, setBindings] = useState<StudioMediaParticipantBinding[]>([]);
  const initialized = useRef(false);
  const meetingRef = useRef<ReadyStudioMeeting | undefined>(meeting);
  const joined = useRef(false);
  const cleaned = useRef(false);
  const refreshRunning = useRef(false);
  const mounted = useRef(true);
  const lifecycleGeneration = useRef(0);
  const locationRef = useRef(options.location ?? "backstage");
  const syncedLocationRef = useRef<"on_stage" | "backstage" | null>(null);
  const intentRef = useRef({ microphoneMuted: true, cameraHidden: true, screenSharing: false });
  const speakerSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  locationRef.current = options.location ?? "backstage";

  const isCurrentLifecycle = useCallback((generation: number, client?: ReadyStudioMeeting) => (
    mounted.current && lifecycleGeneration.current === generation && (!client || meetingRef.current === client)
  ), []);

  const initializeMeeting = useCallback(async (authToken: string, onError: (error: ClientError) => void) => initMeeting({
    authToken,
    defaults: { audio: false, video: false },
    modules: { experimentalAudioPlayback: true },
    onError,
  }), [initMeeting]);

  useEffect(() => {
    if (meeting && (!meetingRef.current || meetingRef.current === meeting)) meetingRef.current = meeting;
  }, [meeting]);

  const refreshMappings = useCallback(async () => {
    try {
      const status = await loadStudioMediaStatus(roomId);
      setBindings(status.participantBindings);
      if (status.reconciliationRequired) {
        setState("reconciliation_required");
        setReason("Runtime and RealtimeKit media state require reconciliation");
      }
      return status.participantBindings;
    } catch {
      // Room SSE and media transport remain independent; a mapping refresh failure does not tear either down.
      return [];
    }
  }, [roomId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStudioMediaStatus(roomId, controller.signal).then((status) => {
      setBindings(status.participantBindings);
      if (!status.enabled) {
        setState("unavailable");
        setReason(status.reasonCode === "realtimekit_disabled" ? "RealtimeKit is not configured" : status.reasonCode);
      } else if (status.reconciliationRequired) {
        setState("reconciliation_required");
        setReason("Runtime and RealtimeKit media state require reconciliation");
      } else {
        setState("idle");
        setReason("Ready for device preflight");
      }
    }).catch(() => { setState("unavailable"); setReason("Media status unavailable"); });
    return () => controller.abort();
  }, [roomId]);

  const reportFailure = useCallback((code: string) => {
    void reportStudioMediaFailure(roomId, code).catch(() => undefined);
  }, [roomId]);

  const refreshExpiredConnection = useCallback(async (sourceMeeting?: ReadyStudioMeeting) => {
    const currentMeeting = sourceMeeting ?? meetingRef.current;
    if (refreshRunning.current || !currentMeeting || currentMeeting !== meetingRef.current) return;
    const generation = lifecycleGeneration.current + 1;
    lifecycleGeneration.current = generation;
    refreshRunning.current = true;
    joined.current = false;
    setState("reconnecting"); setReason("Refreshing media access");
    try {
      const token = await refreshStudioMediaSession(roomId);
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      await currentMeeting.leave("disconnected");
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      const next = await initializeMeeting(token, (error) => {
        const activeClient = meetingRef.current;
        if (error.code === "0004" && activeClient && activeClient !== currentMeeting && isCurrentLifecycle(generation, activeClient)) void refreshExpiredConnection(activeClient);
      });
      if (!next) throw new Error("Media client did not reinitialize");
      meetingRef.current = next;
      await next.join();
      if (!isCurrentLifecycle(generation, next)) { await next.leave().catch(() => undefined); return; }
      if (locationRef.current === "on_stage" && next.stage.status !== "ON_STAGE") await next.stage.join();
      if (!isCurrentLifecycle(generation, next)) return;
      syncedLocationRef.current = locationRef.current;
      joined.current = true; cleaned.current = false;
      setState("connected"); setReason("Connected");
    } catch (error) {
      const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); reportFailure(safe.code);
    } finally { refreshRunning.current = false; }
  }, [initializeMeeting, isCurrentLifecycle, reportFailure, roomId]);

  const openPreflight = useCallback(async () => {
    setPreflightOpen(true);
    if (!window.isSecureContext) { setState("unavailable"); setReason("Camera and microphone require a secure browser context"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setState("unavailable"); setReason("This browser does not support camera and microphone capture"); return; }
    if (initialized.current || meetingRef.current) { setState("preflight"); return; }
    const generation = lifecycleGeneration.current + 1;
    lifecycleGeneration.current = generation;
    initialized.current = true; cleaned.current = false; setState("provisioning"); setReason("Provisioning secure participant access");
    try {
      const session = await createStudioMediaSession(roomId);
      if (!isCurrentLifecycle(generation)) return;
      setBindings(session.participantBindings);
      const client = await initializeMeeting(session.authToken, (error: ClientError) => {
        const activeClient = meetingRef.current;
        if (error.code === "0004" && activeClient && isCurrentLifecycle(generation, activeClient)) void refreshExpiredConnection(activeClient);
      });
      if (!client) throw new Error("Media client did not initialize");
      if (!isCurrentLifecycle(generation)) { await client.leave().catch(() => undefined); return; }
      meetingRef.current = client;
      const found = await client.self.getAllDevices();
      if (!isCurrentLifecycle(generation, client)) return;
      const cameras = found.filter((device) => device.kind === "videoinput");
      const microphones = found.filter((device) => device.kind === "audioinput");
      const speakers = speakerSupported ? found.filter((device) => device.kind === "audiooutput") : [];
      setDevices({ cameras, microphones, speakers });
      setSelectedCameraId(client.self.getCurrentDevices().video?.deviceId || cameras[0]?.deviceId || "");
      setSelectedMicrophoneId(client.self.getCurrentDevices().audio?.deviceId || microphones[0]?.deviceId || "");
      setSelectedSpeakerId(client.self.getCurrentDevices().speaker?.deviceId || speakers[0]?.deviceId || "");
      if (cameras.length) await client.self.enableVideo(); else setCameraChoice(false);
      if (microphones.length) await client.self.enableAudio(); else setMicrophoneChoice(false);
      setState("preflight"); setReason(cameras.length || microphones.length ? "Review devices before joining" : "No camera or microphone was found; join without devices is available");
    } catch (error) {
      initialized.current = false;
      const safe = normalizedError(error); setState(safe.state); setReason(safe.reason);
    }
  }, [initializeMeeting, isCurrentLifecycle, refreshExpiredConnection, roomId, speakerSupported]);

  const selectDevice = useCallback(async (kind: "camera" | "microphone" | "speaker", deviceId: string) => {
    const currentMeeting = meetingRef.current;
    if (!currentMeeting) return;
    const source = kind === "camera" ? devices.cameras : kind === "microphone" ? devices.microphones : devices.speakers;
    const device = source.find((item) => item.deviceId === deviceId);
    if (!device) return;
    setPending(`device-${kind}`);
    try {
      await currentMeeting.self.setDevice(device);
      if (kind === "camera") setSelectedCameraId(deviceId);
      else if (kind === "microphone") setSelectedMicrophoneId(deviceId);
      else {
        const playback = audioPlayback(currentMeeting);
        if (!playback) { setAudioBlocked(true); setReason("Remote audio output is not ready"); return; }
        setSelectedSpeakerId(deviceId); playback.setSpeakerDevice(deviceId);
      }
    } catch (error) { const safe = normalizedError(error); setReason(safe.reason); }
    finally { setPending(""); }
  }, [devices]);

  const setPreflightChoice = useCallback(async (kind: "camera" | "microphone", enabled: boolean) => {
    const currentMeeting = meetingRef.current;
    if (!currentMeeting || pending) return;
    setPending(kind);
    try {
      if (kind === "camera") { enabled ? await currentMeeting.self.enableVideo() : await currentMeeting.self.disableVideo(); setCameraChoice(enabled); }
      else { enabled ? await currentMeeting.self.enableAudio() : await currentMeeting.self.disableAudio(); setMicrophoneChoice(enabled); }
    } catch (error) { const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); }
    finally { setPending(""); }
  }, [pending]);

  const joinPreflight = useCallback(async (withoutDevices = false) => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || joined.current || pending || !isCurrentLifecycle(generation, currentMeeting)) return;
    setPending("join"); setState("connecting"); setReason("Joining RealtimeKit meeting");
    try {
      if (withoutDevices || !cameraChoice) await currentMeeting.self.disableVideo();
      if (withoutDevices || !microphoneChoice) await currentMeeting.self.disableAudio();
      await currentMeeting.join();
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      if (locationRef.current === "on_stage" && currentMeeting.stage.status !== "ON_STAGE") await currentMeeting.stage.join();
      if (locationRef.current === "backstage" && currentMeeting.stage.status === "ON_STAGE") await currentMeeting.stage.leave();
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      syncedLocationRef.current = locationRef.current;
      joined.current = true;
      const intent = { microphoneMuted: !currentMeeting.self.audioEnabled, cameraHidden: !currentMeeting.self.videoEnabled, screenSharing: false };
      await updateOwnStudioMediaIntent(roomId, intent);
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      intentRef.current = intent;
      setPreflightOpen(false); setState("connected");
      setReason(withoutDevices || (!currentMeeting.self.audioEnabled && !currentMeeting.self.videoEnabled) ? "Connected with devices off" : "Connected");
    } catch (error) {
      const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); reportFailure(safe.code);
    } finally { setPending(""); }
  }, [cameraChoice, isCurrentLifecycle, microphoneChoice, pending, reportFailure, roomId]);

  const closePreflight = useCallback(async () => {
    setPreflightOpen(false);
    const currentMeeting = meetingRef.current;
    if (!currentMeeting || joined.current) return;
    lifecycleGeneration.current += 1;
    cleaned.current = true;
    try { await currentMeeting.self.disableAudio(); await currentMeeting.self.disableVideo(); await currentMeeting.leave(); }
    catch { /* The unjoined preview is still discarded below. */ }
    if (meetingRef.current === currentMeeting) meetingRef.current = undefined;
    initialized.current = false; joined.current = false; syncedLocationRef.current = null;
    setState("idle"); setReason("Ready for device preflight");
    void leaveStudioMediaSession(roomId).catch(() => undefined);
  }, [roomId]);

  const leave = useCallback(async () => {
    if (cleaned.current) return;
    cleaned.current = true;
    lifecycleGeneration.current += 1;
    const currentMeeting = meetingRef.current;
    meetingRef.current = undefined;
    try { if (currentMeeting) await currentMeeting.leave(); }
    finally {
      initialized.current = false; joined.current = false; setPreflightOpen(false); setState("disconnected"); setReason("Media disconnected");
      syncedLocationRef.current = null;
      void leaveStudioMediaSession(roomId).catch(() => undefined);
    }
  }, [roomId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lifecycleGeneration.current += 1;
      if (cleaned.current) return;
      cleaned.current = true;
      const currentMeeting = meetingRef.current;
      meetingRef.current = undefined;
      if (currentMeeting) void currentMeeting.leave().catch(() => undefined);
      void leaveStudioMediaSession(roomId).catch(() => undefined);
    };
  }, [roomId]);

  useEffect(() => {
    const currentMeeting = meetingRef.current ?? meeting;
    if (!currentMeeting) return;
    const generation = lifecycleGeneration.current;
    const update = () => setRevision((value) => value + 1);
    const socket = (status: SocketConnectionState) => {
      if (!joined.current || !isCurrentLifecycle(generation, currentMeeting)) return;
      if (status.state === "reconnecting" || status.state === "disconnected") { setState("reconnecting"); setReason("Media reconnecting"); }
      else if (status.state === "connected") { setState("connected"); setReason("Connected"); }
      else if (status.state === "failed") { setState("provider_error"); setReason("Media connection failed"); reportFailure("provider_reconnect_failed"); }
    };
    const active = ({ peerId, volume }: { peerId: string; volume: number }) => {
      if (volume <= 0) return;
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      const participant = currentMeeting.participants.joined.get(peerId);
      const runtimeId = participant?.customParticipantId ? bindingsMap(bindings).get(participant.customParticipantId) : undefined;
      setActiveRuntimeParticipantId(runtimeId ?? (peerId === currentMeeting.self.id ? "self" : null));
    };
    const autoplay = () => setAudioBlocked(true);
    currentMeeting.self.on("videoUpdate", update); currentMeeting.self.on("audioUpdate", update); currentMeeting.self.on("screenShareUpdate", update);
    currentMeeting.self.on("autoplayError", autoplay); currentMeeting.meta.on("socketConnectionUpdate", socket);
    currentMeeting.participants.joined.on("participantJoined", update); currentMeeting.participants.joined.on("participantLeft", update);
    currentMeeting.participants.joined.on("videoUpdate", update); currentMeeting.participants.joined.on("audioUpdate", update); currentMeeting.participants.joined.on("screenShareUpdate", update);
    currentMeeting.participants.on("activeSpeaker", active);
    return () => {
      currentMeeting.self.removeListener("videoUpdate", update); currentMeeting.self.removeListener("audioUpdate", update); currentMeeting.self.removeListener("screenShareUpdate", update);
      currentMeeting.self.removeListener("autoplayError", autoplay); currentMeeting.meta.removeListener("socketConnectionUpdate", socket);
      currentMeeting.participants.joined.removeListener("participantJoined", update); currentMeeting.participants.joined.removeListener("participantLeft", update);
      currentMeeting.participants.joined.removeListener("videoUpdate", update); currentMeeting.participants.joined.removeListener("audioUpdate", update); currentMeeting.participants.joined.removeListener("screenShareUpdate", update);
      currentMeeting.participants.removeListener("activeSpeaker", active);
    };
  }, [bindings, isCurrentLifecycle, meeting, reportFailure, state]);

  useEffect(() => {
    void mediaRevision;
    const currentMeeting = meetingRef.current ?? meeting;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || !joined.current || !currentMeeting.self.roomJoined || !isCurrentLifecycle(generation, currentMeeting)) return;
    const playback = audioPlayback(currentMeeting);
    const current = new Set<string>();
    currentMeeting.participants.joined.forEach((participant) => {
      if (participant.audioEnabled && participant.audioTrack) {
        current.add(participant.id);
        playback?.addParticipantTrack(participant.id, participant.audioTrack);
      }
    });
    if (current.size && !playback) {
      setAudioBlocked(true);
      setReason("Remote audio playback is not ready");
      return;
    }
    if (current.size && playback) {
      void playback.play().then(() => {
        if (isCurrentLifecycle(generation, currentMeeting)) setAudioBlocked(false);
      }).catch(() => {
        if (isCurrentLifecycle(generation, currentMeeting)) setAudioBlocked(true);
      });
    }
    return () => current.forEach((id) => playback?.removeParticipantTrack(id));
  }, [isCurrentLifecycle, meeting, mediaRevision, state]);

  const commitToggle = useCallback(async (kind: "audio" | "video") => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || pending || state !== "connected" || !joined.current || !isCurrentLifecycle(generation, currentMeeting)) return;
    setPending(kind);
    const wasEnabled = kind === "audio" ? currentMeeting.self.audioEnabled : currentMeeting.self.videoEnabled;
    try {
      if (kind === "audio") wasEnabled ? await currentMeeting.self.disableAudio() : await currentMeeting.self.enableAudio();
      else wasEnabled ? await currentMeeting.self.disableVideo() : await currentMeeting.self.enableVideo();
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      const intent = kind === "audio" ? { microphoneMuted: wasEnabled } : { cameraHidden: wasEnabled };
      await updateOwnStudioMediaIntent(roomId, intent);
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      intentRef.current = { ...intentRef.current, ...intent };
      setRevision((value) => value + 1);
    } catch (error) {
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      try {
        if (kind === "audio") wasEnabled ? await currentMeeting.self.enableAudio() : await currentMeeting.self.disableAudio();
        else wasEnabled ? await currentMeeting.self.enableVideo() : await currentMeeting.self.disableVideo();
      } catch { reportFailure("media_intent_rollback_failed"); }
      const safe = normalizedError(error); setReason(safe.reason);
    } finally { setPending(""); }
  }, [isCurrentLifecycle, pending, reportFailure, roomId, state]);

  const runtimeByCustomId = useMemo(() => bindingsMap(bindings), [bindings]);
  const activeMeeting = meetingRef.current;
  const remoteParticipants = useMemo(() => {
    void mediaRevision;
    const mapped = new Map<string, RTKParticipant>();
    activeMeeting?.participants.joined.forEach((participant) => {
      const runtimeId = participant.customParticipantId ? runtimeByCustomId.get(participant.customParticipantId) : undefined;
      if (runtimeId) mapped.set(runtimeId, participant);
    });
    return mapped;
  }, [activeMeeting, mediaRevision, runtimeByCustomId]);

  const activeShares = useMemo(() => {
    void mediaRevision;
    const shares: Array<{ runtimeParticipantId: string; track: MediaStreamTrack; local: boolean }> = [];
    if (activeMeeting?.self.screenShareEnabled && activeMeeting.self.screenShareTracks.video) shares.push({ runtimeParticipantId: "self", track: activeMeeting.self.screenShareTracks.video, local: true });
    remoteParticipants.forEach((participant, runtimeParticipantId) => {
      if (participant.screenShareEnabled && participant.screenShareTracks.video) shares.push({ runtimeParticipantId, track: participant.screenShareTracks.video, local: false });
    });
    return shares;
  }, [activeMeeting, mediaRevision, remoteParticipants]);

  const toggleScreen = useCallback(async () => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || pending || state !== "connected" || !options.canScreenShare || !joined.current || !isCurrentLifecycle(generation, currentMeeting)) return;
    if (!currentMeeting.self.screenShareEnabled && activeShares.some((share) => !share.local)) { setReason("Another participant is already sharing a screen"); return; }
    const wasEnabled = currentMeeting.self.screenShareEnabled; setPending("screen");
    try {
      wasEnabled ? await currentMeeting.self.disableScreenShare() : await currentMeeting.self.enableScreenShare();
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      await updateOwnStudioMediaIntent(roomId, { screenSharing: !wasEnabled });
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      intentRef.current.screenSharing = !wasEnabled; setRevision((value) => value + 1);
    } catch (error) {
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      if (!wasEnabled && currentMeeting.self.screenShareEnabled) await currentMeeting.self.disableScreenShare().catch(() => undefined);
      const safe = normalizedError(error); setReason(safe.reason); reportFailure(safe.code);
    } finally { setPending(""); }
  }, [activeShares, isCurrentLifecycle, options.canScreenShare, pending, reportFailure, roomId, state]);

  useEffect(() => {
    const currentMeeting = meetingRef.current ?? meeting;
    if (!currentMeeting) return;
    const generation = lifecycleGeneration.current;
    const ended = ({ screenShareEnabled }: { screenShareEnabled: boolean }) => {
      if (!isCurrentLifecycle(generation, currentMeeting)) return;
      if (!screenShareEnabled && intentRef.current.screenSharing) {
        intentRef.current.screenSharing = false;
        void updateOwnStudioMediaIntent(roomId, { screenSharing: false }).catch(() => reportFailure("screen_share_intent_failed"));
      }
    };
    currentMeeting.self.on("screenShareUpdate", ended);
    return () => { currentMeeting.self.removeListener("screenShareUpdate", ended); };
  }, [isCurrentLifecycle, meeting, reportFailure, roomId]);

  const syncSelfLocation = useCallback(async (location: "on_stage" | "backstage") => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || state !== "connected" || !isCurrentLifecycle(generation, currentMeeting)) return true;
    if (syncedLocationRef.current === location) return true;
    try {
      if (location === "on_stage" && currentMeeting.stage.status !== "ON_STAGE") await currentMeeting.stage.join();
      if (location === "backstage" && currentMeeting.stage.status === "ON_STAGE") await currentMeeting.stage.leave();
      if (!isCurrentLifecycle(generation, currentMeeting)) return true;
      locationRef.current = location; syncedLocationRef.current = location; return true;
    } catch { setState("reconciliation_required"); setReason("Stage state requires reconciliation"); reportFailure("provider_stage_sync_failed"); return false; }
  }, [isCurrentLifecycle, reportFailure, state]);

  const syncParticipantLocation = useCallback(async (runtimeParticipantId: string, location: "on_stage" | "backstage") => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || state !== "connected" || !isCurrentLifecycle(generation, currentMeeting)) return true;
    let participant = remoteParticipants.get(`guest:${runtimeParticipantId}`) ?? remoteParticipants.get(runtimeParticipantId);
    if (!participant) {
      const nextBindings = await refreshMappings();
      const wanted = nextBindings.find((binding) => binding.runtimeParticipantId === `guest:${runtimeParticipantId}` || binding.runtimeParticipantId === runtimeParticipantId);
      participant = wanted ? Array.from(currentMeeting.participants.joined.values()).find((item) => item.customParticipantId === wanted.customParticipantId) : undefined;
      if (!participant) return true;
    }
    try {
      if (location === "on_stage") await currentMeeting.stage.grantAccess([participant.userId]);
      else await currentMeeting.stage.kick([participant.userId]);
      if (!isCurrentLifecycle(generation, currentMeeting)) return true;
      return true;
    } catch { setState("reconciliation_required"); setReason("Stage state requires reconciliation"); reportFailure("provider_stage_sync_failed"); return false; }
  }, [isCurrentLifecycle, refreshMappings, remoteParticipants, reportFailure, state]);

  useEffect(() => {
    if (state === "connected") void syncSelfLocation(locationRef.current);
  }, [options.location, state, syncSelfLocation]);

  const forceDisableParticipant = useCallback(async (runtimeParticipantId: string, kind: "audio" | "video") => {
    const participant = remoteParticipants.get(`guest:${runtimeParticipantId}`) ?? remoteParticipants.get(runtimeParticipantId);
    if (!participant) return false;
    try { kind === "audio" ? await participant.disableAudio() : await participant.disableVideo(); return true; }
    catch { setState("reconciliation_required"); setReason("Participant media state requires reconciliation"); reportFailure(`provider_force_disable_${kind}_failed`); return false; }
  }, [remoteParticipants, reportFailure]);

  const enableAudio = useCallback(async () => {
    const currentMeeting = meetingRef.current;
    const generation = lifecycleGeneration.current;
    if (!currentMeeting || !joined.current || !currentMeeting.self.roomJoined || !isCurrentLifecycle(generation, currentMeeting)) {
      setAudioBlocked(true);
      setReason("Join the media session before enabling audio");
      return;
    }
    const playback = audioPlayback(currentMeeting);
    if (!playback) {
      setAudioBlocked(true);
      setReason("Remote audio playback is not ready");
      return;
    }
    try {
      await playback.play();
      if (isCurrentLifecycle(generation, currentMeeting)) setAudioBlocked(false);
    } catch {
      if (isCurrentLifecycle(generation, currentMeeting)) {
        setAudioBlocked(true);
        setReason("Browser autoplay is blocked; select Enable audio to retry");
      }
    }
  }, [isCurrentLifecycle]);

  return {
    meeting: activeMeeting, state, reason, pending, preflightOpen, devices, speakerSupported, selectedCameraId, selectedMicrophoneId, selectedSpeakerId,
    cameraChoice, microphoneChoice, audioBlocked, remoteParticipants, activeRuntimeParticipantId, activeShares,
    openPreflight, closePreflight, joinPreflight, selectDevice, setPreflightChoice, leave, refreshMappings, refreshExpiredConnection,
    toggleAudio: () => commitToggle("audio"), toggleVideo: () => commitToggle("video"), toggleScreen, enableAudio,
    syncSelfLocation, syncParticipantLocation, forceDisableParticipant,
    audioEnabled: activeMeeting?.self.audioEnabled === true, videoEnabled: activeMeeting?.self.videoEnabled === true,
    screenEnabled: activeMeeting?.self.screenShareEnabled === true,
  };
}
