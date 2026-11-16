"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type BookingMixSlice = { key: string; label: string; value: number; color: string };

export function BookingMixChart({ slices, total }: { slices: BookingMixSlice[]; total: number }) {
  const data = total > 0 ? slices.filter((slice) => slice.value > 0) : [{ key: "empty", label: "No bookings", value: 1, color: "var(--muted)" }];
  const config = Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.label, color: slice.color }]));
  return (
    <div className="relative mx-auto size-48 shrink-0">
      <ChartContainer config={config} className="aspect-square size-48">
        <PieChart>
          {total > 0 ? <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} /> : null}
          <Pie data={data} dataKey="value" nameKey="key" innerRadius={58} outerRadius={90} paddingAngle={total > 0 && data.length > 1 ? 2 : 0} strokeWidth={0} isAnimationActive={false}>
            {data.map((slice) => <Cell key={slice.key} fill={slice.color} />)}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold tabular-nums">{total.toLocaleString("en-US")}</span>
        <span className="text-xs text-muted-foreground">Bookings</span>
      </div>
    </div>
  );
}
