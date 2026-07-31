import { CheckCircle2, Building2, Plane, FileText, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UnifiedBooking = {
  id: string;
  type: "hotel" | "flight" | "visa" | "umrah";
  title: string;
  subtitle: string;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
};

const TYPE_ICON = { hotel: Building2, flight: Plane, visa: FileText, umrah: Landmark };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  completed: "default",
  approved: "default",
  issued: "default",
  pending: "secondary",
  submitted: "secondary",
  in_review: "secondary",
  additional_info_required: "secondary",
  draft: "secondary",
  cancelled: "destructive",
  rejected: "destructive",
  failed: "destructive",
  refunded: "secondary",
  no_show: "destructive",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  hotel: "Your hotel booking was created.",
  flight: "Your flight request was submitted.",
  visa: "Your visa application was submitted.",
  umrah: "Your Umrah booking was created.",
};

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  const profile = await requireUser();
  const supabase = await createClient();
  const orFilter = `customer_id.eq.${profile.id},booked_by.eq.${profile.id}`;

  const [hotelRes, flightRes, visaRes, umrahRes] = await Promise.all([
    supabase
      .from("hotel_bookings")
      .select("id, check_in, check_out, status, total_price, currency, created_at, hotels(name)")
      .or(orFilter),
    supabase
      .from("flight_bookings")
      .select("id, origin_iata, destination_iata, depart_at, status, total_price, currency, created_at")
      .or(orFilter),
    supabase
      .from("visa_applications")
      .select("id, status, price, currency, created_at, visa_types(name)")
      .or(`applicant_profile_id.eq.${profile.id},submitted_by.eq.${profile.id}`),
    supabase
      .from("umrah_bookings")
      .select("id, status, total_price, currency, created_at, num_pilgrims, umrah_packages(name)")
      .or(orFilter),
  ]);

  const bookings: UnifiedBooking[] = [
    ...(hotelRes.data ?? []).map((b) => ({
      id: b.id,
      type: "hotel" as const,
      title: b.hotels?.name ?? "Hotel booking",
      subtitle: `${b.check_in} → ${b.check_out}`,
      status: b.status,
      price: b.total_price,
      currency: b.currency,
      createdAt: b.created_at,
    })),
    ...(flightRes.data ?? []).map((b) => ({
      id: b.id,
      type: "flight" as const,
      title: `${b.origin_iata} → ${b.destination_iata}`,
      subtitle: new Date(b.depart_at).toLocaleDateString(),
      status: b.status,
      price: b.total_price,
      currency: b.currency,
      createdAt: b.created_at,
    })),
    ...(visaRes.data ?? []).map((v) => ({
      id: v.id,
      type: "visa" as const,
      title: v.visa_types?.name ?? "Visa application",
      subtitle: "Application",
      status: v.status,
      price: v.price,
      currency: v.currency,
      createdAt: v.created_at,
    })),
    ...(umrahRes.data ?? []).map((u) => ({
      id: u.id,
      type: "umrah" as const,
      title: u.umrah_packages?.name ?? "Umrah booking",
      subtitle: `${u.num_pilgrims} pilgrim${u.num_pilgrims > 1 ? "s" : ""}`,
      status: u.status,
      price: u.total_price,
      currency: u.currency,
      createdAt: u.created_at,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Bookings</h1>
        <p className="text-sm text-muted-foreground">Every hotel, flight, visa, and Umrah booking you&apos;ve made.</p>
      </div>

      {success && SUCCESS_MESSAGES[success] ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>{SUCCESS_MESSAGES[success]}</AlertDescription>
        </Alert>
      ) : null}

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No bookings yet</p>
            <p className="text-sm text-muted-foreground">
              Browse hotels, flights, visas, or Umrah packages to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const Icon = TYPE_ICON[b.type];
                return (
                  <TableRow key={`${b.type}-${b.id}`}>
                    <TableCell className="flex items-center gap-2 font-medium capitalize">
                      <Icon className="size-4 text-muted-foreground" /> {b.type}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.subtitle}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"} className="capitalize">
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {b.currency} {b.price.toFixed(0)}
                    </TableCell>
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
