import Link from "next/link";
import Image from "next/image";

import { getCurrentProfile } from "@/lib/auth/session";
import { getMyPartnerContexts, isPortalOnlyIdentity } from "@/modules/identity/queries";
import { SiteHeaderClient } from "@/components/marketing/site-header-client";
import { HeaderShell } from "@/components/marketing/header-shell";

/** Shared public navigation with a compact state on scroll. */
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
      <div className="relative z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 transition-[height] duration-300 ease-out group-data-[condensed]/header:h-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-11 w-auto transition-[height] duration-300 ease-out group-data-[condensed]/header:h-9" />
          </Link>
          <SiteHeaderClient profile={profile} contexts={contexts} />
        </div>
      </div>


    </HeaderShell>
  );
}
