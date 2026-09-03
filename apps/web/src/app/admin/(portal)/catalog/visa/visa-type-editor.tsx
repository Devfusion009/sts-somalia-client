"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createVisaType, updateVisaType } from "@/modules/admin/actions";
import { documentSlotsToRows, applicationQuestionsToRows } from "@/modules/admin/visa-type-utils";
import { providersByCategory } from "@/lib/provider-catalog";
import { countryName } from "@/lib/countries";
import type { Database } from "@/lib/types/database.types";
import { DocumentSlotsField } from "./document-slots-field";
import { ApplicationQuestionsField } from "./application-questions-field";

type VisaType = Database["public"]["Tables"]["visa_types"]["Row"];

// Partners configured in the provider catalog (none until STS signs one),
// plus the always-available manual hand-off — same "manual is always an
// option" convention the payments module uses for bank transfer / cash.
const PARTNER_OPTIONS = [
  { key: "manual", name: "Manual hand-off (default)" },
  ...providersByCategory("visa_processing").map((p) => ({ key: p.key, name: p.name })),
];

const STATUS_VARIANT: Record<string, "default" | "secondary"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "secondary",
};

/** A section of the form — visually separated so a 20+ field editor still reads as organized, not one long wall. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Full-page visa type editor — replaces the old Dialog-based form. A ~25
 * field form (basic info, pricing, documents, application questions,
 * eligibility, terms) never fit in a modal; a dedicated page with clearly
 * separated sections and normal page scroll is the right shape for this,
 * not a bigger dialog.
 */
export function VisaTypeEditor({ visaType }: { visaType?: VisaType }) {
  const isEdit = !!visaType;
  const action = isEdit ? updateVisaType : createVisaType;
  const [state, formAction] = useActionState(action, null);
  const [processingMode, setProcessingMode] = useState(visaType?.processing_mode ?? "in_house");

  return (
    <div className="space-y-6 pb-24">
      <div>
        <BackLink href="/admin/catalog/visa" label="All visa types" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            {isEdit ? `Edit visa type` : "Add visa type"}
          </h1>
          {visaType ? (
            <>
              <Badge variant={STATUS_VARIANT[visaType.status] ?? "secondary"} className="capitalize">
                {visaType.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {countryName(visaType.destination_country_code)} · {visaType.name}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        {visaType ? <input type="hidden" name="id" value={visaType.id} /> : null}

        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Section title="Basic information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="destinationCountryCode">Country code (2 letters)</Label>
              <Input
                id="destinationCountryCode"
                name="destinationCountryCode"
                maxLength={2}
                defaultValue={visaType?.destination_country_code}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue={visaType?.currency ?? "USD"} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={visaType?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={visaType?.description ?? ""} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="overview">Overview (shown on the detail page)</Label>
            <Textarea id="overview" name="overview" defaultValue={visaType?.overview ?? ""} rows={3} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visaCategory">Category</Label>
              <Select name="visaCategory" defaultValue={visaType?.visa_category ?? "tourist"}>
                <SelectTrigger id="visaCategory" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tourist">Tourist</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="transit">Transit</SelectItem>
                  <SelectItem value="umrah">Umrah</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="family_visit">Family visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryType">Entries</Label>
              <Select name="entryType" defaultValue={visaType?.entry_type ?? "single"}>
                <SelectTrigger id="entryType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single entry</SelectItem>
                  <SelectItem value="multiple">Multiple entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Price &amp; processing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price (charged to customer)</Label>
              <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={visaType?.price} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processingFee">Processing fee (internal only — not shown to customer)</Label>
              <Input
                id="processingFee"
                name="processingFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={visaType?.processing_fee ?? undefined}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="validityDays">Visa validity (days)</Label>
              <Input
                id="validityDays"
                name="validityDays"
                type="number"
                min={0}
                defaultValue={visaType?.validity_days ?? undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stayDays">Max stay per visit (days)</Label>
              <Input id="stayDays" name="stayDays" type="number" min={0} defaultValue={visaType?.stay_days ?? undefined} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="processingDaysMin">Processing time — min (working days)</Label>
              <Input
                id="processingDaysMin"
                name="processingDaysMin"
                type="number"
                min={0}
                defaultValue={visaType?.processing_days_min ?? undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processingDaysMax">Processing time — max (working days)</Label>
              <Input
                id="processingDaysMax"
                name="processingDaysMax"
                type="number"
                min={0}
                defaultValue={visaType?.processing_days_max ?? undefined}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="processingMode">Who processes it</Label>
              <Select
                name="processingMode"
                defaultValue={visaType?.processing_mode ?? "in_house"}
                onValueChange={(value) => setProcessingMode(value as "in_house" | "partner")}
              >
                <SelectTrigger id="processingMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_house">In-house (STS processes it)</SelectItem>
                  <SelectItem value="partner">Partner (hand off to a processing partner)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {processingMode === "partner" ? (
              <div className="space-y-2">
                <Label htmlFor="partnerProviderKey">Partner</Label>
                <Select name="partnerProviderKey" defaultValue={visaType?.partner_provider_key ?? "manual"}>
                  <SelectTrigger id="partnerProviderKey" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_OPTIONS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Required documents">
          <DocumentSlotsField name="requiredDocuments" initialRows={documentSlotsToRows(visaType?.required_documents)} />
        </Section>

        <Section title="Application questions">
          <ApplicationQuestionsField
            name="applicationQuestions"
            initialRows={applicationQuestionsToRows(visaType?.application_questions)}
          />
        </Section>

        <Section title="Eligibility &amp; terms">
          <div className="space-y-2">
            <Label htmlFor="eligibilityRequirements">Eligibility requirements</Label>
            <Textarea
              id="eligibilityRequirements"
              name="eligibilityRequirements"
              rows={4}
              defaultValue={visaType?.eligibility_requirements ?? ""}
              placeholder="Shown on the detail page so customers can check before they start applying."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
            <Textarea
              id="termsAndConditions"
              name="termsAndConditions"
              rows={4}
              defaultValue={visaType?.terms_and_conditions ?? ""}
              placeholder="Shown at Review with an “I agree” checkbox before the customer can submit."
            />
          </div>
        </Section>

        <Section title="Visibility">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={visaType?.is_featured ?? false}
              className="size-4 accent-primary"
            />
            Featured (shown under &ldquo;Popular destinations&rdquo;)
          </label>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={visaType?.status ?? "draft"}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="published">Published — visible to customers</SelectItem>
                <SelectItem value="suspended">Suspended — hidden from customers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Sticky so Save is always reachable without scrolling back down through 25+ fields. */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button type="button" variant="outline" render={<Link href="/admin/catalog/visa" />}>
            Cancel
          </Button>
          <SubmitButton pendingText="Saving…">{isEdit ? "Save changes" : "Create visa type"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
