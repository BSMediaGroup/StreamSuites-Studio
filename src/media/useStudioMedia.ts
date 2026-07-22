import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStudioRealtimeSession,
  heartbeatStudioRealtimeSession,
  leaveStudioRealtimeSession,
  listStudioRealtimeTracks,
  loadStudioRealtimeStatus,
  publishStudioRealtimeTracks,
  renegotiateStudioRealtimeSession,
  subscribeStudioRealtimeTracks,
  updateOwnStudioMediaIntent,
  type StudioRealtimeSession,
  type StudioRealtimeTrack,
} from "../api/studioAuth";

export type StudioMediaConnection = "idle" | "preflight" | "provisioning" | "connecting" | "connected" | "reconnecting" | "disconnected" | "permission_error" | "provider_error" | "unavailable" | "reconciliation_required";
export interface StudioMediaDevices { cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[]; speakers: MediaDeviceInfo[]; }
export interface StudioMediaOptions { location?: "on_stage" | "backstage"; canScreenShare?: boolean; }
export interface StudioRemoteParticipant {
  readonly id: string;
  readonly videoEnabled: boolean;
  readonly audioEnabled: boolean;
  readonly videoTrack: MediaStreamTrack | null;
  readonly audioTrack: MediaStreamTrack | null;
  readonly screenShareEnabled: boolean;
  readonly screenShareTracks: { readonly video: MediaStreamTrack | null };
  readonly registerVideoElement?: (element: HTMLVideoElement) => void;
  readonly deregisterVideoElement?: (element: HTMLVideoElement) => void;
}

function safeError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (["NotAllowedError", "SecurityError"].includes(name)) return { state: "permission_error" as const, reason: "Camera or microphone permission was denied" };
  if (["NotFoundError", "DevicesNotFoundError"].includes(name)) return { state: "permission_error" as const, reason: "No requested camera or microphone is available" };
  return { state: "provider_error" as const, reason: error instanceof Error ? error.message : "Cloudflare Realtime media could not connect" };
}

