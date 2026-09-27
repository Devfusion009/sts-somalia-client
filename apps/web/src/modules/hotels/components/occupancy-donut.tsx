"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  booked: { label: "Rooms occupied", color: "var(--chart-1)" },
  unsold: { label: "Rooms unsold", color: "var(--border)" },
} satisfies ChartConfig;

export function OccupancyDonut({
  booked,
  capacity,
}: {
  booked: number;
  capacity: number;
}) {
  const unsold = Math.max(capacity - booked, 0);
  const data = [
    { key: "booked", value: booked },
    { key: "unsold", value: unsold },
  ];

  return (
    <div className="space-y-3">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-48"
      >
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="key" hideLabel />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="62%"
            outerRadius="100%"
            strokeWidth={2}
            stroke="var(--card)"
          >
            {data.map((d) => (
              <Cell key={d.key} fill={`var(--color-${d.key})`} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: "var(--chart-1)" }}
          />
          Rooms occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: "var(--border)" }}
          />
          Rooms unsold
        </span>
      </div>
    </div>
  );
}
