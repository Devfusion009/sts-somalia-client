import { ArrowRight, ExternalLink, FlaskConical, ShieldCheck } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { SandboxCheckout, SandboxCredentials, SandboxResult } from "@/modules/payments/sandbox/forms";
import { inspectSandboxTest, newSandboxReference, sandboxSetupStatus } from "@/modules/payments/sandbox/service";

export const metadata = { title: "WaafiPay sandbox" };
export default async function WaafiSandboxPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  await requirePlatformAdmin();
  const { attempt } = await searchParams;
  const setup = await sandboxSetupStatus();
  const result = attempt ? await inspectSandboxTest(attempt) : null;
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader title="WaafiPay sandbox" back={{ href: "/admin/integrations?tab=payments", label: "Payment integrations" }} status={<Badge variant="warning">Test mode</Badge>} />
    <section className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50 text-amber-950">
      <div className="flex items-start gap-4 p-6"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-200/60"><FlaskConical className="size-6" aria-hidden="true" /></span><div><h2 className="font-heading text-lg font-semibold">Sandbox payments only</h2><p className="mt-1 text-sm leading-6">No real payment is collected. Test results do not confirm bookings, credit wallets or enter financial reports.</p></div></div>
      <ol className="grid gap-3 border-t border-amber-200 bg-white/50 px-6 py-4 text-xs font-medium sm:grid-cols-3">{["Create a test checkout", "Complete it on WaafiPay", "Verify the sandbox result"].map((label, i) => <li className="flex items-center gap-2" key={label}><span className="flex size-6 items-center justify-center rounded-full bg-amber-200/70 font-semibold">{i + 1}</span>{label}{i < 2 && <ArrowRight className="ml-auto hidden size-3.5 sm:block" aria-hidden="true" />}</li>)}</ol>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_.9fr]">
      {result ? <section className="rounded-2xl border border-border bg-card p-6"><h2 className="mb-5 text-lg font-semibold">Sandbox result</h2><SandboxResult initial={result} /></section> : <SandboxCheckout reference={newSandboxReference()} configured={setup.configured} />}
      <aside className="space-y-6">
        <SandboxCredentials configured={setup.configured} />
        <section className="rounded-2xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />Test environment</div><dl className="space-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Gateway</dt><dd className="mt-1 break-all font-mono text-xs">sandbox.waafipay.com/asm</dd></div><div><dt className="text-xs text-muted-foreground">Access</dt><dd className="mt-1">Platform admins only</dd></div><div><dt className="text-xs text-muted-foreground">Test retention</dt><dd className="mt-1">One hour</dd></div><div><dt className="text-xs text-muted-foreground">Live checkout</dt><dd className="mt-1">Unchanged</dd></div></dl><a href="https://docs.waafipay.com/quickstart" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">WaafiPay test accounts<ExternalLink className="size-3.5" aria-hidden="true" /></a></section>
      </aside>
    </div>
  </div>;
}
