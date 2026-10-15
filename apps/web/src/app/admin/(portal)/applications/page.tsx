import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal, X, LayoutGrid, Building2, BedDouble, PartyPopper, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApplicationsForAdmin, type ApplicationQueueFilters, type ApplicationQueueRow } from "@/modules/admin/queries";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import { ApplicationActions } from "./application-actions";
import { SortSelect } from "./sort-select";

type ApplicationKind = "agency" | "hotel_partner" | "venue_partner" | "affiliate";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  under_review: "bg-chart-3/10 text-chart-3",
  more_info_requested: "bg-destructive/10 text-destructive",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

const STATUS_ORDER = ["pending", "under_review", "more_info_requested", "approved", "rejected"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  more_info_requested: "More info requested",
  approved: "Approved",
  rejected: "Rejected",
};

/** Lower rank sorts first — mirrors the original per-type ordering (oldest pending first) now applied across the merged queue. */
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  under_review: 1,
  more_info_requested: 2,
  approved: 3,
  rejected: 4,
};

const KIND_META: Record<ApplicationKind, { label: string; slug: string; icon: LucideIcon; tone: string }> = {
  hotel_partner: { label: "Hotel Partner", slug: "hotel-partner", icon: BedDouble, tone: "bg-chart-3/10 text-chart-3" },
  venue_partner: { label: "Venue Partner", slug: "venue-partner", icon: PartyPopper, tone: "bg-brand-gold/15 text-brand-gold" },
  affiliate: { label: "Affiliate", slug: "affiliate", icon: User, tone: "bg-primary/10 text-primary" },
  agency: { label: "Travel Agency", slug: "agency", icon: Building2, tone: "bg-chart-4/15 text-chart-4" },
};

/** Category order for the filter tiles — hotel/venue/affiliate/agency, matching how the sidebar and mockup group partner types. */
const KIND_ORDER: ApplicationKind[] = ["hotel_partner", "venue_partner", "affiliate", "agency"];

const SLUG_TO_KIND: Record<string, ApplicationKind> = Object.fromEntries(
  KIND_ORDER.map((kind) => [KIND_META[kind].slug, kind])
) as Record<string, ApplicationKind>;

type UnifiedRow = {
  id: string;
  kind: ApplicationKind;
  reference: string | null;
  partnerName: string;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  status: string;
  submittedAt: string;
};

function partnerNameFor(kind: ApplicationKind, row: ApplicationQueueRow): string {
  if (kind === "agency") return row.agency_name ?? "—";
  if (kind === "affiliate") return row.applicant?.full_name ?? "—";
  return row.business_name ?? "—";
}

