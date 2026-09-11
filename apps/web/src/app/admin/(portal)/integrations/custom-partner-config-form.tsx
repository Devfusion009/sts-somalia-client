"use client";

import { useActionState } from "react";
import { Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <form action={formAction} className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Settings2 className="size-3.5" />
        Request shape
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="max-w-3xl space-y-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">Submit</p>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="space-y-1.5">
            <Label htmlFor="submitUrl">Submit URL</Label>
            <Input id="submitUrl" name="submitUrl" placeholder="https://api.partner.com/visa/applications" defaultValue={cfg.submit?.url} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submitMethod">Method</Label>
            <Select name="submitMethod" defaultValue={cfg.submit?.method ?? "POST"}>
              <SelectTrigger id="submitMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="submitBodyTemplate">Request body template</Label>
          <Textarea
            id="submitBodyTemplate"
            name="submitBodyTemplate"
            rows={4}
            className="font-mono text-xs"
            placeholder={'{\n  "name": "{{traveler.full_name}}",\n  "passport": "{{traveler.passport_number}}",\n  "destination": "{{visaType.destinationCountryCode}}"\n}'}
            defaultValue={cfg.submit?.bodyTemplate ? JSON.stringify(cfg.submit.bodyTemplate, null, 2) : ""}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="submitRefPath">Reference path</Label>
            <Input id="submitRefPath" name="submitRefPath" placeholder="data.id" defaultValue={cfg.submit?.refPath} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submitStatusPath">Status path</Label>
            <Input id="submitStatusPath" name="submitStatusPath" placeholder="data.status (optional)" defaultValue={cfg.submit?.statusPath} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">Status sync</p>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="space-y-1.5">
            <Label htmlFor="syncUrlTemplate">Status URL</Label>
            <Input
              id="syncUrlTemplate"
              name="syncUrlTemplate"
              placeholder="https://api.partner.com/visa/applications/{{ref}} (optional)"
              defaultValue={cfg.sync?.urlTemplate}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="syncMethod">Method</Label>
            <Select name="syncMethod" defaultValue={cfg.sync?.method ?? "GET"}>
              <SelectTrigger id="syncMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="syncStatusPath">Status path</Label>
          <Input id="syncStatusPath" name="syncStatusPath" placeholder="data.status" defaultValue={cfg.sync?.statusPath} />
        </div>
      </div>

      <div className="max-w-3xl space-y-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground">Webhook fields</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="webhookRefField">Reference field</Label>
            <Input id="webhookRefField" name="webhookRefField" placeholder="partner_ref" defaultValue={cfg.webhook?.refField} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhookStatusField">Status field</Label>
            <Input id="webhookStatusField" name="webhookStatusField" placeholder="status" defaultValue={cfg.webhook?.statusField} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-1.5 rounded-lg border bg-muted/30 p-4">
        <Label htmlFor="statusMap">Status map</Label>
        <Textarea
          id="statusMap"
          name="statusMap"
          rows={4}
          className="font-mono text-xs"
          placeholder={'{\n  "received": "in_review",\n  "approved": "approved",\n  "rejected": "rejected",\n  "completed": "issued"\n}'}
          defaultValue={cfg.statusMap ? JSON.stringify(cfg.statusMap, null, 2) : ""}
        />
      </div>

      <SubmitButton size="sm" pendingText="Saving…">
        Save request shape
      </SubmitButton>
    </form>
  );
}
