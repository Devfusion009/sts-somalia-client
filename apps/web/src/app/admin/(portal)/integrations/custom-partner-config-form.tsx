"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { saveCustomPartnerConfig } from "@/modules/admin/integrations/actions";

type CustomConfig = {
  submit?: { url?: string; method?: string; bodyTemplate?: unknown; refPath?: string; statusPath?: string };
  sync?: { urlTemplate?: string; method?: string; statusPath?: string };
  webhook?: { refField?: string; statusField?: string };
  statusMap?: Record<string, string>;
};

/**
 * The custom adapter's request/response shape — everything
 * modules/visa/partner/adapters/custom.ts needs to submit an application,
 * poll a status, and read a webhook payload, without a line of adapter
 * code. Field syntax lives in placeholders, not in the label sentence —
 * a label stays a name, per this project's copy standard.
 */
export function CustomPartnerConfigForm({ config }: { config: Record<string, unknown> }) {
  const cfg = config as CustomConfig;
  const [state, formAction] = useActionState(saveCustomPartnerConfig, null);

  return (
    <form action={formAction} className="max-w-3xl space-y-6 border-t pt-5">
      <h4 className="font-heading text-sm font-semibold">Request shape</h4>

      <FieldSet>
        <FieldLegend variant="label">Submit</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field>
            <FieldLabel htmlFor="submitUrl">Submit URL</FieldLabel>
            <Input id="submitUrl" name="submitUrl" placeholder="https://api.partner.com/visa/applications" defaultValue={cfg.submit?.url} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="submitMethod">Method</FieldLabel>
            <Select name="submitMethod" defaultValue={cfg.submit?.method ?? "POST"}>
              <SelectTrigger id="submitMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="submitBodyTemplate">Request body template</FieldLabel>
          <Textarea
            id="submitBodyTemplate"
            name="submitBodyTemplate"
            rows={4}
            className="font-mono text-xs"
            placeholder={'{\n  "name": "{{traveler.full_name}}",\n  "passport": "{{traveler.passport_number}}",\n  "destination": "{{visaType.destinationCountryCode}}"\n}'}
            defaultValue={cfg.submit?.bodyTemplate ? JSON.stringify(cfg.submit.bodyTemplate, null, 2) : ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="submitRefPath">Reference path</FieldLabel>
            <Input id="submitRefPath" name="submitRefPath" placeholder="data.id" defaultValue={cfg.submit?.refPath} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="submitStatusPath">Status path</FieldLabel>
            <Input id="submitStatusPath" name="submitStatusPath" placeholder="data.status (optional)" defaultValue={cfg.submit?.statusPath} />
          </Field>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Status sync</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field>
            <FieldLabel htmlFor="syncUrlTemplate">Status URL</FieldLabel>
            <Input
              id="syncUrlTemplate"
              name="syncUrlTemplate"
              placeholder="https://api.partner.com/visa/applications/{{ref}} (optional)"
              defaultValue={cfg.sync?.urlTemplate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="syncMethod">Method</FieldLabel>
            <Select name="syncMethod" defaultValue={cfg.sync?.method ?? "GET"}>
              <SelectTrigger id="syncMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="syncStatusPath">Status path</FieldLabel>
          <Input id="syncStatusPath" name="syncStatusPath" placeholder="data.status" defaultValue={cfg.sync?.statusPath} />
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Webhook fields</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="webhookRefField">Reference field</FieldLabel>
            <Input id="webhookRefField" name="webhookRefField" placeholder="partner_ref" defaultValue={cfg.webhook?.refField} />
          </Field>
          <Field>
            <FieldLabel htmlFor="webhookStatusField">Status field</FieldLabel>
            <Input id="webhookStatusField" name="webhookStatusField" placeholder="status" defaultValue={cfg.webhook?.statusField} />
          </Field>
        </div>
      </FieldSet>

      <Field>
        <FieldLabel htmlFor="statusMap">Status map</FieldLabel>
        <Textarea
          id="statusMap"
          name="statusMap"
          rows={4}
          className="font-mono text-xs"
          placeholder={'{\n  "received": "in_review",\n  "approved": "approved",\n  "rejected": "rejected",\n  "completed": "issued"\n}'}
          defaultValue={cfg.statusMap ? JSON.stringify(cfg.statusMap, null, 2) : ""}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {state?.error ? (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <SubmitButton size="sm" pendingText="Saving…">
          Save request shape
        </SubmitButton>
      </div>
    </form>
  );
}
