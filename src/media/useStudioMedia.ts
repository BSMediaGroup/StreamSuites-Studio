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
  const meetingRef = useRef(meeting);
  const joined = useRef(false);
  const cleaned = useRef(false);
  const refreshRunning = useRef(false);
  const locationRef = useRef(options.location ?? "backstage");
  const syncedLocationRef = useRef<"on_stage" | "backstage" | null>(null);
  const intentRef = useRef({ microphoneMuted: true, cameraHidden: true, screenSharing: false });
  const speakerSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  locationRef.current = options.location ?? "backstage";
  meetingRef.current = meeting;

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

  const refreshExpiredConnection = useCallback(async () => {
    const currentMeeting = meetingRef.current;
    if (refreshRunning.current || !currentMeeting) return;
    refreshRunning.current = true;
    setState("reconnecting"); setReason("Refreshing media access");
    try {
      const token = await refreshStudioMediaSession(roomId);
      await currentMeeting.leave("disconnected");
      const next = await initMeeting({ authToken: token, defaults: { audio: false, video: false }, onError: () => undefined });
      if (!next) throw new Error("Media client did not reinitialize");
      meetingRef.current = next;
      await next.join();
      if (locationRef.current === "on_stage" && next.stage.status !== "ON_STAGE") await next.stage.join();
      syncedLocationRef.current = locationRef.current;
      joined.current = true; cleaned.current = false;
      setState("connected"); setReason("Connected");
    } catch (error) {
      const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); reportFailure(safe.code);
    } finally { refreshRunning.current = false; }
  }, [initMeeting, reportFailure, roomId]);

  const openPreflight = useCallback(async () => {
    setPreflightOpen(true);
    if (!window.isSecureContext) { setState("unavailable"); setReason("Camera and microphone require a secure browser context"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setState("unavailable"); setReason("This browser does not support camera and microphone capture"); return; }
    if (initialized.current || meeting) { setState("preflight"); return; }
    initialized.current = true; cleaned.current = false; setState("provisioning"); setReason("Provisioning secure participant access");
    try {
      const session = await createStudioMediaSession(roomId);
      setBindings(session.participantBindings);
      const client = await initMeeting({
        authToken: session.authToken,
        defaults: { audio: false, video: false },
        onError: (error: ClientError) => { if (error.code === "0004") void refreshExpiredConnection(); },
      });
      if (!client) throw new Error("Media client did not initialize");
      meetingRef.current = client;
      const found = await client.self.getAllDevices();
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
  }, [initMeeting, meeting, refreshExpiredConnection, roomId, speakerSupported]);

  const selectDevice = useCallback(async (kind: "camera" | "microphone" | "speaker", deviceId: string) => {
    if (!meeting) return;
    const source = kind === "camera" ? devices.cameras : kind === "microphone" ? devices.microphones : devices.speakers;
    const device = source.find((item) => item.deviceId === deviceId);
    if (!device) return;
    setPending(`device-${kind}`);
    try {
      await meeting.self.setDevice(device);
      if (kind === "camera") setSelectedCameraId(deviceId);
      else if (kind === "microphone") setSelectedMicrophoneId(deviceId);
      else { setSelectedSpeakerId(deviceId); meeting.audio.setSpeakerDevice(deviceId); }
    } catch (error) { const safe = normalizedError(error); setReason(safe.reason); }
    finally { setPending(""); }
  }, [devices, meeting]);

  const setPreflightChoice = useCallback(async (kind: "camera" | "microphone", enabled: boolean) => {
    if (!meeting || pending) return;
    setPending(kind);
    try {
      if (kind === "camera") { enabled ? await meeting.self.enableVideo() : await meeting.self.disableVideo(); setCameraChoice(enabled); }
      else { enabled ? await meeting.self.enableAudio() : await meeting.self.disableAudio(); setMicrophoneChoice(enabled); }
    } catch (error) { const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); }
    finally { setPending(""); }
  }, [meeting, pending]);

  const joinPreflight = useCallback(async (withoutDevices = false) => {
    if (!meeting || joined.current || pending) return;
    setPending("join"); setState("connecting"); setReason("Joining RealtimeKit meeting");
    try {
      if (withoutDevices || !cameraChoice) await meeting.self.disableVideo();
      if (withoutDevices || !microphoneChoice) await meeting.self.disableAudio();
      await meeting.join();
      if (locationRef.current === "on_stage" && meeting.stage.status !== "ON_STAGE") await meeting.stage.join();
      if (locationRef.current === "backstage" && meeting.stage.status === "ON_STAGE") await meeting.stage.leave();
      syncedLocationRef.current = locationRef.current;
      joined.current = true;
      const intent = { microphoneMuted: !meeting.self.audioEnabled, cameraHidden: !meeting.self.videoEnabled, screenSharing: false };
      await updateOwnStudioMediaIntent(roomId, intent);
      intentRef.current = intent;
      setPreflightOpen(false); setState("connected");
      setReason(withoutDevices || (!meeting.self.audioEnabled && !meeting.self.videoEnabled) ? "Connected with devices off" : "Connected");
    } catch (error) {
      const safe = normalizedError(error); setState(safe.state); setReason(safe.reason); reportFailure(safe.code);
    } finally { setPending(""); }
  }, [cameraChoice, meeting, microphoneChoice, pending, reportFailure, roomId]);

  const closePreflight = useCallback(async () => {
    setPreflightOpen(false);
    if (!meeting || joined.current) return;
    cleaned.current = true;
    try { await meeting.self.disableAudio(); await meeting.self.disableVideo(); await meeting.leave(); }
    catch { /* The unjoined preview is still discarded below. */ }
    initialized.current = false; setState("idle"); setReason("Ready for device preflight");
    void leaveStudioMediaSession(roomId).catch(() => undefined);
  }, [meeting, roomId]);

  const leave = useCallback(async () => {
    if (cleaned.current) return;
    cleaned.current = true;
    try { if (meeting) await meeting.leave(); }
    finally {
      initialized.current = false; joined.current = false; setPreflightOpen(false); setState("disconnected"); setReason("Media disconnected");
      syncedLocationRef.current = null;
      void leaveStudioMediaSession(roomId).catch(() => undefined);
    }
  }, [meeting, roomId]);

  useEffect(() => () => {
    if (!cleaned.current && meeting) { cleaned.current = true; void meeting.leave(); void leaveStudioMediaSession(roomId).catch(() => undefined); }
  }, [meeting, roomId]);

  useEffect(() => {
    if (!meeting) return;
    const update = () => setRevision((value) => value + 1);
    const socket = (status: SocketConnectionState) => {
      if (!joined.current) return;
      if (status.state === "reconnecting" || status.state === "disconnected") { setState("reconnecting"); setReason("Media reconnecting"); }
      else if (status.state === "connected") { setState("connected"); setReason("Connected"); }
      else if (status.state === "failed") { setState("provider_error"); setReason("Media connection failed"); reportFailure("provider_reconnect_failed"); }
    };
    const active = ({ peerId, volume }: { peerId: string; volume: number }) => {
      if (volume <= 0) return;
      const participant = meeting.participants.joined.get(peerId);
      const runtimeId = participant?.customParticipantId ? bindingsMap(bindings).get(participant.customParticipantId) : undefined;
      setActiveRuntimeParticipantId(runtimeId ?? (peerId === meeting.self.id ? "self" : null));
    };
    const autoplay = () => setAudioBlocked(true);
    meeting.self.on("videoUpdate", update); meeting.self.on("audioUpdate", update); meeting.self.on("screenShareUpdate", update);
    meeting.self.on("autoplayError", autoplay); meeting.meta.on("socketConnectionUpdate", socket);
    meeting.participants.joined.on("participantJoined", update); meeting.participants.joined.on("participantLeft", update);
    meeting.participants.joined.on("videoUpdate", update); meeting.participants.joined.on("audioUpdate", update); meeting.participants.joined.on("screenShareUpdate", update);
    meeting.participants.on("activeSpeaker", active);
    return () => {
      meeting.self.removeListener("videoUpdate", update); meeting.self.removeListener("audioUpdate", update); meeting.self.removeListener("screenShareUpdate", update);
      meeting.self.removeListener("autoplayError", autoplay); meeting.meta.removeListener("socketConnectionUpdate", socket);
      meeting.participants.joined.removeListener("participantJoined", update); meeting.participants.joined.removeListener("participantLeft", update);
      meeting.participants.joined.removeListener("videoUpdate", update); meeting.participants.joined.removeListener("audioUpdate", update); meeting.participants.joined.removeListener("screenShareUpdate", update);
      meeting.participants.removeListener("activeSpeaker", active);
    };
  }, [bindings, meeting, reportFailure]);

  useEffect(() => {
    void mediaRevision;
    if (!meeting || !joined.current) return;
    const current = new Set<string>();
    meeting.participants.joined.forEach((participant) => {
      if (participant.audioEnabled && participant.audioTrack) {
        current.add(participant.id); meeting.audio.addParticipantTrack(participant.id, participant.audioTrack);
      }
    });
    void meeting.audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    return () => current.forEach((id) => meeting.audio.removeParticipantTrack(id));
  }, [meeting, mediaRevision]);

  const commitToggle = useCallback(async (kind: "audio" | "video") => {
    if (!meeting || pending || state !== "connected") return;
    setPending(kind);
    const wasEnabled = kind === "audio" ? meeting.self.audioEnabled : meeting.self.videoEnabled;
    try {
      if (kind === "audio") wasEnabled ? await meeting.self.disableAudio() : await meeting.self.enableAudio();
      else wasEnabled ? await meeting.self.disableVideo() : await meeting.self.enableVideo();
      const intent = kind === "audio" ? { microphoneMuted: wasEnabled } : { cameraHidden: wasEnabled };
      await updateOwnStudioMediaIntent(roomId, intent);
      intentRef.current = { ...intentRef.current, ...intent };
      setRevision((value) => value + 1);
    } catch (error) {
      try {
        if (kind === "audio") wasEnabled ? await meeting.self.enableAudio() : await meeting.self.disableAudio();
        else wasEnabled ? await meeting.self.enableVideo() : await meeting.self.disableVideo();
      } catch { reportFailure("media_intent_rollback_failed"); }
      const safe = normalizedError(error); setReason(safe.reason);
    } finally { setPending(""); }
  }, [meeting, pending, reportFailure, roomId, state]);

  const runtimeByCustomId = useMemo(() => bindingsMap(bindings), [bindings]);
  const remoteParticipants = useMemo(() => {
    void mediaRevision;
    const mapped = new Map<string, RTKParticipant>();
    meeting?.participants.joined.forEach((participant) => {
      const runtimeId = participant.customParticipantId ? runtimeByCustomId.get(participant.customParticipantId) : undefined;
      if (runtimeId) mapped.set(runtimeId, participant);
    });
    return mapped;
  }, [mediaRevision, meeting, runtimeByCustomId]);

  const activeShares = useMemo(() => {
    void mediaRevision;
    const shares: Array<{ runtimeParticipantId: string; track: MediaStreamTrack; local: boolean }> = [];
    if (meeting?.self.screenShareEnabled && meeting.self.screenShareTracks.video) shares.push({ runtimeParticipantId: "self", track: meeting.self.screenShareTracks.video, local: true });
    remoteParticipants.forEach((participant, runtimeParticipantId) => {
      if (participant.screenShareEnabled && participant.screenShareTracks.video) shares.push({ runtimeParticipantId, track: participant.screenShareTracks.video, local: false });
    });
    return shares;
  }, [mediaRevision, meeting, remoteParticipants]);

  const toggleScreen = useCallback(async () => {
    if (!meeting || pending || state !== "connected" || !options.canScreenShare) return;
    if (!meeting.self.screenShareEnabled && activeShares.some((share) => !share.local)) { setReason("Another participant is already sharing a screen"); return; }
    const wasEnabled = meeting.self.screenShareEnabled; setPending("screen");
    try {
      wasEnabled ? await meeting.self.disableScreenShare() : await meeting.self.enableScreenShare();
      await updateOwnStudioMediaIntent(roomId, { screenSharing: !wasEnabled });
      intentRef.current.screenSharing = !wasEnabled; setRevision((value) => value + 1);
    } catch (error) {
      if (!wasEnabled && meeting.self.screenShareEnabled) await meeting.self.disableScreenShare().catch(() => undefined);
      const safe = normalizedError(error); setReason(safe.reason); reportFailure(safe.code);
    } finally { setPending(""); }
  }, [activeShares, meeting, options.canScreenShare, pending, reportFailure, roomId, state]);

  useEffect(() => {
    if (!meeting) return;
    const ended = ({ screenShareEnabled }: { screenShareEnabled: boolean }) => {
      if (!screenShareEnabled && intentRef.current.screenSharing) {
        intentRef.current.screenSharing = false;
        void updateOwnStudioMediaIntent(roomId, { screenSharing: false }).catch(() => reportFailure("screen_share_intent_failed"));
      }
    };
    meeting.self.on("screenShareUpdate", ended);
    return () => { meeting.self.removeListener("screenShareUpdate", ended); };
  }, [meeting, reportFailure, roomId]);

  const syncSelfLocation = useCallback(async (location: "on_stage" | "backstage") => {
    if (!meeting || state !== "connected") return true;
    if (syncedLocationRef.current === location) return true;
    try {
      if (location === "on_stage" && meeting.stage.status !== "ON_STAGE") await meeting.stage.join();
      if (location === "backstage" && meeting.stage.status === "ON_STAGE") await meeting.stage.leave();
      locationRef.current = location; syncedLocationRef.current = location; return true;
    } catch { setState("reconciliation_required"); setReason("Stage state requires reconciliation"); reportFailure("provider_stage_sync_failed"); return false; }
  }, [meeting, reportFailure, state]);

  const syncParticipantLocation = useCallback(async (runtimeParticipantId: string, location: "on_stage" | "backstage") => {
    if (!meeting || state !== "connected") return true;
    let participant = remoteParticipants.get(`guest:${runtimeParticipantId}`) ?? remoteParticipants.get(runtimeParticipantId);
    if (!participant) {
      const nextBindings = await refreshMappings();
      const wanted = nextBindings.find((binding) => binding.runtimeParticipantId === `guest:${runtimeParticipantId}` || binding.runtimeParticipantId === runtimeParticipantId);
      participant = wanted ? Array.from(meeting.participants.joined.values()).find((item) => item.customParticipantId === wanted.customParticipantId) : undefined;
      if (!participant) return true;
    }
    try {
      if (location === "on_stage") await meeting.stage.grantAccess([participant.userId]);
      else await meeting.stage.kick([participant.userId]);
      return true;
    } catch { setState("reconciliation_required"); setReason("Stage state requires reconciliation"); reportFailure("provider_stage_sync_failed"); return false; }
  }, [meeting, refreshMappings, remoteParticipants, reportFailure, state]);

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
    if (!meeting) return;
    try { await meeting.audio.play(); setAudioBlocked(false); }
    catch { setAudioBlocked(true); }
  }, [meeting]);

  return {
    meeting, state, reason, pending, preflightOpen, devices, speakerSupported, selectedCameraId, selectedMicrophoneId, selectedSpeakerId,
    cameraChoice, microphoneChoice, audioBlocked, remoteParticipants, activeRuntimeParticipantId, activeShares,
    openPreflight, closePreflight, joinPreflight, selectDevice, setPreflightChoice, leave, refreshMappings, refreshExpiredConnection,
    toggleAudio: () => commitToggle("audio"), toggleVideo: () => commitToggle("video"), toggleScreen, enableAudio,
    syncSelfLocation, syncParticipantLocation, forceDisableParticipant,
    audioEnabled: meeting?.self.audioEnabled === true, videoEnabled: meeting?.self.videoEnabled === true,
    screenEnabled: meeting?.self.screenShareEnabled === true,
  };
}
