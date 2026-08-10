import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getPartnerAccountsIndex,
  ACCOUNT_SLUG_FROM_TYPE,
  ACCOUNT_TYPE_LABEL,
  type PartnerAccountStatus,
} from "@/modules/admin/partner-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Partner Accounts" };

const STATUS_STYLES: Record<PartnerAccountStatus, string> = {
  onboarding: "bg-chart-3/10 text-chart-3",
  live: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
  offboarded: "bg-muted text-muted-foreground",
};

export default async function PartnerAccountsIndexPage() {
  await requirePlatformAdmin();
  const accounts = await getPartnerAccountsIndex();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Partner Accounts</h1>
        <p className="text-sm text-muted-foreground">
          The ongoing relationships created by approving applications — one account per approved application.
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        {accounts.length === 0 ? (
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No partner accounts yet — approve an application to create the first one.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account ID</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Went live</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const href = `/admin/partners/${ACCOUNT_SLUG_FROM_TYPE[account.type]}/${account.id}`;
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Link href={href} className="font-mono text-xs text-primary hover:underline">
                        {account.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-sm">{ACCOUNT_TYPE_LABEL[account.type]}</TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", STATUS_STYLES[account.status])}>
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(account.created_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.went_live_at ? format(new Date(account.went_live_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" render={<Link href={href} />}>
                        Manage
                      </Button>
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
