import { useEffect, useState } from "react";
import { defaultRoomBranding, listStudioRoomAssets, updateStudioBranding } from "../../api/studioAuth";
import type { RoomAsset, RoomBranding } from "../../domain/studio";
import { Button } from "../ui/Button";

export function RoomBrandingPanel({ roomId, canonical, canEdit, refreshKey, onPreview, onCanonical }: { readonly roomId: string; readonly canonical: RoomBranding; readonly canEdit: boolean; readonly refreshKey: number; readonly onPreview: (branding: RoomBranding) => void; readonly onCanonical: (branding: RoomBranding) => void }) {
  const [draft, setDraft] = useState(canonical), [assets, setAssets] = useState<RoomAsset[]>([]), [status, setStatus] = useState<"ready" | "saving" | "loading" | "error">("loading"), [error, setError] = useState("");
  useEffect(() => { setDraft(canonical); onPreview(canonical); }, [canonical, onPreview]);
  useEffect(() => { let active = true; setStatus("loading"); listStudioRoomAssets(roomId).then((items) => { if (active) { setAssets(items); setStatus("ready"); } }).catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Room assets could not be loaded."); setStatus("error"); } }); return () => { active = false; }; }, [refreshKey, roomId]);
  const update = (next: RoomBranding) => { setDraft(next); onPreview(next); setError(""); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(canonical);
  const backgrounds = assets.filter((asset) => asset.category === "stage_background"), logos = assets.filter((asset) => asset.category === "logo");
  async function save(reset = false) {
    setStatus("saving"); setError("");
    try { const saved = await updateStudioBranding(roomId, reset ? null : draft); setDraft(saved); onPreview(saved); onCanonical(saved); setStatus("ready"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Branding could not be saved."); setStatus("error"); onPreview(canonical); }
  }
  return <div className="branding-panel">
    <div className="side-panel-heading"><div><p className="eyebrow">ROOM-LEVEL PREVIEW</p><h2>Branding</h2></div><span>{status === "saving" ? "Saving…" : dirty ? "Unsaved" : "Saved"}</span></div>
    {error && <p className="status-banner" role="alert">{error}</p>}
    <fieldset disabled={!canEdit || status === "saving"}><legend>Stage background</legend>
      <label>Mode<select value={draft.stageBackground.mode} onChange={(event) => update({ ...draft, stageBackground: { ...draft.stageBackground, mode: event.target.value as RoomBranding["stageBackground"]["mode"] } })}><option value="solid">Solid color</option><option value="gradient">Two-color gradient</option><option value="image">Uploaded image</option></select></label>
      <label>Primary color<input type="color" value={draft.stageBackground.color} onChange={(event) => update({ ...draft, stageBackground: { ...draft.stageBackground, color: event.target.value } })} /></label>
      {draft.stageBackground.mode === "gradient" && <label>Gradient color<input type="color" value={draft.stageBackground.gradientColor} onChange={(event) => update({ ...draft, stageBackground: { ...draft.stageBackground, gradientColor: event.target.value } })} /></label>}
      {draft.stageBackground.mode === "image" && <><label>Background image<select value={draft.stageBackground.imageAssetId ?? ""} onChange={(event) => { const asset = backgrounds.find((item) => item.id === event.target.value); update({ ...draft, stageBackground: { ...draft.stageBackground, imageAssetId: asset?.id ?? null, imageUrl: asset?.url ?? null } }); }}><option value="">Select a room asset</option>{backgrounds.map((asset) => <option key={asset.id} value={asset.id}>{asset.displayName}</option>)}</select></label><label>Image fit<select value={draft.stageBackground.imageFit} onChange={(event) => update({ ...draft, stageBackground: { ...draft.stageBackground, imageFit: event.target.value as "cover" | "contain" } })}><option value="cover">Cover</option><option value="contain">Contain</option></select></label><label>Image position<select value={draft.stageBackground.imagePosition} onChange={(event) => update({ ...draft, stageBackground: { ...draft.stageBackground, imagePosition: event.target.value as "center" | "top" | "bottom" } })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label></>}
    </fieldset>
    <fieldset disabled={!canEdit || status === "saving"}><legend>Logo / bug</legend>
      <label>Image<select value={draft.logo.assetId ?? ""} onChange={(event) => { const asset = logos.find((item) => item.id === event.target.value); update({ ...draft, logo: { ...draft.logo, assetId: asset?.id ?? null, url: asset?.url ?? null } }); }}><option value="">None</option>{logos.map((asset) => <option key={asset.id} value={asset.id}>{asset.displayName}</option>)}</select></label>
      <label>Position<select value={draft.logo.position} onChange={(event) => update({ ...draft, logo: { ...draft.logo, position: event.target.value as RoomBranding["logo"]["position"] } })}>{["top-left", "top-right", "bottom-left", "bottom-right"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Size<select value={draft.logo.size} onChange={(event) => update({ ...draft, logo: { ...draft.logo, size: event.target.value as RoomBranding["logo"]["size"] } })}>{["small", "medium", "large"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Opacity <output>{Math.round(draft.logo.opacity * 100)}%</output><input type="range" min="0.1" max="1" step="0.05" value={draft.logo.opacity} onChange={(event) => update({ ...draft, logo: { ...draft.logo, opacity: Number(event.target.value) } })} /></label>
    </fieldset>
    <fieldset disabled={!canEdit || status === "saving"}><legend>Participant name badge</legend>
      <div className="branding-color-grid">{(["backgroundColor", "textColor", "accentColor"] as const).map((key) => <label key={key}>{key.replace("Color", " color")}<input type="color" value={draft.nameBadge[key]} onChange={(event) => update({ ...draft, nameBadge: { ...draft.nameBadge, [key]: event.target.value } })} /></label>)}</div>
      <label>Opacity <output>{Math.round(draft.nameBadge.opacity * 100)}%</output><input type="range" min="0.2" max="1" step="0.05" value={draft.nameBadge.opacity} onChange={(event) => update({ ...draft, nameBadge: { ...draft.nameBadge, opacity: Number(event.target.value) } })} /></label>
      <label>Density<select value={draft.nameBadge.density} onChange={(event) => update({ ...draft, nameBadge: { ...draft.nameBadge, density: event.target.value as "compact" | "standard" } })}><option value="compact">Compact</option><option value="standard">Standard</option></select></label>
      <label>Shape<select value={draft.nameBadge.shape} onChange={(event) => update({ ...draft, nameBadge: { ...draft.nameBadge, shape: event.target.value as RoomBranding["nameBadge"]["shape"] } })}><option value="square">Square</option><option value="subtle-rounded">Subtle rounded</option><option value="rounded">Rounded</option></select></label>
      <label>Position<select value={draft.nameBadge.position} onChange={(event) => update({ ...draft, nameBadge: { ...draft.nameBadge, position: event.target.value as "lower-left" | "lower-right" } })}><option value="lower-left">Lower-left</option><option value="lower-right">Lower-right</option></select></label>
    </fieldset>
    <fieldset disabled={!canEdit || status === "saving"}><legend>Subtitle style</legend>
      <label>Style<select value={draft.subtitle.mode} onChange={(event) => update({ ...draft, subtitle: { ...draft.subtitle, mode: event.target.value as "inherit" | "separate" } })}><option value="inherit">Inherit name badge</option><option value="separate">Separate subtitle color</option></select></label>
      {draft.subtitle.mode === "separate" && <><label>Text color<input type="color" value={draft.subtitle.textColor} onChange={(event) => update({ ...draft, subtitle: { ...draft.subtitle, textColor: event.target.value } })} /></label><label>Opacity <output>{Math.round(draft.subtitle.opacity * 100)}%</output><input type="range" min="0.2" max="1" step="0.05" value={draft.subtitle.opacity} onChange={(event) => update({ ...draft, subtitle: { ...draft.subtitle, opacity: Number(event.target.value) } })} /></label></>}
      <p className="fine-print">Subtitles use the smaller text scale in this foundation.</p>
    </fieldset>
    <label className="check-row"><input type="checkbox" checked={draft.safeAreaVisible} disabled={!canEdit || status === "saving"} onChange={(event) => update({ ...draft, safeAreaVisible: event.target.checked })} /><span>Show Stage safe area while editing</span></label>
    <p className="fine-print">The safe-area helper is editor-only. Room Settings decides whether participant labels are visible.</p>
    <div className="branding-panel__actions"><Button disabled={!canEdit || !dirty || status === "saving"} onClick={() => void save()}>{status === "saving" ? "Saving…" : "Save branding"}</Button><Button variant="quiet" disabled={!canEdit || status === "saving"} onClick={() => { const defaults = defaultRoomBranding(); setDraft(defaults); onPreview(defaults); void save(true); }}>Reset to room defaults</Button></div>
  </div>;
}
