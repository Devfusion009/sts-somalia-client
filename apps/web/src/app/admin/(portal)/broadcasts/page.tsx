import type { Metadata } from "next";
import { format } from "date-fns";
import { Megaphone } from "lucide-react";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { BroadcastForm } from "./broadcast-form";

export const metadata: Metadata = { title: "Broadcasts" };

const AUDIENCE_LABELS: Record<string, string> = {
  all_agency_owners: "Owners & admins",
  all_agency_members: "Everyone in every agency",
};

export default async function AdminBroadcastsPage() {
  const trpc = await getServerTrpc();
  const history = await trpc.notifications.admin.broadcastHistory.query();

  return (
    <div className="space-y-6">
      <PageHeader title="Broadcasts" />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New broadcast</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastForm />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Send history</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Megaphone />
                </EmptyMedia>
                <EmptyTitle>No broadcasts sent</EmptyTitle>
              </Empty>
            ) : (
              <ul className="-my-3 divide-y divide-border">
                {history.map((b) => (
                  <li key={b.broadcastId} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 font-medium break-words">{b.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral">{AUDIENCE_LABELS[b.audience] ?? b.audience}</Badge>
                        <Badge variant="outline" className="tabular-nums">
                          {b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                    {b.body ? <p className="mt-1 text-sm break-words text-muted-foreground">{b.body}</p> : null}
                    <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {format(new Date(b.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
