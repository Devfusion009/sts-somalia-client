import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Globe, Plus, Stamp, FileText, Layers, CircleCheck, Clock3, FolderLock, Users, Headset, AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countryFlag, countryName } from "@/lib/countries";
import { Input } from "@/components/ui/input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { whatsappLink } from "@/lib/whatsapp";
import { filterCustomerVisas, visaListCounts, type VisaListFilters } from "@/modules/visa/customer-list";
import { VISA_STAGE_LABELS } from "@/modules/visa/workflow";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { reviewUploadsComplete } from "@/modules/visa/schemas";
import { getMyVisaApplications } from "@/modules/visa/queries";
import { visaCustomerProgress, visaNextAction, type NextAction } from "@/modules/visa/progress";
import { VisaStatusBadge, fmtMoney } from "@/modules/visa/components/visa-shared";
import type { VisaStage } from "@/modules/visa/workflow";

export const metadata: Metadata = { title: "Visa Applications" };

function nextLine(action: NextAction): string | null {
  switch (action.kind) {
    case "pay":
      return `Complete payment${action.amount ? ` · ${action.amount}` : ""}`;
    case "upload":
      return action.items.length === 1 ? `Upload ${action.items[0].label}` : `Upload ${action.items.length} documents`;
    case "attend":
      return `Appointment ${format(new Date(action.appointment.scheduled_at), "dd MMM")}`;
    case "handover":
      return "Hand in your passport";
    case "collect":
      return "Collect your passport";
    case "download":
      return "Download your visa";
    case "none":
      return null;
  }
}

