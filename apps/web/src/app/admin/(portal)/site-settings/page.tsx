import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getSocialLinks } from "@/lib/site-settings";
import { MuiProvider } from "@/components/mui-provider";
import { PageHeader } from "@/components/ui/page-header";
import { SocialLinksForm } from "./social-links-form";
import { UmrahOperationsForm } from "./umrah-operations-form";
import { getUmrahOperations } from "@/modules/umrah/settings";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSiteSettingsPage() {
  await requirePlatformAdmin();
  const [links, umrah] = await Promise.all([getSocialLinks(), getUmrahOperations()]);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Site settings" />
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Social links</h2>
        <MuiProvider>
          <SocialLinksForm links={links} />
        </MuiProvider>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Umrah operations</h2>
        <UmrahOperationsForm settings={umrah} />
      </section>
    </div>
  );
}
