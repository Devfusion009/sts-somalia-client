"use client";

import { useActionState } from "react";
import { format } from "date-fns";
import { Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createPropertyReview, deletePropertyReview } from "@/modules/admin/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

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
  title,
}: {
  hotelId?: string;
  venueId?: string;
  reviews: Review[];
  /** Renders a card heading, for pages whose sections are titled cards. */
  title?: string;
}) {
  const [state, formAction] = useActionState(createPropertyReview, null);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {title ? (
        <CardHeader className="border-b border-border pt-4 pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      ) : null}
      {reviews.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No reviews</p>
      ) : (
        <ul className="divide-y divide-border">
          {reviews.map((review) => (
            <li key={review.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {review.author_name}
                  <span
                    className="flex items-center gap-0.5 text-brand-gold"
                    role="img"
                    aria-label={`${review.rating} out of 5`}
                  >
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} className="size-3 fill-current" aria-hidden="true" />
                    ))}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {format(new Date(review.created_at), "d MMM yyyy")}
                  </span>
                </p>
                {review.body ? <p className="mt-1 text-sm text-muted-foreground">{review.body}</p> : null}
              </div>
              <form action={deletePropertyReview}>
                <input type="hidden" name="reviewId" value={review.id} />
                {hotelId ? <input type="hidden" name="hotelId" value={hotelId} /> : null}
                {venueId ? <input type="hidden" name="venueId" value={venueId} /> : null}
                <ConfirmButton
                  title="Delete this review?"
                  description={review.author_name}
                  aria-label={`Delete review by ${review.author_name}`}
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-4 border-t border-border bg-muted/30 px-4 py-4">
        {hotelId ? <input type="hidden" name="hotelId" value={hotelId} /> : null}
        {venueId ? <input type="hidden" name="venueId" value={venueId} /> : null}
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field>
            <FieldLabel htmlFor={`review-author-${hotelId ?? venueId}`}>Author</FieldLabel>
            <Input id={`review-author-${hotelId ?? venueId}`} name="authorName" required />
          </Field>
          <Field>
            <FieldLabel htmlFor={`review-rating-${hotelId ?? venueId}`}>Rating</FieldLabel>
            <Input
              id={`review-rating-${hotelId ?? venueId}`}
              name="rating"
              type="number"
              min={1}
              max={5}
              defaultValue={5}
              placeholder="1–5"
              className="tabular-nums"
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`review-body-${hotelId ?? venueId}`}>Review</FieldLabel>
          <Textarea id={`review-body-${hotelId ?? venueId}`} name="body" rows={2} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton pendingText="Adding…">Add review</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
