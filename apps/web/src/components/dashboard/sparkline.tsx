"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

/**
 * Decorative trend indicator for a stat card — no axes, grid, or tooltip on
 * purpose (the exact numbers live in the card itself; this only conveys
 * shape). Gradient-filled so it reads as a miniature of the full-size trend
 * charts below rather than a stray hairline.
 */
export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  // Gradient defs are document-global by id — useId keeps several sparklines
  // on the same page from all inheriting the first one's color.
  const gradientId = useId();
  if (data.length < 2) return null;
  // A perfectly flat series (typically all zeros on a quiet period) draws a
  // stray horizontal rule that reads as a divider, not data — render nothing
  // rather than decorate the card with a line that carries no information.
  if (Math.min(...data) === Math.max(...data)) return null;
  const points = data.map((value, i) => ({ i, value }));
  const stroke = positive ? "var(--chart-1)" : "var(--destructive)";

  return (
    <ResponsiveContainer width={72} height={32}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={1.75}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
