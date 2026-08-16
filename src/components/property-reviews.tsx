import { Star, MessageSquareText } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PropertyReview = { id: string; author_name: string; rating: number; body: string | null; created_at: string };

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("size-3.5", i < rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

/**
 * Admin-authored testimonials for now — no public submission flow exists
 * yet, and we deliberately don't import reviews from TripAdvisor/etc.
 * (those belong to the reviewer/platform, not us). Renders nothing when
 * there are none rather than an empty-state card cluttering the page.
 */
export function PropertyReviews({ reviews }: { reviews: PropertyReview[] }) {
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const sorted = [...reviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="size-4 text-muted-foreground" />
          Reviews
          <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
            <Stars rating={Math.round(average)} />
            {average.toFixed(1)} · {reviews.length} review{reviews.length > 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map((review) => (
          <div key={review.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{review.author_name}</p>
              <div className="flex items-center gap-2">
                <Stars rating={review.rating} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(review.created_at), "MMM yyyy")}
                </span>
              </div>
            </div>
            {review.body ? <p className="mt-1.5 text-sm text-muted-foreground">{review.body}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
