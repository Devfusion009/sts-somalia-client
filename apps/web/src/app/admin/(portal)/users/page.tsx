import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUsersPage } from "@/modules/admin/queries";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { accountRoleBadges } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { UserStatusToggle } from "./user-status-toggle";

// Platform admin is a privilege rather than a business identity, so it is
// styled to stand out from the role/membership badges beside it — an admin
// list where every row looks alike is how a stray admin grant goes unnoticed.
const BADGE_STYLES = {
  platform: "border-transparent bg-brand-accent text-brand-accent-foreground",
  business: "",
  membership: "border-dashed text-muted-foreground",
} as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  pending_verification: "secondary",
  suspended: "destructive",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const { rows: users, total } = await getUsersPage({ page, q: sp.q });
  const hrefFor = (n: number) => `/users?${sp.q ? `q=${encodeURIComponent(sp.q)}&` : ""}page=${n}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Users</h1>
        <Badge variant="secondary">{total}</Badge>
      </div>

      <form action="/admin/users" className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="Name or email" className="h-8 w-64 pl-8" aria-label="Search" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {accountRoleBadges(user).map((badge) => (
                      <Badge
                        key={`${badge.kind}-${badge.label}`}
                        variant={badge.kind === "membership" ? "outline" : "secondary"}
                        className={cn(BADGE_STYLES[badge.kind])}
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status] ?? "secondary"} className="capitalize">
                    {user.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <UserStatusToggle userId={user.id} status={user.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
