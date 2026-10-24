import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Handshake } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getPartnerAccountsIndex,
  ACCOUNT_SLUG_FROM_TYPE,
  ACCOUNT_TYPE_LABEL,
} from "@/modules/admin/partner-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_STATUS_VARIANT } from "./status";

export const metadata: Metadata = { title: "Partner Accounts" };

export default async function PartnerAccountsIndexPage() {
  await requirePlatformAdmin();
  const accounts = await getPartnerAccountsIndex();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner accounts"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {accounts.length}
          </Badge>
        }
      />

      <Card className="overflow-hidden py-0">
        {accounts.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Handshake />
            </EmptyMedia>
            <EmptyTitle>No partner accounts</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Account ID</TableHead>
                <TableHead numeric>Created</TableHead>
                <TableHead numeric>Went live</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const href = `/admin/partners/${ACCOUNT_SLUG_FROM_TYPE[account.type]}/${account.id}`;
                return (
                  <TableRow key={account.id}>
                    <TableCell className="max-w-72">
                      <Link
                        href={href}
                        className="block truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {account.name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {ACCOUNT_TYPE_LABEL[account.type]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACCOUNT_STATUS_VARIANT[account.status]} className="capitalize">
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground" title={account.id}>
                      {account.id}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(account.created_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {account.went_live_at ? format(new Date(account.went_live_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Manage ${account.name}`}
                        title="Manage"
                        render={<Link href={href} />}
                      >
                        <ChevronRight />
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
