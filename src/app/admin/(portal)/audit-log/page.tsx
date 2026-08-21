import Link from "next/link";
import { format } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAuditLog, getAuditLogEntityTypes } from "@/modules/admin/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditDiffToggle } from "./audit-diff";

const ACTION_STYLES: Record<string, string> = {
  INSERT: "bg-primary/10 text-primary",
  UPDATE: "bg-brand-gold/15 text-brand-gold",
  DELETE: "bg-destructive/10 text-destructive",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  await requirePlatformAdmin();
  const { entityType } = await searchParams;

  const [entries, entityTypes] = await Promise.all([
    getAuditLog({ entityType }),
    getAuditLogEntityTypes(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Audit Log</h1>
        <Badge variant="secondary">{entries.length} shown</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/audit-log"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !entityType
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
        {entityTypes.map((type) => (
          <Link
            key={type}
            href={`/admin/audit-log?entityType=${type}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              entityType === type
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {type.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        {entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No audit entries{entityType ? " for this entity type" : ""} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "d MMM yyyy, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      {entry.actor ? (
                        <>
                          <p className="text-sm font-medium">{entry.actor.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`border-transparent ${ACTION_STYLES[entry.action] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm capitalize">{entry.entity_type.replace(/_/g, " ")}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {entry.entity_id?.slice(0, 8) ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <AuditDiffToggle oldData={entry.old_data} newData={entry.new_data} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
