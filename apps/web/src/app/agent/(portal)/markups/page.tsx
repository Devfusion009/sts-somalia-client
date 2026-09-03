import { format } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyMarkups, getAgencyMarkupRequests } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { WithdrawRequestButton, RequestRemovalButton } from "./markup-row-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { scopeLabel, markupLabel, requestedLabel } from "@/modules/agencies/markup-labels";
import { MarkupForm } from "./markup-form";

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

export default async function AgentMarkupsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const isOwner = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const [markups, requests] = await Promise.all([
    getAgencyMarkups(membership.agency.id),
    getAgencyMarkupRequests(membership.agency.id),
  ]);
  const pendingScopes = new Set(requests.filter((r) => r.status === "pending").map((r) => r.item_type ?? "all"));

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Markups</h1>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add or update a rule</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkupForm pendingScopes={[...pendingScopes]} />
          </CardContent>
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="text-base">Change requests</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applies to</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                {isOwner ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{scopeLabel(request.item_type)}</TableCell>
                  <TableCell className="font-semibold">
                    {requestedLabel(request)}
                    <p className="text-xs font-normal text-muted-foreground">
                      {format(new Date(request.requested_at), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent capitalize", REQUEST_STATUS_STYLES[request.status])}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {request.reviewed_at ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.reviewed_at), "dd MMM yyyy, hh:mm a")}
                        </p>
                        {request.review_note ? <p className="mt-0.5">{request.review_note}</p> : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {isOwner ? (
                    <TableCell className="text-right">
                      {request.status === "pending" ? <WithdrawRequestButton requestId={request.id} /> : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Active Rules</CardTitle>
        </CardHeader>
        {markups.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No markup rules yet.</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applies to</TableHead>
                <TableHead>Markup</TableHead>
                {isOwner ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {markups.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    {rule.item_type === null ? (
                      <Badge variant="secondary">All services (default)</Badge>
                    ) : (
                      <span className="font-medium">{scopeLabel(rule.item_type)}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">{markupLabel(rule.markup_type, rule.value)}</TableCell>
                  {isOwner ? (
                    <TableCell className="text-right">
                      {pendingScopes.has(rule.item_type ?? "all") ? (
                        <Badge className={cn("border-transparent", REQUEST_STATUS_STYLES.pending)}>Change pending</Badge>
                      ) : (
                        <RequestRemovalButton markupId={rule.id} />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
