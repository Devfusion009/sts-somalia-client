import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { Card, CardContent } from "@/components/ui/card";
import { ManagerHotelProfileForm } from "./profile-form";

export const metadata = { title: "Hotel Profile" };

export default async function ManagerProfilePage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "profile")) notFound();

  const hotel = await getHotelForEdit(hotelId, [hotelId]);
  if (!hotel) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Hotel Profile</h1>
      <Card>
        <CardContent className="p-6">
          <ManagerHotelProfileForm
            hotel={{
              id: hotel.id,
              description: hotel.description,
              address_line: hotel.address_line,
              phone: hotel.phone,
              contact_email: hotel.contact_email,
              check_in_time: hotel.check_in_time,
              check_out_time: hotel.check_out_time,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
