"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  orders: { label: "Orders", color: "var(--chart-1)" },
  revenue: { label: "Revenue ($)", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function B2BvsB2CChart({
  data,
}: {
  data: { channel: string; label: string; orders: number; revenue: number }[];
}) {
  const hasData = data.some((d) => d.orders > 0);
  if (!hasData) {
    return (
      <Empty className="h-56 p-0 md:p-0">
        <EmptyMedia variant="icon">
          <BarChart3 />
        </EmptyMedia>
        <EmptyTitle>No paid orders in this range</EmptyTitle>
      </Empty>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
        <XAxis dataKey="channel" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
        <YAxis yAxisId="orders" tickLine={false} axisLine={false} tickMargin={8} width={32} fontSize={11} allowDecimals={false} />
        <YAxis yAxisId="revenue" orientation="right" tickLine={false} axisLine={false} tickMargin={8} width={48} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar yAxisId="orders" dataKey="orders" fill="var(--color-orders)" radius={4} />
        <Bar yAxisId="revenue" dataKey="revenue" fill="var(--color-revenue)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
