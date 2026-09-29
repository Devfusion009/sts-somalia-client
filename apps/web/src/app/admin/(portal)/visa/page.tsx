import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ChevronLeft, ChevronRight, Flag, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryFlag, countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import {
  QUEUE_PAGE_SIZE,
  getVisaCaseQueue,
  getVisaQueueCounts,
  getVisaQueueDestinations,
  getVisaStaff,
  type QueueRow,
} from "@/modules/visa/case-queries";
import { ATTENTION_LABELS, VISA_QUEUE_GROUPS, isVisaQueue, type VisaQueue } from "@/modules/visa/queues";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { PAYMENT_STATE_LABELS, daysSince, isPast, type PaymentState, type VisaStage } from "@/modules/visa/workflow";
import { StageBadge } from "./[id]/case-ui";

export const metadata: Metadata = { title: "Visa Applications" };

type Search = { queue?: string; q?: string; destination?: string; owner?: string; urgent?: string; page?: string };

const RAIL: Array<{ key: VisaQueue; label: string; tone?: "warn" | "danger" }> = [
  { key: "needs_action", label: "Needs action", tone: "warn" },
  { key: "unassigned", label: "Unassigned" },
  { key: "sla_at_risk", label: "Due within 24h", tone: "danger" },
  { key: "payment_pending", label: "Awaiting payment" },
  { key: "customer_action", label: "Waiting on applicant" },
  { key: "processing", label: "Processing" },
  { key: "passport_return", label: "Passport return" },
];

function hrefFor(current: Search, patch: Partial<Search>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const qs = params.toString();
  return `/admin/visa${qs ? `?${qs}` : ""}`;
}

const PAYMENT_TONE: Record<string, string> = {
  paid: "text-primary",
  partially_paid: "text-brand-gold",
  pending: "text-brand-gold",
  not_billed: "text-muted-foreground",
  cancelled: "text-muted-foreground",
  refunded: "text-muted-foreground",
};

function AppointmentCell({ row }: { row: QueueRow }) {
  if (row.next_appointment_at) {
    return (
      <span className={cn("tabular-nums", isPast(row.next_appointment_at) && "font-medium text-destructive")}>
        {format(new Date(row.next_appointment_at), "dd MMM, HH:mm")}
      </span>
    );
  }
  if (row.appointment_attended) return <span className="text-primary">Attended</span>;
  if (row.requires_appointment) return <span className="text-brand-gold">Not booked</span>;
  return <span className="text-muted-foreground">—</span>;
}

