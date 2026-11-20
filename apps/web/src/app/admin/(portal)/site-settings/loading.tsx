import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";

function Fields({ labels, className }: { labels: string[]; className: string }) {
  return (
    <div className={className}>
      {labels.map((label) => (
        <div key={label} className="space-y-2">
          <p className="text-sm font-medium">{label}</p>
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <div className="flex justify-end border-t pt-4">
      <Skeleton className="h-7 w-24 rounded-lg" />
    </div>
  );
}

export default function SiteSettingsLoading() {
  return (
    <LoadingShell label="site settings" className="max-w-5xl space-y-8">
      <Title title="Site settings" />
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Social links</h2>
        <Card>
          <CardContent className="space-y-5">
            <Fields
              labels={["Instagram", "TikTok", "Facebook", "X", "YouTube", "LinkedIn"]}
              className="grid gap-4 lg:grid-cols-2"
            />
            <Footer />
          </CardContent>
        </Card>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Umrah operations</h2>
        <Card>
          <CardContent className="space-y-6">
            <Fields
              labels={["Unpaid seat hold"]}
              className="grid gap-4 sm:grid-cols-2"
            />
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Footer />
          </CardContent>
        </Card>
      </section>
    </LoadingShell>
  );
}
