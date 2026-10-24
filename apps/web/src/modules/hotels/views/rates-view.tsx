import { format } from "date-fns";
import { getRatePreview, getRateRules } from "@/modules/hotels/rate-queries";
import { todayIso } from "@/modules/hotels/availability";
import { RateRulesEditor } from "@/modules/hotels/components/rate-rules-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const PREVIEW_DAYS = 14;

export async function RatesView({ hotelId }: { hotelId: string }) {

  const today = todayIso();
  const [rules, preview] = await Promise.all([getRateRules(hotelId), getRatePreview(hotelId, today, PREVIEW_DAYS)]);
  const nights = preview[0]?.nights.map((n) => n.night) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Rates" />

      {preview.length > 0 ? (
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b border-border pt-4 pb-3">
            <CardTitle className="text-base">Next {PREVIEW_DAYS} nights</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">Room type</th>
                  {nights.map((night) => (
                    <th key={night} className="px-2 py-2 text-center font-medium whitespace-nowrap tabular-nums">
                      {format(new Date(`${night}T00:00:00`), "EEE d")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((room) => (
                  <tr key={room.roomId} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                    <td className="sticky left-0 bg-card px-3 py-2 font-medium whitespace-nowrap">{room.roomName}</td>
                    {room.nights.map((n) => (
                      <td
                        key={n.night}
                        title={n.ruleName ?? (n.source === "override" ? "Set for this date" : undefined)}
                        className={cn(
                          "px-2 py-2 text-center tabular-nums",
                          n.source === "rule" && "bg-brand-gold/15 font-medium text-[color-mix(in_oklch,var(--brand-gold),black_50%)] dark:text-brand-gold",
                          n.source === "override" && "bg-primary/10 font-medium text-primary"
                        )}
                      >
                        {Math.round(n.rate).toLocaleString("en-US")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rate rules</CardTitle>
        </CardHeader>
        <CardContent>
          <RateRulesEditor
            hotelId={hotelId}
            rules={rules}
            roomTypes={preview.map((r) => ({ id: r.roomId, name: r.roomName }))}
            today={today}
          />
        </CardContent>
      </Card>
    </div>
  );
}
