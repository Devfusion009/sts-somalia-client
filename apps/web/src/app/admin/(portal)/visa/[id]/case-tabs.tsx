import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { parseApplicationQuestions } from "@/modules/visa/schemas";
import { PAYMENT_STATE_LABELS, type VisaAction } from "@/modules/visa/workflow";
import type { VisaCase } from "@/modules/visa/case-queries";
import { CaseActions } from "./case-actions";
import { NoteForm } from "./note-form";
import { MessageThread } from "@/modules/visa/components/message-thread";
import { MessageComposer } from "@/modules/visa/components/message-composer";
import { adminSendMessage } from "@/modules/visa/admin-actions";
import { DetailGrid, EventList, SectionHeading, formatWhen } from "./case-ui";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function OverviewTab({ data, actions }: { data: VisaCase; actions: VisaAction[] }) {
  const recent = data.events.filter((e) => e.event_type !== "document.accessed").slice(0, 6);
  const applies = data.readiness.filter((r) => r.applies);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-5">
          <SectionHeading>Next step</SectionHeading>
          {actions.length > 0 ? <CaseActions applicationId={data.application.id} actions={actions} /> : null}
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
              <Button variant="ghost" size="sm" render={<Link href={`?tab=activity`} scroll={false} />}>
                All activity
              </Button>
            }
          >
            Recent activity
          </SectionHeading>
          <EventList events={recent} />
        </CardContent>
      </Card>
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
  const questions = parseApplicationQuestions(app.visa_type?.application_questions);
  const answers = (app.custom_answers ?? {}) as Record<string, string>;
  const answered = questions.filter((q) => answers[q.key]);

  return (
    <div className="space-y-6">
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
                ["Email", contact.email],
                ["Mobile", contact.mobile],
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
                ["Booked by", data.application.submitter?.full_name ?? data.application.submitter?.email],
                ["Booking channel", app.agency_id ? "Agency" : "Direct"],
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.application.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                      {member.is_primary ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Primary
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="capitalize">{member.relationship.replace(/_/g, " ")}</TableCell>
                    <TableCell>{day(member.date_of_birth) ?? "—"}</TableCell>
                    <TableCell>{member.nationality ? countryName(member.nationality) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{member.passport_number ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading>Additional answers</SectionHeading>
            <DetailGrid rows={answered.map((q) => [q.label, answers[q.key]])} />
          </CardContent>
        </Card>
      ) : null}
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
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">No order.</p>
        </CardContent>
      </Card>
    );
  }
  const money = (v: number | string) => `${order.currency} ${Number(v).toFixed(2)}`;
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
              <Badge className="border-transparent bg-secondary text-foreground">
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
          <Button variant="outline" size="sm" render={<Link href="/admin/orders" />}>
            Open in Orders
          </Button>
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
            <p className="text-sm text-muted-foreground">No notes.</p>
          ) : (
            <ol className="divide-y divide-border">
              {notes.map((n) => (
                <li key={n.id} className="space-y-1 py-2.5 text-sm">
                  <p className="whitespace-pre-wrap break-words">{n.note}</p>
                  <p className="text-xs text-muted-foreground">
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
        <EventList events={data.events} />
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
