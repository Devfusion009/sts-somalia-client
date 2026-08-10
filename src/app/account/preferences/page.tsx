import type { Metadata } from "next";
import { getMyPreferences, getFxRates } from "@/modules/preferences/queries";
import { PreferencesForm } from "@/modules/preferences/components/preferences-form";
import { getIntegrations } from "@/lib/integrations";

export const metadata: Metadata = { title: "Preferences" };

export default async function AccountPreferencesPage() {
  const [preferences, rates] = await Promise.all([getMyPreferences(), getFxRates("USD")]);

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
        convertibleCurrencies={[...rates.keys()]}
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
