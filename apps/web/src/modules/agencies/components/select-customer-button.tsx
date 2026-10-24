"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { selectBookingCustomer } from "@/modules/agencies/booking-context-actions";

/**
 * Navigates client-side rather than letting the action redirect — a Server
 * Action redirect to an /agent path is answered with a 404 under portal
 * isolation in this Next.js version (see booking-context-actions.ts).
 */
export function SelectCustomerButton({
  customerId,
  label = "Select",
  redirectTo,
  variant = "outline",
  className,
}: {
  customerId: string;
  label?: string;
  redirectTo?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={variant}
      className={className}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await selectBookingCustomer(customerId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (redirectTo) {
            router.push(redirectTo);
          } else {
            router.refresh();
          }
        })
      }
    >
      {label}
    </Button>
  );
}
