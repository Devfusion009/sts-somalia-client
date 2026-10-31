"use client";

import { useRef, useState, useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
        toast.success("Request sent.");
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
      className="w-full bg-card p-5 sm:p-6 lg:p-7"
    >
      <h3 className="font-heading text-2xl font-semibold tracking-tight">Request a callback</h3>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="callback-name">Your name</FieldLabel>
          <Input
            id="callback-name"
            name="name"
            autoComplete="name"
            placeholder="Amina Hassan"
            required
            className="h-12 rounded-xl bg-background shadow-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "callback-error" : undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="callback-phone">Phone / WhatsApp</FieldLabel>
          <Input
            id="callback-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+252 61 1234567"
            required
            className="h-12 rounded-xl bg-background shadow-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "callback-error" : undefined}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="callback-service">What do you need?</FieldLabel>
          <Select value={service} onValueChange={(value) => setService(value ? String(value) : null)}>
            <SelectTrigger id="callback-service" className="h-12! w-full rounded-xl bg-background shadow-none">
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
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="callback-message">
            Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id="callback-message"
            name="message"
            rows={3}
            className="min-h-24 rounded-xl bg-background shadow-none"
            placeholder="Travel dates, destination, number of travellers…"
          />
        </Field>
      </div>

      {error ? (
        <FieldError id="callback-error" className="mt-4">
          {error}
        </FieldError>
      ) : null}

      <Button
        type="submit"
        loading={pending}
        className="mt-6 h-12 w-full rounded-xl bg-brand-accent text-base font-semibold text-brand-accent-foreground hover:bg-brand-accent/90"
      >
        {pending ? null : <PhoneCall aria-hidden />}
        Call me back
      </Button>
    </form>
  );
}
