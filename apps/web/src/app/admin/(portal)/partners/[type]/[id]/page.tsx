import { getAgentCredentialDelivery } from "@/lib/agents/credentials";
import { AgentCredentialDelivery } from "./agent-credential-delivery";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Banknote,
  BedDouble,
  CheckCircle2,
  ChevronRight,
  Circle,
  FileStack,
  FileText,
  History,
  Landmark,
  PartyPopper,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getPartnerAccount,
  evaluateAutoLive,
  ACCOUNT_TYPE_FROM_SLUG,
  ACCOUNT_TYPE_LABEL,
} from "@/modules/admin/partner-accounts";
import {
  BusinessDetailsCard,
  AffiliateDetailCards,
  DocFileIcon,
  type Details,
} from "@/modules/partner-applications/components/detail-cards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";
import { ACCOUNT_STATUS_VARIANT } from "../../status";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { StatusActions } from "./status-actions";
import { ListingStatusControl } from "./listing-status-control";
import { DocumentReviewControls } from "../../../applications/[type]/document-review-controls";
import {
  CommercialTermsForm,
  AccountNotesForm,
  SendReminderButton,
  AddMemberForm,
  MemberRowControls,
  AffiliateCommissionPayoutForm,
} from "./console-forms";

export const metadata: Metadata = { title: "Partner Account" };

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium break-words", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function KeyDate({ label, value }: { label: string; value: string | null }) {
  return (
    <DetailItem label={label} value={value ? format(new Date(value), "d MMM yyyy, HH:mm") : "—"} />
  );
}

const CONSOLE_TABS = ["overview", "onboarding", "portfolio", "commercial", "documents", "users", "activity", "notes"];

