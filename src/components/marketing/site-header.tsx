import Link from "next/link";
import Image from "next/image";
import { getCurrentProfile } from "@/lib/auth/session";
import { SiteHeaderClient } from "@/components/marketing/site-header-client";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-10 w-auto" />
        </Link>

        <SiteHeaderClient profile={profile} />
      </div>
    </header>
  );
}