export default async function AccountVisaPage({searchParams}:{searchParams:Promise<VisaListFilters>}) {
  await requireUser();
  const applications = await getMyVisaApplications();
  const filters = await searchParams;
  const counts = visaListCounts(applications);
  const visible = filterCustomerVisas(applications,filters,countryName);
  const countries = [...new Set(applications.flatMap(app=>app.visa_type ? [app.visa_type.destination_country_code]:[]))].sort((a,b)=>countryName(a).localeCompare(countryName(b)));
  const statuses = [...new Set(applications.map(app=>app.status))];

  const newButton = (
    <Button render={<Link href="/visa" />}>
      <Plus data-icon="inline-start" aria-hidden="true" /> New application
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Visa applications"
        status={applications.length > 0 ? <Badge variant="secondary">{applications.length}</Badge> : null}
        actions={newButton}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:"Total applications",value:counts.total,icon:FileText},{label:"In progress",value:counts.progress,icon:Clock3},{label:"Ready for processing",value:counts.ready,icon:Layers},{label:"Approved / issued",value:counts.completed,icon:CircleCheck}].map(metric=><Card key={metric.label} className="flex-row items-center gap-4 p-5"><span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><metric.icon className="size-6" aria-hidden /></span><div><div className="text-sm text-muted-foreground">{metric.label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</div></div></Card>)}
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-64 flex-1"><label htmlFor="visa-search" className="sr-only">Search applications</label><Input id="visa-search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Search application ID, visa type or destination" /></div>
        <div className="space-y-2"><label htmlFor="visa-country" className="block text-xs text-muted-foreground">Destination</label><select id="visa-country" name="country" defaultValue={filters.country ?? ""} className={NATIVE_SELECT_CLASS}><option value="">All destinations</option>{countries.map(code=><option key={code} value={code}>{countryName(code)}</option>)}</select></div>
        <div className="space-y-2"><label htmlFor="visa-status" className="block text-xs text-muted-foreground">Status</label><select id="visa-status" name="status" defaultValue={filters.status ?? ""} className={NATIVE_SELECT_CLASS}><option value="">All statuses</option>{statuses.map(status=><option key={status} value={status}>{VISA_STAGE_LABELS[status as VisaStage] ?? status}</option>)}</select></div>
        <div className="space-y-2"><label htmlFor="visa-date" className="block text-xs text-muted-foreground">Application date</label><select id="visa-date" name="days" defaultValue={filters.days ?? ""} className={NATIVE_SELECT_CLASS}><option value="">All dates</option>{[7,30,90].map(days=><option key={days} value={days}>Last {days} days</option>)}</select></div>
        <div className="space-y-2"><label htmlFor="visa-sort" className="block text-xs text-muted-foreground">Sort</label><select id="visa-sort" name="sort" defaultValue={filters.sort ?? "newest"} className={NATIVE_SELECT_CLASS}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        <Button type="submit" variant="outline">Apply</Button>{Object.values(filters).some(Boolean) ? <Link className="px-2 py-2 text-sm text-muted-foreground hover:underline" href="/account/visa">Reset</Link>:null}
      </form>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="space-y-3">
        {visible.length===0 ? <Card><Empty><EmptyHeader><EmptyMedia variant="icon"><Stamp /></EmptyMedia><EmptyTitle>{applications.length ? "No matching applications":"No visa applications"}</EmptyTitle></EmptyHeader><EmptyContent>{applications.length ? <Button variant="outline" render={<Link href="/account/visa" />}>Reset filters</Button>:newButton}</EmptyContent></Empty></Card> : visible.map(app=>{
          const draft=app.status==="draft";
          const order=app.order_items[0]?.order ?? null;
          const input={status:app.status as VisaStage,workflow:app.workflow,memberIds:app.members.map(member=>member.id),documentsComplete:reviewUploadsComplete(app),orderStatus:order?.status ?? null,orderId:order?.id ?? null,orderTotal:order ? fmtMoney(order.total,order.currency):null,documents:app.documents,requests:app.document_requests,appointments:app.appointments,passports:app.passports,decisionOutcome:null};
          const progress=draft ? null:visaCustomerProgress(input);
          const action:NextAction=draft || ["rejected","cancelled"].includes(app.status) ? {kind:"none"}:visaNextAction(input,type=>type.replace(/^request:/,"").replace(/_/g," "));
          const detail=draft ? `/visa/apply/${app.id}`:`/account/visa/${app.id}`;
          const actionHref=action.kind==="pay" ? action.href : action.kind==="upload" ? `${detail}#documents`:detail;
          const actionLabel=draft ? "Continue" : action.kind==="pay" ? "Complete payment" : action.kind==="upload" ? "Upload documents" : action.kind==="download" ? "View visa":"View details";
          const line=nextLine(action);
          return <Card key={app.id} className="gap-0 overflow-hidden py-0">
            <div className="grid items-center gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(150px,1fr)_minmax(175px,1.2fr)_auto]">
              <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl" aria-hidden>{app.visa_type ? countryFlag(app.visa_type.destination_country_code):<Globe className="size-5" />}</span><div className="min-w-0"><Link href={detail} className="font-semibold hover:underline">{app.visa_type ? countryName(app.visa_type.destination_country_code):"Visa application"}</Link><div className="mt-1 text-xs text-muted-foreground">{app.visa_type?.name ?? "Visa application"}</div></div></div>
              <div className="space-y-2 lg:border-l lg:pl-4"><div className="break-all font-mono text-xs font-medium">{app.application_ref}</div><div className="text-xs text-muted-foreground">{format(new Date(app.submitted_at ?? app.created_at),"d MMM yyyy")}</div>{progress ? <><div className="text-xs font-medium">{progress.stepLabel}</div><div className="flex gap-1" role="progressbar" aria-label={progress.stepLabel} aria-valuemin={1} aria-valuemax={progress.stages.length} aria-valuenow={progress.index+1}>{progress.stages.map((step,index)=><span key={step.key} className={`h-1.5 flex-1 rounded-full ${progress.outcome === "failed" ? "bg-muted" : index < progress.index || progress.outcome === "success" ? "bg-primary" : index === progress.index ? "bg-primary/40":"bg-muted"}`} />)}</div></>:<Badge variant="neutral">Draft</Badge>}</div>
              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end"><VisaStatusBadge status={app.status} /><span className="whitespace-nowrap text-sm font-semibold tabular-nums">{fmtMoney(order?.total ?? app.price,order?.currency ?? app.currency)}</span><Button variant={action.kind==="none" && !draft ? "outline":"default"} size="sm" render={<Link href={actionHref} />}>{actionLabel}</Button></div>
            </div>
            {line && action.kind!=="none" ? <div className={`mx-4 mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:mx-5 ${action.kind === "upload" ? "bg-destructive/5 text-destructive":"bg-primary/5 text-primary"}`}><AlertCircle className="size-4 shrink-0" aria-hidden />{line}</div>:null}
          </Card>;
        })}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6"><Card className="gap-4 p-5"><h2 className="flex items-center gap-2 font-semibold"><Headset className="size-5 text-primary" />Quick help</h2>{[{href:"/account/documents",label:"Document vault",icon:FolderLock},{href:"/account/travelers",label:"Saved travelers",icon:Users},{href:whatsappLink("Hello STS, I need help with my visa application."),label:"Contact STS",icon:Headset}].map(link=><Link key={link.href} href={link.href} className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:border-primary"><link.icon className="size-4 text-primary" aria-hidden />{link.label}</Link>)}</Card></aside>
      </div>
    </div>
  );
}
