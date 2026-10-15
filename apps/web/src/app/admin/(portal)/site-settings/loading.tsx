import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";

export default function SiteSettingsLoading() {
  return (
    <LoadingShell label="site settings">
      <Title title="Site settings" />
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Social links</h2>
        <Card>
          <CardContent className="p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {["Instagram", "TikTok", "Facebook", "X", "YouTube", "LinkedIn"].map((label) => (
                <div key={label} className="space-y-1.5">
                  <p className="text-sm font-medium">{label}</p>
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-5 h-8 w-28 rounded-lg" />
          </CardContent>
        </Card>
      </section>
    </LoadingShell>
  );
}
