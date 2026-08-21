import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAllAgenciesForAdmin } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function AdminAgenciesPage() {
  await requirePlatformAdmin();
  const agencies = await getAllAgenciesForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Agencies</h1>
        <Badge variant="secondary">{agencies.length}</Badge>
      </div>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell>
                    <p className="font-medium">{agency.name}</p>
                    <p className="text-xs text-muted-foreground">{agency.contact_email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        STATUS_STYLES[agency.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {agency.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agency.agency_tiers?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{agency.commission_rate}%</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      Number(agency.credit_balance) < 0 ? "text-destructive" : undefined
                    )}
                  >
                    USD {Number(agency.credit_balance).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    USD {Number(agency.credit_limit).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {agency.agency_members?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-primary"
                      render={<Link href={`/admin/agencies/${agency.id}`} />}
                    >
                      Open <ArrowRight className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
