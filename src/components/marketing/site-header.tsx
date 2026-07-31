import Link from "next/link";
import { Plane } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/session";
import { SiteHeaderClient } from "@/components/marketing/site-header-client";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Plane className="size-5" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
            STS Somalia
          </span>
        </Link>

        <SiteHeaderClient profile={profile} />
      </div>
    </header>
  );
}
