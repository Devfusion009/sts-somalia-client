import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgencyTiers } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { CreateTierForm, EditTierForm, DeleteTierForm } from "./tier-crud-forms";

export const metadata: Metadata = { title: "Agency Tiers" };

export default async function AgencyTiersPage() {
  await requirePlatformAdmin();
  const tiers = await getAgencyTiers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency tiers"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {tiers.length}
          </Badge>
        }
        actions={<CreateTierForm />}
      />

      <Card className="overflow-hidden py-0">
        {tiers.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>No tiers</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead numeric>Commission</TableHead>
                <TableHead numeric>Credit limit</TableHead>
                <TableHead numeric>Sort</TableHead>
                <TableHead numeric>Agencies</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium">{tier.name}</TableCell>
                  <TableCell numeric className="tabular-nums">
                    {tier.default_commission_rate}%
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {money(tier.default_credit_limit, "USD")}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground tabular-nums">
                    {tier.sort_order}
                  </TableCell>
                  <TableCell numeric className="tabular-nums">
                    {tier.agencies?.[0]?.count ?? 0}
                  </TableCell>
                  <TableCell numeric>
                    <div className="flex items-center justify-end gap-1">
                      <EditTierForm tier={tier} />
                      <DeleteTierForm tierId={tier.id} />
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
