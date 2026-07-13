import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import type { RTKParticipant } from "@cloudflare/realtimekit";
import { Button } from "../components/ui/Button";
import type { StudioGuest } from "../domain/studio";
import type { useStudioMedia } from "./useStudioMedia";

type StudioMedia = ReturnType<typeof useStudioMedia>;

export function LocalMediaVideo({ media, preview = false, className = "participant-video" }: { media: StudioMedia; preview?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current, self = media.meeting?.self;
    if (!element || !self) return;
    self.registerVideoElement(element, preview);
    return () => self.deregisterVideoElement(element, preview);
  }, [media.meeting, preview]);
  return <video ref={ref} className={className} autoPlay muted playsInline aria-label={preview ? "Local camera preview" : "Local camera"} />;
}

export function RemoteMediaVideo({ participant, label }: { participant: RTKParticipant; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    participant.registerVideoElement(element);
    return () => participant.deregisterVideoElement(element);
  }, [participant]);
  return <video ref={ref} className="participant-video" autoPlay playsInline aria-label={`${label} camera`} />;
}

export function ScreenShareVideo({ track, label = "Shared screen" }: { track: MediaStreamTrack; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const stream = new MediaStream([track]);
    element.srcObject = stream;
    void element.play().catch(() => undefined);
    return () => { element.pause(); element.srcObject = null; };
  }, [track]);
  return <video ref={ref} className="presentation-video" autoPlay muted playsInline aria-label={label} />;
}

function MicrophoneMeter({ media }: { media: StudioMedia }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const track = media.meeting?.self.audioTrack;
    if (!track || !media.microphoneChoice || typeof AudioContext === "undefined") { setLevel(0); return; }
    const context = new AudioContext();
    const analyser = context.createAnalyser(); analyser.fftSize = 256;
    const source = context.createMediaStreamSource(new MediaStream([track])); source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount); let frame = 0;
    const sample = () => { analyser.getByteFrequencyData(values); setLevel(Math.min(100, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length))); frame = requestAnimationFrame(sample); };
    frame = requestAnimationFrame(sample);
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); };
  }, [media.meeting, media.microphoneChoice]);
  return <span className="microphone-meter" aria-label={`Microphone activity ${level}%`}><span style={{ width: `${level}%` }} /></span>;
}

export function DevicePreflightDialog({ media }: { media: StudioMedia }) {
  if (!media.preflightOpen) return null;
  const preparing = media.state === "provisioning";
  const blocked = media.state === "permission_error" || media.state === "unavailable" || media.state === "provider_error";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) void media.closePreflight(); }}>
      <section className="studio-dialog device-preflight" role="dialog" aria-modal="true" aria-labelledby="device-preflight-title">
        <h2 id="device-preflight-title">Device preflight</h2>
        <p>{media.reason}</p>
        <div className="device-preflight__preview">
          {media.meeting && media.cameraChoice ? <LocalMediaVideo media={media} preview className="device-preflight__video" /> : <span>Camera preview is off</span>}
        </div>
        {!preparing && !blocked && <div className="device-preflight__fields">
          <label>Camera<select value={media.selectedCameraId} disabled={!media.devices.cameras.length || Boolean(media.pending)} onChange={(event) => void media.selectDevice("camera", event.target.value)}><option value="">No camera</option>{media.devices.cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>
          <label>Microphone<select value={media.selectedMicrophoneId} disabled={!media.devices.microphones.length || Boolean(media.pending)} onChange={(event) => void media.selectDevice("microphone", event.target.value)}><option value="">No microphone</option>{media.devices.microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select><MicrophoneMeter media={media} /></label>
          {media.speakerSupported && <label>Speaker<select value={media.selectedSpeakerId} disabled={!media.devices.speakers.length || Boolean(media.pending)} onChange={(event) => void media.selectDevice("speaker", event.target.value)}><option value="">System default</option>{media.devices.speakers.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${index + 1}`}</option>)}</select></label>}
          <label className="device-preflight__choice"><input type="checkbox" checked={media.cameraChoice} disabled={!media.devices.cameras.length || Boolean(media.pending)} onChange={(event) => void media.setPreflightChoice("camera", event.target.checked)} /> Camera enabled when joining</label>
          <label className="device-preflight__choice"><input type="checkbox" checked={media.microphoneChoice} disabled={!media.devices.microphones.length || Boolean(media.pending)} onChange={(event) => void media.setPreflightChoice("microphone", event.target.checked)} /> Microphone unmuted when joining</label>
        </div>}
        <div className="studio-dialog__actions">
          <Button variant="quiet" disabled={Boolean(media.pending)} onClick={() => void media.closePreflight()}>Cancel</Button>
          <Button variant="secondary" disabled={preparing || Boolean(media.pending) || !media.meeting} onClick={() => void media.joinPreflight(true)}>Join without devices</Button>
          <Button disabled={preparing || blocked || Boolean(media.pending) || !media.meeting} onClick={() => void media.joinPreflight(false)}>Join room</Button>
        </div>
      </section>
    </div>
  );
}

export function MediaParticipantTile({ guest, media, className = "participant-tile", children, ...articleProps }: { guest: StudioGuest; media: StudioMedia; className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "children">) {
  const participant = media.remoteParticipants.get(`guest:${guest.id}`) ?? media.remoteParticipants.get(guest.id);
  const usableVideo = participant?.videoEnabled && participant.videoTrack?.readyState === "live";
  const reconnecting = media.state === "reconnecting";
  const providerMissing = media.state === "connected" && !participant;
  return (
    <article {...articleProps} className={`${className}${media.activeRuntimeParticipantId === `guest:${guest.id}` || media.activeRuntimeParticipantId === guest.id ? " is-active-speaker" : ""}`} data-participant-id={guest.id}>
      {usableVideo && participant ? <RemoteMediaVideo participant={participant} label={guest.displayName} /> : guest.avatarUrl ? <img className="participant-avatar" src={guest.avatarUrl} alt="" crossOrigin="use-credentials" /> : <span className={`participant-avatar guest-avatar--${guest.avatarColor}`} aria-hidden="true">{guest.displayName.trim().charAt(0).toUpperCase() || "?"}</span>}
      <span className="participant-identity"><strong>{guest.displayName}</strong>{guest.subtitle && <small>{guest.subtitle}</small>}<small>{reconnecting ? "Media reconnecting" : providerMissing ? "Provider participant not connected" : `${participant?.audioEnabled ? "Microphone on" : "Microphone muted"} · ${usableVideo ? "Camera on" : "Camera off"}`}</small></span>
      {children}
    </article>
  );
}
