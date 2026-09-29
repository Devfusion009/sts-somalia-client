import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink href="/admin/catalog/visa" label="Visa catalog" />
          <h1 className="font-heading text-2xl font-semibold">Application centres</h1>
        </div>
        <CentreDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centre</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Visa types</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centres.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No centres yet.
                </TableCell>
              </TableRow>
            ) : (
              centres.map((c) => (
                <TableRow key={c.id} className={cn(!c.is_active && "text-muted-foreground")}>
                  <TableCell>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{[c.provider, c.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span aria-hidden>{countryFlag(c.country_code)}</span> {c.city}, {countryName(c.country_code)}
                    <p className="text-xs text-muted-foreground">{c.timezone}</p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.submission_hours ? <p>Submit {c.submission_hours}</p> : null}
                    {c.collection_hours ? <p>Collect {c.collection_hours}</p> : null}
                    {!c.submission_hours && !c.collection_hours ? "—" : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{c.visa_type_centres.length || "All"}</TableCell>
                  <TableCell>
                    <form action={toggleVisaCentre}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={String(!c.is_active)} />
                      <button
                        type="submit"
                        className={cn(
                          "rounded-full border px-3 py-0.5 text-xs font-medium transition-colors",
                          c.is_active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </form>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {c.appointment_url ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Open booking site"
                          title="Booking site"
                          render={<a href={c.appointment_url} target="_blank" rel="noopener noreferrer" />}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      ) : null}
                      <CentreDialog centre={c} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
