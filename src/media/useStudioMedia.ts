import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { createStudioMediaSession, leaveStudioMediaSession, loadStudioMediaStatus } from "../api/studioAuth";

export type StudioMediaConnection = "idle" | "provisioning" | "connecting" | "connected" | "reconnecting" | "disconnected" | "unavailable" | "permission_error" | "provider_error";

export function useStudioMedia(roomId: string) {
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const [state, setState] = useState<StudioMediaConnection>("idle");
  const [reason, setReason] = useState("Checking media configuration");
  const [pending, setPending] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadStudioMediaStatus(roomId, controller.signal).then((status) => {
      if (!status.enabled) { setState("unavailable"); setReason(status.reasonCode === "realtimekit_disabled" ? "RealtimeKit is not configured" : status.reasonCode); }
      else { setState("idle"); setReason("Ready to connect"); }
    }).catch(() => { setState("unavailable"); setReason("Media status unavailable"); });
    return () => controller.abort();
  }, [roomId]);

  const connect = useCallback(async () => {
    if (initialized.current || meeting) return;
    initialized.current = true; setState("provisioning"); setReason("Provisioning secure participant access");
    try {
      const session = await createStudioMediaSession(roomId);
      setState("connecting"); setReason("Connecting media");
      const client = await initMeeting({ authToken: session.authToken, defaults: { audio: false, video: false } });
      if (!client) throw new Error("Media client did not initialize");
      await client.join(); setState("connected"); setReason("Connected");
    } catch (error) {
      initialized.current = false;
      const name = error instanceof DOMException ? error.name : "";
      setState(name === "NotAllowedError" ? "permission_error" : "provider_error");
      setReason(name === "NotAllowedError" ? "Device permission was denied" : error instanceof Error ? error.message : "Media connection failed");
    }
  }, [initMeeting, meeting, roomId]);

  const leave = useCallback(async () => {
    try { await meeting?.leave(); } finally { initialized.current = false; setState("disconnected"); void leaveStudioMediaSession(roomId).catch(() => undefined); }
  }, [meeting, roomId]);

  useEffect(() => () => { if (meeting) void meeting.leave(); }, [meeting]);

  const toggleAudio = useCallback(async () => { if (!meeting || pending) return; setPending("audio"); try { meeting.self.audioEnabled ? await meeting.self.disableAudio() : await meeting.self.enableAudio(); } finally { setPending(""); } }, [meeting, pending]);
  const toggleVideo = useCallback(async () => { if (!meeting || pending) return; setPending("video"); try { meeting.self.videoEnabled ? await meeting.self.disableVideo() : await meeting.self.enableVideo(); } finally { setPending(""); } }, [meeting, pending]);
  const toggleScreen = useCallback(async () => { if (!meeting || pending) return; setPending("screen"); try { meeting.self.screenShareEnabled ? await meeting.self.disableScreenShare() : await meeting.self.enableScreenShare(); } finally { setPending(""); } }, [meeting, pending]);

  return { meeting, state, reason, pending, connect, leave, toggleAudio, toggleVideo, toggleScreen,
    audioEnabled: meeting?.self.audioEnabled === true, videoEnabled: meeting?.self.videoEnabled === true,
    screenEnabled: meeting?.self.screenShareEnabled === true };
}
