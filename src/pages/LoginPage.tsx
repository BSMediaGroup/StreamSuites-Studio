import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  buildOAuthLoginUrl,
  loginWithPassword,
  safeStudioReturnPath,
  type OAuthProvider,
} from "../api/studioAuth";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import {
  TurnstileWidget,
  type TurnstileState,
  type TurnstileWidgetHandle,
} from "../components/TurnstileWidget";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import { useTheme } from "../theme/themeContext";
import { useGlobalActivity } from "../activity/useGlobalActivity";
import googleIcon from "../../assets/icons/google.svg";
import githubIcon from "../../assets/icons/github.svg";
import discordIcon from "../../assets/icons/discord.svg";
import xIcon from "../../assets/icons/x.svg";
import twitchIcon from "../../assets/icons/twitch.svg";

const oauthProviders: readonly { id: OAuthProvider; label: string; icon: string }[] = [
  { id: "google", label: "Google", icon: googleIcon },
  { id: "github", label: "GitHub", icon: githubIcon },
  { id: "discord", label: "Discord", icon: discordIcon },
  { id: "x", label: "X", icon: xIcon },
  { id: "twitch", label: "Twitch", icon: twitchIcon },
];

interface LoginPageProps {
  readonly embedded?: boolean;
  readonly returnTo?: string;
  readonly onAuthenticated?: () => void;
  readonly onOAuthStart?: () => void;
}

