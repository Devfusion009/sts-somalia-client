"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subscribeNewsletter } from "@/components/marketing/lead-actions";

/** Inline email capture for the pre-footer strip. */
export function NewsletterSignup() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await subscribeNewsletter(formData);
      if (result.ok) {
        setError(null);
        formRef.current?.reset();
        toast.success("You're on the list!", {
          description: "Fare deals and travel updates, straight to your inbox.",
        });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="w-full max-w-md">
      <Label htmlFor="newsletter-email" className="sr-only">
        Email address
      </Label>
      <div className="flex gap-2">
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          className="h-12 flex-1 border-white/20 bg-white/10 text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/40 dark:bg-white/10"
        />
        <Button
          type="submit"
          disabled={pending}
          aria-label="Subscribe"
          className="h-12 shrink-0 bg-brand-accent px-5 font-semibold text-brand-accent-foreground hover:bg-brand-accent/90"
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          <span className="hidden sm:inline">Subscribe</span>
        </Button>
      </div>
      {error ? (
        <p id="newsletter-error" role="alert" aria-live="polite" className="mt-2 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
