import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { FileCheck2, Flag, Inbox, Search } from "lucide-react";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/dashboard/pager";
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
import { ATTENTION_LABELS, VISA_QUEUE_GROUPS, VISA_QUEUE_LABELS, VISA_SORT_OPTIONS, parseVisaSort, isVisaQueue, type VisaQueue } from "@/modules/visa/queues";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { PAYMENT_STATE_LABELS, daysSince, isPast, type PaymentState, type VisaStage } from "@/modules/visa/workflow";
import { visaReviewHandoff } from "@/modules/visa/review-handoff";
import { StageBadge } from "./[id]/case-ui";
import { RefreshOrdersButton } from "../orders/refresh-orders-button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export const metadata: Metadata = { title: "Visa Applications" };

type Search = { queue?: string; q?: string; destination?: string; owner?: string; urgent?: string; page?: string; sort?: string };

const RAIL: Array<{ key: VisaQueue; label: string; tone?: "warn" | "danger" }> = [
  { key: "all", label: "All applications" },
  { key: "needs_action", label: "Needs action", tone: "warn" },
  { key: "payment_pending", label: "Awaiting payment", tone: "warn" },
  { key: "document_review", label: "Document review" },
];
const PRIMARY_QUEUES: VisaQueue[] = ["all", "payment_pending", "new", "document_review", "customer_action", "processing"];

function hrefFor(current: Search, patch: Partial<Search>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const qs = params.toString();
  return `/admin/visa${qs ? `?${qs}` : ""}`;
}

const WARN_TEXT = "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold";

const SELECT_CLASS = cn(NATIVE_SELECT_CLASS, "w-auto");

function AppointmentCell({ row }: { row: QueueRow }) {
  if (row.next_appointment_at) {
    return (
      <span className={cn("tabular-nums", isPast(row.next_appointment_at) && "font-medium text-destructive")}>
        {format(new Date(row.next_appointment_at), "d MMM, HH:mm")}
      </span>
    );
  }
  if (row.appointment_attended) return <span className="text-primary">Attended</span>;
  if (row.requires_appointment) return <span className={cn("font-medium", WARN_TEXT)}>Not booked</span>;
  return <span className="text-muted-foreground">—</span>;
}

