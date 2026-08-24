import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getRoomForInventory, getRoomInventory } from "@/modules/hotels/partner-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InventoryRangeForm, ClearInventoryForm } from "@/app/partner/hotels/[id]/rooms/[roomId]/inventory-form";

export const metadata = { title: "Room Availability" };

export default async function ManagerRoomInventoryPage({
  params,
}: {
  params: Promise<{ hotelId: string; roomId: string }>;
}) {
  const { hotelId, roomId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "availability")) notFound();

  const room = await getRoomForInventory(roomId, hotelId, [hotelId]);
  if (!room) notFound();

  const inventory = await getRoomInventory(room.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/manager/${hotelId}/rooms`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Rooms
        </Link>
        <h1 className="font-heading text-2xl font-semibold">{room.name} — availability</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set availability</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryRangeForm hotelId={hotelId} roomId={room.id} currency={room.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" /> Next 60 days
          </CardTitle>
          <Badge variant="secondary">{inventory.length} capped</Badge>
        </CardHeader>
        {inventory.length > 0 ? (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Booked</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead className="text-right">Nightly price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((row) => {
                  const left = row.total_units - row.booked_units;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-right">{row.total_units}</TableCell>
                      <TableCell className="text-right">{row.booked_units}</TableCell>
                      <TableCell className="text-right">
                        {left <= 0 ? (
                          <Badge variant="destructive">Sold out</Badge>
                        ) : (
                          <span className={left <= 3 ? "font-semibold text-brand-gold" : ""}>{left}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.price_override != null ? `${room.currency} ${Number(row.price_override).toFixed(0)}` : "base"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clear caps</CardTitle>
        </CardHeader>
        <CardContent>
          <ClearInventoryForm hotelId={hotelId} roomId={room.id} />
        </CardContent>
      </Card>
    </div>
  );
}
