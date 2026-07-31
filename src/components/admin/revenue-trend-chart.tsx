"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "Revenue ($)", color: "var(--chart-1)" },
  orders: { label: "Orders", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RevenueTrendChart({ data }: { data: { month: string; revenue: number; orders: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="revenue" tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <YAxis
          yAxisId="orders"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="revenue" dataKey="revenue" fill="var(--color-revenue)" radius={4} />
        <Line
          yAxisId="orders"
          dataKey="orders"
          type="monotone"
          stroke="var(--color-orders)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