export default async function AdminVisaQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const profile = await requireVisaPermission("visa.applications.read");
  const sp = await searchParams;
  const queue: VisaQueue = isVisaQueue(sp.queue) ? sp.queue : "needs_action";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const current: Search = {
    queue,
    q: sp.q?.trim() || undefined,
    destination: sp.destination || undefined,
    owner: sp.owner || undefined,
    urgent: sp.urgent === "1" ? "1" : undefined,
  };

  const [counts, { rows, total }, staff, destinations] = await Promise.all([
    getVisaQueueCounts(),
    getVisaCaseQueue(
      { queue, q: current.q, destination: current.destination, owner: current.owner, urgent: !!current.urgent, page },
      profile.id
    ),
    getVisaStaff(),
    getVisaQueueDestinations(),
  ]);
  const lastPage = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * QUEUE_PAGE_SIZE + 1;
  const to = Math.min(total, page * QUEUE_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Visa applications</h1>
        <form action="/admin/visa" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="queue" value={queue} />
          {current.urgent ? <input type="hidden" name="urgent" value="1" /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={current.q} placeholder="Reference, name, email, ref no." className="h-8 w-64 pl-8" aria-label="Search" />
          </div>
          <select
            name="destination"
            defaultValue={current.destination ?? ""}
            aria-label="Destination"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">All destinations</option>
            {destinations.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </select>
          <select
            name="owner"
            defaultValue={current.owner ?? ""}
            aria-label="Owner"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">Any owner</option>
            <option value="none">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === profile.id ? "Me" : (s.full_name ?? s.email)}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
          <Link
            href={hrefFor(current, { urgent: current.urgent ? undefined : "1", page: undefined })}
            aria-pressed={!!current.urgent}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              current.urgent
                ? "border-destructive bg-destructive text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="size-3" /> Urgent
          </Link>
        </form>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border text-sm sm:grid-cols-4 lg:grid-cols-7">
        {RAIL.map((item) => {
          const n = counts[item.key] ?? 0;
          const active = queue === item.key;
          return (
            <Link
              key={item.key}
              href={hrefFor(current, { queue: item.key, page: undefined })}
              className={cn(
                "flex flex-col gap-0.5 bg-secondary/40 px-4 py-3 transition-colors hover:bg-secondary",
                active && "bg-background ring-2 ring-primary ring-inset"
              )}
            >
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums",
                  n > 0 && item.tone === "warn" && "text-brand-gold",
                  n > 0 && item.tone === "danger" && "text-destructive"
                )}
              >
                {n}
              </dd>
            </Link>
          );
        })}
      </dl>

      <nav aria-label="Queues" className="space-y-2">
        {VISA_QUEUE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{group.label}</span>
            {group.queues.map((q) => {
              const active = queue === q.key;
              const n = counts[q.key] ?? 0;
              return (
                <Link
                  key={q.key}
                  href={hrefFor(current, { queue: q.key, page: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {q.label}
                  <span className={cn("tabular-nums", active ? "opacity-90" : "text-foreground/70")}>{n}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Appointment</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">In stage</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                  No applications in this queue.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const age = daysSince(row.stage_entered_at);
                const closed = ["approved", "rejected", "issued", "cancelled"].includes(row.status ?? "");
                const overdue = !closed && isPast(row.sla_due_at);
                return (
                  <TableRow key={row.id} className="group">
                    <TableCell>
                      <Link href={`/admin/visa/${row.id}`} className="block min-w-0">
                        <span className="flex items-center gap-1.5 font-medium group-hover:text-primary">
                          {row.priority === "urgent" ? <Flag className="size-3 text-destructive" aria-label="Urgent" /> : null}
                          {row.applicant_name ?? "Applicant"}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{row.application_ref}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{countryFlag(row.destination_country_code ?? "")}</span>
                        {countryName(row.destination_country_code ?? "")}
                      </span>
                      <span className="block max-w-44 truncate text-xs text-muted-foreground">{row.visa_type_name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StageBadge stage={row.status as VisaStage} />
                        {row.attention ? (
                          <span className="text-xs font-medium text-brand-gold">{ATTENTION_LABELS[row.attention] ?? row.attention}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-sm", PAYMENT_TONE[row.payment_state ?? "pending"])}>
                      {PAYMENT_STATE_LABELS[(row.payment_state ?? "pending") as PaymentState]}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <span className={cn((row.docs_rejected ?? 0) > 0 && "text-destructive")}>
                        {row.docs_verified ?? 0}/{row.docs_total ?? 0}
                      </span>
                      {(row.docs_pending ?? 0) > 0 ? (
                        <Badge className="ml-1.5 border-transparent bg-brand-gold/15 px-1.5 text-[10px] text-brand-gold">
                          {row.docs_pending} new
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <AppointmentCell row={row} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.assigned_to ? (
                        row.assigned_to === profile.id ? "Me" : (row.assignee_name ?? "Staff")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm tabular-nums", !closed && (age ?? 0) > 3 && "font-medium text-brand-gold")}>
                      {age === null ? "—" : `${age}d`}
                    </TableCell>
                    <TableCell className={cn("text-sm tabular-nums", overdue && "font-medium text-destructive")}>
                      {closed || !row.sla_due_at ? "—" : format(new Date(row.sla_due_at), "dd MMM")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${row.application_ref}`}
                        render={<Link href={`/admin/visa/${row.id}`} />}
                      >
                        <ArrowRight className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {total > QUEUE_PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {from}–{to} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page <= 1}
              render={page > 1 ? <Link href={hrefFor(current, { page: String(page - 1) })} /> : undefined}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={page >= lastPage}
              render={page < lastPage ? <Link href={hrefFor(current, { page: String(page + 1) })} /> : undefined}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
