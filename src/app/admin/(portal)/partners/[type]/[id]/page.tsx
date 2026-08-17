import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  CheckCircle2,
  Circle,
  BedDouble,
  Landmark,
  Link2,
  ShieldAlert,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getPartnerAccount,
  evaluateAutoLive,
  ACCOUNT_TYPE_FROM_SLUG,
  ACCOUNT_TYPE_LABEL,
  type PartnerAccountStatus,
} from "@/modules/admin/partner-accounts";
import {
  BusinessDetailsCard,
  AffiliateDetailCards,
  type Details,
} from "@/modules/partner-applications/components/detail-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusActions } from "./status-actions";
import { ListingStatusControl } from "./listing-status-control";
import {
  CommercialTermsForm,
  AccountNotesForm,
  SendReminderButton,
  AddMemberForm,
  MemberRowControls,
  AffiliateCommissionPayoutForm,
} from "./console-forms";

export const metadata: Metadata = { title: "Partner Account" };

const ACCOUNT_STATUS_STYLES: Record<PartnerAccountStatus, string> = {
  onboarding: "bg-chart-3/10 text-chart-3",
  live: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
  offboarded: "bg-muted text-muted-foreground",
};

const DOC_REVIEW_STYLES: Record<string, string> = {
  verified: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  pending: "bg-brand-gold/15 text-brand-gold",
};

function money(amount: number, currency = "USD") {
  return `${currency} ${amount.toFixed(2)}`;
}

function KeyDate({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ? format(new Date(value), "d MMM yyyy, HH:mm") : "—"}</dd>
    </div>
  );
}

