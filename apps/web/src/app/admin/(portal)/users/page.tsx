import type { Metadata } from "next";
import { format } from "date-fns";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUsersPage } from "@/modules/admin/queries";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { accountRoleBadges } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { UserStatusToggle } from "./user-status-toggle";

export const metadata: Metadata = { title: "Users" };

// Platform admin is a privilege rather than a business identity, so it is
// styled to stand out from the role/membership badges beside it — an admin
// list where every row looks alike is how a stray admin grant goes unnoticed.
const BADGE_VARIANT = {
  platform: "default",
  business: "neutral",
  membership: "outline",
} as const;

const STATUS_OVERRIDES = { pending_verification: "warning" } as const;

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
      <PageHeader
        title="Users"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {total.toLocaleString("en-US")}
          </Badge>
        }
      />

      <form action="/admin/users" role="search" className="flex items-center gap-2">
        <InputGroup className="sm:w-64 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput name="q" type="search" defaultValue={sp.q} placeholder="Name or email" aria-label="Search users" />
        </InputGroup>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        {users.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{sp.q ? "No users match this search" : "No users"}</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {accountRoleBadges(user).map((badge) => (
                        <Badge
                          key={`${badge.kind}-${badge.label}`}
                          variant={BADGE_VARIANT[badge.kind]}
                          className={cn(badge.kind === "membership" && "border-dashed text-muted-foreground")}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(user.status, STATUS_OVERRIDES)} className="capitalize">
                      {user.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(user.created_at), "d MMM yyyy")}</TableCell>
                  <TableCell numeric>
                    <UserStatusToggle userId={user.id} status={user.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
