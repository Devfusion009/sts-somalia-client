import Link from "next/link";
import Image from "next/image";

import { getCurrentProfile } from "@/lib/auth/session";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { SiteHeaderClient, HeaderSearch } from "@/components/marketing/site-header-client";
import { HeaderShell } from "@/components/marketing/header-shell";
import { ScrollProgressBar } from "@/components/ui/aceternity/motion-primitives";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import { whatsappLink } from "@/lib/whatsapp";

import { InfoOutlinedIcon, PhoneInTalkIcon, StorefrontIcon, SupportAgentIcon } from "@/components/ui/mui-icons";
/**
 * Two-tier marketing chrome: a slim utility bar (contact + secondary links)
 * over the pill nav, then a sticky destination search that reveals on scroll.
 *
 * On scroll the whole block condenses — the utility bar collapses to nothing
 * and the nav row, logo and controls shrink — so the header gives the page
 * back roughly half its vertical space. Every step is a CSS transition driven
 * off HeaderShell's `data-condensed` attribute.
 */
export async function SiteHeader() {
  const rawProfile = await getCurrentProfile();
  // A hotel manager has no B2C identity of their own — see the rejection in
  // signInAction. Treated as signed-out here so the public site never shows
  // them a "My Account" customer identity that isn't really theirs, even
  // though the /manager session cookie is still valid.
  //
  // Checked against the real hotel_managers row (same query signInAction's
  // hasActiveHotelManagerRow and every manager layout use), not
  // profile.role: a manager assigned by seed data or any path that doesn't
  // run the admin promotion RPC never gets role bumped to 'hotel_manager',
  // and that stale role was silently letting them appear as a signed-in
  // customer here.
  const managedHotels = rawProfile ? await getMyManagedHotels(rawProfile.id) : [];
  const profile = managedHotels.length > 0 ? null : rawProfile;
  const contexts = profile ? await getMyPartnerContexts(profile.id, profile.full_name) : [];

  return (
    <HeaderShell>
      <ScrollProgressBar />

      {/* Utility bar — collapses entirely once scrolled */}
      <div className="hidden overflow-hidden border-b border-border/60 bg-secondary/60 transition-[height,opacity] duration-300 ease-out group-data-[condensed]/header:h-0 group-data-[condensed]/header:border-b-0 group-data-[condensed]/header:opacity-0 lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
          <a
            href={SUPPORT_PHONE_TEL}
            className="flex items-center gap-1.5 font-semibold text-secondary-foreground transition-colors hover:text-primary"
          >
            <PhoneInTalkIcon sx={{ fontSize: 15 }} className="text-primary" />
            Toll free: {SUPPORT_PHONE_DISPLAY}
          </a>
          <nav aria-label="Secondary" className="flex items-center gap-5 font-medium text-muted-foreground">
            <Link href="/about" className="flex items-center gap-1 transition-colors hover:text-primary">
              <InfoOutlinedIcon sx={{ fontSize: 15 }} /> About us
            </Link>
            <a
              href={whatsappLink("Hello STS! I need help with a booking.")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              <SupportAgentIcon sx={{ fontSize: 15 }} /> Customer support
            </a>
            <Link href="/#stores" className="flex items-center gap-1 transition-colors hover:text-primary">
              <StorefrontIcon sx={{ fontSize: 15 }} /> Our office
            </Link>
            {profile ? null : (
              <Link href="/signup" className="font-semibold text-primary transition-colors hover:underline">
                Sign up
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* Primary nav */}
      {/* relative z-30: `backdrop-blur` creates a stacking context, which traps
          the mega-menu's own z-50 inside this row. Raising the ROW above the
          search row below is what actually lets the dropdown paint over it. */}
      <div className="supports-backdrop-filter:bg-background/85 relative z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 transition-[height] duration-300 ease-out group-data-[condensed]/header:h-14 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-11 w-auto transition-[height] duration-300 ease-out group-data-[condensed]/header:h-9" />
          </Link>
          <SiteHeaderClient profile={profile} contexts={contexts} />
        </div>
      </div>

      {/* Sticky destination search — always shown off-home, scroll-revealed on home */}
      <HeaderSearch />
    </HeaderShell>
  );
}
