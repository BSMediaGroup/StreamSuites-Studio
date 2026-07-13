import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { connectStudioEvents, joinStudioInvite, leaveStudioGuestSession, listCohostRelationships, loadStudioGuestSession, removeStudioGuestAvatar, respondCohostInvitation, StudioApiError, updateStudioGuestProfile, uploadStudioGuestAvatar, validateStudioInvite } from "../api/studioAuth";
import { SiteShell } from "../components/shell/SiteShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import type { CohostRelationship, InviteValidation, RoomConnectionState, StudioGuest } from "../domain/studio";
import { checkInviteCode } from "../lib/inviteCode";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import { useStudioAuth } from "../auth/studioAuthContext";
import { InitialsColorPicker } from "../components/InitialsColorPicker";
import { LoginPage } from "./LoginPage";

const INVITE_DRAFT_KEY = "streamsuites.studio.invite-draft.v1";
const INVITE_DRAFT_MAX_AGE_MS = 15 * 60 * 1000;
type InviteDirtyFields = { displayName: boolean; subtitle: boolean; avatarColor: boolean; avatar: boolean };
const cleanInviteFields = (): InviteDirtyFields => ({ displayName: false, subtitle: false, avatarColor: false, avatar: false });

type PageState = "validating" | "valid" | "invalid" | "revoked" | "expired" | "exhausted" | "closed" | "ended" | "session_expired" | "unavailable" | "joining" | "guest";

function stateForError(error: unknown): PageState {
  if (!(error instanceof StudioApiError)) return "unavailable";
  if (error.code === "invite_revoked") return "revoked";
  if (error.code === "invite_expired") return "expired";
  if (error.code === "invite_exhausted") return "exhausted";
  if (error.code === "room_closed") return "closed";
  if (error.code === "room_ended") return "ended";
  if (error.code === "invite_invalid" || error.status === 404) return "invalid";
  return "unavailable";
}

