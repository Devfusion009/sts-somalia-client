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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Everyone with access to {membership.agency.name}.
          </p>
        </div>
        <Badge className="gap-1.5 border-transparent bg-secondary text-secondary-foreground">
          <Users className="size-3.5" /> {team.length} member{team.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <Alert>
        <Info />
        <AlertDescription>
          Adding staff is handled by our team for now — email support@sts-somalia.example with the
          new team member&apos;s account email (they&apos;ll need to sign up first) and we&apos;ll
          add them.
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => (
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
                    className={cn(
                      "gap-1 border-transparent capitalize",
                      member.role_in_agency === "owner"
                        ? "bg-brand-gold/15 text-brand-gold"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {member.role_in_agency === "owner" ? <Crown className="size-3" /> : null}
                    {member.role_in_agency}
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
                <TableCell className="text-right text-sm text-muted-foreground">
                  {format(new Date(member.created_at), "d MMM yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
