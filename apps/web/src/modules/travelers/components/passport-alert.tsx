import { AlertTriangle, BadgeCheck, CalendarX2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { passportStatus, PASSPORT_VALIDITY_MONTHS } from "../schemas";

/**
 * The six-month passport rule, surfaced where the customer can still act on it.
 *
 * No directive: this renders identically in a Server or Client Component, and
 * it is used from both (the account overview renders it on the server, the
 * traveler dialog re-renders it live as the date input changes).
 */

function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Full-width alert for the profile/traveler forms. */
export function PassportExpiryAlert({
  expiry,
  subject = "This passport",
}: {
  expiry: string | null | undefined;
  /**
   * The complete noun phrase, not a bare name — callers say "Your passport" or
   * "Amina's passport". Building the possessive here would produce "Your's"
   * for the first-person case.
   */
  subject?: string;
}) {
  const status = passportStatus(expiry);
  if (status.level === "none" || status.level === "valid") return null;

  const who = subject;

  if (status.level === "expired") {
    return (
      <Alert variant="destructive">
        <CalendarX2 />
        <AlertTitle>{who} has expired</AlertTitle>
        <AlertDescription>Expired on {formatDate(status.expiry)}.</AlertDescription>
      </Alert>
    );
  }

  return (
    // Not variant="destructive": nothing is broken yet and the passport is
    // still usable for some trips. Amber reads as "act soon", which is the
    // accurate instruction — red here would cry wolf on every booking.
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>{who} expires in under {PASSPORT_VALIDITY_MONTHS} months</AlertTitle>
      <AlertDescription className="tabular-nums">
        Valid until {formatDate(status.expiry)} · {status.daysRemaining} days left
      </AlertDescription>
    </Alert>
  );
}

/** Compact inline badge for list rows and tables. */
export function PassportExpiryBadge({ expiry }: { expiry: string | null | undefined }) {
  const status = passportStatus(expiry);

  if (status.level === "none") {
    return (
      <Badge variant="neutral">
        No passport saved
      </Badge>
    );
  }

  if (status.level === "expired") {
    return (
      <Badge variant="destructive">
        <CalendarX2 aria-hidden="true" /> Expired
      </Badge>
    );
  }

  if (status.level === "expiring") {
    return (
      <Badge variant="warning">
        <AlertTriangle aria-hidden="true" /> Expires in {status.monthsRemaining < 1 ? "under a month" : `${status.monthsRemaining} mo`}
      </Badge>
    );
  }

  return (
    <Badge variant="success">
      <BadgeCheck aria-hidden="true" /> Valid to {formatDate(status.expiry)}
    </Badge>
  );
}
