import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgencyTiers } from "@/modules/agencies/queries";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTierForm, EditTierForm, DeleteTierForm } from "./tier-crud-forms";

export default async function AgencyTiersPage() {
  await requirePlatformAdmin();
  const tiers = await getAgencyTiers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Agency Tiers</h1>
          <p className="text-sm text-muted-foreground">
            Labeled presets (e.g. Silver/Gold) for commission rate and credit limit — assign one
            to an agency from its detail page, then apply the defaults with one click.
          </p>
        </div>
        <CreateTierForm />
      </div>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Default Commission</TableHead>
                <TableHead className="text-right">Default Credit Limit</TableHead>
                <TableHead className="text-right">Sort</TableHead>
                <TableHead className="text-right">Agencies</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No tiers yet.
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell className="text-right">{tier.default_commission_rate}%</TableCell>
                    <TableCell className="text-right">
                      USD {Number(tier.default_credit_limit).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {tier.sort_order}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {tier.agencies?.[0]?.count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditTierForm tier={tier} />
                        <DeleteTierForm tierId={tier.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
