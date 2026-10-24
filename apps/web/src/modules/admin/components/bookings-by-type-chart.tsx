"use client";

import { Pie, PieChart } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Bookings" },
  hotel: { label: "Hotels", color: "var(--chart-1)" },
  flight: { label: "Flights", color: "var(--chart-2)" },
  visa: { label: "Visa", color: "var(--chart-3)" },
  umrah: { label: "Umrah", color: "var(--chart-4)" },
  hall: { label: "Halls", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function BookingsByTypeChart({ data }: { data: { type: string; label: string; count: number }[] }) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Empty className="h-72 p-0 md:p-0">
        <EmptyMedia variant="icon">
          <PieChartIcon />
        </EmptyMedia>
        <EmptyTitle>No paid bookings in this range</EmptyTitle>
      </Empty>
    );
  }

  const chartData = data.map((d) => ({ ...d, fill: `var(--color-${d.type})` }));

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="type" hideLabel />} />
        <Pie data={chartData} dataKey="count" nameKey="type" innerRadius={60} outerRadius={95} strokeWidth={4} />
        <ChartLegend content={<ChartLegendContent nameKey="type" />} />
      </PieChart>
    </ChartContainer>
  );
}
