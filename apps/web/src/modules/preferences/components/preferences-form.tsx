"use client";

import { Mail, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { SUPPORTED_LANGUAGES, DISPLAY_CURRENCIES, type AccountLanguage } from "@sts/shared-types";

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
  },
  {
    name: "whatsappEnabled",
    key: "whatsapp_enabled" as const,
    icon: MessageCircle,
    label: "WhatsApp",
  },
  {
    name: "smsEnabled",
    key: "sms_enabled" as const,
    icon: Smartphone,
    label: "SMS",
  },
];

export function PreferencesForm({
  preferences,
  smsAvailable,
  whatsappAvailable = true,
  convertibleCurrencies,
}: {
  preferences: Preferences;
  /** False until an SMS provider is configured — the toggle stays honest about it. */
  smsAvailable: boolean;
  /** False while the WhatsApp provider is awaiting verification. */
  whatsappAvailable?: boolean;
  /** Currencies that actually have an FX rate on file. */
  convertibleCurrencies: string[];
}) {
  const utils = trpc.useUtils();
  const save = trpc.preferences.save.useMutation({
    onSuccess: () => {
      utils.preferences.me.invalidate();
      toast.success("Preferences saved.");
    },
  });

  // async + awaited mutateAsync (not the fire-and-forget .mutate()) so that
  // SubmitButton's useFormStatus()-based pending state tracks the
  // mutation's actual duration — same reasoning as affiliate/links/new-link-form.tsx.
  async function handleSubmit(formData: FormData) {
    try {
      await save.mutateAsync({
        emailEnabled: formData.get("emailEnabled") === "on",
        smsEnabled: formData.get("smsEnabled") === "on",
        whatsappEnabled: formData.get("whatsappEnabled") === "on",
        language: formData.get("language") as AccountLanguage,
        displayCurrency: formData.get("displayCurrency") as string,
      });
    } catch {
      // handled via save.error below
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {CHANNELS.map((channel) => {
              const unavailable =
                (channel.name === "smsEnabled" && !smsAvailable) ||
                (channel.name === "whatsappEnabled" && !whatsappAvailable);
              return (
                <li
                  key={channel.name}
                  className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <channel.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <Label htmlFor={channel.name} className="font-medium">
                      {channel.label}
                    </Label>
                    {unavailable ? <Badge variant="neutral">Not live yet</Badge> : null}
                  </div>
                  <Switch
                    id={channel.name}
                    name={channel.name}
                    defaultChecked={preferences[channel.key]}
                  />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language &amp; currency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="language">Message language</FieldLabel>
              <Select name="language" defaultValue={preferences.language} items={LANGUAGE_ITEMS}>
                <SelectTrigger id="language" className="w-full">
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
            </Field>

            <Field>
              <FieldLabel htmlFor="displayCurrency">Display currency</FieldLabel>
              <Select
                name="displayCurrency"
                defaultValue={preferences.display_currency}
                items={CURRENCY_ITEMS}
              >
                <SelectTrigger id="displayCurrency" className="w-full">
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
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {save.error ? (
          <p role="alert" className="text-sm text-destructive sm:mr-auto">
            {save.error.message}
          </p>
        ) : null}
        <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
      </div>
    </form>
  );
}
