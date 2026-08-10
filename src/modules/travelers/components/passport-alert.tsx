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
        <AlertDescription>
          It expired on {formatDate(status.expiry)}. You&apos;ll need to renew it before we can
          submit a visa application or issue a ticket in this name.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    // Not variant="destructive": nothing is broken yet and the passport is
    // still usable for some trips. Amber reads as "act soon", which is the
    // accurate instruction — red here would cry wolf on every booking.
    <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
      <AlertTriangle />
      <AlertTitle>{who} expires in under {PASSPORT_VALIDITY_MONTHS} months</AlertTitle>
      <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
        Valid until {formatDate(status.expiry)} ({status.daysRemaining} days). Most destinations —
        including the UAE, Saudi Arabia, Türkiye and Kenya — require at least{" "}
        {PASSPORT_VALIDITY_MONTHS} months of validity from your date of entry, and applications are
        commonly refused on this alone. Renew before you book.
      </AlertDescription>
    </Alert>
  );
}

/** Compact inline badge for list rows and tables. */
export function PassportExpiryBadge({ expiry }: { expiry: string | null | undefined }) {
  const status = passportStatus(expiry);

  if (status.level === "none") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        No passport saved
      </Badge>
    );
  }

  if (status.level === "expired") {
    return (
      <Badge variant="destructive" className="gap-1">
        <CalendarX2 className="size-3" /> Expired
      </Badge>
    );
  }

  if (status.level === "expiring") {
    return (
      <Badge className="gap-1 border-amber-500/40 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100">
        <AlertTriangle className="size-3" /> Expires in {status.monthsRemaining < 1 ? "under a month" : `${status.monthsRemaining} mo`}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <BadgeCheck className="size-3" /> Valid to {formatDate(status.expiry)}
    </Badge>
  );
}
