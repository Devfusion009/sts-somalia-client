import { Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
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

export const metadata = { title: "My Links" };

export default async function AffiliateLinksPage() {
  await requireUser();
  const trpc = await getServerTrpc();
  const affiliate = await trpc.affiliates.me.query();

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No affiliate account.</AlertDescription>
      </Alert>
    );
  }

  const links = await trpc.affiliates.myLinks.query();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Links"
        status={
          links.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {links.length}
            </Badge>
          ) : null
        }
        actions={links.length > 0 ? <NewLinkForm /> : null}
      />

      <Card className="py-0">
        {links.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>No links</EmptyTitle>
            <EmptyContent>
              <NewLinkForm />
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Link</TableHead>
                <TableHead numeric>Clicks</TableHead>
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
                    <TableCell className="max-w-[16rem] truncate font-mono text-xs text-muted-foreground" title={link.target_path}>
                      {link.target_path}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground" title={url}>
                          {url}
                        </code>
                        <CopyLinkButton url={url} />
                      </div>
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {link.clicks_count.toLocaleString("en-US")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