export default async function PartnerAccountConsolePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  await requirePlatformAdmin();
  const { type: slug, id } = await params;
  const type = ACCOUNT_TYPE_FROM_SLUG[slug];
  if (!type) notFound();

  let detail = await getPartnerAccount(decodeURIComponent(id));
  if (!detail || detail.account.type !== type) notFound();

  // Automatic onboarding -> live promotion, evaluated on load (idempotent).
  detail = await evaluateAutoLive(detail);

  const { account, application, entity, members, events, docReviews, checklist } = detail;
  const applicationHref = `/admin/applications/${slug}/${application.id}`;
  const doneCount = checklist.filter((i) => i.done).length;
  const progressPct = Math.round((doneCount / checklist.length) * 100);
  const docsVerified = checklist.find((i) => i.key === "docs_verified")?.done ?? false;

  const supabase = await createClient();
  const signedDocs = await Promise.all(
    application.document_refs.map(async (doc) => {
      const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: data?.signedUrl ?? null, review: docReviews.get(doc.key) };
    })
  );

  const typeSpecificTabLabel =
    type === "agency" ? "Portfolio" : type === "hotel_partner" ? "Properties" : type === "venue_partner" ? "Venues" : "Affiliate";

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1 text-muted-foreground"
        render={<Link href="/admin/partners" />}
      >
        <ArrowLeft className="size-3.5" /> All partner accounts
      </Button>

      {/* Header — always present regardless of tab */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">{entity.name}</h1>
            <Badge variant="outline">{ACCOUNT_TYPE_LABEL[type]}</Badge>
            <Badge className={cn("border-transparent capitalize", ACCOUNT_STATUS_STYLES[account.status])}>
              {account.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{account.id}</span>
            {entity.contactEmail ? ` · ${entity.contactEmail}` : ""}
            {entity.contactPhone ? ` · ${entity.contactPhone}` : ""}
          </p>
          <Link href={applicationHref} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <FileText className="size-3" /> View original application
          </Link>
        </div>
        <StatusActions accountId={account.id} status={account.status} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="portfolio">{typeSpecificTabLabel}</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="notes">Internal Notes</TabsTrigger>
        </TabsList>

        {/* ------------------------------- Overview ------------------------------ */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Primary contact</dt>
                    <dd className="text-sm font-medium">{application.applicant?.full_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="text-sm font-medium break-words">{application.applicant?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="text-sm font-medium">{application.applicant?.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Approved by</dt>
                    <dd className="text-sm font-medium">
                      {(application.reviewer as { full_name?: string | null; email?: string } | null)?.full_name ??
                        (application.reviewer as { email?: string } | null)?.email ??
                        "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key dates</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <KeyDate label="Application submitted" value={application.submitted_at} />
                  <KeyDate label="Approved" value={application.reviewed_at} />
                  <KeyDate label="Went live" value={account.went_live_at} />
                  {account.suspended_at ? <KeyDate label="Last suspended" value={account.suspended_at} /> : null}
                  {account.offboarded_at ? <KeyDate label="Offboarded" value={account.offboarded_at} /> : null}
                </dl>
              </CardContent>
            </Card>
          </div>

          {type === "affiliate" ? (
            <AffiliateDetailCards details={(application.business_details ?? {}) as Details} />
          ) : (
            <BusinessDetailsCard kind={type} details={(application.business_details ?? {}) as Details} />
          )}
        </TabsContent>

        {/* ------------------------------ Onboarding ----------------------------- */}
        <TabsContent value="onboarding" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Onboarding — {doneCount}/{checklist.length} complete
                  </CardTitle>
                  <CardDescription>
                    {account.status === "onboarding"
                      ? "The account goes live automatically the moment every item is complete."
                      : "Completed items are computed live from real data."}
                  </CardDescription>
                </div>
                {account.status === "onboarding" ? <SendReminderButton accountId={account.id} /> : null}
              </div>
              <Progress value={progressPct} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item) => (
                <div key={item.key} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className={cn("text-sm font-medium", item.done && "text-muted-foreground line-through")}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------- Properties / Portfolio / stub -------------------- */}
        <TabsContent value="portfolio" className="mt-4 space-y-4">
          {type === "hotel_partner" ? (
            detail.hotels.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No properties listed yet — the partner creates these in their own portal.
                </CardContent>
              </Card>
            ) : (
              <>
                {!docsVerified && detail.hotels.some((h) => h.status === "published") ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <ShieldAlert className="size-4 shrink-0" />
                    This partner has a published (live, bookable) property, but KYC documents
                    aren&apos;t all verified yet — check the Documents tab.
                  </div>
                ) : null}
                {detail.hotels.map((hotel) => (
                <Card key={hotel.id} className="overflow-hidden py-0">
                  <CardHeader className="border-b border-border !py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BedDouble className="size-4" /> {hotel.name}
                        <span className="text-xs font-normal text-muted-foreground">
                          {hotel.city}
                          {hotel.star_rating ? ` · ${hotel.star_rating}★` : ""}
                        </span>
                      </CardTitle>
                      <ListingStatusControl kind="hotel" id={hotel.id} currentStatus={hotel.status} />
                    </div>
                  </CardHeader>
                  {hotel.rooms.length === 0 ? (
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No room types configured yet.
                    </CardContent>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Rate / night</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hotel.rooms.map((room) => (
                          <TableRow key={room.id}>
                            <TableCell className="font-medium">{room.name}</TableCell>
                            <TableCell>
                              <ListingStatusControl kind="room" id={room.id} currentStatus={room.status} />
                            </TableCell>
                            <TableCell className="text-right">{money(room.base_price, room.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
                ))}
              </>
            )
          ) : type === "venue_partner" ? (
            detail.venues.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No venues listed yet — the partner creates these in their own Venue Portal.
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venue</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Base price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.venues.map((venue) => (
                      <TableRow key={venue.id}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell>{venue.city}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {venue.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(venue.basePrice, venue.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )
          ) : type === "agency" ? (
            <>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {[
                  {
                    label: "Wallet balance",
                    value: money(detail.agencySnapshot?.creditBalance ?? 0),
                  },
                  { label: "Credit limit", value: money(detail.agencySnapshot?.creditLimit ?? 0) },
                  { label: "Tier", value: detail.agencySnapshot?.tierName ?? "None" },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 font-heading text-xl font-bold">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
                  <div>
                    <p className="text-sm font-medium">Full agency finance console</p>
                    <p className="text-xs text-muted-foreground">
                      Wallet top-ups, credit/debit notes, tiers, markups and ledgers live in the dedicated agency
                      console.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    render={<Link href={`/admin/agencies/${account.entity_id}`} />}
                  >
                    <Landmark className="size-3.5" /> Open finance console
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="size-4" /> Affiliate program
                </CardTitle>
                <CardDescription>
                  Referral performance lives in the affiliate&apos;s own dashboard — this view will grow as the
                  program does.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Referral code</dt>
                    <dd className="font-mono text-sm font-medium">{detail.affiliateSnapshot?.referralCode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Links created</dt>
                    <dd className="text-sm font-medium">{detail.affiliateSnapshot?.linkCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total earned</dt>
                    <dd className="text-sm font-medium">{money(detail.affiliateSnapshot?.totalEarned ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total paid</dt>
                    <dd className="text-sm font-medium">{money(detail.affiliateSnapshot?.totalPaid ?? 0)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ------------------------------ Commercial ----------------------------- */}
        <TabsContent value="commercial" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commercial terms</CardTitle>
              <CardDescription>
                Commission is the platform&apos;s cut{type === "hotel_partner" ? " of each completed stay" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommercialTermsForm
                accountId={account.id}
                commissionRate={entity.commissionRate}
                paymentTerms={account.payment_terms}
              />
            </CardContent>
          </Card>

          {type === "affiliate" && detail.affiliateSnapshot ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Commission Payout</CardTitle>
                <CardDescription>
                  Total earned {money(detail.affiliateSnapshot.totalEarned)} · total paid out{" "}
                  {money(detail.affiliateSnapshot.totalPaid)}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AffiliateCommissionPayoutForm accountId={account.id} affiliateId={detail.affiliateSnapshot.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b border-border !py-4">
              <CardTitle className="text-base">Payout history</CardTitle>
            </CardHeader>
            {detail.payouts.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No payouts recorded yet.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(payout.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">{payout.method ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{payout.reference ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(payout.amount, payout.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ------------------------------ Documents ------------------------------ */}
        <TabsContent value="documents" className="mt-4">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b border-border !py-4">
              <CardTitle className="text-base">
                KYC documents ({signedDocs.length})
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {signedDocs.filter((d) => d.review?.status === "verified").length} verified — review them on the
                  original application
                </span>
              </CardTitle>
            </CardHeader>
            {signedDocs.length === 0 ? (
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No documents on file.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signedDocs.map((doc) => (
                    <TableRow key={doc.key}>
                      <TableCell>
                        <p className="text-sm font-medium">{doc.label}</p>
                        <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.uploaded_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            DOC_REVIEW_STYLES[doc.review?.status ?? "pending"]
                          )}
                        >
                          {doc.review?.status ?? "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {doc.url ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                            className="gap-1 text-primary"
                          >
                            View <ExternalLink className="size-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* -------------------------------- Users -------------------------------- */}
        <TabsContent value="users" className="mt-4 space-y-4">
          {type === "affiliate" ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Affiliate accounts are single-user — the affiliate signs in with their own account.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden py-0">
                <CardHeader className="border-b border-border !py-4">
                  <CardTitle className="text-base">Team logins</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-medium">{member.profile?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{member.profile?.email}</p>
                        </TableCell>
                        <TableCell className="capitalize">{member.role.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <MemberRowControls accountId={account.id} type={type} member={member} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add a team member</CardTitle>
                  <CardDescription>They need an existing STS account — ask them to sign up first.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AddMemberForm accountId={account.id} type={type} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ------------------------------- Activity ------------------------------ */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity log</CardTitle>
              <CardDescription>Every status change and admin action on this account, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize">{event.action.replace(/_/g, " ")}</span>
                          {event.from_status && event.to_status ? (
                            <span className="text-xs text-muted-foreground capitalize">
                              {event.from_status} → {event.to_status}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "d MMM yyyy, HH:mm")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by {event.actor ? (event.actor.full_name ?? event.actor.email) : "System"}
                          </span>
                        </p>
                        {event.reason ? <p className="text-xs text-muted-foreground">{event.reason}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------- Notes ------------------------------- */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
              <CardDescription>Admin-only — never visible to the partner.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccountNotesForm accountId={account.id} initialNotes={account.internal_notes} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
