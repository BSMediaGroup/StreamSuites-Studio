import { Navigate } from "react-router-dom";
import { useStudioAuth } from "../auth/studioAuthContext";
import { SiteShell } from "../components/shell/SiteShell";
import { StudioShell } from "../components/shell/StudioShell";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusChip } from "../components/ui/StatusChip";

export function StudioPage() {
  const { access, refresh, logout } = useStudioAuth();

  if (access.status === "loading") {
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card className="access-card access-state-card" role="status">
            <StatusChip tone="neutral">Checking access</StatusChip>
            <h1>Confirming Studio access.</h1>
            <p>Runtime/Auth is validating the shared session and closed-ALPHA grant.</p>
          </Card>
        </section>
      </SiteShell>
    );
  }

  if (access.status === "unauthenticated") {
    return <Navigate to="/login?return_to=%2Fstudio" replace />;
  }

  if (access.status === "unavailable") {
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card className="access-card access-state-card">
            <StatusChip tone="blocked">Service unavailable</StatusChip>
            <h1>Access cannot be confirmed.</h1>
            <p>
              Runtime/Auth is unavailable, so Studio has failed closed. This is not an access denial.
            </p>
            <Button onClick={() => void refresh()}>Retry access check</Button>
          </Card>
        </section>
      </SiteShell>
    );
  }

  if (access.status === "denied" || access.status === "restricted") {
    return (
      <SiteShell>
        <section className="centered-page page-width">
          <Card className="access-card access-state-card">
            <StatusChip tone="blocked">
              {access.status === "restricted" ? "Account restricted" : "Access denied"}
            </StatusChip>
            <h1>
              {access.status === "restricted" ? "This account is not eligible." : "Closed ALPHA access required."}
            </h1>
            <p>
              {access.status === "restricted"
                ? "Runtime/Auth reports that this account cannot currently use Studio."
                : `This account does not have an active Studio ALPHA grant. The non-admin tester limit is ${access.activeTesterLimit}.`}
            </p>
            <div className="access-actions">
              <Button onClick={() => void refresh()}>Check again</Button>
              <Button
                variant="secondary"
                onClick={() => void logout().then((ok) => ok && window.location.assign("/login"))}
              >
                Logout
              </Button>
              <ButtonLink to="/" variant="quiet">Return home</ButtonLink>
            </div>
          </Card>
        </section>
      </SiteShell>
    );
  }

  return (
    <StudioShell>
      <div className="studio-page-heading">
        <div>
          <p className="eyebrow">Authorized workspace foundation</p>
          <h1>Studio</h1>
          <p>Runtime/Auth confirmed this account. No authoritative room or media data exists yet.</p>
        </div>
        <StatusChip tone="alpha">Access confirmed</StatusChip>
      </div>

      <div className="studio-workspace-grid">
        <Card className="stage-card">
          <div className="stage-card__toolbar">
            <div>
              <span>Program</span>
              <strong>No room selected</strong>
            </div>
            <StatusChip tone="neutral">Offline</StatusChip>
          </div>
          <div className="stage-card__canvas">
            <EmptyState title="Your stage will appear here">
              <p>
                Room creation, participants, camera, microphone, screen share, and production
                controls have not been implemented.
              </p>
            </EmptyState>
          </div>
          <div className="stage-card__controls" aria-label="Unavailable production controls">
            <Button variant="secondary" disabled>Camera</Button>
            <Button variant="secondary" disabled>Microphone</Button>
            <Button variant="secondary" disabled>Share screen</Button>
            <Button disabled>Go live</Button>
          </div>
        </Card>

        <Card className="room-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Runtime-owned</p>
              <h2>Rooms</h2>
            </div>
            <StatusChip tone="pending">Not implemented</StatusChip>
          </div>
          <EmptyState title="No room data">
            <p>Rooms will appear only after Runtime/Auth provides permission-checked room summaries.</p>
          </EmptyState>
        </Card>
      </div>

      <div className="studio-bottom-grid">
        <Card>
          <p className="eyebrow">Destinations</p>
          <h2>Nothing configured</h2>
          <p>No broadcast destination or provider connection is represented here.</p>
        </Card>
        <Card>
          <p className="eyebrow">Program output</p>
          <h2>OBS path planned</h2>
          <p>Early ALPHA may use an OBS-capturable program view before server-side egress exists.</p>
        </Card>
      </div>
    </StudioShell>
  );
}
