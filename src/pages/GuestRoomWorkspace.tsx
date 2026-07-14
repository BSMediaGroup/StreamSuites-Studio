import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectStudioEvents, leaveStudioGuestSession, listStudioBrowserSources, loadPresentationSources, loadStudioGuestRoomView, moveStudioGuestSelf, registerPresentationSource, stopPresentationSource } from "../api/studioAuth";
import { SiteShell } from "../components/shell/SiteShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusChip } from "../components/ui/StatusChip";
import { StudioIcon } from "../components/ui/StudioIcon";
import type { BrowserSource, GuestRoomView, PresentationSource } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioMedia } from "../media/useStudioMedia";
import { BackstageMediaPreview, DevicePreflightDialog, LocalMediaVideo, MediaParticipantTile, ParticipantFallback, ParticipantLabelOverlay, RemoteMediaVideo, ScreenShareVideo } from "../media/StudioMediaElements";
import { resolveEffectiveStageLayout, stageGridRows } from "../layout/stageLayout";
import { StageBrandingOverlay, stageBrandingStyle } from "../branding/StageBranding";
import { BrowserSourceRenderer } from "../components/room/BrowserSourceRenderer";
import moveUpIcon from "../../assets/icons/ui/moveselectionup.svg";
import moveUpFilledIcon from "../../assets/icons/ui/moveselectionup-filled.svg";
import moveDownIcon from "../../assets/icons/ui/moveselectiondown.svg";
import moveDownFilledIcon from "../../assets/icons/ui/moveselectiondown-filled.svg";

