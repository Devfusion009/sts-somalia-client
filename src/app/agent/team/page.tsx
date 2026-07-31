import { Info } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyTeam } from "@/lib/data/agent-portal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AgentTeamPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const team = await getAgencyTeam(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">Everyone with access to {membership.agency.name}.</p>
      </div>

      <Alert>
        <Info />
        <AlertDescription>
          Adding staff is handled by our team for now — email support@sts-somalia.example with the
          new team member&apos;s account email (they&apos;ll need to sign up first) and we&apos;ll add them.
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{member.profiles?.email}</TableCell>
                <TableCell className="capitalize">{member.role_in_agency}</TableCell>
                <TableCell>
                  <Badge variant={member.status === "active" ? "default" : "secondary"} className="capitalize">
                    {member.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
