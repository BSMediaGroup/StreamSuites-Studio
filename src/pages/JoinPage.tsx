import { useParams } from "react-router-dom";
import { SiteShell } from "../components/shell/SiteShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { StatusChip } from "../components/ui/StatusChip";
import { checkInviteCode } from "../lib/inviteCode";

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const code = checkInviteCode(inviteCode);

  return (
    <SiteShell>
      <section className="centered-page page-width">
        <Card className="access-card join-card">
          <StatusChip tone={code.isSafeFormat ? "pending" : "blocked"}>
            {code.isSafeFormat ? "Unverified invite" : "Invalid format"}
          </StatusChip>
          <p className="eyebrow">Guest entry shell</p>
          <h1>{code.isSafeFormat ? "Invitation received." : "Check the invitation link."}</h1>
          <p className="access-card__lede">
            {code.isSafeFormat
              ? "This browser-only check confirms that the code has a safe display format. It has not been validated, accepted, or matched to a room."
              : "This route does not contain an invite code in the expected browser-safe format. No backend validation was attempted."}
          </p>
          <FormField
            label="Invite code"
            value={code.normalized || "No usable code"}
            readOnly
            aria-invalid={!code.isSafeFormat}
            hint="Runtime/Auth will own invitation validation, expiry, room access, and temporary guest permissions."
          />
          <Button disabled>Validate invitation</Button>
          <p className="fine-print">Invite validation is reserved for a future Runtime/Auth integration.</p>
        </Card>
      </section>
    </SiteShell>
  );
}
