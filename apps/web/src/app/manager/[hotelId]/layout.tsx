import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, getMyManagedHotels, getPendingBookingCount } from "@/modules/hotels/manager-queries";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getOpenRequestCount } from "@/modules/hotels/refund-queries";
import { hotelLogoUrl } from "@/modules/hotels/images";
import { PortalShell, type PortalNavGroup } from "@/components/portal/portal-shell";
import styles from "@/components/portal/operations-shell.module.css";

/**
 * The tenant boundary for the whole portal: every page under
 * /manager/[hotelId] renders inside this layout, which 404s unless the
 * signed-in user holds an active hotel_managers row for exactly this hotel.
 * Pages below never query outside the hotelId this layout admitted, and RLS
 * (is_hotel_manager / hotel_manager_has_permission) enforces the same
 * boundary again on every row the pages do touch.
 *
 * Nav is permission-shaped: sections a manager wasn't granted don't render
 * at all — an operator's console shows their job, not a menu of denials.
 */
export default async function ManagerHotelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const [pendingBookings, openRequests, allManaged, contexts] = await Promise.all([
    getPendingBookingCount(hotelId),
    getOpenRequestCount(hotelId),
    getMyManagedHotels(profile.id),
    getMyPartnerContexts(profile.id, profile.full_name),
  ]);

  const base = `/manager/${hotelId}`;
  const operate: PortalNavGroup = {
    label: "Property workspace",
    alwaysOpen: true,
    items: [
      { href: base, label: "Dashboard", icon: "overview" },
      ...(managed.permissions.includes("bookings")
        ? [{ href: `${base}/bookings/new`, label: "New reservation", icon: "new-booking" as const }]
        : []),
      { href: `${base}/bookings`, label: "Bookings", icon: "bookings", badge: pendingBookings || undefined },
      ...(managed.permissions.includes("bookings")
        ? [
            { href: `${base}/front-desk`, label: "Front Desk", icon: "calendar" as const },
            { href: `${base}/refunds`, label: "Refunds", icon: "refund" as const, badge: openRequests || undefined },
            { href: `${base}/guests`, label: "Guests", icon: "team" as const },
            { href: `${base}/reports`, label: "Reports", icon: "earnings" as const },
          ]
        : []),
      ...(managed.permissions.includes("rooms") || managed.permissions.includes("availability")
        ? [{ href: `${base}/rooms`, label: "Rooms & Availability", icon: "rooms" as const }]
        : []),
      ...(managed.permissions.includes("rooms") ? [{ href: `${base}/rates`, label: "Rates", icon: "tiers" as const }] : []),
      ...(managed.permissions.includes("photos") ? [{ href: `${base}/photos`, label: "Photos & Media", icon: "photos" as const }] : []),
      ...(managed.permissions.includes("profile") ? [{ href: `${base}/profile`, label: "Hotel Profile", icon: "hotels" as const }] : []),
      { href: `${base}/reviews`, label: "Reviews", icon: "reviews" },
      { href: "/manager/security", label: "Security", icon: "security" },
    ],
  };

  const navGroups: PortalNavGroup[] = [operate];
  if (allManaged.length > 1) {
    navGroups.push({
      label: "My Hotels",
      items: allManaged
        .filter((h) => h.hotelId !== hotelId)
        .map((h) => ({ href: `/manager/${h.hotelId}`, label: h.hotel.name, icon: "hotels" as const })),
    });
  }

  return (
    <PortalShell
      className={styles.shell}
      portalName="Manager Portal"
      roleLabel="Hotel Manager"
      navGroups={navGroups}
      profileName={profile.full_name}
      profileEmail={profile.manager_contact_email ?? profile.email}
      accountCode={profile.manager_code ?? undefined}
      contexts={contexts}
      isPlatformAdmin={profile.is_platform_admin}
      accent="manager"
      brandLogoUrl={hotelLogoUrl(managed.hotel.logo_path)}
      brandName={managed.hotel.name}
      menuInfo={{ workspace: managed.hotel.name, buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null }}
    >
      {children}
    </PortalShell>
  );
}
