import Link from "next/link";
import { redirect } from "next/navigation";
import { Hotel, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Portal entry. One managed hotel — the overwhelmingly common case — goes
 * straight to that hotel's dashboard; several get a picker; none gets told
 * why the portal is empty instead of a dead end.
 */
export default async function ManagerEntryPage() {
  const profile = await requireUser();
  const hotels = await getMyManagedHotels(profile.id);

  if (hotels.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">No hotel assignment found</p>
            <p className="text-sm text-muted-foreground">
              This account isn&apos;t assigned to manage any hotel. Hotel access is granted by STS.
            </p>
            <Button render={<Link href="/account" />}>Go to My Account</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hotels.length === 1) redirect(`/manager/${hotels[0].hotelId}`);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-4 py-10">
      <h1 className="font-heading text-xl font-semibold">Choose a hotel</h1>
      {hotels.map((h) => (
        <Link
          key={h.hotelId}
          href={`/manager/${h.hotelId}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hotel className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">{h.hotel.name}</span>
              <span className="block text-xs text-muted-foreground">
                {h.hotel.city}, {h.hotel.country_code}
              </span>
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