function toUnifiedRows(kind: ApplicationKind, rows: ApplicationQueueRow[]): UnifiedRow[] {
  return rows.map((row) => ({
    id: row.id,
    kind,
    reference: row.reference_number,
    partnerName: partnerNameFor(kind, row),
    applicantName: row.applicant?.full_name ?? null,
    applicantEmail: row.applicant?.email ?? null,
    applicantPhone: row.applicant?.phone ?? null,
    status: row.status,
    submittedAt: row.submitted_at ?? row.created_at,
  }));
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`border-transparent capitalize ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function TypeBadge({ kind }: { kind: ApplicationKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", meta.tone)}>
      <Icon className="size-3.5" /> {meta.label}
    </span>
  );
}

/** Labels must be block-level — an inline <label> flows onto the same line as its input, which is what made this toolbar read as cramped. */
function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterBar({
  current,
  kind,
  sort,
  status,
}: {
  current: ApplicationQueueFilters;
  kind?: ApplicationKind;
  sort: string;
  status?: string;
}) {
  const activeCount = [current.search, current.dateFrom, current.dateTo].filter(Boolean).length;

  return (
    <form className="rounded-xl bg-card p-4 shadow-sm shadow-foreground/5 ring-1 ring-foreground/10">
      {kind ? <input type="hidden" name="type" value={KIND_META[kind].slug} /> : null}
      {/* Submitting this form (Apply) must not silently reset the sort order or status pill chosen via their own controls. */}
      <input type="hidden" name="sort" value={sort} />
      {status ? <input type="hidden" name="status" value={status} /> : null}
      {/* Search grows to fill; the fixed-width controls sit to its right so
          the row never leaves a dead gap at the end of the bar. */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Search" htmlFor="filter-search" className="min-w-56 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-search"
              name="search"
              defaultValue={current.search}
              placeholder="Business name or reference…"
              className="pl-8"
            />
          </div>
        </FilterField>

        {/* One labelled range rather than two disconnected "From"/"To" fields. */}
        <FilterField label="Submitted between" htmlFor="filter-from">
          <div className="flex items-center gap-1.5">
            <Input
              id="filter-from"
              type="date"
              name="dateFrom"
              defaultValue={current.dateFrom}
              aria-label="Submitted on or after"
              className="w-[8.5rem]"
            />
            <span aria-hidden className="text-muted-foreground">
              &rarr;
            </span>
            <Input
              type="date"
              name="dateTo"
              defaultValue={current.dateTo}
              aria-label="Submitted on or before"
              className="w-[8.5rem]"
            />
          </div>
        </FilterField>

        <div className="flex items-center gap-1">
          <Button type="submit" className="gap-1.5">
            <SlidersHorizontal className="size-3.5" /> Apply
          </Button>
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              render={
                <Link
                  href={{
                    pathname: "/admin/applications",
                    query: {
                      ...(kind ? { type: KIND_META[kind].slug } : {}),
                      ...(sort !== "newest" ? { sort } : {}),
                      ...(status ? { status } : {}),
                    },
                  }}
                />
              }
            >
              <X className="size-3.5" /> Clear {activeCount}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** One clickable stat tile per partner type, "All Applications" first — selecting one narrows the unified table below without losing the search/status/date filters already applied. */
function CategoryTile({
  href,
  active,
  icon: Icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 shadow-sm shadow-foreground/5 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="font-heading text-xl font-bold">{count}</p>
      </div>
    </Link>
  );
}

/** Pending / Approved / Rejected (etc.) as one-click pills with live counts — the admin's actual ask was to see applications "according to approved, rejected or pending" at a glance, not buried in a dropdown. */
function StatusPill({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-primary/15" : "bg-muted text-muted-foreground")}>
        {count}
      </span>
    </Link>
  );
}

export const metadata: Metadata = { title: "Partner Applications" };

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  // Status is filtered client-side (like type and sort) so its own pill row
  // can show live counts per status without a second round-trip query.
  const filters: ApplicationQueueFilters = {
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
  };
  const activeKind = params.type ? SLUG_TO_KIND[params.type] : undefined;
  const activeStatus = params.status && STATUS_ORDER.includes(params.status) ? params.status : undefined;
  const sort = params.sort === "oldest" || params.sort === "status" ? params.sort : "newest";

  const { agency, partner, affiliate, venue } = await getApplicationsForAdmin(filters);
  const rowsByKind: Record<ApplicationKind, ApplicationQueueRow[]> = {
    agency,
    hotel_partner: partner,
    venue_partner: venue,
    affiliate,
  };

  // Approved applications get a "Manage" action into their Partner Account
  // console instead of the read-only "View" — resolved in one batch per type.
  const [agencyAccounts, partnerAccounts, affiliateAccounts, venueAccounts] = await Promise.all([
    getAccountIdsByApplication("agency", agency.filter((a) => a.status === "approved").map((a) => a.id)),
    getAccountIdsByApplication("hotel_partner", partner.filter((a) => a.status === "approved").map((a) => a.id)),
    getAccountIdsByApplication("affiliate", affiliate.filter((a) => a.status === "approved").map((a) => a.id)),
    getAccountIdsByApplication("venue_partner", venue.filter((a) => a.status === "approved").map((a) => a.id)),
  ]);
  const accountsByKind: Record<ApplicationKind, Map<string, string>> = {
    agency: agencyAccounts,
    hotel_partner: partnerAccounts,
    venue_partner: venueAccounts,
    affiliate: affiliateAccounts,
  };

  const allRows = KIND_ORDER.flatMap((kind) => toUnifiedRows(kind, rowsByKind[kind]));
  // Each dimension's own filter is excluded from its own count so switching
  // it stays meaningful: category tiles respect the active status, and the
  // status pills respect the active category.
  const rowsForKind = (kind: ApplicationKind) => allRows.filter((r) => r.kind === kind && (!activeStatus || r.status === activeStatus));
  const rowsInKindScope = activeKind ? allRows.filter((r) => r.kind === activeKind) : allRows;
  const visibleRows = rowsInKindScope
    .filter((r) => !activeStatus || r.status === activeStatus)
    .sort((a, b) => {
      if (sort === "status") {
        const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        if (rank !== 0) return rank;
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      const diff = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return sort === "oldest" ? diff : -diff;
    });

  const qs = (overrides: { type?: string; status?: string } = {}) => {
    const sp = new URLSearchParams();
    const typeSlug = "type" in overrides ? overrides.type : activeKind ? KIND_META[activeKind].slug : undefined;
    const statusVal = "status" in overrides ? overrides.status : activeStatus;
    if (typeSlug) sp.set("type", typeSlug);
    if (statusVal) sp.set("status", statusVal);
    if (filters.search) sp.set("search", filters.search);
    if (filters.dateFrom) sp.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) sp.set("dateTo", filters.dateTo);
    if (sort !== "newest") sp.set("sort", sort);
    const s = sp.toString();
    return s ? `/admin/applications?${s}` : "/admin/applications";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Partner Applications</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <CategoryTile
          href={qs({ type: undefined })}
          active={!activeKind}
          icon={LayoutGrid}
          label="All Applications"
          count={allRows.filter((r) => !activeStatus || r.status === activeStatus).length}
        />
        {KIND_ORDER.map((kind) => (
          <CategoryTile
            key={kind}
            href={qs({ type: KIND_META[kind].slug })}
            active={activeKind === kind}
            icon={KIND_META[kind].icon}
            label={KIND_META[kind].label}
            count={rowsForKind(kind).length}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <StatusPill href={qs({ status: undefined })} active={!activeStatus} label="All" count={rowsInKindScope.length} />
        {STATUS_ORDER.map((status) => (
          <StatusPill
            key={status}
            href={qs({ status })}
            active={activeStatus === status}
            label={STATUS_LABEL[status]}
            count={rowsInKindScope.filter((r) => r.status === status).length}
          />
        ))}
      </div>

      <FilterBar current={filters} kind={activeKind} sort={sort} status={activeStatus} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {visibleRows.length} application{visibleRows.length === 1 ? "" : "s"}
        </p>
        <SortSelect
          value={sort}
          hidden={{
            type: activeKind ? KIND_META[activeKind].slug : undefined,
            status: activeStatus,
            search: filters.search,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
          }}
        />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Application ID</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No applications match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => {
                const slug = KIND_META[row.kind].slug;
                const accountId = accountsByKind[row.kind].get(row.id);
                return (
                  <TableRow key={`${row.kind}-${row.id}`}>
                    <TableCell>
                      <Link
                        href={`/admin/applications/${slug}/${row.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {row.reference ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.partnerName}</p>
                      {row.kind !== "affiliate" ? (
                        <p className="text-xs text-muted-foreground">{row.applicantName ?? "—"}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <TypeBadge kind={row.kind} />
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.applicantPhone ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{row.applicantEmail ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "pending" || row.status === "under_review" ? (
                        <ApplicationActions applicationId={row.id} type={row.kind} />
                      ) : row.status === "approved" && accountId ? (
                        <Button size="sm" variant="outline" render={<Link href={`/admin/partners/${slug}/${accountId}`} />}>
                          Manage
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/admin/applications/${slug}/${row.id}`} />}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
