"use client";

import { trpc } from "@/lib/trpc/react";

/** Shared by the bell and order banner; polling never re-renders server pages. */
export function usePortalNotifications(poll = true) {
  return trpc.notifications.unread.useQuery({ limit: 10 }, {
    staleTime: 30_000,
    refetchInterval: poll ? 30_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
    trpc: { abortOnUnmount: true },
  });
}
