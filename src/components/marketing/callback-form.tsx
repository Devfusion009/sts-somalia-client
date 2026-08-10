"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestCallback } from "@/components/marketing/lead-actions";

const SERVICES = [
  { value: "flights", label: "Flights" },
  { value: "hotels", label: "Hotels" },
  { value: "visa", label: "Visa" },
  { value: "umrah", label: "Umrah" },
  { value: "events", label: "Events & halls" },
  { value: "other", label: "Something else" },
];

/**
 * Callback-request card. Controlled fields + a manual transition (instead of
 * `<form action>`) so a validation error never wipes what the user typed —
 * React 19 resets uncontrolled action-forms on submit.
 */
export function CallbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (service) formData.set("service", service);

    startTransition(async () => {
      const result = await requestCallback(formData);
      if (result.ok) {
        setError(null);
        setService(null);
        formRef.current?.reset();
        toast.success("Request received!", {
          description: "Our team will call you back within business hours.",
        });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/25 lg:p-8"
    >
      <h3 className="font-heading text-xl font-semibold">Request a callback</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Leave your number — a travel expert calls you back, usually within the hour.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="callback-name">Your name</Label>
          <Input
            id="callback-name"
            name="name"
            autoComplete="name"
            placeholder="Amina Hassan"
            required
            className="h-12"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "callback-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="callback-phone">Phone / WhatsApp</Label>
          <Input
            id="callback-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+252 61 1234567"
            required
            className="h-12"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "callback-error" : undefined}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="callback-service">What do you need?</Label>
          <Select value={service} onValueChange={(value) => setService(value ? String(value) : null)}>
            <SelectTrigger id="callback-service" className="h-12 w-full">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {SERVICES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="callback-message">
            Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="callback-message"
            name="message"
            rows={3}
            placeholder="Travel dates, destination, number of travellers…"
          />
        </div>
      </div>

      {error ? (
        <p id="callback-error" role="alert" aria-live="polite" className="mt-4 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="mt-6 h-12 w-full bg-brand-accent text-base font-semibold text-brand-accent-foreground hover:bg-brand-accent/90"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          <>
            <PhoneCall aria-hidden /> Call me back
          </>
        )}
      </Button>
    </form>
  );
}
