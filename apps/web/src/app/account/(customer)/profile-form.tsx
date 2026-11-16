"use client";

import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/ui/phone-input";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const updateProfile = trpc.identity.updateProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated."); router.refresh(); },
  });

  // async + awaited mutateAsync, same reasoning as affiliate/links/new-link-form.tsx
  // (SubmitButton's useFormStatus()-based pending state needs an awaited action).
  async function handleSubmit(formData: FormData) {
    try {
      await updateProfile.mutateAsync({
        fullName: formData.get("fullName") as string,
        phone: (formData.get("phone") as string) || undefined,
        countryCode: (formData.get("countryCode") as string) || undefined,
      });
    } catch {
      // handled via updateProfile.error below
    }
  }

  return (
    <Card id="contact-details" className="h-full scroll-mt-20">
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ""} required autoComplete="name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Sign-in email</FieldLabel>
              <Input id="profile-email" value={profile.email ?? ""} readOnly disabled />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="phone">Mobile number</FieldLabel><PhoneInput id="phone" name="phone" defaultValue={profile.phone ?? ""} validateNumber /></Field>
              <Field><FieldLabel htmlFor="countryCode">Country of residence</FieldLabel><CountrySearchSelect id="countryCode" name="countryCode" defaultValue={profile.country_code ?? ""} placeholder="Select country" className="h-10 text-sm" /></Field>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {updateProfile.error ? (
                <p role="alert" className="text-sm text-destructive sm:mr-auto">
                  {updateProfile.error.message}
                </p>
              ) : null}
              <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
