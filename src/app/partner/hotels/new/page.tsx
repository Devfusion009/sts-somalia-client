import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewHotelForm } from "./new-hotel-form";

export default function NewHotelPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Add a hotel</h1>
        <p className="text-sm text-muted-foreground">You can add rooms once the hotel is created.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hotel details</CardTitle>
          <CardDescription>Submit for review when ready — STS verifies and publishes it for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewHotelForm />
        </CardContent>
      </Card>
    </div>
  );
}
