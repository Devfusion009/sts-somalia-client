import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import { PreferencesForm } from "@/modules/preferences/components/preferences-form";
import { getIntegrations } from "@/lib/integrations";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Preferences" };

export default async function AccountPreferencesPage() {
  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — falling back to default preferences here and letting the
  // form save them would silently overwrite what the customer actually has
  // saved, so this page blocks rather than degrades.
  let preferences, rates;
  try {
    [preferences, rates] = await Promise.all([trpc.preferences.me.query(), trpc.preferences.fxRates.query()]);
  } catch {
    return <UnavailableNotice label="Preferences" />;
  }

  // There is no SMS provider wired yet (Twilio is configured for WhatsApp
  // only). The form badges it rather than offering a toggle that quietly
  // does nothing.
  const { whatsappApi } = getIntegrations();
  const smsAvailable = false;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Preferences" />

      <PreferencesForm
        preferences={preferences}
        smsAvailable={smsAvailable}
        whatsappAvailable={whatsappApi}
        convertibleCurrencies={Object.keys(rates)}
      />
    </div>
  );
}
