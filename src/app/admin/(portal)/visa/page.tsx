import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVisaApplicationsAdmin } from "@/modules/admin/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { VisaStatusBadge } from "@/modules/visa/components/visa-shared";
import { VISA_STATUS_LABELS } from "@/modules/visa/schemas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visa Applications" };

const FILTERS = [
  "submitted",
  "in_review",
  "additional_info_required",
  "processing",
  "approved",
  "rejected",
  "issued",
] as const;

export default async function AdminVisaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const applications = await getVisaApplicationsAdmin(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Visa Applications</h1>
        <p className="text-sm text-muted-foreground">
          Review submissions, request documents, and issue decisions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/visa"
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !status
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary/50"
          )}
        >
          All
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/visa?status=${f}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/50"
            )}
          >
            {VISA_STATUS_LABELS[f]}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No visa applications{status ? ` with status "${VISA_STATUS_LABELS[status] ?? status}"` : ""} yet.
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => {
                const traveler = (app.traveler_details ?? {}) as Record<string, string>;
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono text-xs">{app.application_ref}</TableCell>
                    <TableCell className="font-medium">{traveler.full_name ?? "—"}</TableCell>
                    <TableCell>
                      {app.visa_type ? (
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden>{countryFlag(app.visa_type.destination_country_code)}</span>
                          {countryName(app.visa_type.destination_country_code)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{app.applicant_type}</TableCell>
                    <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {app.currency} {Number(app.price).toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <VisaStatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/visa/${app.id}`} />}
                        className="gap-1"
                      >
                        Review <ArrowRight className="size-3.5" />
                      </Button>
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
