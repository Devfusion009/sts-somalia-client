"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";

/**
 * Withdraws a booking request the customer raised, while it's still open.
 * Was a plain zero-JS `<form action={withdrawBookingRequestAction}>` when
 * this ran as a Server Action directly in the page's own server-rendered
 * JSX — now a small client component, since the mutation runs on apps/api
 * and needs a client-side call to reach it.
 */
export function WithdrawRequestButton({ requestId, orderId }: { requestId: string; orderId: string }) {
  const router = useRouter();
  const withdraw = trpc.bookings.withdrawRequest.useMutation({
    onSuccess: () => {
      toast.success("Request withdrawn.");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Button
      type="button"
      variant="outline"
      loading={withdraw.isPending}
      onClick={() => withdraw.mutate({ requestId, orderId })}
    >
      Withdraw
    </Button>
  );
}
