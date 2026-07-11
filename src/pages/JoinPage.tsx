import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { joinStudioInvite, leaveStudioGuestSession, loadStudioGuestSession, StudioApiError, validateStudioInvite } from "../api/studioAuth";
import { SiteShell } from "../components/shell/SiteShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { InviteValidation, StudioGuest } from "../domain/studio";
import { checkInviteCode } from "../lib/inviteCode";

type PageState = "validating" | "valid" | "invalid" | "revoked" | "expired" | "closed" | "ended" | "session_expired" | "unavailable" | "joining" | "guest";

function stateForError(error: unknown): PageState {
  if (!(error instanceof StudioApiError)) return "unavailable";
  if (error.code === "invite_revoked") return "revoked";
  if (error.code === "invite_expired") return "expired";
  if (error.code === "room_closed") return "closed";
  if (error.code === "room_ended") return "ended";
  if (error.code === "invite_invalid" || error.status === 404) return "invalid";
  return "unavailable";
}

const copy: Record<Exclude<PageState, "valid" | "joining" | "guest">, { chip: string; title: string; detail: string }> = {
  validating: { chip: "Validating invite", title: "Checking room authority…", detail: "Runtime/Auth is validating this room-scoped invitation." },
  invalid: { chip: "Invalid invite", title: "This invitation is not valid.", detail: "Ask the host for a newly created room invitation." },
  revoked: { chip: "Invite revoked", title: "This invitation is no longer active.", detail: "The host revoked this link. It cannot be recovered or reused." },
  expired: { chip: "Invite expired", title: "This invitation has expired.", detail: "Ask the host to create a replacement invitation." },
  closed: { chip: "Room closed", title: "Guest entry is currently closed.", detail: "The room exists, but the host is not accepting new lobby entry." },
  ended: { chip: "Room ended", title: "This room has ended.", detail: "Ended rooms cannot accept new guests or restore guest authority." },
  session_expired: { chip: "Session expired", title: "Your temporary guest session is no longer active.", detail: "Return to the original invitation link to validate current room entry again." },
  unavailable: { chip: "Service unavailable", title: "The invitation cannot be checked.", detail: "Runtime/Auth is unavailable. No guest authority has been granted." },
};

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const checked = checkInviteCode(inviteCode);
  const [state, setState] = useState<PageState>(checked.isSafeFormat ? "validating" : "invalid");
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [guest, setGuest] = useState<StudioGuest | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  const validate = useCallback(async () => {
    if (!checked.isSafeFormat) { setState("invalid"); return; }
    setState("validating"); setMessage("");
    try { const result = await validateStudioInvite(checked.normalized); setValidation(result); setState("valid"); }
    catch (error) { setState(stateForError(error)); setMessage(error instanceof Error ? error.message : "Invite validation failed."); }
  }, [checked.isSafeFormat, checked.normalized]);

  useEffect(() => { void validate(); }, [validate]);

  async function join(event: FormEvent) {
    event.preventDefault(); if (!displayName.trim() || state === "joining") return; setState("joining"); setMessage("");
    try { const joined = await joinStudioInvite(checked.normalized, displayName); setGuest(joined); setState("guest"); }
    catch (error) { setState(stateForError(error)); setMessage(error instanceof Error ? error.message : "Guest entry failed."); }
  }

  async function refreshGuest() {
    setMessage("");
    try { const current = await loadStudioGuestSession(); setGuest(current); setState("guest"); }
    catch (error) { setGuest(null); setState(error instanceof StudioApiError && error.code === "guest_session_not_found" ? "session_expired" : "unavailable"); setMessage(error instanceof Error ? error.message : "Guest session could not be refreshed."); }
  }

  async function leave() {
    try { const left = await leaveStudioGuestSession(); setGuest(left); setMessage("You left the room. The temporary guest cookie has been cleared."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The guest session could not be left cleanly."); }
  }

  if (state === "guest" && guest) {
    const stateCopy = {
      waiting: ["Waiting in lobby", "The host can now admit or deny this temporary guest identity."],
      admitted: ["Admission granted", "You have room authority, but camera, microphone, and media are not connected."],
      denied: ["Entry denied", "The host denied this lobby request. Admission will not retry automatically."],
      removed: ["Removed from room", "The host removed this temporary guest authority. It will not retry automatically."],
      left: ["You left the room", "This temporary room session is no longer active."],
      expired: ["Session expired", "This temporary guest session or room has ended."],
    }[guest.state];
    return <SiteShell><section className="centered-page page-width"><Card className="access-card join-card"><StatusChip tone={guest.state === "admitted" ? "alpha" : ["denied", "removed", "expired"].includes(guest.state) ? "blocked" : "pending"}>{stateCopy[0]}</StatusChip><p className="eyebrow">{guest.room?.title ?? validation?.room.title ?? "Studio room"}</p><h1>{stateCopy[0]}</h1><p className="access-card__lede">{stateCopy[1]}</p><dl className="safe-room-summary"><div><dt>Guest</dt><dd>{guest.displayName}</dd></div><div><dt>Authority state</dt><dd>{guest.state}</dd></div><div><dt>Media</dt><dd>Not connected</dd></div></dl>{message && <p role="status" aria-live="polite">{message}</p>}<div className="access-actions">{["waiting", "admitted"].includes(guest.state) && <Button onClick={() => void refreshGuest()}>Refresh room state</Button>}{["waiting", "admitted"].includes(guest.state) && <Button variant="secondary" onClick={() => void leave()}>Leave room</Button>}<ButtonLink to="/" variant="quiet">Studio home</ButtonLink></div></Card></section></SiteShell>;
  }

  if (state !== "valid" && state !== "joining") {
    const detail = state in copy ? copy[state as keyof typeof copy] : copy.unavailable;
    return <SiteShell><section className="centered-page page-width"><Card className="access-card join-card"><StatusChip tone={state === "validating" ? "pending" : "blocked"}>{detail.chip}</StatusChip><p className="eyebrow">Guest invitation</p><h1>{detail.title}</h1><p className="access-card__lede">{detail.detail}</p>{message && <p className="fine-print">{message}</p>}<div className="access-actions">{["unavailable", "closed"].includes(state) && <Button onClick={() => void validate()}>Try again</Button>}<ButtonLink to="/" variant="quiet">Studio home</ButtonLink></div></Card></section></SiteShell>;
  }

  return <SiteShell><section className="centered-page page-width"><Card className="access-card join-card"><StatusChip tone="alpha">Valid room invite</StatusChip><p className="eyebrow">Temporary guest entry</p><h1>{validation?.room.title ?? "Studio room"}</h1>{validation?.room.description && <p className="access-card__lede">{validation.room.description}</p>}<p>Enter a display name to create a temporary identity scoped only to this room. No StreamSuites account is required or created.</p><form className="stack-form" onSubmit={join}><FormField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={1} maxLength={60} autoComplete="name" disabled={state === "joining"} hint="Runtime/Auth normalizes this name and places you in the lobby. Joining does not admit you." /><Button type="submit" disabled={!displayName.trim() || state === "joining"}>{state === "joining" ? "Joining lobby…" : "Join lobby"}</Button></form><p className="fine-print">Your signed-in StreamSuites session, if present, remains unchanged. Guest authority uses a separate secure HttpOnly cookie and is never stored in browser storage.</p></Card></section></SiteShell>;
}
