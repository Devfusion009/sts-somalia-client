"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
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
        {/* Gradient-filled area rather than bars: revenue is a continuous
            quantity over time, so the filled curve reads as a trend at a
            glance while bars implied discrete buckets. */}
        <defs>
          <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
        <YAxis yAxisId="revenue" tickLine={false} axisLine={false} tickMargin={8} width={40} fontSize={11} />
        <YAxis
          yAxisId="orders"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={32}
          fontSize={11}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          yAxisId="revenue"
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2.5}
          fill="url(#revenueTrendFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
        <Line
          yAxisId="orders"
          dataKey="orders"
          type="monotone"
          stroke="var(--color-orders)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
