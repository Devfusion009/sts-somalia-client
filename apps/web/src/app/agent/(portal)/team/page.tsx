import type { Metadata } from "next";
import { format } from "date-fns";
import { Crown } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyTeam } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddMemberForm } from "./add-member-form";
import { MemberRowActions } from "./member-row-actions";

export const metadata: Metadata = { title: "Team" };

const ROLE_LEGEND: Record<string, string> = {
  owner: "Full control over the agency; can't be removed.",
  admin: "Same access as the owner, except managing the owner's own role.",
  booking_staff: "Can book on behalf of customers and spend the wallet.",
  accountant: "Sees wallet, commission and reports — no booking or spending.",
  viewer: "Read-only access to bookings and reports.",
};

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function AgentTeamPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const team = await getAgencyTeam(membership.agency.id);
  const canManage = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        meta={
          <span className="tabular-nums">
            {team.length} member{team.length === 1 ? "" : "s"}
          </span>
        }
        actions={canManage ? <AddMemberForm /> : null}
      />

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {canManage ? (
                <TableHead className="w-0 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => {
              const isOwnerRow = member.role_in_agency === "owner";
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                          {initials(member.profiles?.full_name ?? null, member.profiles?.email ?? null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.profiles?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.profiles?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isOwnerRow ? "default" : "neutral"}
                      title={ROLE_LEGEND[member.role_in_agency]}
                      className="capitalize"
                    >
                      {isOwnerRow ? <Crown aria-hidden="true" /> : null}
                      {member.role_in_agency.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(member.status)} className="capitalize">
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(member.created_at), "d MMM yyyy")}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {isOwnerRow ? null : (
                        <MemberRowActions memberId={member.id} currentRole={member.role_in_agency} />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
