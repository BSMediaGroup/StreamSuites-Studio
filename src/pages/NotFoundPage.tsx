import { SiteShell } from "../components/shell/SiteShell";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <SiteShell>
      <section className="centered-page page-width">
        <EmptyState eyebrow="404" title="That Studio route does not exist.">
          <p>The requested path is not part of the current ALPHA scaffold.</p>
          <ButtonLink to="/">Return to Studio overview</ButtonLink>
        </EmptyState>
      </section>
    </SiteShell>
  );
}
