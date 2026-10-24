"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = trpc.identity.updateProfile.useMutation({
    onSuccess: () => toast.success("Profile updated."),
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
    <Card>
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ""} required autoComplete="name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Email</FieldLabel>
              <Input id="profile-email" value={profile.email ?? ""} readOnly disabled />
            </Field>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4">
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={profile.phone ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="countryCode">Country</FieldLabel>
                <Input
                  id="countryCode"
                  name="countryCode"
                  placeholder="SO"
                  maxLength={2}
                  className="uppercase"
                  defaultValue={profile.country_code ?? ""}
                />
              </Field>
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
