import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewHotelForm } from "./new-hotel-form";

export default function NewHotelPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Add a hotel</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hotel details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewHotelForm />
        </CardContent>
      </Card>
    </div>
  );
}
