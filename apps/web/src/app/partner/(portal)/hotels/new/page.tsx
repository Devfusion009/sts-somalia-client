import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewHotelForm } from "./new-hotel-form";

export const metadata = { title: "Add hotel" };

export default function NewHotelPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Add hotel" back={{ href: "/partner/hotels", label: "My Hotels" }} />
      <Card>
        <CardContent>
          <NewHotelForm />
        </CardContent>
      </Card>
    </div>
  );
}