export default async function AdminVisaQueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  const profile = await requireVisaPermission("visa.applications.read");
  const sp = await searchParams;
  const queue: VisaQueue = isVisaQueue(sp.queue) ? sp.queue : "needs_action";
  const sort = parseVisaSort(sp.sort);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const current: Search = {
    queue,
    sort,
    q: sp.q?.trim() || undefined,
    destination: sp.destination || undefined,
    owner: sp.owner || undefined,
    urgent: sp.urgent === "1" ? "1" : undefined,
  };

  const [counts, { rows, total }, staff, destinations] = await Promise.all([
    getVisaQueueCounts(),
    getVisaCaseQueue(
      { queue, sort, q: current.q, destination: current.destination, owner: current.owner, urgent: !!current.urgent, page },
      profile.id
    ),
    getVisaStaff(),
    getVisaQueueDestinations(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Visa applications" actions={<RefreshOrdersButton />} />

      <nav aria-label="Queue overview" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {RAIL.map((item) => {
          const n = counts[item.key] ?? 0;
          const active = queue === item.key;
          return (
            <Link
              key={item.key}
              href={hrefFor(current, { queue: item.key, page: undefined })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 bg-secondary/40 px-4 py-3 transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                active && "bg-card shadow-[inset_0_-2px_0_var(--primary)]"
              )}
            >
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <span
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums",
                  n > 0 && item.tone === "warn" && WARN_TEXT,
                  n > 0 && item.tone === "danger" && "text-destructive"
                )}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Application queues" className="flex flex-wrap gap-2">
        {PRIMARY_QUEUES.map(key => (
          <Button key={key} size="sm" variant={queue === key ? "default" : "outline"} render={<Link href={hrefFor(current, { queue: key, page: undefined })} aria-current={queue === key ? "page" : undefined} />}>
            {key === "all" ? "All applications" : VISA_QUEUE_LABELS[key]} <span className="ml-1 tabular-nums opacity-75">{counts[key] ?? 0}</span>
          </Button>
        ))}
      </nav>
      <details className="rounded-xl border border-border bg-card p-4" open={!PRIMARY_QUEUES.includes(queue) || undefined}>
        <summary className="cursor-pointer text-sm font-medium">More queues</summary>
        <nav aria-label="More queues" className="mt-4 space-y-2">
        {VISA_QUEUE_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className="shrink-0 text-xs text-muted-foreground sm:w-24">{group.label}</span>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {group.queues.filter(q => !PRIMARY_QUEUES.includes(q.key)).map((q) => {
                const active = queue === q.key;
                const n = counts[q.key] ?? 0;
                return (
                  <Link
                    key={q.key}
                    href={hrefFor(current, { queue: q.key, page: undefined })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-9",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {q.label}
                    <span className={cn("tabular-nums", active ? "opacity-90" : "text-foreground/70")}>{n}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        </nav>
      </details>

      <form key={JSON.stringify(current)} action="/admin/visa" role="search" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
        <input type="hidden" name="queue" value={queue} />
        {current.urgent ? <input type="hidden" name="urgent" value="1" /> : null}
        <InputGroup className="w-full sm:w-72 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder="Reference, name, email"
            aria-label="Search applications"
          />
        </InputGroup>
        <select name="destination" defaultValue={current.destination ?? ""} aria-label="Destination" className={SELECT_CLASS}>
          <option value="">All destinations</option>
          {destinations.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
        <select name="owner" defaultValue={current.owner ?? ""} aria-label="Owner" className={SELECT_CLASS}>
          <option value="">Any owner</option>
          <option value="none">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === profile.id ? "Me" : (s.full_name ?? s.email)}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort applications" className={SELECT_CLASS}>
          {VISA_SORT_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <Link
          href={hrefFor(current, { urgent: current.urgent ? undefined : "1", page: undefined })}
          aria-pressed={!!current.urgent}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-10",
            current.urgent
              ? "border-destructive bg-destructive text-white"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          <Flag className="size-3" aria-hidden="true" /> Urgent
        </Link>
        {(current.q || current.destination || current.owner || current.urgent || sort !== "newest" || queue !== "all") ? <Button variant="ghost" render={<Link href="/admin/visa" />}>Reset</Button> : null}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{queue === "all" ? "All applications" : VISA_QUEUE_LABELS[queue]}</h2>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? "application" : "applications"} · {VISA_SORT_OPTIONS.find(option => option.key === sort)?.label}</span>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead numeric className="w-10">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Empty>
                    <EmptyMedia variant="icon">
                      <Inbox />
                    </EmptyMedia>
                    <EmptyTitle>No applications match these filters</EmptyTitle>
                    <Button variant="outline" render={<Link href="/admin/visa" />}>View all applications</Button>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const age = daysSince(row.stage_entered_at);
                const closed = ["approved", "rejected", "issued", "cancelled"].includes(row.status ?? "");
                const overdue = !closed && isPast(row.sla_due_at);
                const review = visaReviewHandoff(row.status, row.payment_state);
                return (
                  <TableRow key={row.id} className="group">
                    <TableCell>
                      <Link
                        href={`/admin/visa/${row.id}`}
                        className="block min-w-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="flex items-center gap-1.5 font-medium group-hover:underline">
                          {row.priority === "urgent" ? (
                            <Flag className="size-3 shrink-0 text-destructive" role="img" aria-label="Urgent" />
                          ) : null}
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
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {row.submitted_at || row.created_at ? <time dateTime={(row.submitted_at ?? row.created_at)!}><span className="block">{format(new Date((row.submitted_at ?? row.created_at)!), "d MMM yyyy")}</span><span className="text-muted-foreground">{format(new Date((row.submitted_at ?? row.created_at)!), "HH:mm")}</span></time> : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StageBadge stage={row.status as VisaStage} />
                        {!closed && age !== null ? <span className="text-xs text-muted-foreground">{age}d in stage</span> : null}
                        {row.requires_appointment ? <span className="text-xs"><AppointmentCell row={row} /></span> : null}
                        {row.attention ? (
                          <span className={cn("text-xs font-medium", WARN_TEXT)}>
                            {ATTENTION_LABELS[row.attention] ?? row.attention}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.payment_state ?? "pending", { not_billed: "neutral" })}>
                        {PAYMENT_STATE_LABELS[(row.payment_state ?? "pending") as PaymentState]}
                      </Badge>
                      {review ? <span className="mt-1.5 block max-w-40 text-xs font-medium text-primary">{review.message}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <span className={cn((row.docs_rejected ?? 0) > 0 && "font-medium text-destructive")}>
                        {row.docs_verified ?? 0}/{row.docs_total ?? 0}
                      </span>
                      {(row.docs_pending ?? 0) > 0 ? (
                        <Badge variant="warning" className="ml-1.5">
                          {row.docs_pending} new
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.assigned_to ? (
                        row.assigned_to === profile.id ? "Me" : (row.assignee_name ?? "Staff")
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                      {!closed && row.sla_due_at ? <span className={cn("mt-1 block text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>Due {format(new Date(row.sla_due_at), "d MMM")}</span> : null}
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        variant={review ? "default" : "outline"}
                        size="sm"
                        aria-label={`${review ? "Review documents" : "Open documents"} for ${row.application_ref}`}
                        render={<Link href={`/admin/visa/${row.id}?tab=documents`} />}
                      >
                        <FileCheck2 className="size-3.5" /> {review ? review.label : "Documents"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Pager
        page={page}
        total={total}
        pageSize={QUEUE_PAGE_SIZE}
        hrefFor={(n) => hrefFor(current, { page: n > 1 ? String(n) : undefined })}
      />
    </div>
  );
}
