import type { Metadata } from "next";
import { Building2, ExternalLink } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryFlag, countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { getVisaCentresAdmin } from "@/modules/admin/queries";
import { toggleVisaCentre } from "@/modules/admin/visa-centre-actions";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { CentreDialog } from "./centre-dialog";

export const metadata: Metadata = { title: "Application Centres" };

export default async function VisaCentresPage() {
  await requireVisaPermission("visa.config.manage");
  const centres = await getVisaCentresAdmin();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <BackLink href="/admin/catalog/visa" label="Visa catalog" />
          <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight">Application centres</h1>
          <Badge variant="neutral" className="tabular-nums">
            {centres.length}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CentreDialog />
        </div>
      </header>

      <Card className="overflow-hidden py-0">
        {centres.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No application centres</EmptyTitle>
          </Empty>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centre</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead numeric>Visa types</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centres.map((c) => (
                <TableRow key={c.id} className={cn(!c.is_active && "text-muted-foreground")}>
                  <TableCell>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{[c.provider, c.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span aria-hidden>{countryFlag(c.country_code)}</span> {c.city}, {countryName(c.country_code)}
                    <p className="text-xs text-muted-foreground">{c.timezone}</p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {c.submission_hours ? <p>Submit {c.submission_hours}</p> : null}
                    {c.collection_hours ? <p>Collect {c.collection_hours}</p> : null}
                    {!c.submission_hours && !c.collection_hours ? "—" : null}
                  </TableCell>
                  <TableCell numeric>{c.visa_type_centres.length || "All"}</TableCell>
                  <TableCell>
                    <form action={toggleVisaCentre}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={String(!c.is_active)} />
                      <button
                        type="submit"
                        aria-pressed={c.is_active}
                        aria-label={`${c.name}: ${c.is_active ? "active" : "inactive"}`}
                        className={cn(
                          "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-9",
                          c.is_active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </form>
                  </TableCell>
                  <TableCell numeric>
                    <div className="flex justify-end gap-1">
                      {c.appointment_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Open booking site"
                          title="Booking site"
                          render={<a href={c.appointment_url} target="_blank" rel="noopener noreferrer" />}
                        >
                          <ExternalLink />
                        </Button>
                      ) : null}
                      <CentreDialog centre={c} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        )}
      </Card>
    </div>
  );
}