export function LoginPage({ embedded = false, returnTo, onAuthenticated, onOAuthStart }: LoginPageProps = {}) {
  const { access, authGate, refresh, refreshAuthGate, unlockAuthGate, logout } = useStudioAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [bypassCode, setBypassCode] = useState("");
  const [bypassSubmitting, setBypassSubmitting] = useState(false);
  const [bypassFeedback, setBypassFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<{ code: string; message: string } | null>(null);
  const [turnstile, setTurnstile] = useState<TurnstileState>({
    enabled: null,
    token: "",
    phase: "loading",
  });
  useGlobalActivity(submitting || oauthSubmitting || bypassSubmitting, "Completing sign-in");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const returnPath = useMemo(
    () => safeStudioReturnPath(returnTo ?? searchParams.get("return_to")),
    [returnTo, searchParams],
  );

  useEffect(() => {
    if (embedded && access.account) onAuthenticated?.();
    else if (!embedded && access.status === "allowed") navigate(returnPath, { replace: true });
  }, [access.account, access.status, embedded, navigate, onAuthenticated, returnPath]);

  const handleTurnstileState = useCallback((next: TurnstileState) => {
    setTurnstile(next);
    if (next.phase === "ready") {
      setFormError((current) =>
        current?.code.startsWith("turnstile_") ? null : current,
      );
    }
  }, []);

  const challengeReady =
    turnstile.enabled === false || (turnstile.enabled === true && Boolean(turnstile.token));
  const fieldsReady = Boolean(email.trim() && password);
  const gateActive = authGate.mode === "maintenance" || authGate.mode === "development";
  const gateBlocked = authGate.status !== "ready" || (gateActive && !authGate.bypassUnlocked);

  async function handleBypassUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = bypassCode.trim();
    if (!code || bypassSubmitting) {
      if (!code) setBypassFeedback({ tone: "error", message: "Enter the access code." });
      return;
    }
    setBypassSubmitting(true);
    setBypassFeedback(null);
    const result = await unlockAuthGate(code);
    setBypassSubmitting(false);
    if (!result.ok) {
      setBypassFeedback({ tone: "error", message: result.error.message });
      return;
    }
    setBypassCode("");
    setBypassFeedback({ tone: "success", message: "Access unlocked. Continue with login." });
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || gateBlocked || !fieldsReady || !challengeReady) return;
    setSubmitting(true);
    setFormError(null);
    const result = await loginWithPassword(email, password, turnstile.token);
    if (!result.ok) {
      setFormError({ code: result.error.code, message: result.error.message });
      turnstileRef.current?.reset();
      setSubmitting(false);
      return;
    }
    await refresh();
    setSubmitting(false);
  }

  function handleOAuthLogin(provider: OAuthProvider) {
    if (oauthSubmitting || gateBlocked || !challengeReady) return;
    setOauthSubmitting(true);
    setFormError(null);
    onOAuthStart?.();
    window.location.assign(buildOAuthLoginUrl(provider, returnPath, turnstile.token));
  }

  async function handleLogout() {
    if (await logout()) await refresh();
  }

  const content = (
      <section className="centered-page page-width">
        <Card className="access-card">
          <div className="access-card__mark" aria-hidden="true">
            <span />
          </div>
          <StatusChip tone={access.status === "unavailable" ? "blocked" : "alpha"}>
            Closed ALPHA
          </StatusChip>
          <p className="eyebrow">Existing StreamSuites accounts</p>
          <h1>One account authority.</h1>

          {access.status === "loading" && (
            <div className="notice-box notice-box--neutral" role="status">
              <strong>Checking Runtime/Auth</strong>
              <p>Confirming the current shared StreamSuites session and Studio access.</p>
            </div>
          )}

          {access.status === "unavailable" && (
            <>
              <p className="access-card__lede">
                Runtime/Auth could not confirm your session or Studio access. This is not being
                treated as an access denial.
              </p>
              <div className="notice-box notice-box--danger" role="alert">
                <strong>Service unavailable</strong>
                <p>{access.errorMessage ?? "Please try again when Runtime/Auth is available."}</p>
              </div>
              <Button onClick={() => void refresh()}>Retry access check</Button>
            </>
          )}

          {(access.status === "denied" || access.status === "restricted") && (
            <>
              <p className="access-card__lede">
                Your StreamSuites account is signed in, but Runtime/Auth did not authorize Studio.
              </p>
              <div className="notice-box notice-box--danger" role="alert">
                <strong>
                  {access.status === "restricted" ? "Account access restricted" : "ALPHA grant required"}
                </strong>
                <p>
                  {access.status === "restricted"
                    ? "The account is suspended, unverified, deleted, or otherwise ineligible."
                    : `Studio is closed to admins and up to ${access.activeTesterLimit} actively invited non-admin testers.`}
                </p>
              </div>
              <div className="access-actions">
                <Button onClick={() => void refresh()}>Check again</Button>
                <Button variant="secondary" onClick={() => void handleLogout()}>
                  Logout
                </Button>
              </div>
            </>
          )}

          {access.status === "unauthenticated" && (
            <>
              <p className="access-card__lede">
                Sign in through the existing StreamSuites Auth API. Studio does not create a
                separate account, session, role, or creator identity.
              </p>
              {authGate.status === "loading" && (
                <div className="notice-box notice-box--neutral" role="status">
                  <strong>Checking access mode</strong>
                  <p>Loading the Runtime/Auth access gate.</p>
                </div>
              )}
              {authGate.status === "unavailable" && (
                <div className="notice-box notice-box--danger" role="alert">
                  <strong>Access state unavailable</strong>
                  <p>{authGate.message}</p>
                  <Button variant="secondary" onClick={() => void refreshAuthGate()}>Retry access state</Button>
                </div>
              )}
              {authGate.status === "ready" && gateActive && (
                <div className={`notice-box ${authGate.bypassUnlocked ? "notice-box--success" : "notice-box--danger"}`} role="status">
                  <strong>{authGate.mode === "development" ? "Development access mode" : "Maintenance access mode"}</strong>
                  <p>{authGate.message}</p>
                  {authGate.bypassUnlocked ? (
                    <p>Access unlocked. Continue with login.</p>
                  ) : authGate.bypassEnabled ? (
                    <form className="access-bypass-form" onSubmit={(event) => void handleBypassUnlock(event)}>
                      <FormField
                        label="Access code"
                        type="password"
                        autoComplete="off"
                        value={bypassCode}
                        onChange={(event) => {
                          setBypassCode(event.target.value);
                          setBypassFeedback(null);
                        }}
                        disabled={bypassSubmitting}
                        required
                      />
                      {bypassFeedback && <p className={`access-bypass-feedback access-bypass-feedback--${bypassFeedback.tone}`}>{bypassFeedback.message}</p>}
                      <Button type="submit" disabled={bypassSubmitting || !bypassCode.trim()}>
                        {bypassSubmitting ? "Unlocking…" : "Unlock"}
                      </Button>
                    </form>
                  ) : (
                    <p>Normal login is paused right now.</p>
                  )}
                </div>
              )}
              <div className="oauth-grid" aria-label="OAuth login options">
                {oauthProviders.map((provider) => (
                  <Button
                    variant="secondary"
                    disabled={oauthSubmitting || submitting || bypassSubmitting || gateBlocked || !challengeReady}
                    onClick={() => handleOAuthLogin(provider.id)}
                    key={provider.id}
                  >
                    <img src={provider.icon} alt="" aria-hidden="true" data-provider-icon={provider.id} />
                    <span>Continue with {provider.label}</span>
                  </Button>
                ))}
              </div>
              <div className="auth-divider" role="separator">
                <span>or use email/password</span>
              </div>
              <TurnstileWidget
                ref={turnstileRef}
                theme={theme}
                onStateChange={handleTurnstileState}
              />
              <form className="login-form" onSubmit={(event) => void handlePasswordLogin(event)}>
                <FormField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                />
                <FormField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
                {formError && (
                  <div className="notice-box notice-box--danger auth-error" role="alert">
                    <strong>
                      {formError.code === "invalid_credentials"
                        ? "Credentials not accepted"
                        : formError.code.startsWith("turnstile_")
                          ? "Security verification rejected"
                          : formError.code === "auth_unavailable" || formError.code === "login_request_failed"
                            ? "Runtime/Auth unavailable"
                            : "Sign-in not completed"}
                    </strong>
                    <p>{formError.message}</p>
                  </div>
                )}
                <Button type="submit" disabled={submitting || oauthSubmitting || bypassSubmitting || gateBlocked || !fieldsReady || !challengeReady}>
                  {submitting ? "Signing in…" : "Sign in with StreamSuites"}
                </Button>
              </form>
              <p className="fine-print">
                New ALPHA access cannot be requested here. Grants are managed by a StreamSuites admin.
              </p>
            </>
          )}
        </Card>
      </section>
  );
  return embedded ? content : <SiteShell>{content}</SiteShell>;
}
