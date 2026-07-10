import { SiteShell } from "../components/shell/SiteShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusChip } from "../components/ui/StatusChip";

export function LoginPage() {
  return (
    <SiteShell>
      <section className="centered-page page-width">
        <Card className="access-card">
          <div className="access-card__mark" aria-hidden="true">
            <span />
          </div>
          <StatusChip tone="pending">Auth bridge pending</StatusChip>
          <p className="eyebrow">Existing StreamSuites accounts</p>
          <h1>One account authority.</h1>
          <p className="access-card__lede">
            Studio will use the existing StreamSuites Runtime/Auth API for account,
            session, role, tier, and access decisions. It will not create a separate
            login database or trust client-authored session state.
          </p>
          <div className="notice-box">
            <strong>Not connected yet</strong>
            <p>
              The current-session adapter is scaffolded, but this page does not send a
              login request or establish a session.
            </p>
          </div>
          <Button disabled aria-describedby="auth-pending-note">
            Continue with StreamSuites
          </Button>
          <p id="auth-pending-note" className="fine-print">
            Available after the next Runtime/Auth integration milestone.
          </p>
        </Card>
      </section>
    </SiteShell>
  );
}
