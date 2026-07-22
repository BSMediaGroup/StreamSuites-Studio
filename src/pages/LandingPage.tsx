import { SiteShell } from "../components/shell/SiteShell";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusChip } from "../components/ui/StatusChip";

const foundationPoints = [
  {
    number: "01",
    title: "One production surface",
    body: "A focused browser workspace intended to bring StreamSuites production tools together without moving authority into the client.",
  },
  {
    number: "02",
    title: "Existing account authority",
    body: "Studio reuses StreamSuites admin, creator, developer, and public accounts through the Runtime/Auth API.",
  },
  {
    number: "03",
    title: "Media stays off runtime",
    body: "Cloudflare RealtimeKit is the active browser room-media provider. LiveKit and Egress remain planned for the later production path.",
  },
];

export function LandingPage() {
  return (
    <SiteShell>
      <section className="hero page-width">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__content">
          <div className="hero__status">
            <StatusChip tone="alpha">Flagship product surface</StatusChip>
            <span>Invite-only access</span>
          </div>
          <p className="eyebrow">Browser livestream production</p>
          <h1>
            Build the show.
            <span>Keep the control.</span>
          </h1>
          <p className="hero__lede">
            StreamSuites Studio is the new flagship browser production surface. This
            closed ALPHA now uses Runtime/Auth-owned rooms, secure invitations, and lobby
            admission. Media transport and broadcasting are not available yet.
          </p>
          <div className="hero__actions">
            <ButtonLink to="/login">View access path</ButtonLink>
            <ButtonLink to="/studio" variant="secondary">
              Open Studio
            </ButtonLink>
          </div>
          <p className="hero__footnote">
            Initial access is limited to Daniel and no more than 25 invited testers.
          </p>
        </div>

        <div className="program-preview" aria-label="Conceptual program workspace preview">
          <div className="program-preview__topline">
            <span>Program workspace</span>
            <StatusChip tone="pending">Not connected</StatusChip>
          </div>
          <div className="program-preview__canvas">
            <div className="program-preview__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <strong>No production feed</strong>
            <span>Camera, microphone, screen share, and destinations are not implemented.</span>
          </div>
          <div className="program-preview__meter" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>

      <section className="foundation-section page-width" aria-labelledby="foundation-title">
        <div className="section-heading">
          <p className="eyebrow">Foundation first</p>
          <h2 id="foundation-title">Clear boundaries from the first frame.</h2>
          <p>
            The client now consumes runtime-owned session, access, room, invite, and lobby
            decisions while StreamSuites remains the only source of canonical truth.
          </p>
        </div>
        <div className="foundation-grid">
          {foundationPoints.map((point) => (
            <Card key={point.number}>
              <span className="card__number">{point.number}</span>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="access-callout page-width">
        <div>
          <p className="eyebrow">ALPHA scope</p>
          <h2>Small room. Honest status.</h2>
          <p>
            Runtime/Auth now enforces nine total Stage slots: one reserved for the director and
            eight additional participants. Backstage does not count. Every media capability remains unshipped.
          </p>
        </div>
        <ButtonLink to="/login" variant="secondary">
          Understand access
        </ButtonLink>
      </section>
    </SiteShell>
  );
}