export function GuestRoomWorkspace() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<GuestRoomView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [presentationSources, setPresentationSources] = useState<PresentationSource[]>([]);
  const [browserSources, setBrowserSources] = useState<BrowserSource[]>([]);
  const media = useStudioMedia(roomId, { location: view?.self.state === "on_stage" ? "on_stage" : "backstage", canScreenShare: view?.self.state === "on_stage" });
  useGlobalActivity(status === "loading" || Boolean(busy), "Loading guest room");

  const refresh = useCallback(async () => {
    try {
      const [next, sources, nextBrowserSources] = await Promise.all([loadStudioGuestRoomView(), loadPresentationSources(roomId), listStudioBrowserSources(roomId)]);
      if (next.room.id !== roomId) navigate(`/studio/rooms/${encodeURIComponent(next.room.id)}`, { replace: true });
      setView(next); setPresentationSources(sources); setBrowserSources(nextBrowserSources); setStatus("ready");
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
  useEffect(() => {
    if (!view || media.state !== "connected" || !media.selfRuntimeParticipantId) return;
    const ownSource = presentationSources.find((source) => source.ownerParticipantId === media.selfRuntimeParticipantId);
    if (media.screenEnabled && !ownSource) void registerPresentationSource(view.room.id).then((source) => setPresentationSources((current) => [...current, source])).catch((error) => setMessage(error instanceof Error ? error.message : "Screen share source could not be registered."));
    if (!media.screenEnabled && ownSource) void stopPresentationSource(view.room.id, ownSource.id).then(() => setPresentationSources((current) => current.filter((source) => source.id !== ownSource.id))).catch(() => undefined);
  }, [media.screenEnabled, media.selfRuntimeParticipantId, media.state, presentationSources, view]);

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
  const onStageSource = presentationSources.find((source) => source.location === "on_stage");
  const presentationShare = onStageSource ? media.activeShares.find((share) => share.runtimeParticipantId === onStageSource.ownerParticipantId) : undefined;
  const directorParticipant = Array.from(media.remoteParticipants.entries()).find(([runtimeId]) => runtimeId.startsWith("account:"))?.[1];
  const requestedLayout = view.room.presentation.layoutMode;
  const guestStageCount = 1 + view.stage.length;
  const explicitSpotlight = Boolean(view.room.presentation.spotlightGuestId && view.stage.some((participant) => participant.id === view.room.presentation.spotlightGuestId));
  const selectedCustomLayout = view.room.presentation.customLayouts.find((item) => item.id === view.room.presentation.selectedCustomLayoutId);
  const effectiveLayout = resolveEffectiveStageLayout({ requested: requestedLayout, customBaseMode: selectedCustomLayout?.baseLayoutMode, activeScreenShare: Boolean(onStageSource), explicitSpotlight, participantCount: guestStageCount });
  const stageItems = [{ id: "director", participant: null }, ...view.stage.slice(0, view.room.maxAdditionalStageParticipants).map((participant) => ({ id: participant.id, participant }))].slice(0, 9);
  let rowOffset = 0;
  const stageRows = stageGridRows(stageItems.length).map((size) => { const row = stageItems.slice(rowOffset, rowOffset + size); rowOffset += size; return row; });
  const renderStageItem = ({ participant }: (typeof stageItems)[number]) => !participant ? <article className="participant-tile stage-participant" key="director" data-stage-slot="director">{directorParticipant?.videoEnabled && directorParticipant.videoTrack?.readyState === "live" ? <RemoteMediaVideo participant={directorParticipant} label="Director" /> : <ParticipantFallback guest={{ displayName: "Director", avatarColor: "green", avatarUrl: null }} status={directorParticipant ? `${directorParticipant.audioEnabled ? "Microphone on" : "Microphone muted"} · Camera off` : "Reserved Stage slot"} />}<ParticipantLabelOverlay name="Director" mode={view.room.presentation.participantLabelMode} branding={view.room.branding} /></article> : participant.id === view.self.id ? <article className={`participant-tile stage-participant${media.activeRuntimeParticipantId === "self" ? " is-active-speaker" : ""}`} key={participant.id}>{media.videoEnabled && media.meeting?.self.videoTrack?.readyState === "live" ? <LocalMediaVideo media={media} /> : <ParticipantFallback guest={participant} status={`${media.audioEnabled ? "Microphone on" : "Microphone muted"} · Camera off`} />}<ParticipantLabelOverlay name={participant.displayName} subtitle={participant.subtitle} mode={view.room.presentation.participantLabelMode} branding={view.room.branding} /></article> : <MediaParticipantTile className="participant-tile stage-participant" guest={participant} media={media} labelMode={view.room.presentation.participantLabelMode} branding={view.room.branding} key={participant.id} />;
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
          <div className={`program-canvas program-canvas--${effectiveLayout}${onStageSource ? ` has-presentation presentation-${view.room.presentation.participantMode} edge-${view.room.presentation.participantEdge}` : ""}`} style={stageBrandingStyle(view.room.branding)} data-layout={requestedLayout} data-effective-layout={effectiveLayout} data-participant-count={guestStageCount} data-slot-sizing={view.room.presentation.guestSlotSizing}>
            {effectiveLayout === "presentation" && (presentationShare ? <div className="presentation-source" key={onStageSource?.id}><ScreenShareVideo track={presentationShare.track} /></div> : <div className="presentation-source-placeholder">Presentation source not connected</div>)}
            <div className="browser-source-layer">{browserSources.filter((source) => source.location === "on_stage" && source.visibilityScope === "room" && source.url).map((source) => <BrowserSourceRenderer key={source.id} source={source} mode="stage" />)}</div>
            <StageBrandingOverlay branding={view.room.branding} />
            <div className="program-stage-grid">
              {stageRows.map((row) => <div className="program-stage-row" key={row.map((item) => item.id).join(":")} style={{ "--stage-row-size": row.length } as CSSProperties}>{row.map(renderStageItem)}</div>)}
            </div>
          </div>
        </section>
        <section className="backstage-tray" aria-labelledby="guest-backstage-title">
          <div className="backstage-tray__heading"><h2 id="guest-backstage-title">Backstage</h2><StatusChip tone="pending">{selfOnStage ? 0 : 1}</StatusChip></div>
          {!selfOnStage ? <article className="backstage-tile"><BackstageMediaPreview guest={view.self} media={media} local /><div><strong>{view.self.displayName}</strong><small>{view.self.subtitle || "Waiting Backstage"}</small></div><div className="participant-actions"><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleAudio()}>{media.audioEnabled ? "Mute microphone" : "Enable microphone"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleVideo()}>{media.videoEnabled ? "Turn camera off" : "Enable camera"}</Button>{view.permissions.selfStage && <Button className="icon-control" disabled={Boolean(busy) || view.stage.length >= view.room.maxAdditionalStageParticipants} onClick={() => void move("stage")}><StudioIcon regular={moveUpIcon} filled={moveUpFilledIcon} /> Move to Stage</Button>}</div></article> : <EmptyState title="You are on Stage"><p>Use your participant action to move Backstage.</p></EmptyState>}
          {presentationSources.filter((source) => source.location === "backstage" && source.ownerParticipantId === media.selfRuntimeParticipantId).map((source) => <article className="backstage-tile presentation-source-card" key={source.id}><div><strong>{source.displayName}</strong><small>Screen share · Backstage</small></div><Button variant="quiet" onClick={() => void media.toggleScreen()}>Stop sharing</Button></article>)}
        </section>
        <div className="guest-self-controls"><Button variant={media.state === "connected" ? "quiet" : "secondary"} disabled={["provisioning", "connecting"].includes(media.state)} onClick={() => void (media.state === "connected" ? media.leave() : media.openPreflight())}>{media.state === "connected" ? "Disconnect media" : "Connect media"}</Button>{media.audioBlocked && <Button onClick={() => void media.enableAudio()}>Enable audio</Button>}{selfOnStage && <><Button className="icon-control" variant="secondary" disabled={Boolean(busy)} onClick={() => void move("backstage")}><StudioIcon regular={moveDownIcon} filled={moveDownFilledIcon} /> Move backstage</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleAudio()}>{media.audioEnabled ? "Mute microphone" : "Enable microphone"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleVideo()}>{media.videoEnabled ? "Turn camera off" : "Enable camera"}</Button><Button variant="quiet" disabled={media.state !== "connected" || Boolean(media.pending)} onClick={() => void media.toggleScreen()}>{media.screenEnabled ? "Stop sharing" : "Share screen"}</Button></>}</div>
        {message && <p role="status">{message}</p>}
        <p className="fine-print">RealtimeKit transports private room media. Runtime/Auth remains authoritative and the room remains OFF AIR.</p>
      </section>
      <DevicePreflightDialog media={media} />
    </SiteShell>
  );
}
