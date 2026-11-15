"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";

/** Rendering the list is passive. Opening or interacting with a specific order acknowledges only that order. */
export function OrderReadScope({ orderId, opened, children }: { orderId: string; opened: boolean; children: ReactNode }) {
  const sent = useRef(false);
  const utils = trpc.useUtils();
  const { mutate } = trpc.notifications.readOrder.useMutation({
    onSuccess: () => Promise.all([
      utils.notifications.unreadOrderCount.invalidate(),
      utils.notifications.unread.invalidate(),
    ]),
    onError: () => { sent.current = false; toast.error("Order could not be marked as seen. Try again."); },
  });
  const markSeen = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    mutate({ orderId });
  }, [mutate, orderId]);
  useEffect(() => { if (opened) markSeen(); }, [opened, markSeen]);
  return <div onClickCapture={markSeen}>{children}</div>;
}
