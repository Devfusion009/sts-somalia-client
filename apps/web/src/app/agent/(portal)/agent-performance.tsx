"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesTimelinePoint } from "@/modules/agencies/components/sales-timeline-chart";

const PerformanceChart = dynamic(() => import("./performance-chart").then((module) => module.PerformanceChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] rounded-2xl" />,
});

export function AgentPerformance({ data, currency }: { data: SalesTimelinePoint[]; currency: string }) {
  return <PerformanceChart data={data} currency={currency} />;
}
