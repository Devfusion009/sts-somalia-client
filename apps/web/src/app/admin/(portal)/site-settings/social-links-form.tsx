"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { SOCIAL_ICONS } from "@/components/ui/social-icons";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_ORDER, type SocialLink } from "@/lib/social-platforms";
import { saveSocialLinks } from "@/modules/admin/site-settings/actions";

export function SocialLinksForm({ links }: { links: SocialLink[] }) {
  const [state, action] = useActionState(saveSocialLinks, null);
  const urlByPlatform = new Map(links.map((l) => [l.platform, l.url]));

  return (
    <Card>
      <CardContent className="p-5">
        <form action={action} className="space-y-5">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {SOCIAL_PLATFORM_ORDER.map((platform) => {
              const Icon = SOCIAL_ICONS[platform];
              const meta = SOCIAL_PLATFORMS[platform];
              return (
                <div key={platform} className="space-y-1.5">
                  <Label htmlFor={`social-${platform}`} className="flex items-center gap-2 text-sm">
                    <Icon sx={{ fontSize: 16 }} /> {meta.label}
                  </Label>
                  <Input
                    id={`social-${platform}`}
                    name={platform}
                    type="url"
                    inputMode="url"
                    defaultValue={urlByPlatform.get(platform) ?? ""}
                    placeholder={meta.placeholder}
                    autoComplete="off"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-t pt-4">
            <SubmitButton size="sm" pendingText="Saving…">
              Save links
            </SubmitButton>
            {state && !state.error ? (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" /> Saved.
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
