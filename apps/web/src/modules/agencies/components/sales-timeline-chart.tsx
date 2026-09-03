"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type SalesTimelinePoint = { label: string; sales: number; tickets: number };

const salesConfig = {
  sales: { label: "Sales", color: "var(--chart-1)" },
} satisfies ChartConfig;

const ticketsConfig = {
  tickets: { label: "Tickets", color: "var(--chart-3)" },
} satisfies ChartConfig;

/**
 * Sales value and tickets cut over the selected range, as two side-by-side
 * single-axis panels rather than one dual-axis chart — a count and a
 * currency amount don't share a scale. Sparse tick interval keeps hourly
 * ranges from colliding.
 */
export function SalesTimelineChart({
  data,
  currency,
}: {
  data: SalesTimelinePoint[];
  currency: string;
}) {
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales ({currency})</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesConfig} className="aspect-auto h-56 w-full">
            <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="agencySalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
                interval={tickInterval}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="sales"
                type="monotone"
                stroke="var(--color-sales)"
                strokeWidth={2}
                fill="url(#agencySalesFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tickets cut</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={ticketsConfig} className="aspect-auto h-56 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
                interval={tickInterval}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={32}
                fontSize={11}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="tickets"
                fill="var(--color-tickets)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
