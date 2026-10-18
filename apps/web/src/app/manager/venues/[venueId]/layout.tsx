import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedVenue, getPendingHallBookingCount } from "@/modules/events/venue-manager-queries";
import { getOpenVenueRequestCount } from "@/modules/events/venue-refund-queries";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";

/**
 * Tenant boundary for the venue half of the manager portal: every page under
 * /manager/venues/[venueId] renders inside this layout, which 404s unless the
 * signed-in user holds an active venue_managers row for exactly this venue.
 * RLS (is_venue_manager / venue_manager_has_permission) enforces the same
 * boundary again on every row the pages touch. Nav is permission-shaped.
 */
export default async function ManagerVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed) notFound();

  const [pending, openRequests, contexts] = await Promise.all([
    getPendingHallBookingCount(venueId),
    getOpenVenueRequestCount(venueId),
    getMyPartnerContexts(profile.id, profile.full_name),
  ]);

  const base = `/manager/venues/${venueId}`;
  const can = (perm: string) => managed.permissions.includes(perm);
  const navGroups: PortalNavGroup[] = [
    {
      label: managed.venue.name,
      items: [
        { href: base, label: "Dashboard", icon: "overview" },
        { href: `${base}/bookings`, label: "Bookings", icon: "bookings", badge: pending || undefined },
        { href: `${base}/calendar`, label: "Calendar", icon: "calendar" },
        ...(can("bookings")
          ? [{ href: `${base}/refunds`, label: "Refunds", icon: "refund" as const, badge: openRequests || undefined }]
          : []),
        ...(can("photos") ? [{ href: `${base}/photos`, label: "Photos", icon: "photos" as const }] : []),
        ...(can("profile") ? [{ href: `${base}/profile`, label: "Venue Profile", icon: "events" as const }] : []),
        { href: `${base}/reviews`, label: "Reviews", icon: "reviews" },
      ],
    },
  ];

  return (
    <PortalShell
      portalName="Manager Portal"
      roleLabel="Venue Manager"
      navGroups={navGroups}
      profileName={profile.full_name}
      profileEmail={profile.email}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
      accent="manager"
    >
      {children}
    </PortalShell>
  );
}
