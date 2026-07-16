import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { deleteStudioRoomAsset, listStudioRoomAssets, loadStudioBranding, updateStudioBranding, updateStudioRoomAsset, uploadStudioRoomAsset } from "../../api/studioAuth";
import type { BrowserSource, RoomAsset, RoomAssetCategory, RoomBranding } from "../../domain/studio";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { BrowserSourcesPanel } from "./BrowserSourcesPanel";

const categories: readonly RoomAssetCategory[] = ["logo", "stage_background", "overlay", "holding", "presentation_placeholder", "broadcast_thumbnail"];
const labels: Record<RoomAssetCategory, string> = { logo: "Logo / bug", stage_background: "Stage background", overlay: "Overlay image", holding: "Holding / waiting", presentation_placeholder: "Presentation placeholder", broadcast_thumbnail: "Broadcast thumbnail source" };

export function RoomMediaPanel({ roomId, branding, browserSources, canEdit, refreshKey, onBranding, onChanged, onNotice }: { readonly roomId: string; readonly branding: RoomBranding; readonly browserSources: readonly BrowserSource[]; readonly canEdit: boolean; readonly refreshKey: number; readonly onBranding: (branding: RoomBranding) => void; readonly onChanged: () => Promise<void> | void; readonly onNotice: (message: string) => void }) {
  const [assets, setAssets] = useState<RoomAsset[]>([]), [filter, setFilter] = useState<RoomAssetCategory | "all">("all"), [uploadCategory, setUploadCategory] = useState<RoomAssetCategory>("logo"), [selected, setSelected] = useState(""), [status, setStatus] = useState<"loading" | "ready" | "uploading" | "error">("loading"), [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => { setStatus("loading"); setError(""); return listStudioRoomAssets(roomId).then((items) => { setAssets(items); setStatus("ready"); }).catch((cause) => { setError(cause instanceof Error ? cause.message : "Room media could not be loaded."); setStatus("error"); }); }, [roomId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setStatus("uploading"); setError("");
    try { const asset = await uploadStudioRoomAsset(roomId, file, uploadCategory); setAssets((items) => [...items, asset]); setSelected(asset.id); setStatus("ready"); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed."); setStatus("error"); }
    finally { if (inputRef.current) inputRef.current.value = ""; }
  }
  async function rename(asset: RoomAsset) {
    const name = window.prompt("Rename room asset", asset.displayName)?.trim(); if (!name || name === asset.displayName) return;
    try { const updated = await updateStudioRoomAsset(roomId, asset.id, { displayName: name }); setAssets((items) => items.map((item) => item.id === updated.id ? updated : item)); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Asset could not be renamed."); }
  }
  async function remove(asset: RoomAsset) {
    const assigned = branding.logo.assetId === asset.id || branding.stageBackground.imageAssetId === asset.id;
    if (!window.confirm(assigned ? `Delete ${asset.displayName}? It is assigned to Branding and the assignment will be cleared.` : `Delete ${asset.displayName}?`)) return;
    try { const result = await deleteStudioRoomAsset(roomId, asset.id, assigned); setAssets((items) => items.filter((item) => item.id !== asset.id)); if (result.brandingAssignmentCleared) onBranding(await loadStudioBranding(roomId)); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Asset could not be deleted."); }
  }
  async function assign(asset: RoomAsset) {
    let next: RoomBranding;
    if (asset.category === "logo") next = { ...branding, logo: { ...branding.logo, assetId: asset.id, url: asset.url } };
    else if (asset.category === "stage_background") next = { ...branding, stageBackground: { ...branding.stageBackground, mode: "image", imageAssetId: asset.id, imageUrl: asset.url } };
    else return;
    try { const canonical = await updateStudioBranding(roomId, next); onBranding(canonical); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Asset could not be assigned."); }
  }
  const visible = filter === "all" ? assets : assets.filter((asset) => asset.category === filter);
  return <div className="media-panel">
    <div className="side-panel-heading"><div><p className="eyebrow">CDN-BACKED IMAGES</p><h2>Room media</h2></div><span>{assets.length} assets</span></div>
    {error && <p className="status-banner" role="alert">{error}</p>}
    <div className="media-upload-row"><label>Upload category<select value={uploadCategory} disabled={!canEdit || status === "uploading"} onChange={(event) => setUploadCategory(event.target.value as RoomAssetCategory)}>{categories.map((category) => <option key={category} value={category}>{labels[category]}</option>)}</select></label><label className="button">Upload PNG, JPEG, or WebP<input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit || status === "uploading"} onChange={(event) => void upload(event)} /></label></div>
    {status === "uploading" && <div className="media-upload-progress" role="status"><progress /> Uploading and normalizing image…</div>}
    <label>Category filter<select value={filter} onChange={(event) => setFilter(event.target.value as RoomAssetCategory | "all")}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{labels[category]}</option>)}</select></label>
    {status === "loading" ? <p>Loading room assets…</p> : visible.length === 0 ? <EmptyState title="No room images yet"><p>Upload a PNG, JPEG, or WebP. Video and audio are not supported in this milestone.</p></EmptyState> : <div className="room-asset-grid">{visible.map((asset) => <article key={asset.id} className={selected === asset.id ? "is-selected" : ""}><button type="button" className="room-asset-grid__select" onClick={() => setSelected(asset.id)} aria-pressed={selected === asset.id}><img src={asset.url} alt="" /><span><strong>{asset.displayName}</strong><small>{asset.width} × {asset.height}</small><em>{labels[asset.category]}</em></span></button><div>{(asset.category === "logo" || asset.category === "stage_background") && <Button variant="quiet" disabled={!canEdit} onClick={() => void assign(asset)}>Assign</Button>}<Button variant="quiet" disabled={!canEdit} onClick={() => void rename(asset)}>Rename</Button><Button className="button--destructive" variant="quiet" disabled={!canEdit} onClick={() => void remove(asset)}>Delete</Button></div></article>)}</div>}
    <p className="fine-print">Runtime/Auth serializes only secure <code>https://cdn.streamsuites.app/…</code> URLs; files remain available when the room ends.</p>
    <BrowserSourcesPanel roomId={roomId} sources={browserSources} canEdit={canEdit} onChanged={onChanged} onNotice={onNotice} />
  </div>;
}
