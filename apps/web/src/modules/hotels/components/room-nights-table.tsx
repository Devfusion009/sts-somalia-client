import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RoomNight } from "@/modules/hotels/availability";

export function RoomNightsTable({ nights, currency }: { nights: RoomNight[]; currency: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Night</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
          <TableHead className="text-right">Agency</TableHead>
          <TableHead className="text-right">Customer</TableHead>
          <TableHead className="text-right">Confirmed</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead className="text-right">Left</TableHead>
          <TableHead className="text-right">Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nights.map((n) => {
          const low = n.capacity !== null && n.available !== null && n.available > 0 && n.available <= Math.max(1, Math.ceil(n.capacity * 0.2));
          return (
            <TableRow key={n.night}>
              <TableCell className="font-medium">{format(new Date(`${n.night}T00:00:00`), "EEE d MMM")}</TableCell>
              <TableCell className="text-right">{n.capacity ?? "—"}</TableCell>
              <TableCell className="text-right">{n.b2b}</TableCell>
              <TableCell className="text-right">{n.b2c}</TableCell>
              <TableCell className="text-right">{n.confirmed}</TableCell>
              <TableCell className="text-right">{n.pending}</TableCell>
              <TableCell className="text-right">
                {n.capacity === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : n.available !== null && n.available <= 0 ? (
                  <Badge variant="destructive">Sold out</Badge>
                ) : (
                  <span className={cn(low && "font-semibold text-brand-gold")}>{n.available}</span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {n.priceOverride !== null ? `${currency} ${n.priceOverride.toFixed(0)}` : "base"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
