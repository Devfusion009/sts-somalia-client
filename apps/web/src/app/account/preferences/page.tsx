import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import { PreferencesForm } from "@/modules/preferences/components/preferences-form";
import { getIntegrations } from "@/lib/integrations";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

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
  // only). The form says so rather than offering a toggle that quietly does
  // nothing.
  const { whatsappApi } = getIntegrations();
  const smsAvailable = false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how we reach you, in which language, and how prices are shown.
        </p>
      </div>

      <PreferencesForm
        preferences={preferences}
        smsAvailable={smsAvailable}
        convertibleCurrencies={Object.keys(rates)}
      />

      {!whatsappApi ? (
        <p className="text-xs text-muted-foreground">
          Note: WhatsApp delivery is awaiting provider verification. Your choice is saved and will
          apply as soon as it goes live.
        </p>
      ) : null}
    </div>
  );
}
