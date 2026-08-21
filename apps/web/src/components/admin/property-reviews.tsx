"use client";

import { useActionState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createPropertyReview, deletePropertyReview } from "@/modules/admin/actions";

type Review = {
  id: string;
  author_name: string;
  rating: number;
  body: string | null;
  created_at: string;
};

/** Admin-authored reviews (property_reviews) — shared by the hotel and venue detail pages. */
export function PropertyReviews({
  hotelId,
  venueId,
  reviews,
}: {
  hotelId?: string;
  venueId?: string;
  reviews: Review[];
}) {
  const [state, formAction] = useActionState(createPropertyReview, null);

  return (
    <div className="space-y-4">
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {review.author_name}
                    <span className="ml-1 flex items-center gap-0.5 text-brand-gold">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="size-3 fill-current" />
                      ))}
                    </span>
                  </p>
                  {review.body ? <p className="mt-1 text-sm text-muted-foreground">{review.body}</p> : null}
                </div>
                <form action={deletePropertyReview}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  {hotelId ? <input type="hidden" name="hotelId" value={hotelId} /> : null}
                  {venueId ? <input type="hidden" name="venueId" value={venueId} /> : null}
                  <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-3">
        {hotelId ? <input type="hidden" name="hotelId" value={hotelId} /> : null}
        {venueId ? <input type="hidden" name="venueId" value={venueId} /> : null}
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-author">Author name</Label>
            <Input id="review-author" name="authorName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-rating">Rating (1-5)</Label>
            <Input id="review-rating" name="rating" type="number" min={1} max={5} defaultValue={5} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-body">Review</Label>
          <Textarea id="review-body" name="body" rows={2} />
        </div>
        <SubmitButton size="sm" pendingText="Adding…">
          Add review
        </SubmitButton>
      </form>
    </div>
  );
}
