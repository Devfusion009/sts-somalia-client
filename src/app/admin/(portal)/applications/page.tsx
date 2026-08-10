import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApplicationsForAdmin, type ApplicationQueueFilters } from "@/modules/admin/queries";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import { ApplicationActions } from "./application-actions";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  under_review: "bg-chart-3/10 text-chart-3",
  more_info_requested: "bg-destructive/10 text-destructive",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "more_info_requested", label: "More info requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`border-transparent capitalize ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        No applications match these filters.
      </TableCell>
    </TableRow>
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

function FilterBar({ current }: { current: ApplicationQueueFilters }) {
  const activeCount = [current.search, current.status, current.dateFrom, current.dateTo].filter(Boolean).length;

  return (
    <form className="rounded-xl bg-card p-4 shadow-sm shadow-foreground/5 ring-1 ring-foreground/10">
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

        <FilterField label="Status" htmlFor="filter-status">
          <select
            id="filter-status"
            name="status"
            defaultValue={current.status ?? ""}
            className="h-8 w-44 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
              render={<Link href="/admin/applications" />}
            >
              <X className="size-3.5" /> Clear {activeCount}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export const metadata: Metadata = { title: "Partner Applications" };

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const filters: ApplicationQueueFilters = {
    status: params.status || undefined,
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
  };

  const { agency, partner, affiliate } = await getApplicationsForAdmin(filters);

  // Approved applications get a "Manage" action into their Partner Account
  // console instead of the read-only "View" — resolved in one batch per type.
  const [agencyAccounts, partnerAccounts, affiliateAccounts] = await Promise.all([
    getAccountIdsByApplication("agency", agency.filter((a) => a.status === "approved").map((a) => a.id)),
    getAccountIdsByApplication("hotel_partner", partner.filter((a) => a.status === "approved").map((a) => a.id)),
    getAccountIdsByApplication("affiliate", affiliate.filter((a) => a.status === "approved").map((a) => a.id)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Partner Applications</h1>
        <p className="text-sm text-muted-foreground">
          Review agency, hotel partner, and affiliate applications — oldest pending first.
        </p>
      </div>

      <FilterBar current={filters} />

      <Tabs defaultValue="agency">
        <TabsList>
          <TabsTrigger value="agency">Agencies ({agency.length})</TabsTrigger>
          <TabsTrigger value="partner">Hotel Partners ({partner.length})</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliates ({affiliate.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agency" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Agency name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agency.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  agency.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link href={`/admin/applications/agency/${app.id}`} className="font-mono text-xs text-primary hover:underline">
                          {app.reference_number ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell>{app.agency_name}</TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell>{new Date(app.submitted_at ?? app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {app.status === "pending" || app.status === "under_review" ? (
                          <ApplicationActions applicationId={app.id} type="agency" />
                        ) : app.status === "approved" && agencyAccounts.get(app.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            render={<Link href={`/admin/partners/agency/${agencyAccounts.get(app.id)}`} />}
                          >
                            Manage
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" render={<Link href={`/admin/applications/agency/${app.id}`} />}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="partner" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Business name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  partner.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link href={`/admin/applications/hotel-partner/${app.id}`} className="font-mono text-xs text-primary hover:underline">
                          {app.reference_number ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell>{app.business_name}</TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell>{new Date(app.submitted_at ?? app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {app.status === "pending" || app.status === "under_review" ? (
                          <ApplicationActions applicationId={app.id} type="hotel_partner" />
                        ) : app.status === "approved" && partnerAccounts.get(app.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            render={<Link href={`/admin/partners/hotel-partner/${partnerAccounts.get(app.id)}`} />}
                          >
                            Manage
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" render={<Link href={`/admin/applications/hotel-partner/${app.id}`} />}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="affiliate" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  affiliate.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link href={`/admin/applications/affiliate/${app.id}`} className="font-mono text-xs text-primary hover:underline">
                          {app.reference_number ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{app.applicant?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.applicant?.email}</p>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {app.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell>{new Date(app.submitted_at ?? app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {app.status === "pending" || app.status === "under_review" ? (
                          <ApplicationActions applicationId={app.id} type="affiliate" />
                        ) : app.status === "approved" && affiliateAccounts.get(app.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            render={<Link href={`/admin/partners/affiliate/${affiliateAccounts.get(app.id)}`} />}
                          >
                            Manage
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" render={<Link href={`/admin/applications/affiliate/${app.id}`} />}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
