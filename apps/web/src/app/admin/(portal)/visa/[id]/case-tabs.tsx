import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, CheckCircle2, CircleDashed, History, NotebookPen, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { money as formatMoney } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  formatRequirementAnswer,
  memberRequirementAnswers,
  parseRequirementAnswers,
  parseRequirementSections,
} from "@/modules/visa/schemas";
import { PAYMENT_STATE_LABELS, type VisaAction } from "@/modules/visa/workflow";
import type { VisaCase } from "@/modules/visa/case-queries";
import { CaseActions } from "./case-actions";
import { NoteForm } from "./note-form";
import { MessageThread } from "@/modules/visa/components/message-thread";
import { MessageComposer } from "@/modules/visa/components/message-composer";
import { adminSendMessage } from "@/modules/visa/admin-actions";
import { DetailGrid, EventList, SectionHeading, formatWhen } from "./case-ui";
import { DocumentsTab } from "./documents-tab";

function NoActivity() {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <History />
      </EmptyMedia>
      <EmptyTitle>No activity</EmptyTitle>
    </Empty>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function OverviewTab({ data, actions, reviewable }: { data: VisaCase; actions: VisaAction[]; reviewable: boolean }) {
  const recent = data.events.filter((e) => e.event_type !== "document.accessed").slice(0, 6);
  const applies = data.readiness.filter((r) => r.applies);
  const refundNote =
    data.jobs.length > 0
      ? "Filed with the authority · no refund"
      : data.order && data.order.paid > 0
        ? `Full refund · ${formatMoney(data.order.paid, data.order.currency)}`
        : "Nothing paid · no refund";

  return (
    <div className="space-y-6">
      <nav aria-label="Application sections" className="flex flex-wrap gap-2">
        {[["applicant", "Applicant & answers"], ["documents", "Documents"], ["payment", "Order & payment"]].map(([id, label]) => (
          <Button key={id} variant="outline" size="sm" render={<a href={`#case-${id}`} />}>{label}</Button>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeading>Next step</SectionHeading>
            {actions.length > 0 ? <CaseActions applicationId={data.application.id} actions={actions} refundNote={refundNote} /> : null}
            {applies.length > 0 ? (
              <ul className="divide-y divide-border">
                {applies.map((item) => (
                  <li key={item.key} className="flex items-start gap-3 py-2.5 text-sm">
                    {item.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Done" />
                    ) : (
                      <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Outstanding" />
                    )}
                    <div className="min-w-0">
                      <p className={cn("font-medium", item.ok && "text-muted-foreground")}>{item.label}</p>
                      {!item.ok && item.detail && item.key !== "payment" ? (
                        <p className="text-xs text-muted-foreground first-letter:uppercase">{item.detail}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeading
              action={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="All activity"
                  title="All activity"
                  render={<Link href={`?tab=activity`} scroll={false} />}
                >
                  <ArrowRight />
                </Button>
              }
            >
              Recent activity
            </SectionHeading>
            {recent.length === 0 ? <NoActivity /> : <EventList events={recent} />}
          </CardContent>
        </Card>
      </div>
      <section id="case-applicant" className="scroll-mt-24"><ApplicantTab data={data} /></section>
      <section id="case-documents" className="scroll-mt-24"><DocumentsTab data={data} reviewable={reviewable} /></section>
      <section id="case-payment" className="scroll-mt-24"><PaymentTab data={data} /></section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applicant
// ---------------------------------------------------------------------------
export function ApplicantTab({ data }: { data: VisaCase }) {
  const app = data.application;
  const traveler = (app.traveler_details ?? {}) as Record<string, string>;
  const contact = (app.contact_details ?? {}) as Record<string, string>;
  const travel = (app.travel_details ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const day = (v: unknown) => {
    const value = str(v);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? format(parseISO(value), "d MMM yyyy") : value;
  };
  const label = (v: unknown) => {
    const value = str(v)?.replace(/_/g, " ");
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  };
  const appAnswers = parseRequirementAnswers(app.custom_answers);
  const sections = parseRequirementSections(app.visa_type?.application_sections)
    .map((section) => ({ ...section, fields: section.fields.filter((f) => f.type !== "file") }))
    .filter((section) => section.fields.length > 0);
  const multipleTravellers = data.application.members.length > 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <SectionHeading>Application contact</SectionHeading>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {contact.email ? <a className="break-all font-medium text-primary underline underline-offset-4" href={`mailto:${contact.email}`}>{contact.email}</a> : null}
            {contact.mobile ? <a className="font-medium text-primary underline underline-offset-4" href={`tel:${contact.mobile.replace(/[^+0-9]/g, "")}`}>{contact.mobile}</a> : null}
          </div>
          <DetailGrid rows={[
            ["Booked by", app.submitter?.full_name ?? app.submitter?.email],
            ["Booking channel", app.agency_id ? "Agency" : "Direct"],
            ["Agency", app.agency?.name],
            ["Application type", label(app.applicant_type)],
            ["Account email", app.submitter?.email],
            ["Account phone", app.submitter?.phone],
          ]} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading>Primary applicant</SectionHeading>
            <DetailGrid
              rows={[
                ["Full name", traveler.full_name],
                ["Date of birth", day(traveler.date_of_birth)],
                ["Gender", label(traveler.gender)],
                ["Nationality", traveler.nationality ? countryName(traveler.nationality) : undefined],
                ["Passport number", traveler.passport_number],
                ["Passport expiry", day(traveler.passport_expiry)],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading>Travel</SectionHeading>
            <DetailGrid
              rows={[
                ["Arrival", day(travel.arrival_date)],
                ["Departure", day(travel.departure_date)],
                ["Purpose", label(travel.purpose)],
                ["Address", str(travel.address)],
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {data.application.members.length > 1 ? (
        <section className="space-y-3">
          <SectionHeading>Travellers</SectionHeading>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Passport</TableHead>
                  <TableHead>Passport expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.application.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                      {member.is_primary ? (
                        <Badge variant="outline" className="ml-2">
                          Primary
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="capitalize">{member.relationship.replace(/_/g, " ")}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{day(member.date_of_birth) ?? "—"}</TableCell>
                    <TableCell>{member.nationality ? countryName(member.nationality) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{member.passport_number ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{day(member.passport_expiry) ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : null}

      {sections.map((section) => (
        <Card key={section.key}>
          <CardContent className="space-y-4">
            <SectionHeading>{section.title}</SectionHeading>
            {section.scope === "application" ? (
              <DetailGrid rows={section.fields.map((f) => [f.label, formatRequirementAnswer(f, appAnswers[section.key]?.[f.key]) || undefined])} />
            ) : (
              data.application.members.map((member) => {
                const answers = memberRequirementAnswers(member.details)[section.key];
                return (
                  <div key={member.id} className="space-y-2">
                    {multipleTravellers ? <p className="text-sm font-semibold">{member.full_name}</p> : null}
                    <DetailGrid rows={section.fields.map((f) => [f.label, formatRequirementAnswer(f, answers?.[f.key]) || undefined])} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------
export function PaymentTab({ data }: { data: VisaCase }) {
  const order = data.order;
  if (!order) {
    return (
      <Card className="max-w-xl">
        <Empty>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>No order</EmptyTitle>
        </Empty>
      </Card>
    );
  }
  const money = (v: number | string) => formatMoney(v, order.currency);
  const pending = order.payments.filter((p) => ["requires_action", "processing"].includes(p.status));
  const rows: Array<[string, string, boolean?]> = [
    ["Visa service", money(order.subtotal)],
    ...(Number(order.markup_amount) > 0 ? ([["Agency service fee", money(order.markup_amount)]] as Array<[string, string]>) : []),
    ...(Number(order.fee_total) > 0 ? ([["STS processing fee", money(order.fee_total)]] as Array<[string, string]>) : []),
    ["Total", money(order.total), true],
    ["Paid", `${money(order.paid)}${order.method ? ` · ${order.method}` : ""}`],
    ["Balance", money(order.remaining), true],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <SectionHeading
            action={
              <Badge variant={statusBadgeVariant(data.paymentState, { not_billed: "neutral" })}>
                {PAYMENT_STATE_LABELS[data.paymentState]}
              </Badge>
            }
          >
            Order {order.order_number}
          </SectionHeading>
          <dl className="divide-y divide-border text-sm">
            {rows.map(([label, value, strong]) => (
              <div key={label} className="flex items-center justify-between py-2">
                <dt className={cn(strong ? "font-medium" : "text-muted-foreground")}>{label}</dt>
                <dd className={cn("tabular-nums", strong ? "font-semibold" : "font-medium")}>{value}</dd>
              </div>
            ))}
          </dl>
          {pending.length > 0 ? <ul className="space-y-2">{pending.map((payment, index) => (
            <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">{payment.method_label ?? "Online payment"} · {money(payment.amount)}</span>
              <Badge variant="warning">{payment.status === "processing" ? "Processing" : "Awaiting confirmation"}</Badge>
            </li>
          ))}</ul> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {order.invoices ? <Button variant="outline" size="sm" render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}><Receipt className="size-4" />{order.invoices.invoice_number}</Button> : null}
            <Button variant="outline" size="sm" render={<Link href={`/admin/orders?order=${order.id}#order-${order.id}`} />}>
              Open order & payments
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal notes
// ---------------------------------------------------------------------------
export function NotesTab({ data, canWrite }: { data: VisaCase; canWrite: boolean }) {
  const notes = data.workspace.notes;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {canWrite ? (
        <Card className="h-fit">
          <CardContent>
            <NoteForm applicationId={data.application.id} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="space-y-3">
          <SectionHeading>Internal notes</SectionHeading>
          {notes.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <NotebookPen />
              </EmptyMedia>
              <EmptyTitle>No notes</EmptyTitle>
            </Empty>
          ) : (
            <ol className="divide-y divide-border">
              {notes.map((n) => (
                <li key={n.id} className="space-y-1 py-2.5 text-sm">
                  <p className="whitespace-pre-wrap break-words">{n.note}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {n.author?.full_name ?? "System"} · {formatWhen(n.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity (immutable case timeline)
// ---------------------------------------------------------------------------
export function ActivityTab({ data }: { data: VisaCase }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeading>Activity</SectionHeading>
        {data.events.length === 0 ? <NoActivity /> : <EventList events={data.events} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Messages (visible to the applicant)
// ---------------------------------------------------------------------------
export function MessagesTab({ data, canSend }: { data: VisaCase; canSend: boolean }) {
  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-4">
        <SectionHeading>Messages with applicant</SectionHeading>
        <MessageThread messages={data.messages} viewer="staff" />
        {canSend ? (
          <MessageComposer applicationId={data.application.id} action={adminSendMessage} placeholder="Message to applicant" />
        ) : null}
      </CardContent>
    </Card>
  );
}
