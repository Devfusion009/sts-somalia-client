"use client";

import { Pie, PieChart } from "recharts";
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
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No paid bookings yet.
      </div>
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
