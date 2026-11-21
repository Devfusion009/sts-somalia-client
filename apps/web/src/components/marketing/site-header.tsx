import Link from "next/link";
import { StsBrandLogo } from "./sts-brand-logo";

import { getCurrentProfile } from "@/lib/auth/session";
import { getMyPartnerContexts, isPortalOnlyIdentity } from "@/modules/identity/queries";
import { SiteHeaderClient, HeaderSearch } from "@/components/marketing/site-header-client";
import { HeaderShell } from "@/components/marketing/header-shell";
import { ScrollProgressBar } from "@/components/ui/aceternity/motion-primitives";

/** Public navigation with a compact sticky state and destination search. */
export async function SiteHeader() {
  const rawProfile = await getCurrentProfile();
  // A platform admin or hotel manager has no B2C identity of their own —
  // see the rejection in signInAction. Treated as signed-out here so the
  // public site never shows them a "My Account" customer identity that
  // isn't really theirs, even though their portal session cookie is still
  // valid (no custom domain yet means every portal and the public site
  // share one cookie — see the comment on rootOrigin()).
  // Both reads need only the profile, so they run together instead of one after the other.
  const [portalOnly, allContexts] = rawProfile
    ? await Promise.all([isPortalOnlyIdentity(rawProfile), getMyPartnerContexts(rawProfile.id, rawProfile.full_name)])
    : [false, []];
  const profile = rawProfile && !portalOnly ? rawProfile : null;
  const contexts = profile ? allContexts : [];

  return (
    <HeaderShell>
      <ScrollProgressBar />

      {/* Primary nav */}
      {/* relative z-30: `backdrop-blur` creates a stacking context, which traps
          the mega-menu's own z-50 inside this row. Raising the ROW above the
          search row below is what actually lets the dropdown paint over it. */}
      <div className="relative z-30 border-b border-border/80 bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 transition-[height] duration-300 ease-out group-data-[condensed]/header:h-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 flex-col items-start gap-0.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <StsBrandLogo className="h-auto w-28 transition-[width] duration-200 sm:w-32 group-data-[condensed]/header:w-28 motion-reduce:transition-none" />
          </Link>
          <SiteHeaderClient profile={profile} contexts={contexts} />
        </div>
      </div>

      {/* Sticky destination search — always shown off-home, scroll-revealed on home */}
      <HeaderSearch />
    </HeaderShell>
  );
}
