"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
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
import { CountrySearchSelect } from "@/components/ui/country-select";
import { COUNTRY_NAMES, countryName } from "@/lib/countries";
import { visaCardImage, visaImageUrl } from "@/modules/visa/images";
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
type CentreOption = { id: string; name: string; city: string; is_active: boolean };

const DELIVERY_OPTIONS = [
  { value: "counter", label: "Counter collection" },
  { value: "courier", label: "Courier" },
  { value: "third_party", label: "Authorised third party" },
];

/** Checkbox rendered as a pill — a boolean capability in one click. */
function TogglePill({ name, value, label, defaultChecked }: { name: string; value?: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-flex rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {label}
      </span>
    </label>
  );
}

/** Cover photo picker: previews what visitors will see and swaps in the chosen file before saving. */
function CoverImageField({ visaType }: { visaType?: VisaType }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const hasUpload = !!visaImageUrl(visaType?.cover_image);
  const current = visaType ? visaCardImage(visaType) : null;
  const preview = picked ?? current;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border bg-muted sm:w-56">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: and bucket URLs, no optimizer
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageIcon className="size-7" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          name="coverImage"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (pickedRef.current) URL.revokeObjectURL(pickedRef.current);
            pickedRef.current = file ? URL.createObjectURL(file) : null;
            setPicked(pickedRef.current);
          }}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          {preview ? "Replace image" : "Upload image"}
        </Button>
        {hasUpload ? <TogglePill name="removeCoverImage" label="Remove custom image" defaultChecked={false} /> : null}
      </div>
    </div>
  );
}

export function VisaTypeEditor({
  visaType,
  centres = [],
  selectedCentreIds = [],
}: {
  visaType?: VisaType;
  centres?: CentreOption[];
  selectedCentreIds?: string[];
}) {
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
              <Label htmlFor="destinationCountryCode">Country</Label>
              <CountrySearchSelect
                id="destinationCountryCode"
                name="destinationCountryCode"
                defaultValue={visaType && visaType.destination_country_code in COUNTRY_NAMES ? visaType.destination_country_code : undefined}
                placeholder="Search for a country"
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
            <Label htmlFor="overview">Overview</Label>
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

        <Section title="Cover image">
          <CoverImageField visaType={visaType} />
        </Section>

        <Section title="Price &amp; processing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={visaType?.price} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processingFee">Internal processing fee</Label>
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

        <Section title="Case workflow">
          <div className="space-y-2">
            <Label>Steps</Label>
            <div className="flex flex-wrap gap-2">
              <TogglePill name="requiresAppointment" label="Appointment" defaultChecked={visaType?.requires_appointment ?? false} />
              <TogglePill name="requiresBiometrics" label="Biometrics" defaultChecked={visaType?.requires_biometrics ?? false} />
              <TogglePill
                name="requiresPhysicalPassport"
                label="Physical passport"
                defaultChecked={visaType?.requires_physical_passport ?? false}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Passport return</Label>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_OPTIONS.map((o) => (
                <TogglePill
                  key={o.value}
                  name="passportDeliveryModes"
                  value={o.value}
                  label={o.label}
                  defaultChecked={(visaType?.passport_delivery_modes ?? ["counter"]).includes(o.value)}
                />
              ))}
            </div>
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="internalSlaDays">Internal handling target (days)</Label>
            <Input
              id="internalSlaDays"
              name="internalSlaDays"
              type="number"
              min={0}
              max={60}
              defaultValue={visaType?.internal_sla_days ?? 2}
            />
          </div>
          {centres.length > 0 ? (
            <div className="space-y-2">
              <Label>Application centres</Label>
              <div className="flex flex-wrap gap-2">
                {centres.map((c) => (
                  <TogglePill
                    key={c.id}
                    name="centreIds"
                    value={c.id}
                    label={`${c.name} — ${c.city}${c.is_active ? "" : " (inactive)"}`}
                    defaultChecked={selectedCentreIds.includes(c.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
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
              placeholder="One requirement per line"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
            <Textarea
              id="termsAndConditions"
              name="termsAndConditions"
              rows={4}
              defaultValue={visaType?.terms_and_conditions ?? ""}
              placeholder="Optional"
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
            Featured
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
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
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
