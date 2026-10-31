"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { SalesTimelinePoint } from "@/modules/agencies/components/sales-timeline-chart";
import styles from "./workspace.module.css";

export function PerformanceChart({ data, currency }: { data: SalesTimelinePoint[]; currency: string }) {
  const [measure, setMeasure] = useState<"sales" | "tickets">("sales");
  const fillId = useId().replace(/:/g, "");
  const isSales = measure === "sales";
  return (
    <section className={styles.chart} aria-labelledby={`${fillId}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`${fillId}-title`}>{isSales ? `Sales (${currency})` : "Booking activity"}</h2>
        <div className={styles.chartTabs} role="group" aria-label="Performance measure">
          <button type="button" aria-pressed={isSales} onClick={() => setMeasure("sales")}>Sales</button>
          <button type="button" aria-pressed={!isSales} onClick={() => setMeasure("tickets")}>Bookings</button>
        </div>
      </div>
      <ChartContainer config={{ sales: { label: "Sales", color: "var(--primary)" }, tickets: { label: "Bookings", color: "var(--primary)" } }} className="h-64 w-full aspect-auto">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} fontSize={10} interval={Math.max(0, Math.ceil(data.length / 7) - 1)} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={45} fontSize={10} allowDecimals={isSales} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area key={measure} dataKey={measure} type="monotone" stroke="var(--primary)" strokeWidth={2} fill={`url(#${fillId})`} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
    </section>
  );
}