export default async function PartnerAccountConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ tab?: string; approved?: string; email?: string }>;
}) {
  await requirePlatformAdmin();
  const { type: slug, id } = await params;
  const { tab: requestedTab, approved: justApproved, email: approvalEmail } = await searchParams;
  const initialTab = requestedTab && CONSOLE_TABS.includes(requestedTab) ? requestedTab : "overview";
  const type = ACCOUNT_TYPE_FROM_SLUG[slug];
  if (!type) notFound();

  let detail = await getPartnerAccount(decodeURIComponent(id));
  if (!detail || detail.account.type !== type) notFound();

  // Automatic onboarding -> live promotion, evaluated on load (idempotent).
  detail = await evaluateAutoLive(detail);

  const { account, application, entity, members, events, docReviews, checklist } = detail;
  const agentDelivery = type === "agency" ? await getAgentCredentialDelivery(application.id) : null;
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
  const verifiedDocs = signedDocs.filter((d) => d.review?.status === "verified").length;
  const rejectedDocs = signedDocs.filter((d) => d.review?.status === "rejected").length;
  const activeMembers = members.filter((m) => m.status === "active").length;
  const reviewerRow = application.reviewer as { full_name?: string | null; email?: string } | null;
  const meta = [entity.contactEmail, entity.contactPhone].filter(Boolean).join(" · ");

  // Set by approveApplication's redirect: whether the approval email went out.
  const approvalNotice =
    justApproved === "1"
      ? approvalEmail === "sent"
        ? { variant: "default" as const, text: "Approved. Approval email sent to the applicant." }
        : approvalEmail === "not_configured"
          ? { variant: "warning" as const, text: "Approved. Approval email not sent: no email provider is configured." }
          : { variant: "destructive" as const, text: "Approved. Approval email could not be sent." }
      : null;

  return (
    <div className="space-y-6">
      {approvalNotice ? (
        <Alert variant={approvalNotice.variant}>
          <AlertDescription>{approvalNotice.text}</AlertDescription>
        </Alert>
      ) : null}
      {agentDelivery?.approved_at ? <AgentCredentialDelivery applicationId={application.id} agentId={agentDelivery.agent_id} email={agentDelivery.contact_email} sent={!!agentDelivery.email_sent_at} /> : null}
      <div className="space-y-5">
        <BackLink href="/admin/partners" label="All partner accounts" />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{entity.name}</h1>
              {entity.agentCode ? (
                <Badge variant="outline" className="font-mono" title="Agency code">
                  {entity.agentCode}
                </Badge>
              ) : null}
              <Badge variant={ACCOUNT_STATUS_VARIANT[account.status]} className="capitalize">
                {account.status}
              </Badge>
            </div>
            <p className="text-sm break-words text-muted-foreground">
              {ACCOUNT_TYPE_LABEL[type]}
              {meta ? ` · ${meta}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open original application"
              title="Original application"
              render={<Link href={applicationHref} />}
            >
              <FileText />
            </Button>
            <StatusActions accountId={account.id} status={account.status} />
          </div>
        </header>

        <StatRail>
          <StatRailItem
            label="Onboarding"
            value={`${doneCount}/${checklist.length}`}
            tone={doneCount === checklist.length ? "primary" : undefined}
          />
          <StatRailItem
            label="Documents verified"
            value={signedDocs.length === 0 ? "—" : `${verifiedDocs}/${signedDocs.length}`}
            tone={rejectedDocs > 0 ? "destructive" : undefined}
          />
          <StatRailItem label="Team" value={type === "affiliate" ? "—" : activeMembers} />
          <StatRailItem
            label="Went live"
            value={account.went_live_at ? format(new Date(account.went_live_at), "d MMM yyyy") : "—"}
          />
        </StatRail>
      </div>

      <Tabs key={initialTab} defaultValue={initialTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="portfolio">{typeSpecificTabLabel}</TabsTrigger>
            <TabsTrigger value="commercial">Commercial</TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              {signedDocs.length - verifiedDocs > 0 ? (
                <Badge variant="warning" className="ml-1 tabular-nums">
                  {signedDocs.length - verifiedDocs}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </div>

        {/* ------------------------------- Overview ------------------------------ */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailItem label="Primary contact" value={application.applicant?.full_name ?? "—"} />
                  <DetailItem label="Email" value={application.applicant?.email ?? "—"} />
                  <DetailItem label="Phone" value={application.applicant?.phone ?? "—"} />
                  <DetailItem label="Approved by" value={reviewerRow?.full_name ?? reviewerRow?.email ?? "—"} />
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
                  <DetailItem label="Account ID" value={account.id} mono />
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
        <TabsContent value="onboarding" className="mt-4">
          <Card className="gap-0">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                Onboarding
                <Badge variant={doneCount === checklist.length ? "success" : "neutral"} className="tabular-nums">
                  {doneCount}/{checklist.length}
                </Badge>
              </CardTitle>
              {account.status === "onboarding" ? (
                <CardAction>
                  <SendReminderButton accountId={account.id} />
                </CardAction>
              ) : null}
              <Progress value={progressPct} className="col-span-full mt-3" aria-label="Onboarding progress" />
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border">
                {checklist.map((item) => {
                  const body = (
                    <>
                      {item.done ? (
                        <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
                      ) : (
                        <Circle aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn("min-w-0 flex-1 text-sm font-medium", item.done && "text-muted-foreground")}>
                        {item.label}
                        <span className="sr-only">{item.done ? " (done)" : " (open)"}</span>
                      </span>
                      {item.tab ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
                    </>
                  );
                  return (
                    <li key={item.key}>
                      {item.tab ? (
                        <Link
                          href={`?tab=${item.tab}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 sm:px-6"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------- Properties / Portfolio / stub -------------------- */}
        <TabsContent value="portfolio" className="mt-4 space-y-4">
          {type === "hotel_partner" ? (
            detail.hotels.length === 0 ? (
              <Card>
                <Empty>
                  <EmptyMedia variant="icon">
                    <BedDouble />
                  </EmptyMedia>
                  <EmptyTitle>No properties</EmptyTitle>
                </Empty>
              </Card>
            ) : (
              <>
                {!docsVerified && detail.hotels.some((h) => h.status === "published") ? (
                  <Alert variant="destructive">
                    <ShieldAlert />
                    <AlertDescription>Published property with unverified KYC documents.</AlertDescription>
                  </Alert>
                ) : null}
                {detail.hotels.map((hotel) => (
                  <Card key={hotel.id} className="gap-0 overflow-hidden py-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                      <div className="min-w-0">
                        <h3 className="truncate font-heading text-base font-semibold">{hotel.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {hotel.city}
                          {hotel.star_rating ? ` · ${hotel.star_rating}★` : ""}
                        </p>
                      </div>
                      <ListingStatusControl kind="hotel" id={hotel.id} currentStatus={hotel.status} />
                    </div>
                    {hotel.rooms.length === 0 ? (
                      <Empty>
                        <EmptyMedia variant="icon">
                          <BedDouble />
                        </EmptyMedia>
                        <EmptyTitle>No room types</EmptyTitle>
                      </Empty>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Room type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead numeric>Rate / night</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hotel.rooms.map((room) => (
                            <TableRow key={room.id}>
                              <TableCell className="font-medium">{room.name}</TableCell>
                              <TableCell>
                                <ListingStatusControl kind="room" id={room.id} currentStatus={room.status} />
                              </TableCell>
                              <TableCell numeric className="tabular-nums">
                                {money(room.base_price, room.currency)}
                              </TableCell>
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
            <Card className="overflow-hidden py-0">
              {detail.venues.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <PartyPopper />
                  </EmptyMedia>
                  <EmptyTitle>No venues</EmptyTitle>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venue</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead numeric>Base price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.venues.map((venue) => (
                      <TableRow key={venue.id}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell className="text-muted-foreground">{venue.city}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(venue.status)} className="capitalize">
                            {venue.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell numeric className="tabular-nums">
                          {money(venue.basePrice, venue.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ) : type === "agency" ? (
            <div className="space-y-4">
              <StatRail className="sm:grid-cols-3">
                <StatRailItem label="Wallet balance" value={money(detail.agencySnapshot?.creditBalance ?? 0, "USD")} />
                <StatRailItem label="Credit limit" value={money(detail.agencySnapshot?.creditLimit ?? 0, "USD")} />
                <StatRailItem label="Tier" value={detail.agencySnapshot?.tierName ?? "None"} />
              </StatRail>
              <div className="flex justify-end">
                <Button variant="outline" render={<Link href={`/admin/agencies/${account.entity_id}`} />}>
                  <Landmark data-icon="inline-start" /> Agency finance
                </Button>
              </div>
            </div>
          ) : (
            <StatRail>
              <StatRailItem label="Referral code" value={detail.affiliateSnapshot?.referralCode ?? "—"} />
              <StatRailItem label="Links created" value={detail.affiliateSnapshot?.linkCount ?? 0} />
              <StatRailItem label="Total earned" value={money(detail.affiliateSnapshot?.totalEarned ?? 0, "USD")} />
              <StatRailItem label="Total paid" value={money(detail.affiliateSnapshot?.totalPaid ?? 0, "USD")} />
            </StatRail>
          )}
        </TabsContent>

        {/* ------------------------------ Commercial ----------------------------- */}
        <TabsContent value="commercial" className="mt-4 space-y-6">
          <div className={cn("grid items-start gap-6", type === "affiliate" && detail.affiliateSnapshot && "lg:grid-cols-2")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commercial terms</CardTitle>
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
                  <CardTitle className="text-base">Record payout</CardTitle>
                </CardHeader>
                <CardContent>
                  <AffiliateCommissionPayoutForm accountId={account.id} affiliateId={detail.affiliateSnapshot.id} />
                </CardContent>
              </Card>
            ) : null}
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-base font-semibold">Payout history</h2>
            <Card className="overflow-hidden py-0">
              {detail.payouts.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <Banknote />
                  </EmptyMedia>
                  <EmptyTitle>No payouts</EmptyTitle>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead numeric>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {format(new Date(payout.created_at), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>{payout.method ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{payout.reference ?? "—"}</TableCell>
                        <TableCell numeric className="font-medium tabular-nums">
                          {money(payout.amount, payout.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </section>
        </TabsContent>

        {/* ------------------------------ Documents ------------------------------ */}
        <TabsContent value="documents" className="mt-4">
          <Card className="gap-0">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                KYC documents
                {signedDocs.length > 0 ? (
                  <>
                    <Badge variant={verifiedDocs === signedDocs.length ? "success" : "neutral"} className="tabular-nums">
                      {verifiedDocs}/{signedDocs.length} verified
                    </Badge>
                    {rejectedDocs > 0 ? (
                      <Badge variant="destructive" className="tabular-nums">
                        {rejectedDocs} rejected
                      </Badge>
                    ) : null}
                  </>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {signedDocs.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <FileStack />
                  </EmptyMedia>
                  <EmptyTitle>No documents</EmptyTitle>
                </Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {signedDocs.map((doc) => (
                    <li key={doc.key} className="flex gap-3 px-4 py-3 sm:px-6">
                      <DocFileIcon fileName={doc.file_name} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.label}</p>
                          <p className="truncate text-xs text-muted-foreground tabular-nums">
                            {doc.file_name} · {format(new Date(doc.uploaded_at), "d MMM yyyy")}
                          </p>
                        </div>
                        <DocumentReviewControls
                          applicationId={application.id}
                          type={type}
                          docKey={doc.key}
                          status={(doc.review?.status as "pending" | "verified" | "rejected" | undefined) ?? "pending"}
                          note={doc.review?.note ?? null}
                          reviewedAt={doc.review?.reviewed_at ?? null}
                          reviewerName={doc.review?.reviewer?.full_name ?? doc.review?.reviewer?.email ?? null}
                          viewUrl={doc.url}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------- Users -------------------------------- */}
        <TabsContent value="users" className="mt-4 space-y-6">
          {type === "affiliate" ? (
            <Card>
              <Empty>
                <EmptyMedia variant="icon">
                  <UserRound />
                </EmptyMedia>
                <EmptyTitle>Single-user account</EmptyTitle>
              </Empty>
            </Card>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-base font-semibold">Team logins</h2>
                  <Badge variant="neutral" className="tabular-nums">
                    {members.length}
                  </Badge>
                </div>
                <Card className="overflow-hidden py-0">
                  {members.length === 0 ? (
                    <Empty>
                      <EmptyMedia variant="icon">
                        <Users />
                      </EmptyMedia>
                      <EmptyTitle>No team members</EmptyTitle>
                    </Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead numeric>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="max-w-64">
                              <p className="truncate font-medium">{member.profile?.full_name ?? "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.profile?.email}</p>
                            </TableCell>
                            <TableCell className="capitalize">{member.role.replace(/_/g, " ")}</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusBadgeVariant(member.status, { removed: "neutral" })}
                                className="capitalize"
                              >
                                {member.status}
                              </Badge>
                            </TableCell>
                            <TableCell numeric>
                              <MemberRowControls accountId={account.id} type={type} member={member} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </section>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add team member</CardTitle>
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
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <History />
                  </EmptyMedia>
                  <EmptyTitle>No activity</EmptyTitle>
                </Empty>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium capitalize">{event.action.replace(/_/g, " ")}</span>
                          {event.from_status && event.to_status ? (
                            <span className="text-xs text-muted-foreground capitalize">
                              {event.from_status} → {event.to_status}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(event.created_at), "d MMM yyyy, HH:mm")} ·{" "}
                            {event.actor ? (event.actor.full_name ?? event.actor.email) : "System"}
                          </span>
                        </p>
                        {event.reason ? (
                          <p className="text-xs break-words text-muted-foreground">{event.reason}</p>
                        ) : null}
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
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
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
