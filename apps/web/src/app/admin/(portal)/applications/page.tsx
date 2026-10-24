import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FileSearch, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { getApplicationsForAdmin, type ApplicationQueueFilters, type ApplicationQueueRow } from "@/modules/admin/queries";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import { ApplicationActions } from "./application-actions";
import { SortSelect } from "./sort-select";
import { APPLICATION_STATUS_VARIANT, applicationStatusLabel } from "./status";

type ApplicationKind = "agency" | "hotel_partner" | "venue_partner" | "affiliate";

const STATUS_ORDER = ["pending", "under_review", "more_info_requested", "approved", "rejected"];

/** Lower rank sorts first — mirrors the original per-type ordering (oldest pending first) now applied across the merged queue. */
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  under_review: 1,
  more_info_requested: 2,
  approved: 3,
  rejected: 4,
};

const KIND_META: Record<ApplicationKind, { label: string; slug: string }> = {
  hotel_partner: { label: "Hotel partner", slug: "hotel-partner" },
  venue_partner: { label: "Venue partner", slug: "venue-partner" },
  affiliate: { label: "Affiliate", slug: "affiliate" },
  agency: { label: "Travel agency", slug: "agency" },
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
  return <Badge variant={APPLICATION_STATUS_VARIANT[status] ?? "neutral"}>{applicationStatusLabel(status)}</Badge>;
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
    <form role="search" className="flex flex-wrap items-center gap-2">
      {kind ? <input type="hidden" name="type" value={KIND_META[kind].slug} /> : null}
      {/* Apply must not reset the sort order or status chosen via their own controls. */}
      <input type="hidden" name="sort" value={sort} />
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <InputGroup className="w-full sm:w-72 max-sm:h-10">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          name="search"
          type="search"
          defaultValue={current.search}
          placeholder="Business name or reference"
          aria-label="Search applications"
        />
      </InputGroup>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          name="dateFrom"
          defaultValue={current.dateFrom}
          aria-label="Submitted on or after"
          className="w-[9.5rem] tabular-nums max-sm:h-10"
        />
        <span aria-hidden className="text-muted-foreground">
          –
        </span>
        <Input
          type="date"
          name="dateTo"
          defaultValue={current.dateTo}
          aria-label="Submitted on or before"
          className="w-[9.5rem] tabular-nums max-sm:h-10"
        />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear filters"
          title="Clear filters"
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
          <X />
        </Button>
      ) : null}
    </form>
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

  const kindChips = [
    {
      key: "all",
      label: "All types",
      href: qs({ type: undefined }),
      count: allRows.filter((r) => !activeStatus || r.status === activeStatus).length,
    },
    ...KIND_ORDER.map((kind) => ({
      key: kind,
      label: KIND_META[kind].label,
      href: qs({ type: KIND_META[kind].slug }),
      count: rowsForKind(kind).length,
    })),
  ];
  const statusChips = [
    { key: "all", label: "Any status", href: qs({ status: undefined }), count: rowsInKindScope.length },
    ...STATUS_ORDER.map((status) => ({
      key: status,
      label: applicationStatusLabel(status),
      href: qs({ status }),
      count: rowsInKindScope.filter((r) => r.status === status).length,
    })),
  ];
  const pendingCount = allRows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner applications"
        status={
          pendingCount > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {pendingCount} pending
            </Badge>
          ) : null
        }
      />

      <div className="space-y-3">
        <FilterChips items={kindChips} active={activeKind ?? "all"} label="Filter by partner type" />
        <FilterChips items={statusChips} active={activeStatus ?? "all"} label="Filter by status" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar current={filters} kind={activeKind} sort={sort} status={activeStatus} />
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            {visibleRows.length} application{visibleRows.length === 1 ? "" : "s"}
          </span>
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
      </div>

      <Card className="overflow-hidden py-0">
        {visibleRows.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <FileSearch />
            </EmptyMedia>
            <EmptyTitle>No applications match these filters</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const slug = KIND_META[row.kind].slug;
                const accountId = accountsByKind[row.kind].get(row.id);
                const detailHref = `/admin/applications/${slug}/${row.id}`;
                return (
                  <TableRow key={`${row.kind}-${row.id}`}>
                    <TableCell>
                      <Link
                        href={detailHref}
                        className="rounded-sm font-mono text-xs font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.reference ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate font-medium">{row.partnerName}</p>
                      {row.kind !== "affiliate" ? (
                        <p className="truncate text-xs text-muted-foreground">{row.applicantName ?? "—"}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{KIND_META[row.kind].label}</TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate tabular-nums">{row.applicantPhone ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.applicantEmail ?? "—"}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(row.submittedAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell numeric>
                      <div className="flex items-center justify-end gap-1">
                        {row.status === "pending" || row.status === "under_review" ? (
                          <ApplicationActions applicationId={row.id} type={row.kind} layout="inline" />
                        ) : row.status === "approved" && accountId ? (
                          <Button size="sm" variant="outline" render={<Link href={`/admin/partners/${slug}/${accountId}`} />}>
                            Manage
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Open ${row.reference ?? row.partnerName}`}
                          title="Open"
                          render={<Link href={detailHref} />}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
