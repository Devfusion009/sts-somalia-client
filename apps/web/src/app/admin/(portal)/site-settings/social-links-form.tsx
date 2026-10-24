"use client";

import { useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { SOCIAL_ICONS } from "@/components/ui/social-icons";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_ORDER, type SocialLink } from "@/lib/social-platforms";
import { saveSocialLinks } from "@/modules/admin/site-settings/actions";
import { SettingsFooter } from "./form-footer";

export function SocialLinksForm({ links }: { links: SocialLink[] }) {
  const [state, action] = useActionState(saveSocialLinks, null);
  const urlByPlatform = new Map(links.map((l) => [l.platform, l.url]));

  return (
    <Card>
      <CardContent>
        <form action={action} className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {SOCIAL_PLATFORM_ORDER.map((platform) => {
              const Icon = SOCIAL_ICONS[platform];
              const meta = SOCIAL_PLATFORMS[platform];
              return (
                <Field key={platform}>
                  <FieldLabel htmlFor={`social-${platform}`} className="flex items-center gap-2">
                    <Icon sx={{ fontSize: 16 }} aria-hidden="true" /> {meta.label}
                  </FieldLabel>
                  <Input
                    id={`social-${platform}`}
                    name={platform}
                    type="url"
                    inputMode="url"
                    defaultValue={urlByPlatform.get(platform) ?? ""}
                    placeholder={meta.placeholder}
                    autoComplete="off"
                  />
                </Field>
              );
            })}
          </div>
          <SettingsFooter state={state}>
            <SubmitButton size="sm" pendingText="Saving…">
              Save links
            </SubmitButton>
          </SettingsFooter>
        </form>
      </CardContent>
    </Card>
  );
}
