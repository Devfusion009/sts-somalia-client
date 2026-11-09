"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

export function WaafiPaymentStatus({ referenceId, kind, agencyId, autoPoll = true }: {
  referenceId: string; kind: "payment" | "topup"; agencyId?: string; autoPoll?: boolean;
}) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const status = trpc.payments.waafiStatus.useQuery({ referenceId, kind }, {
    enabled: autoPoll, refetchInterval: 5000, refetchIntervalInBackground: false, retry: false,
  });
  useEffect(() => {
    if (!refreshed.current && (status.data?.status === "paid" || status.data?.status === "failed")) {
      refreshed.current = true;
      router.refresh();
    }
  }, [status.data?.status, router]);
  const payment = trpc.payments.confirmWaafi.useMutation();
  const topup = trpc.payments.confirmWaafiTopup.useMutation();
  async function check() {
    setMessage(null);
    try {
      const result = kind === "payment"
        ? (await payment.mutateAsync({ paymentId: referenceId })).status
        : await topup.mutateAsync({ topupId: referenceId, agencyId: agencyId! });
      if (result === "paid" || result === "failed") router.refresh();
      else setMessage("Payment confirmation pending.");
      await status.refetch();
    } catch { setMessage("Payment confirmation is unavailable."); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status.data?.redirectUrl ? <Button size="sm" nativeButton={false} render={<a href={status.data.redirectUrl} />}>Continue payment</Button> : null}
      <Button type="button" size="sm" variant="outline" disabled={payment.isPending || topup.isPending} onClick={check}>Check payment</Button>
      {message ? <span role="status" className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