const copy: Record<Exclude<PageState, "valid" | "joining" | "guest">, { chip: string; title: string; detail: string }> = {
  validating: {
    chip: "Validating invite",
    title: "Checking room authority…",
    detail: "Runtime/Auth is validating this room-scoped invitation.",
  },
  invalid: {
    chip: "Invalid invite",
    title: "This invitation is not valid.",
    detail: "Ask the host for a newly created room invitation.",
  },
  revoked: {
    chip: "Invite revoked",
    title: "This invitation is no longer active.",
    detail: "The host revoked this link. It cannot be recovered or reused.",
  },
  expired: {
    chip: "Invite expired",
    title: "This invitation has expired.",
    detail: "Ask the host to create a replacement invitation.",
  },
  exhausted: {
    chip: "Invite exhausted",
    title: "This invitation has reached its entrant limit.",
    detail: "Ask the host for another invitation.",
  },
  closed: {
    chip: "Room closed",
    title: "Guest entry is currently closed.",
    detail: "The room exists, but the host is not accepting new lobby entry.",
  },
  ended: {
    chip: "Room ended",
    title: "This room has ended.",
    detail: "Ended rooms cannot accept new guests or restore guest authority.",
  },
  session_expired: {
    chip: "Session expired",
    title: "Your temporary guest session is no longer active.",
    detail: "Return to the original invitation link to validate current room entry again.",
  },
  unavailable: {
    chip: "Service unavailable",
    title: "The invitation cannot be checked.",
    detail: "Runtime/Auth is unavailable. No guest authority has been granted.",
  },
};

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const checked = checkInviteCode(inviteCode);
  const navigate = useNavigate();
  const { access } = useStudioAuth();
  const [state, setState] = useState<PageState>(checked.isSafeFormat ? "validating" : "invalid");
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [guest, setGuest] = useState<StudioGuest | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [avatarColor, setAvatarColor] = useState("blue");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarNeedsReselect, setAvatarNeedsReselect] = useState(false);
  const [connection, setConnection] = useState<RoomConnectionState>("unavailable");
  const [cohostInvitations, setCohostInvitations] = useState<CohostRelationship[]>([]);
  const [message, setMessage] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  useGlobalActivity(state === "validating" || state === "joining" || guestBusy, "Resolving guest access");
  const profileHeadingRef = useRef<HTMLHeadingElement>(null);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);
  const loginDialogRef = useRef<HTMLDivElement>(null);
  const dirtyFieldsRef = useRef<InviteDirtyFields>(cleanInviteFields());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(INVITE_DRAFT_KEY);
      sessionStorage.removeItem(INVITE_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > INVITE_DRAFT_MAX_AGE_MS) return;
      const restoredDirty = cleanInviteFields();
      if (draft.dirtyFields && typeof draft.dirtyFields === "object") {
        const dirty = draft.dirtyFields as Record<string, unknown>;
        restoredDirty.displayName = dirty.displayName === true;
        restoredDirty.subtitle = dirty.subtitle === true;
        restoredDirty.avatarColor = dirty.avatarColor === true;
        restoredDirty.avatar = dirty.avatar === true;
      }
      dirtyFieldsRef.current = restoredDirty;
      if (typeof draft.displayName === "string") setDisplayName(draft.displayName.slice(0, 60));
      if (typeof draft.subtitle === "string") setSubtitle(draft.subtitle.slice(0, 100));
      if (typeof draft.avatarColor === "string" && ["blue", "violet", "teal", "amber", "rose", "slate"].includes(draft.avatarColor)) setAvatarColor(draft.avatarColor);
      setAvatarNeedsReselect(restoredDirty.avatar && draft.avatarSelected === true);
    } catch {
      sessionStorage.removeItem(INVITE_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const account = access.account;
    if (!account) return;
    if (!dirtyFieldsRef.current.displayName) setDisplayName(account.displayName || account.userCode || "");
  }, [access.account]);

  useEffect(() => {
    if (!loginOpen) return;
    const dialog = loginDialogRef.current;
    const trigger = loginTriggerRef.current;
    window.setTimeout(() => dialog?.querySelector<HTMLElement>('input,button')?.focus(), 0);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setLoginOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])') ?? []);
      if (!items.length) return;
      const first = items[0], last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); window.setTimeout(() => trigger?.focus(), 0); };
  }, [loginOpen]);

  function persistOAuthDraft() {
    sessionStorage.setItem(INVITE_DRAFT_KEY, JSON.stringify({
      savedAt: Date.now(),
      displayName: displayName.slice(0, 60),
      subtitle: subtitle.slice(0, 100),
      avatarColor,
      dirtyFields: dirtyFieldsRef.current,
      avatarSelected: Boolean(avatarFile) || avatarNeedsReselect,
    }));
  }

  const markDirty = (field: keyof InviteDirtyFields) => { dirtyFieldsRef.current[field] = true; };

  const useAccountDetails = useCallback(() => {
    const account = access.account;
    if (!account) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    dirtyFieldsRef.current.displayName = false;
    dirtyFieldsRef.current.avatar = false;
    setDisplayName(account.displayName || account.userCode || "");
    setAvatarFile(null);
    setAvatarPreview("");
    setAvatarNeedsReselect(false);
  }, [access.account, avatarPreview]);

  const closeAuthenticatedLogin = useCallback(() => setLoginOpen(false), []);

  const validate = useCallback(async () => {
    if (!checked.isSafeFormat) {
      setState("invalid");
      return;
    }
    setState("validating");
    setMessage("");
    try {
      const result = await validateStudioInvite(checked.normalized);
      setValidation(result);
      setState("valid");
    } catch (error) {
      setState(stateForError(error));
      setMessage(error instanceof Error ? error.message : "Invite validation failed.");
    }
  }, [checked.isSafeFormat, checked.normalized]);

  useEffect(() => {
    void validate();
  }, [validate]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || state === "joining") return;
    setState("joining");
    setMessage("");
    try {
      let joined = await joinStudioInvite(checked.normalized, {
        displayName,
        subtitle,
        avatarColor,
      });
      if (avatarFile) joined = await uploadStudioGuestAvatar(avatarFile);
      setGuest(joined);
      setState("guest");
      navigate(`/studio/rooms/${encodeURIComponent(joined.roomId)}`, { replace: true });
    } catch (error) {
      setState(stateForError(error));
      setMessage(error instanceof Error ? error.message : "Guest entry failed.");
    }
  }

  const liveGuestId = guest?.id;
  const liveGuestState = guest?.state;
  useEffect(() => {
    if (state !== "guest" || !liveGuestId || !liveGuestState || !["backstage", "on_stage"].includes(liveGuestState)) return;
    const handle = connectStudioEvents({
      guest: true,
      onState: setConnection,
      onEvent: () => void refreshGuest(),
    });
    return () => handle.close();
  }, [state, liveGuestId, liveGuestState]);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
    dirtyFieldsRef.current.avatar = Boolean(file);
    setAvatarNeedsReselect(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!guest || guestBusy || !displayName.trim()) return;
    setGuestBusy(true);
    try {
      let updated = await updateStudioGuestProfile({
        displayName,
        subtitle,
        avatarColor,
      });
      if (avatarFile) updated = await uploadStudioGuestAvatar(avatarFile);
      setGuest(updated);
      setMessage("Room-scoped guest identity updated.");
      profileHeadingRef.current?.focus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guest profile could not be updated.");
    } finally {
      setGuestBusy(false);
    }
  }

  async function removeAvatar() {
    setGuestBusy(true);
    try {
      const updated = await removeStudioGuestAvatar();
      setGuest(updated);
      setAvatarFile(null);
      setAvatarPreview("");
      setMessage("Fallback avatar removed; initials are active.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fallback avatar could not be removed.");
    } finally {
      setGuestBusy(false);
    }
  }

  async function respondCohost(id: string, response: "accept" | "decline") {
    setGuestBusy(true);
    try {
      await respondCohostInvitation(id, response);
      setCohostInvitations(await listCohostRelationships(true));
      setMessage(`Permanent cohost invitation ${response === "accept" ? "accepted" : "declined"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cohost invitation could not be updated.");
    } finally {
      setGuestBusy(false);
    }
  }
  async function refreshGuest() {
    setGuestBusy(true);
    setMessage("");
    try {
      const current = await loadStudioGuestSession();
      setGuest(current);
      setState("guest");
      if (current.signedIn) setCohostInvitations(await listCohostRelationships(true));
    } catch (error) {
      setGuest(null);
      setState(error instanceof StudioApiError && error.code === "guest_session_not_found" ? "session_expired" : "unavailable");
      setMessage(error instanceof Error ? error.message : "Guest session could not be refreshed.");
    } finally {
      setGuestBusy(false);
    }
  }

  async function leave() {
    setGuestBusy(true);
    try {
      const left = await leaveStudioGuestSession();
      setGuest(left);
      setMessage("You left the room. The temporary guest cookie has been cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The guest session could not be left cleanly.");
    } finally {
      setGuestBusy(false);
    }
  }

  const embeddedLogin = loginOpen ? (
    <div className="auth-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
      <div ref={loginDialogRef} className="auth-sheet" role="dialog" aria-modal="true" aria-labelledby="invite-login-title">
        <div className="auth-sheet__header">
          <div><p className="eyebrow">Invitation stays open</p><h2 id="invite-login-title">Sign in with StreamSuites</h2></div>
          <Button variant="quiet" aria-label="Close sign in" onClick={() => setLoginOpen(false)}>×</Button>
        </div>
        <LoginPage embedded returnTo={`/join/${checked.normalized}`} onOAuthStart={persistOAuthDraft} onAuthenticated={closeAuthenticatedLogin} />
      </div>
    </div>
  ) : null;

  if (state === "guest" && guest) {
    const stateCopy = {
      backstage: ["Waiting Backstage", "You can watch the Stage while the director decides when to bring you on."],
      on_stage: ["On Stage", "Your intended controls are ready, but camera, microphone, and media are not connected."],
      denied: ["Entry denied", "The host denied this lobby request. Admission will not retry automatically."],
      removed: ["Removed from room", "The host removed this temporary guest authority. It will not retry automatically."],
      left: ["You left the room", "This temporary room session is no longer active."],
      expired: ["Session expired", "This temporary guest session or room has ended."],
    }[guest.state];
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card className="access-card join-card">
            <div className="join-status-row">
              <StatusChip tone={guest.state === "on_stage" ? "alpha" : ["denied", "removed", "expired"].includes(guest.state) ? "blocked" : "pending"}>{stateCopy[0]}</StatusChip>
              <span className={`connection-state connection-state--${connection.replace(" ", "-")}`}>{connection}</span>
            </div>
            <p className="eyebrow">{guest.room?.title ?? validation?.room.title ?? "Studio room"}</p>
            <h1>{stateCopy[0]}</h1>
            <p className="access-card__lede">{stateCopy[1]}</p>
            <dl className="safe-room-summary">
              <div>
                <dt>Guest</dt>
                <dd>{guest.displayName}</dd>
              </div>
              <div>
                <dt>Authority state</dt>
                <dd>{guest.state}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>Not connected</dd>
              </div>
            </dl>
            {["backstage", "on_stage"].includes(guest.state) && (
              <form className="stack-form guest-profile-editor" onSubmit={saveProfile}>
                <h2 ref={profileHeadingRef} tabIndex={-1}>
                  Room identity
                </h2>
                <FormField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
                <FormField label="Subtitle (optional)" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={100} />
                <InitialsColorPicker value={avatarColor} onChange={setAvatarColor} disabled={guestBusy} />
                <label className="field">
                  <span className="field__label">Fallback avatar (PNG, JPEG, or WebP)</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} />
                </label>
                {(avatarPreview || guest.avatarUrl) && (
                  <div className="guest-avatar-preview">
                    <img src={avatarPreview || guest.avatarUrl || ""} alt="Fallback avatar preview" crossOrigin="use-credentials" />
                    <Button type="button" variant="quiet" onClick={() => void removeAvatar()}>
                      Remove avatar
                    </Button>
                  </div>
                )}
                <Button type="submit" disabled={guestBusy || !displayName.trim()}>
                  Save room identity
                </Button>
              </form>
            )}
            {message && (
              <p role="status" aria-live="polite">
                {message}
              </p>
            )}
            {guest.pendingPermanentCohost && !guest.signedIn && (
              <section className="cohost-invitation">
                <StatusChip tone="pending">Permanent cohost invitation</StatusChip>
                <h2>Sign in to accept permanent cohost authority</h2>
                <p>Your pending invitation is bound to this secure room guest session, not to your display name.</p>
                <ButtonLink variant="secondary" to={`/login?return_to=${encodeURIComponent(`/join/${checked.normalized}`)}`}>Sign in with StreamSuites</ButtonLink>
              </section>
            )}
            {cohostInvitations.map((invitation) => (
              <section className="cohost-invitation" key={invitation.id}>
                <StatusChip tone="pending">Permanent cohost invitation</StatusChip>
                <h2>{invitation.director?.displayName ?? "A director"} invited you to cohost</h2>
                <p>{invitation.scopeType === "all_rooms" ? "All current and future rooms" : `${invitation.roomIds.length} selected room${invitation.roomIds.length === 1 ? "" : "s"}`}.</p>
                <div className="access-actions">
                  <Button disabled={guestBusy} onClick={() => void respondCohost(invitation.id, "accept")}>
                    Accept
                  </Button>
                  <Button variant="quiet" disabled={guestBusy} onClick={() => void respondCohost(invitation.id, "decline")}>
                    Decline
                  </Button>
                </div>
              </section>
            ))}
            <div className="access-actions">
              {["backstage", "on_stage"].includes(guest.state) && <Button onClick={() => void refreshGuest()}>Refresh room state</Button>}
              {["backstage", "on_stage"].includes(guest.state) && (
                <Button variant="secondary" onClick={() => void leave()}>
                  Leave room
                </Button>
              )}
              <ButtonLink to="/" variant="quiet">
                Studio home
              </ButtonLink>
            </div>
          </Card>
        </section>
      </SiteShell>
    );
  }

  if (state !== "valid" && state !== "joining") {
    const detail = state in copy ? copy[state as keyof typeof copy] : copy.unavailable;
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card className="access-card join-card">
            <StatusChip tone={state === "validating" ? "pending" : "blocked"}>{detail.chip}</StatusChip>
            <p className="eyebrow">Guest invitation</p>
            <h1>{detail.title}</h1>
            <p className="access-card__lede">{detail.detail}</p>
            {message && <p className="fine-print">{message}</p>}
            <div className="access-actions">
              {["unavailable", "closed"].includes(state) && <Button onClick={() => void validate()}>Try again</Button>}
              <ButtonLink to="/" variant="quiet">
                Studio home
              </ButtonLink>
            </div>
          </Card>
        </section>
      </SiteShell>
    );
  }

  const policy = validation?.invite.policyType === "single_use" ? "Single use" : validation?.invite.policyType === "capped" ? `Capped at ${validation.invite.maxUses} entrants` : "Open invite";
  return (
    <SiteShell>
      <section className="centered-page page-width">
        <Card className="access-card join-card">
          <StatusChip tone="alpha">Valid room invite</StatusChip>
          <p className="eyebrow">Guest entry · Account optional</p>
          <h1>{validation?.room.title ?? "Studio room"}</h1>
          {validation?.director && (
            <p>
              Hosted by <strong>{validation.director.displayName}</strong>
            </p>
          )}
          {validation?.room.description && <p className="access-card__lede">{validation.room.description}</p>}
          <div className="invite-policy-summary">
            <strong>{policy}</strong>
            <span>{validation?.invite.permanent ? "No expiry" : `Expires ${validation?.expiresAt ? new Date(validation.expiresAt).toLocaleString() : "after 24 hours"}`}</span>
          </div>
          <p>Join fully as a guest, or sign in first and return to this same invite. Signing in alone does not consume an entrant use.</p>
          {access.account && (
            <div className="linked-account-state" role="status" aria-label="Linked StreamSuites account">
              {access.account.avatarUrl ? <img src={access.account.avatarUrl} alt="" /> : <span aria-hidden="true">{(access.account.displayName || access.account.userCode || "S").charAt(0).toUpperCase()}</span>}
              <div><strong>Linked StreamSuites account</strong><small>{access.account.displayName || "StreamSuites account"}{access.account.userCode ? ` · ${access.account.userCode}` : ""}</small></div>
              <Button type="button" variant="quiet" onClick={useAccountDetails}>Use account details</Button>
            </div>
          )}
          <form className="stack-form" onSubmit={join}>
            <FormField label="Display name" value={displayName} onChange={(event) => { markDirty("displayName"); setDisplayName(event.target.value); }} minLength={1} maxLength={60} autoComplete="name" disabled={state === "joining"} hint="Runtime/Auth normalizes this room-scoped name. Joining does not admit you." />
            <FormField label="Subtitle (optional)" value={subtitle} onChange={(event) => { markDirty("subtitle"); setSubtitle(event.target.value); }} maxLength={100} disabled={state === "joining"} />
            <InitialsColorPicker value={avatarColor} onChange={(value) => { markDirty("avatarColor"); setAvatarColor(value); }} disabled={state === "joining"} />
            <label className="field">
              <span className="field__label">Fallback avatar (optional)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={state === "joining"} />
            </label>
            {(avatarPreview || (!dirtyFieldsRef.current.avatar && access.account?.avatarUrl)) && (
              <div className="guest-avatar-preview">
                <img src={avatarPreview || access.account?.avatarUrl || ""} alt="Fallback avatar preview" />
              </div>
            )}
            {avatarNeedsReselect && <p className="fine-print" role="status">For privacy, the pre-login avatar file was not stored. Select it again to use that room-scoped override.</p>}
            <Button type="submit" disabled={!displayName.trim() || state === "joining"}>
              {state === "joining" ? "Joining lobby…" : access.account ? "Join as linked participant" : "Join as guest"}
            </Button>
            {!access.account && <button ref={loginTriggerRef} type="button" className="button button--secondary" onClick={() => setLoginOpen(true)}>Sign in with StreamSuites</button>}
          </form>
          <p className="fine-print">An account is optional. Guest authority uses a separate secure HttpOnly cookie; the invite code, credential, avatar binary, and cohost authority are never persisted in browser storage.</p>
        </Card>
        {embeddedLogin}
      </section>
    </SiteShell>
  );
}
