import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectStudioEvents, leaveStudioGuestSession, loadStudioGuestRoomView, moveStudioGuestSelf, updateStudioMediaIntent } from "../api/studioAuth";
import { SiteShell } from "../components/shell/SiteShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusChip } from "../components/ui/StatusChip";
import type { GuestRoomView, StudioGuest } from "../domain/studio";
import { useGlobalActivity } from "../activity/useGlobalActivity";

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
  useEffect(() => {
    if (!liveGuestId) return;
    const connection = connectStudioEvents({ guest: true, onState: () => undefined, onEvent: () => void refresh() });
    return () => connection.close();
  }, [liveGuestId, refresh]);

  async function media(field: "microphone" | "camera") {
    if (!view || busy) return;
    setBusy(field);
    try {
      await updateStudioMediaIntent(field === "microphone" ? { microphoneMuted: !view.self.microphoneMuted } : { cameraHidden: !view.self.cameraHidden });
      await refresh();
      setMessage("Intended participant state updated. No physical media track was changed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Participant state could not be updated."); }
    finally { setBusy(""); }
  }

  async function move(location: "stage" | "backstage") {
    if (!view || busy) return;
    setBusy(location);
    try { await moveStudioGuestSelf(location); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Participant location could not be updated."); }
    finally { setBusy(""); }
  }

  async function leave() {
    if (busy) return;
    setBusy("leave");
    try { await leaveStudioGuestSession(); navigate("/", { replace: true }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The room could not be left cleanly."); setBusy(""); }
  }

  if (status === "loading") return <SiteShell><section className="centered-page page-width"><Card><p>Loading canonical room Stage…</p></Card></section></SiteShell>;
  if (!view || status === "error") return <SiteShell><section className="centered-page page-width"><Card><StatusChip tone="blocked">Room unavailable</StatusChip><h1>Guest room access could not be confirmed.</h1><p>{message}</p></Card></section></SiteShell>;

  const selfOnStage = view.self.state === "on_stage";
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
          <p>Media not connected · OFF AIR</p>
          {view.room.presentation.layoutMode === "presentation" && <div className="presentation-source-placeholder">Presentation source not connected</div>}
          <div className={`program-canvas program-canvas--${view.room.presentation.layoutMode}`}>
            {view.stage.length ? view.stage.map((participant) => (
              <article className="stage-participant" key={participant.id}>
                <Avatar guest={participant} />
                <div><strong>{participant.displayName}</strong>{participant.subtitle && <small>{participant.subtitle}</small>}<small>{participant.microphoneMuted ? "Intended muted" : "Intended unmuted"} · {participant.cameraHidden ? "Camera intended hidden" : "Camera intended visible"}</small></div>
              </article>
            )) : <EmptyState title="Stage is empty"><p>The director has not moved any guests on Stage.</p></EmptyState>}
          </div>
        </section>
        <section className="backstage-tray" aria-labelledby="guest-backstage-title">
          <div className="backstage-tray__heading"><h2 id="guest-backstage-title">Backstage</h2><StatusChip tone="pending">{selfOnStage ? 0 : 1}</StatusChip></div>
          {!selfOnStage ? <article className="backstage-tile"><Avatar guest={view.self} /><div><strong>{view.self.displayName}</strong><small>{view.self.subtitle || "Waiting Backstage"}</small></div><div className="participant-actions"><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void media("microphone")}>{view.self.microphoneMuted ? "Unmute intent" : "Mute intent"}</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void media("camera")}>{view.self.cameraHidden ? "Show camera intent" : "Hide camera intent"}</Button>{view.permissions.selfStage && <Button disabled={Boolean(busy)} onClick={() => void move("stage")}>Move to Stage</Button>}</div></article> : <EmptyState title="You are on Stage"><p>Use your participant action to move Backstage.</p></EmptyState>}
        </section>
        {selfOnStage && <div className="guest-self-controls"><Button variant="secondary" disabled={Boolean(busy)} onClick={() => void move("backstage")}>Move backstage</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void media("microphone")}>{view.self.microphoneMuted ? "Unmute intent" : "Mute intent"}</Button><Button variant="quiet" disabled={Boolean(busy)} onClick={() => void media("camera")}>{view.self.cameraHidden ? "Show camera intent" : "Hide camera intent"}</Button></div>}
        {message && <p role="status">{message}</p>}
        <p className="fine-print">Microphone and camera controls set Runtime-owned intended state only. Cloudflare Realtime media is not connected.</p>
      </section>
    </SiteShell>
  );
}
