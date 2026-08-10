"use client";

import { useActionState } from "react";
import { CheckCircle2, Mail, MessageCircle, Smartphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { savePreferencesAction } from "../actions";
import { SUPPORTED_LANGUAGES, DISPLAY_CURRENCIES } from "../constants";

type Preferences = {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  language: string;
  display_currency: string;
};

const LANGUAGE_ITEMS = SUPPORTED_LANGUAGES.map((l) => ({
  value: l.value,
  label: `${l.label} — ${l.native}`,
}));

const CURRENCY_ITEMS = DISPLAY_CURRENCIES.map((c) => ({ value: c.value, label: c.label }));

const CHANNELS = [
  {
    name: "emailEnabled",
    key: "email_enabled" as const,
    icon: Mail,
    label: "Email",
    description: "Booking confirmations, invoices and visa decisions.",
  },
  {
    name: "whatsappEnabled",
    key: "whatsapp_enabled" as const,
    icon: MessageCircle,
    label: "WhatsApp",
    description: "Quick updates and reminders on the number in your profile.",
  },
  {
    name: "smsEnabled",
    key: "sms_enabled" as const,
    icon: Smartphone,
    label: "SMS",
    description: "Text messages for time-critical changes.",
  },
];

export function PreferencesForm({
  preferences,
  smsAvailable,
  convertibleCurrencies,
}: {
  preferences: Preferences;
  /** False until an SMS provider is configured — the toggle stays honest about it. */
  smsAvailable: boolean;
  /** Currencies that actually have an FX rate on file. */
  convertibleCurrencies: string[];
}) {
  const [state, formAction] = useActionState(savePreferencesAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Preferences saved.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How we contact you</CardTitle>
          <CardDescription>
            These control booking updates — confirmations, visa decisions and schedule changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHANNELS.map((channel) => {
            const unavailable = channel.name === "smsEnabled" && !smsAvailable;
            return (
              <div
                key={channel.name}
                className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
              >
                <div className="flex min-w-0 gap-3">
                  <channel.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <Label htmlFor={channel.name} className="font-medium">
                      {channel.label}
                    </Label>
                    <p className="mt-0.5 text-sm text-muted-foreground">{channel.description}</p>
                    {unavailable ? (
                      <p className="mt-1 text-xs text-amber-600">
                        SMS delivery isn&apos;t switched on yet. You can set this now and it will
                        take effect once it is.
                      </p>
                    ) : null}
                  </div>
                </div>
                <Switch
                  id={channel.name}
                  name={channel.name}
                  defaultChecked={preferences[channel.key]}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language &amp; currency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Message language</Label>
            <Select
              name="language"
              defaultValue={preferences.language}
              items={LANGUAGE_ITEMS}
            >
              <SelectTrigger id="language" className="w-full sm:max-w-sm">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applies to emails and WhatsApp messages we send you. The website itself is currently
              English only.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayCurrency">Display currency</Label>
            <Select
              name="displayCurrency"
              defaultValue={preferences.display_currency}
              items={CURRENCY_ITEMS}
            >
              <SelectTrigger id="displayCurrency" className="w-full sm:max-w-sm">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                    {convertibleCurrencies.includes(item.value) ? "" : " — no rate yet"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Prices are shown converted as a guide. You are always charged in the currency the
              booking is priced in — conversion here never changes what you pay.
            </p>
          </div>
        </CardContent>
      </Card>

      <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
