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

const oauthProviders: readonly { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "discord", label: "Discord" },
  { id: "x", label: "X" },
  { id: "twitch", label: "Twitch" },
];

export function LoginPage() {
  const { access, refresh, logout } = useStudioAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [formError, setFormError] = useState<{ code: string; message: string } | null>(null);
  const [turnstile, setTurnstile] = useState<TurnstileState>({
    enabled: null,
    token: "",
    phase: "loading",
  });
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const returnPath = useMemo(
    () => safeStudioReturnPath(searchParams.get("return_to")),
    [searchParams],
  );

  useEffect(() => {
    if (access.status === "allowed") navigate(returnPath, { replace: true });
  }, [access.status, navigate, returnPath]);

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

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !fieldsReady || !challengeReady) return;
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
    if (oauthSubmitting || !challengeReady) return;
    setOauthSubmitting(true);
    setFormError(null);
    window.location.assign(buildOAuthLoginUrl(provider, returnPath, turnstile.token));
  }

  async function handleLogout() {
    if (await logout()) await refresh();
  }

  return (
    <SiteShell>
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
              <div className="oauth-grid" aria-label="OAuth login options">
                {oauthProviders.map((provider) => (
                  <Button
                    variant="secondary"
                    disabled={oauthSubmitting || submitting || !challengeReady}
                    onClick={() => handleOAuthLogin(provider.id)}
                    key={provider.id}
                  >
                    Continue with {provider.label}
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
                <Button type="submit" disabled={submitting || oauthSubmitting || !fieldsReady || !challengeReady}>
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
    </SiteShell>
  );
}