export function useStudioMedia(roomId: string, options: StudioMediaOptions = {}) {
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
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [selfRuntimeParticipantId, setSelfRuntimeParticipantId] = useState<string | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState(new Map<string, StudioRemoteParticipant>());
  const [revision, setRevision] = useState(0);
  const localStream = useRef<MediaStream | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const session = useRef<StudioRealtimeSession | null>(null);
  const midCatalog = useRef(new Map<string, StudioRealtimeTrack>());
  const subscribed = useRef(new Set<string>());
  const remoteTracks = useRef(new Map<string, Map<string, MediaStreamTrack>>());
  const remoteAudio = useRef(new Map<string, HTMLAudioElement>());
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const operation = useRef(Promise.resolve());
  const speakerSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  const updateRemote = useCallback(() => {
    const next = new Map<string, StudioRemoteParticipant>();
    remoteTracks.current.forEach((tracks, participantId) => {
      const camera = tracks.get("camera") ?? null, microphone = tracks.get("microphone") ?? null, screen = tracks.get("screen") ?? null;
      next.set(participantId, { id: participantId, videoEnabled: camera?.readyState === "live", audioEnabled: microphone?.readyState === "live", videoTrack: camera, audioTrack: microphone, screenShareEnabled: screen?.readyState === "live", screenShareTracks: { video: screen } });
    });
    setRemoteParticipants(next); setRevision((value) => value + 1);
  }, []);

  const applyDescription = useCallback(async (description: RTCSessionDescriptionInit | null, mapping: readonly StudioRealtimeTrack[] = []) => {
    const current = peer.current, currentSession = session.current;
    if (!current || !currentSession || !description) return;
    mapping.forEach((track) => { if (track.mid) midCatalog.current.set(track.mid, track); });
    await current.setRemoteDescription(description);
    if (description.type === "offer") {
      const answer = await current.createAnswer();
      await current.setLocalDescription(answer);
      const result = await renegotiateStudioRealtimeSession(roomId, currentSession.sessionId, current.localDescription ?? answer);
      if (result.sessionDescription?.type === "offer") await applyDescription(result.sessionDescription);
    }
  }, [roomId]);

  const refreshMappings = useCallback(async () => {
    const current = peer.current, currentSession = session.current;
    if (!current || !currentSession || current.signalingState !== "stable") return [];
    const catalog = await listStudioRealtimeTracks(roomId);
    const wanted = catalog.filter((track) => !subscribed.current.has(track.id));
    if (!wanted.length) return catalog;
    const result = await subscribeStudioRealtimeTracks(roomId, currentSession.sessionId, wanted.map((track) => track.id));
    result.tracks.forEach((track) => subscribed.current.add(track.id));
    await applyDescription(result.sessionDescription, result.tracks);
    return catalog;
  }, [applyDescription, roomId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStudioRealtimeStatus(roomId, controller.signal).then((status) => {
      if (!status.enabled || !status.configured) { setState("unavailable"); setReason("Cloudflare Realtime SFU is not configured"); }
      else { setState("idle"); setReason("Ready for device preflight"); }
    }).catch(() => { setState("unavailable"); setReason("Media status unavailable"); });
    return () => controller.abort();
  }, [roomId]);

  const chooseStream = useCallback(async () => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: cameraChoice ? (selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true) : false,
      audio: microphoneChoice ? (selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true) : false,
    });
    localStream.current = stream;
    setVideoEnabled(Boolean(stream.getVideoTracks()[0]?.enabled)); setAudioEnabled(Boolean(stream.getAudioTracks()[0]?.enabled));
    setRevision((value) => value + 1);
    return stream;
  }, [cameraChoice, microphoneChoice, selectedCameraId, selectedMicrophoneId]);

  const openPreflight = useCallback(async () => {
    setPreflightOpen(true); setState("provisioning"); setReason("Preparing local devices");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setState("unavailable"); setReason("Camera and microphone require a supported secure browser context"); return; }
    try {
      const found = await navigator.mediaDevices.enumerateDevices();
      const cameras = found.filter((item) => item.kind === "videoinput"), microphones = found.filter((item) => item.kind === "audioinput"), speakers = found.filter((item) => item.kind === "audiooutput");
      setDevices({ cameras, microphones, speakers }); setSelectedCameraId((value) => value || cameras[0]?.deviceId || ""); setSelectedMicrophoneId((value) => value || microphones[0]?.deviceId || ""); setSelectedSpeakerId((value) => value || speakers[0]?.deviceId || "");
      await chooseStream(); setState("preflight"); setReason("Review devices before joining");
    } catch (error) { const safe = safeError(error); setState(safe.state); setReason(safe.reason); }
  }, [chooseStream]);

  const selectDevice = useCallback(async (kind: "camera" | "microphone" | "speaker", id: string) => {
    if (kind === "camera") setSelectedCameraId(id); else if (kind === "microphone") setSelectedMicrophoneId(id); else setSelectedSpeakerId(id);
  }, []);

  const setPreflightChoice = useCallback(async (kind: "camera" | "microphone", enabled: boolean) => {
    if (kind === "camera") { setCameraChoice(enabled); localStream.current?.getVideoTracks().forEach((track) => { track.enabled = enabled; }); setVideoEnabled(enabled); }
    else { setMicrophoneChoice(enabled); localStream.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; }); setAudioEnabled(enabled); }
  }, []);

  const joinPreflight = useCallback(async (withoutDevices = false) => {
    if (pending) return;
    setPending("join"); setState("connecting"); setReason("Connecting to Cloudflare Realtime SFU");
    try {
      const established = await createStudioRealtimeSession(roomId); session.current = established; setSelfRuntimeParticipantId(established.participantId);
      const current = new RTCPeerConnection({ iceServers: [{ urls: established.stunUrls.length ? [...established.stunUrls] : ["stun:stun.cloudflare.com:3478"] }], bundlePolicy: "max-bundle" }); peer.current = current;
      current.onconnectionstatechange = () => { if (current.connectionState === "failed") { setState("reconnecting"); setReason("Media connection requires reconnection"); } };
      current.ontrack = (event) => {
        const metadata = midCatalog.current.get(event.transceiver.mid ?? ""); if (!metadata) return;
        const tracks = remoteTracks.current.get(metadata.participantId) ?? new Map<string, MediaStreamTrack>(); tracks.set(metadata.sourceRole, event.track); remoteTracks.current.set(metadata.participantId, tracks);
        if (metadata.sourceRole === "microphone") {
          const audio = remoteAudio.current.get(metadata.id) ?? new Audio();
          audio.autoplay = true; audio.srcObject = new MediaStream([event.track]); remoteAudio.current.set(metadata.id, audio);
          void audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
        event.track.onended = updateRemote; updateRemote();
      };
      const stream = withoutDevices ? null : (localStream.current ?? await chooseStream());
      const publications: Array<{ kind: "audio" | "video"; source_role: "microphone" | "camera"; mid: string }> = [];
      stream?.getTracks().forEach((track) => current.addTrack(track, stream));
      const offer = await current.createOffer(); await current.setLocalDescription(offer);
      current.getTransceivers().forEach((transceiver) => { const track = transceiver.sender.track; if (track && transceiver.mid && (track.kind === "audio" || track.kind === "video")) publications.push({ kind: track.kind, source_role: track.kind === "audio" ? "microphone" : "camera", mid: transceiver.mid }); });
      if (publications.length) {
        const result = await publishStudioRealtimeTracks(roomId, established.sessionId, current.localDescription ?? offer, publications); await applyDescription(result.sessionDescription, result.tracks);
      }
      setAudioEnabled(Boolean(stream?.getAudioTracks()[0]?.enabled)); setVideoEnabled(Boolean(stream?.getVideoTracks()[0]?.enabled));
      await updateOwnStudioMediaIntent(roomId, { microphoneMuted: !stream?.getAudioTracks()[0]?.enabled, cameraHidden: !stream?.getVideoTracks()[0]?.enabled, screenSharing: false });
      setPreflightOpen(false); setState("connected"); setReason(withoutDevices ? "Connected with devices off" : "Connected"); await refreshMappings();
    } catch (error) { const safe = safeError(error); setState(safe.state); setReason(safe.reason); }
    finally { setPending(""); }
  }, [applyDescription, chooseStream, pending, refreshMappings, roomId, updateRemote]);

  const closePreflight = useCallback(async () => { setPreflightOpen(false); if (state !== "connected") { localStream.current?.getTracks().forEach((track) => track.stop()); localStream.current = null; setState("idle"); setReason("Ready for device preflight"); } }, [state]);

  const leave = useCallback(async () => {
    peer.current?.close(); peer.current = null; localStream.current?.getTracks().forEach((track) => track.stop()); localStream.current = null; screenTrack.current?.stop(); screenTrack.current = null;
    remoteAudio.current.forEach((audio) => { audio.pause(); audio.srcObject = null; }); remoteAudio.current.clear();
    remoteTracks.current.clear(); midCatalog.current.clear(); subscribed.current.clear(); updateRemote(); setAudioEnabled(false); setVideoEnabled(false); setScreenEnabled(false); setState("disconnected"); setReason("Media disconnected");
    session.current = null; await leaveStudioRealtimeSession(roomId).catch(() => undefined);
  }, [roomId, updateRemote]);

  useEffect(() => () => { peer.current?.close(); localStream.current?.getTracks().forEach((track) => track.stop()); screenTrack.current?.stop(); void leaveStudioRealtimeSession(roomId).catch(() => undefined); }, [roomId]);
  useEffect(() => {
    if (state !== "connected") return;
    const timer = window.setInterval(() => { const current = session.current; if (current) void heartbeatStudioRealtimeSession(roomId, current.generation).catch(() => { peer.current?.close(); peer.current = null; localStream.current?.getTracks().forEach((track) => track.stop()); setState("disconnected"); setReason("Runtime/Auth revoked or lost this media session"); }); void operation.current.then(refreshMappings).catch(() => undefined); }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshMappings, roomId, state]);

  const toggleAudio = useCallback(async () => { const track = localStream.current?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; setAudioEnabled(track.enabled); await updateOwnStudioMediaIntent(roomId, { microphoneMuted: !track.enabled }); }, [roomId]);
  const toggleVideo = useCallback(async () => { const track = localStream.current?.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; setVideoEnabled(track.enabled); await updateOwnStudioMediaIntent(roomId, { cameraHidden: !track.enabled }); }, [roomId]);
  const toggleScreen = useCallback(async () => {
    const current = peer.current, currentSession = session.current; if (!current || !currentSession || !options.canScreenShare) return;
    if (screenTrack.current) { screenTrack.current.stop(); screenTrack.current = null; setScreenEnabled(false); await updateOwnStudioMediaIntent(roomId, { screenSharing: false }); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); const track = stream.getVideoTracks()[0]; screenTrack.current = track; current.addTrack(track, stream);
      const offer = await current.createOffer(); await current.setLocalDescription(offer); const transceiver = current.getTransceivers().find((item) => item.sender.track === track);
      if (!transceiver?.mid) throw new Error("Screen track negotiation was incomplete");
      const result = await publishStudioRealtimeTracks(roomId, currentSession.sessionId, current.localDescription ?? offer, [{ kind: "video", source_role: "screen", mid: transceiver.mid }]); await applyDescription(result.sessionDescription, result.tracks);
      track.onended = () => { screenTrack.current = null; setScreenEnabled(false); void updateOwnStudioMediaIntent(roomId, { screenSharing: false }); };
      setScreenEnabled(true); await updateOwnStudioMediaIntent(roomId, { screenSharing: true });
    } catch (error) { setReason(safeError(error).reason); }
  }, [applyDescription, options.canScreenShare, roomId]);

  const enableAudio = useCallback(async () => {
    try { await Promise.all([...remoteAudio.current.values()].map((audio) => audio.play())); setAudioBlocked(false); }
    catch { setAudioBlocked(true); setReason("Browser playback permission is still required"); }
  }, []);
  const syncSelfLocation = useCallback(async (location: "on_stage" | "backstage") => { void location; return true; }, []);
  const syncParticipantLocation = useCallback(async (participantId: string, location: "on_stage" | "backstage") => { void participantId; void location; return true; }, []);
  const forceDisableParticipant = useCallback(async (participantId: string, kind: "audio" | "video") => { void participantId; void kind; return false; }, []);
  const localVideoTrack = localStream.current?.getVideoTracks()[0] ?? null, localAudioTrack = localStream.current?.getAudioTracks()[0] ?? null;
  const meeting = localStream.current ? { self: { videoTrack: localVideoTrack, audioTrack: localAudioTrack } } : undefined;
  const activeShares = useMemo(() => { void revision; const shares: Array<{ runtimeParticipantId: string; track: MediaStreamTrack; local: boolean }> = []; if (screenTrack.current && selfRuntimeParticipantId) shares.push({ runtimeParticipantId: selfRuntimeParticipantId, track: screenTrack.current, local: true }); remoteParticipants.forEach((participant, id) => { if (participant.screenShareTracks.video) shares.push({ runtimeParticipantId: id, track: participant.screenShareTracks.video, local: false }); }); return shares; }, [remoteParticipants, revision, selfRuntimeParticipantId]);

  return { meeting, localStream: localStream.current, state, reason, pending, preflightOpen, devices, speakerSupported, selectedCameraId, selectedMicrophoneId, selectedSpeakerId, cameraChoice, microphoneChoice, audioBlocked, remoteParticipants, activeRuntimeParticipantId: null as string | null, selfRuntimeParticipantId, activeShares, openPreflight, selectDevice, setPreflightChoice, joinPreflight, closePreflight, leave, toggleAudio, toggleVideo, toggleScreen, enableAudio, syncSelfLocation, syncParticipantLocation, forceDisableParticipant, refreshMappings, audioEnabled, videoEnabled, screenEnabled };
}
