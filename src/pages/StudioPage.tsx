import { StudioShell } from "../components/shell/StudioShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusChip } from "../components/ui/StatusChip";

export function StudioPage() {
  return (
    <StudioShell>
      <div className="studio-page-heading">
        <div>
          <p className="eyebrow">Workspace preview</p>
          <h1>Studio</h1>
          <p>This shell is not authenticated and contains no authoritative room data.</p>
        </div>
        <StatusChip tone="blocked">Runtime not connected</StatusChip>
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
                Room creation, participants, camera, microphone, screen share, and
                production controls have not been implemented.
              </p>
            </EmptyState>
          </div>
          <div className="stage-card__controls" aria-label="Unavailable production controls">
            <Button variant="secondary" disabled>
              Camera
            </Button>
            <Button variant="secondary" disabled>
              Microphone
            </Button>
            <Button variant="secondary" disabled>
              Share screen
            </Button>
            <Button disabled>Go live</Button>
          </div>
        </Card>

        <Card className="room-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Runtime-owned</p>
              <h2>Rooms</h2>
            </div>
            <StatusChip tone="pending">Pending</StatusChip>
          </div>
          <EmptyState title="No room data">
            <p>
              Rooms will appear only after Runtime/Auth provides authenticated,
              permission-checked room summaries.
            </p>
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
          <p>
            Early ALPHA is expected to use an OBS-capturable program view before
            server-side egress exists.
          </p>
        </Card>
      </div>
    </StudioShell>
  );
}
