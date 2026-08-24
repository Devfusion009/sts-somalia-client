import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getHotelReviews, getMyManagedHotel } from "@/modules/hotels/manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Reviews" };

export default async function ManagerReviewsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const reviews = await getHotelReviews(hotelId);
  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold">Reviews</h1>
        {average != null ? (
          <Badge variant="secondary" className="gap-1">
            <Star className="size-3 fill-brand-gold text-brand-gold" /> {average.toFixed(1)} · {reviews.length}
          </Badge>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No reviews yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{review.author_name}</p>
                    {review.status === "hidden" ? <Badge variant="secondary">Hidden</Badge> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${i < review.rating ? "fill-brand-gold text-brand-gold" : "text-border"}`}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(new Date(review.created_at), "dd MMM yyyy")}</span>
                  </div>
                </div>
                {review.body ? <p className="text-sm text-muted-foreground">{review.body}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
