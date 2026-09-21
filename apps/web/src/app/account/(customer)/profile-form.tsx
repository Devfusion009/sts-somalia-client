"use client";

import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = trpc.identity.updateProfile.useMutation();

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
        <CardTitle>Profile</CardTitle>
        <CardDescription>{profile.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {updateProfile.error ? (
            <Alert variant="destructive">
              <AlertDescription>{updateProfile.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {updateProfile.isSuccess ? (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>Profile updated.</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryCode">Country code</Label>
              <Input
                id="countryCode"
                name="countryCode"
                placeholder="SO"
                maxLength={2}
                defaultValue={profile.country_code ?? ""}
              />
            </div>
          </div>
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
