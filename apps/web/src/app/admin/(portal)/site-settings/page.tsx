import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getSocialLinks } from "@/lib/site-settings";
import { SocialLinksForm } from "./social-links-form";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSiteSettingsPage() {
  await requirePlatformAdmin();
  const links = await getSocialLinks();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Site settings</h1>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Social links</h2>
        <SocialLinksForm links={links} />
      </section>
    </div>
  );
}
