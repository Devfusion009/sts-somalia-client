import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewLinkForm } from "./new-link-form";
import { CopyLinkButton } from "./copy-link-button";

export default async function AffiliateLinksPage() {
  await requireUser();
  const trpc = await getServerTrpc();
  const affiliate = await trpc.affiliates.me.query();

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No affiliate account found for your profile. Please contact support.</AlertDescription>
      </Alert>
    );
  }

  const links = await trpc.affiliates.myLinks.query();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Links</h1>
        </div>
        <NewLinkForm />
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No links yet</p>
            <p className="text-sm text-muted-foreground">Create your first tracked link to start earning.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Shareable URL</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                // /r/<code> logs the click + drops the attribution cookie,
                // then forwards to the link's target path.
                const url = `${siteUrl}/r/${link.code}`;
                return (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.campaign_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{link.target_path}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[220px] truncate text-xs text-muted-foreground">{url}</code>
                        <CopyLinkButton url={url} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{link.clicks_count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
