import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectStudioEvents, leaveStudioGuestSession, loadStudioGuestRoomView, moveStudioGuestSelf } from "../api/studioAuth";
import { SiteShell } from "../components/shell/SiteShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusChip } from "../components/ui/StatusChip";
import type { GuestRoomView, StudioGuest } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioMedia } from "../media/useStudioMedia";
import { DevicePreflightDialog, LocalMediaVideo, MediaParticipantTile, RemoteMediaVideo, ScreenShareVideo } from "../media/StudioMediaElements";
import { resolveEffectiveStageLayout } from "../layout/stageLayout";

function initial(value: string) { return value.trim().charAt(0).toUpperCase() || "?"; }

function Avatar({ guest }: { readonly guest: StudioGuest }) {
  return guest.avatarUrl
    ? <img className="participant-avatar" src={guest.avatarUrl} alt="" />
    : <span className={`participant-avatar guest-avatar--${guest.avatarColor}`} aria-hidden="true">{initial(guest.displayName)}</span>;
}

export function GuestRoomWorkspace() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<GuestRoomView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const media = useStudioMedia(roomId, { location: view?.self.state === "on_stage" ? "on_stage" : "backstage", canScreenShare: view?.self.state === "on_stage" });
  useGlobalActivity(status === "loading" || Boolean(busy), "Loading guest room");

  const refresh = useCallback(async () => {
    try {
      const next = await loadStudioGuestRoomView();
      if (next.room.id !== roomId) navigate(`/studio/rooms/${encodeURIComponent(next.room.id)}`, { replace: true });
      setView(next); setStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guest room authority is unavailable.");
      setStatus("error");
    }
  }, [navigate, roomId]);

  useEffect(() => { void refresh(); }, [refresh]);
  const liveGuestId = view?.self.id;
  const mediaState = media.state;
  const refreshMediaMappings = media.refreshMappings;
  useEffect(() => {
    if (!liveGuestId) return;
    const connection = connectStudioEvents({ guest: true, onState: () => undefined, onEvent: () => void refresh() });
    return () => connection.close();
  }, [liveGuestId, refresh]);
  useEffect(() => { if (mediaState === "connected") void refreshMediaMappings(); }, [view?.stage, mediaState, refreshMediaMappings]);

  async function move(location: "stage" | "backstage") {
    if (!view || busy) return;
    if (location === "stage" && view.stage.length >= view.room.maxAdditionalStageParticipants) {
      setMessage("Stage full — 9 participants including the director.");
      return;
    }
    setBusy(location);
    try { await moveStudioGuestSelf(location); await media.syncSelfLocation(location === "stage" ? "on_stage" : "backstage"); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Participant location could not be updated."); }
    finally { setBusy(""); }
  }

  async function leave() {
    if (busy) return;
    setBusy("leave");
    try { await media.leave(); await leaveStudioGuestSession(); navigate("/", { replace: true }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The room could not be left cleanly."); setBusy(""); }
  }

  if (status === "loading") return <SiteShell><section className="centered-page page-width"><Card><p>Loading canonical room Stage…</p></Card></section></SiteShell>;
  if (!view || status === "error") return <SiteShell><section className="centered-page page-width"><Card><StatusChip tone="blocked">Room unavailable</StatusChip><h1>Guest room access could not be confirmed.</h1><p>{message}</p></Card></section></SiteShell>;

  const selfOnStage = view.self.state === "on_stage";
  const presentationShare = media.activeShares.find((share) => share.runtimeParticipantId === `guest:${view.room.presentation.presentationGuestId}` || share.runtimeParticipantId === view.room.presentation.presentationGuestId) ?? media.activeShares[0];
  const directorParticipant = Array.from(media.remoteParticipants.entries()).find(([runtimeId]) => runtimeId.startsWith("account:"))?.[1];
  const requestedLayout = view.room.presentation.layoutMode;
  const guestStageCount = 1 + view.stage.length;
  const explicitSpotlight = Boolean(view.room.presentation.spotlightGuestId && view.stage.some((participant) => participant.id === view.room.presentation.spotlightGuestId));
  const effectiveLayout = resolveEffectiveStageLayout({ requested: requestedLayout, activeScreenShare: Boolean(presentationShare), explicitSpotlight, participantCount: guestStageCount });
  return (
    <SiteShell>
      <section className="guest-room page-width">
        <header className="guest-room__header">
          <div><p className="eyebrow">ROOM DETAILS</p><h1>{view.room.title}</h1><p><code className="room-id-chip" title="Room ID">{view.room.id}</code> · OFF AIR</p></div>
          <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void leave()}>Leave room</Button>
        </header>
        <section className="guest-stage" aria-labelledby="guest-stage-title">
          <p className="eyebrow">STAGE OUTPUT</p>
          <h2 id="guest-stage-title" className="sr-only">Stage output</h2>
          <p>{media.state === "connected" ? "Media connected" : media.reason} · OFF AIR</p>
          {effectiveLayout === "presentation" && (presentationShare ? <div className="presentation-source"><ScreenShareVideo track={presentationShare.track} /></div> : <div className="presentation-source-placeholder">Presentation source not connected</div>)}
          <div className={`program-canvas program-canvas--${effectiveLayout}`} data-layout={requestedLayout} data-effective-layout={effectiveLayout} data-participant-count={guestStageCount}>
            <article className="stage-participant" data-stage-slot="director">{directorParticipant?.videoEnabled ? <RemoteMediaVideo participant={directorParticipant} label="Director" /> : <span className="participant-avatar">D</span>}<div><strong>Director</strong><small>{directorParticipant ? `${directorParticipant.audioEnabled ? "Microphone on" : "Microphone muted"} · ${directorParticipant.videoEnabled ? "Camera on" : "Camera off"}` : "Reserved Stage slot"}</small></div></article>
            {view.stage.length ? view.stage.slice(0, view.room.maxAdditionalStageParticipants).map((participant) => (
              participant.id === view.self.id ? <article className={`stage-participant${media.activeRuntimeParticipantId === "self" ? " is-active-speaker" : ""}`} key={participant.id}>{media.videoEnabled ? <LocalMediaVideo media={media} /> : <Avatar guest={participant} />}<div><strong>{participant.displayName}</strong>{participant.subtitle && <small>{participant.subtitle}</small>}<small>{media.audioEnabled ? "Microphone on" : "Microphone muted"} · {media.videoEnabled ? "Camera on" : "Camera off"}</small></div></article> :
              <MediaParticipantTile className="stage-participant" guest={participant} media={media} key={participant.id} />
            )) : <EmptyState title="Stage is empty"><p>The director has not moved any guests on Stage.</p></EmptyState>}
          </div>
        </section>
        <section className="backstage-tray" aria-labelledby="guest-backstage-title">
          <div className="backstage-tray__heading"><h2 id="guest-backstage-title">Backstage</h2><StatusChip tone="pending">{selfOnStage ? 0 : 1}</StatusChip></div>
          {!selfOnStage ? <article className="backstage-tile">{media.videoEnabled ? <LocalMediaVideo media={media} preview /> : <Avatar guest={view.self} />}<div><strong>{view.self.displayName}</strong><small>{view.self.subtitle || "Waiting Backstage"}</small></div><div className="participant-actions"><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleAudio()}>{media.audioEnabled ? "Mute microphone" : "Enable microphone"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleVideo()}>{media.videoEnabled ? "Turn camera off" : "Enable camera"}</Button>{view.permissions.selfStage && <Button disabled={Boolean(busy) || view.stage.length >= view.room.maxAdditionalStageParticipants} onClick={() => void move("stage")}>Move to Stage</Button>}</div></article> : <EmptyState title="You are on Stage"><p>Use your participant action to move Backstage.</p></EmptyState>}
        </section>
        <div className="guest-self-controls"><Button variant={media.state === "connected" ? "quiet" : "secondary"} disabled={["provisioning", "connecting"].includes(media.state)} onClick={() => void (media.state === "connected" ? media.leave() : media.openPreflight())}>{media.state === "connected" ? "Disconnect media" : "Connect media"}</Button>{media.audioBlocked && <Button onClick={() => void media.enableAudio()}>Enable audio</Button>}{selfOnStage && <><Button variant="secondary" disabled={Boolean(busy)} onClick={() => void move("backstage")}>Move backstage</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleAudio()}>{media.audioEnabled ? "Mute microphone" : "Enable microphone"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleVideo()}>{media.videoEnabled ? "Turn camera off" : "Enable camera"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleScreen()}>{media.screenEnabled ? "Stop sharing" : "Share screen"}</Button></>}</div>
        {message && <p role="status">{message}</p>}
        <p className="fine-print">RealtimeKit transports private room media. Runtime/Auth remains authoritative and the room remains OFF AIR.</p>
      </section>
      <DevicePreflightDialog media={media} />
    </SiteShell>
  );
}
