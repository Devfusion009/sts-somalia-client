import { Percent, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyMarkups } from "@/modules/agencies/queries";
import { deleteAgencyMarkup } from "@/modules/agencies/markup-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarkupForm } from "./markup-form";

const VERTICAL_LABELS: Record<string, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Events & Halls",
};

export default async function AgentMarkupsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  // Owner and admin both manage markups (matches the RLS policy on
  // agency_markups) — kept as `isOwner` to minimize diff noise below.
  const isOwner = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const markups = await getAgencyMarkups(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Markups</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your margin on top of STS net prices. When your agency books, the markup is added to
          the price automatically — and paid back to you as earnings when the order settles. A
          vertical-specific rule overrides the default.
        </p>
      </div>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="size-4 text-primary" /> Add or update a rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarkupForm />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-secondary/60">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Markup rules are managed by your agency owner — shown here for reference.
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Active Rules</CardTitle>
        </CardHeader>
        {markups.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No markup rules yet — bookings use STS net prices as-is.
          </CardContent>
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
                      <span className="font-medium">
                        {VERTICAL_LABELS[rule.item_type] ?? rule.item_type}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {rule.markup_type === "percent"
                      ? `${Number(rule.value)}%`
                      : `USD ${Number(rule.value).toFixed(2)}`}
                  </TableCell>
                  {isOwner ? (
                    <TableCell className="text-right">
                      <form action={deleteAgencyMarkup} className="inline">
                        <input type="hidden" name="markupId" value={rule.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </Button>
                      </form>
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
