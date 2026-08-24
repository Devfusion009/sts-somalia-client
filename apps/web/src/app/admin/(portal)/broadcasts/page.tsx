import type { Metadata } from "next";
import { format } from "date-fns";
import { Megaphone } from "lucide-react";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div>
        <h1 className="font-heading text-2xl font-bold">Broadcasts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-primary" /> New broadcast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BroadcastForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</p>
          ) : (
            history.map((b) => (
              <div key={b.broadcastId} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{b.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{AUDIENCE_LABELS[b.audience] ?? b.audience}</Badge>
                    <Badge variant="outline">{b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}</Badge>
                  </div>
                </div>
                {b.body ? <p className="mt-1 text-sm text-muted-foreground">{b.body}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(new Date(b.createdAt), "d MMM yyyy, HH:mm")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
