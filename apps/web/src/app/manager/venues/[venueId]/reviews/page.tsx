import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedVenue, getVenueReviews } from "@/modules/events/venue-manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Reviews" };

export default async function ManagerVenueReviewsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed) notFound();

  const reviews = await getVenueReviews(venueId);
  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Reviews"
        status={
          average != null ? (
            <Badge variant="secondary" className="tabular-nums">
              <Star aria-hidden="true" className="fill-brand-gold text-brand-gold" />
              {average.toFixed(1)}
              <span className="text-muted-foreground">· {reviews.length}</span>
              <span className="sr-only">average from {reviews.length} reviews</span>
            </Badge>
          ) : null
        }
      />

      <Card className="py-0">
        <CardContent className="p-0">
          {reviews.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Star />
              </EmptyMedia>
              <EmptyTitle>No reviews</EmptyTitle>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((review) => (
                <li key={review.id} className="space-y-1.5 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium">{review.author_name}</p>
                      {review.status === "hidden" ? <Badge variant="neutral">Hidden</Badge> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="flex items-center gap-0.5" role="img" aria-label={`${review.rating} out of 5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            aria-hidden="true"
                            className={`size-3.5 ${i < review.rating ? "fill-brand-gold text-brand-gold" : "text-border"}`}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(review.created_at), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  {review.body ? <p className="text-sm text-muted-foreground">{review.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
