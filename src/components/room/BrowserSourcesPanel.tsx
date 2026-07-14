import { useEffect, useState, type FormEvent } from "react";
import { createStudioBrowserSource, deleteStudioBrowserSource, duplicateStudioBrowserSource, moveStudioBrowserSource, refreshStudioBrowserSource, updateStudioBrowserSource, validateBrowserSourceUrl } from "../../api/studioAuth";
import type { BrowserSource, BrowserSourceVisibility } from "../../domain/studio";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

const defaults = { displayName: "", url: "", viewportWidth: 1920, viewportHeight: 1080, visibilityScope: "production_only" as BrowserSourceVisibility, refreshOnActivation: false, interactive: false };

export function BrowserSourcesPanel({ roomId, sources, canEdit, onChanged, onNotice }: { readonly roomId: string; readonly sources: readonly BrowserSource[]; readonly canEdit: boolean; readonly onChanged: () => Promise<void> | void; readonly onNotice: (message: string) => void }) {
  const [form, setForm] = useState(defaults), [editingId, setEditingId] = useState(""), [busy, setBusy] = useState(""), [urlError, setUrlError] = useState("");
  useEffect(() => { if (editingId && !sources.some((source) => source.id === editingId)) { setEditingId(""); setForm(defaults); } }, [editingId, sources]);
  function edit(source: BrowserSource) { if (!source.url) return; setEditingId(source.id); setForm({ displayName: source.displayName, url: source.url, viewportWidth: source.viewportWidth, viewportHeight: source.viewportHeight, visibilityScope: source.visibilityScope, refreshOnActivation: source.refreshOnActivation, interactive: source.interactive }); setUrlError(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); const invalid = validateBrowserSourceUrl(form.url); setUrlError(invalid ?? ""); if (invalid) return;
    setBusy(editingId || "create");
    try { if (editingId) await updateStudioBrowserSource(roomId, editingId, form); else await createStudioBrowserSource(roomId, form); setEditingId(""); setForm(defaults); await onChanged(); onNotice(editingId ? "Browser source updated from canonical Runtime/Auth state." : "Browser source created Backstage."); }
    catch (cause) { onNotice(cause instanceof Error ? cause.message : "Browser source could not be saved."); }
    finally { setBusy(""); }
  }
  async function action(source: BrowserSource, kind: "duplicate" | "refresh" | "disable" | "enable" | "delete") {
    if (kind === "delete" && !window.confirm(`Delete ${source.displayName}? This removes it from Stage and Backstage.`)) return;
    setBusy(`${kind}:${source.id}`);
    try {
      if (kind === "duplicate") await duplicateStudioBrowserSource(roomId, source.id);
      else if (kind === "refresh") await refreshStudioBrowserSource(roomId, source.id);
      else if (kind === "delete") await deleteStudioBrowserSource(roomId, source.id);
      else await moveStudioBrowserSource(roomId, source.id, kind === "disable" ? "disabled" : "backstage");
      await onChanged(); onNotice(kind === "delete" ? "Browser source deleted." : kind === "disable" ? "Browser source disabled and deactivated." : kind === "enable" ? "Browser source enabled Backstage." : `Browser source ${kind} complete.`);
    } catch (cause) { onNotice(cause instanceof Error ? cause.message : `Browser source ${kind} failed.`); }
    finally { setBusy(""); }
  }
  return <section className="browser-source-library" aria-labelledby="browser-sources-heading">
    <div className="side-panel-heading"><div><p className="eyebrow">SANDBOXED IFRAMES</p><h2 id="browser-sources-heading">Browser Sources</h2></div><span>{sources.length} sources</span></div>
    {canEdit && <form className="stack-form browser-source-form" onSubmit={(event) => void save(event)}>
      <label>Display name<input required maxLength={120} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label>HTTPS source URL<input required type="url" value={form.url} aria-invalid={Boolean(urlError)} aria-describedby={urlError ? "browser-source-url-error" : undefined} onChange={(event) => { setForm({ ...form, url: event.target.value }); setUrlError(""); }} /></label>
      {urlError && <small id="browser-source-url-error" className="field-error" role="alert">{urlError}</small>}
      <div className="browser-source-form__dimensions"><label>Viewport width<input type="number" min={320} max={7680} value={form.viewportWidth} onChange={(event) => setForm({ ...form, viewportWidth: Number(event.target.value) })} /></label><label>Viewport height<input type="number" min={320} max={7680} value={form.viewportHeight} onChange={(event) => setForm({ ...form, viewportHeight: Number(event.target.value) })} /></label></div>
      <label>Visibility<select value={form.visibilityScope} onChange={(event) => setForm({ ...form, visibilityScope: event.target.value as BrowserSourceVisibility })}><option value="production_only">Production only</option><option value="room">Room participants</option></select></label>
      {form.visibilityScope === "room" && <p className="browser-source-warning">The full URL will be shared with current room participants. Never include credentials or private tokens.</p>}
      <label className="check-row"><input type="checkbox" checked={form.refreshOnActivation} onChange={(event) => setForm({ ...form, refreshOnActivation: event.target.checked })} /><span>Refresh when moved to Stage</span></label>
      <label className="check-row"><input type="checkbox" checked={form.interactive} onChange={(event) => setForm({ ...form, interactive: event.target.checked })} /><span>Allow an authorized operator to enter interaction mode</span></label>
      <div className="browser-source-form__actions"><Button type="submit" disabled={Boolean(busy) || !form.displayName.trim() || !form.url.trim()}>{busy === (editingId || "create") ? "Saving…" : editingId ? "Save source" : "Create browser source"}</Button>{editingId && <Button variant="quiet" type="button" onClick={() => { setEditingId(""); setForm(defaults); setUrlError(""); }}>Cancel edit</Button>}</div>
    </form>}
    {sources.length === 0 ? <EmptyState title="No browser sources"><p>Create a source to place it Backstage first. Browser sources remain separate from image assets.</p></EmptyState> : <div className="browser-source-list">{sources.map((source) => <article key={source.id} className={source.location === "disabled" ? "is-disabled" : ""}><div><strong>{source.displayName}</strong><small>Browser source · {source.safeHost ?? "Restricted URL"}</small><span>{source.location === "on_stage" ? "On Stage" : source.location === "disabled" ? "Disabled" : "Backstage"} · {source.visibilityScope === "room" ? "Room visible" : "Production only"}</span></div><p>Embedding may be blocked by the provider's frame policy. Studio does not bypass X-Frame-Options, CSP, or sign-in walls.</p><div className="browser-source-list__actions">{source.url && <Button variant="quiet" type="button" onClick={() => window.open(source.url!, "_blank", "noopener,noreferrer")}>Open source</Button>}<Button variant="quiet" disabled={!canEdit || Boolean(busy) || !source.url} onClick={() => edit(source)}>Edit</Button><Button variant="quiet" disabled={!canEdit || Boolean(busy)} onClick={() => void action(source, "duplicate")}>Duplicate</Button><Button variant="quiet" disabled={!canEdit || Boolean(busy) || source.location === "disabled"} onClick={() => void action(source, "refresh")}>Refresh</Button><Button variant="quiet" disabled={!canEdit || Boolean(busy)} onClick={() => void action(source, source.location === "disabled" ? "enable" : "disable")}>{source.location === "disabled" ? "Enable" : "Disable"}</Button><Button className="button--destructive" variant="quiet" disabled={!canEdit || Boolean(busy)} onClick={() => void action(source, "delete")}>{busy === `delete:${source.id}` ? "Deleting…" : "Delete"}</Button></div></article>)}</div>}
    <p className="fine-print">Strict sandbox: scripts only; no forms, same-origin privilege, popups, downloads, top navigation, media devices, autoplay audio, or referrer. Runtime/Auth never fetches or proxies source pages.</p>
  </section>;
}
