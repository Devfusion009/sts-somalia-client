import type { Metadata } from "next";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAuditLog, getAuditLogEntityTypes } from "@/modules/admin/queries";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { AuditDiffToggle } from "./audit-diff";

export const metadata: Metadata = { title: "Audit Log" };

const ACTION_VARIANT: Partial<Record<string, BadgeVariant>> = {
  insert: "success",
  update: "info",
  delete: "destructive",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; actor?: string }>;
}) {
  const profile = await requirePlatformAdmin();
  const { entityType, actor } = await searchParams;
  const mine = actor === "me";

  const [entries, entityTypes] = await Promise.all([
    getAuditLog({ entityType, actorId: mine ? profile.id : undefined }),
    getAuditLogEntityTypes(),
  ]);

  const active = mine ? "me" : (entityType ?? "all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {entries.length} shown
          </Badge>
        }
      />

      <FilterChips
        label="Filter audit log"
        active={active}
        items={[
          { key: "all", label: "All", href: "/admin/audit-log" },
          { key: "me", label: "My activity", href: "/admin/audit-log?actor=me" },
          ...entityTypes.map((type) => ({
            key: type,
            label: type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
            href: `/admin/audit-log?entityType=${type}`,
          })),
        ]}
      />

      <Card className="overflow-hidden py-0">
        {entries.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>No audit entries</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="text-muted-foreground">
                    {format(new Date(entry.created_at), "d MMM yyyy, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {entry.actor ? (
                      <>
                        <p className="font-medium">{entry.actor.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(entry.action, ACTION_VARIANT)} className="capitalize">
                      {entry.action.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="capitalize">{entry.entity_type.replace(/_/g, " ")}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{entry.entity_id?.slice(0, 8) ?? "—"}</p>
                  </TableCell>
                  <TableCell className="min-w-[220px] whitespace-normal">
                    <AuditDiffToggle oldData={entry.old_data} newData={entry.new_data} />
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
