import type { Metadata } from "next";
import { format } from "date-fns";
import { Percent } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyMarkups, getAgencyMarkupRequests } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { scopeLabel, markupLabel, requestedLabel } from "@/modules/agencies/markup-labels";
import { WithdrawRequestButton, RequestRemovalButton } from "./markup-row-actions";
import { MarkupForm } from "./markup-form";

export const metadata: Metadata = { title: "Markups" };

function stamp(value: string) {
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

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
      <PageHeader title="Pricing & markups" />

      <div className={cn("grid items-start gap-6", isOwner && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {isOwner ? (
          <Card className="lg:sticky lg:top-24 lg:order-2">
            <CardHeader>
              <CardTitle>Add or update a rule</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkupForm pendingScopes={[...pendingScopes]} />
            </CardContent>
          </Card>
        ) : null}

        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <SectionHead title="Active rules" count={markups.length} />
            <Card className="overflow-hidden py-0">
              {markups.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <Percent />
                  </EmptyMedia>
                  <EmptyTitle>No markup rules</EmptyTitle>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applies to</TableHead>
                      <TableHead numeric>Markup</TableHead>
                      {isOwner ? (
                        <TableHead className="w-0 text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {markups.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <span className="font-medium">{scopeLabel(rule.item_type)}</span>
                          {rule.item_type === null ? (
                            <Badge variant="neutral" className="ml-2">
                              Default
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell numeric className="font-medium">
                          {markupLabel(rule.markup_type, rule.value)}
                        </TableCell>
                        {isOwner ? (
                          <TableCell className="text-right">
                            {pendingScopes.has(rule.item_type ?? "all") ? (
                              <Badge variant="warning">Change pending</Badge>
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
          </section>

          {requests.length > 0 ? (
            <section className="space-y-3">
              <SectionHead title="Change requests" count={requests.length} />
              <Card className="overflow-hidden py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applies to</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewed</TableHead>
                      {isOwner ? (
                        <TableHead className="w-0 text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{scopeLabel(request.item_type)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{requestedLabel(request)}</p>
                          <p className="text-xs text-muted-foreground">{stamp(request.requested_at)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(request.status)} className="capitalize">
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs whitespace-normal">
                          {request.reviewed_at ? (
                            <>
                              <p className="text-xs text-muted-foreground">{stamp(request.reviewed_at)}</p>
                              {request.review_note ? <p className="mt-0.5">{request.review_note}</p> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      {count > 0 ? (
        <Badge variant="neutral" className="tabular-nums">
          {count}
        </Badge>
      ) : null}
    </div>
  );
}
