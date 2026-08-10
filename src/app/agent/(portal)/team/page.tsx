import { format } from "date-fns";
import { Crown, Info, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyTeam } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AddMemberForm } from "./add-member-form";
import { MemberRowActions } from "./member-row-actions";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Everyone with access to {membership.agency.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="gap-1.5 border-transparent bg-secondary text-secondary-foreground">
            <Users className="size-3.5" /> {team.length} member{team.length === 1 ? "" : "s"}
          </Badge>
          {canManage ? <AddMemberForm /> : null}
        </div>
      </div>

      <Alert>
        <Info />
        <AlertDescription>
          <span className="font-medium">Owner</span> and <span className="font-medium">Admin</span>{" "}
          manage the team; <span className="font-medium">Booking Staff</span> book and spend the
          wallet; <span className="font-medium">Accountant</span> sees financials only;{" "}
          <span className="font-medium">Viewer</span> is read-only.
          {!canManage
            ? " Only an owner or admin can add, edit, or remove team members."
            : " Adding someone requires them to already have an STS account."}
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
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
                        <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                          {initials(member.profiles?.full_name ?? null, member.profiles?.email ?? null)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.profiles?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{member.profiles?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      title={ROLE_LEGEND[member.role_in_agency]}
                      className={cn(
                        "gap-1 border-transparent capitalize",
                        isOwnerRow
                          ? "bg-brand-gold/15 text-brand-gold"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {isOwnerRow ? <Crown className="size-3" /> : null}
                      {member.role_in_agency.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        member.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(member.created_at), "d MMM yyyy")}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {isOwnerRow ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
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
