import Link from "next/link";
import { Plane, BedDouble, Landmark, Users, FolderLock, FileText, Pencil, ArrowUpRight, Luggage } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { IdentitySummary } from "@/modules/travelers/components/identity-summary";
import { PassportExpiryAlert } from "@/modules/travelers/components/passport-alert";
import { profileCompletion } from "@/modules/account/overview";
import { bookingTimeframe } from "@/modules/bookings/types";
import { StatusBadge } from "@/modules/bookings/components/booking-shared";
import { ProfileForm } from "./profile-form";

export default async function AccountOverviewPage() {
  const profile = await requireUser();
  const db = await createClient();
  const trpc = await getServerTrpc();
  const [hotel,flight,visa,umrah,travelers,documents,bookings] = await Promise.all([
    db.from("hotel_bookings").select("id",{count:"exact",head:true}).eq("customer_id",profile.id),
    db.from("flight_bookings").select("id",{count:"exact",head:true}).eq("customer_id",profile.id),
    db.from("visa_applications").select("id",{count:"exact",head:true}).eq("applicant_profile_id",profile.id),
    db.from("umrah_bookings").select("id",{count:"exact",head:true}).eq("customer_id",profile.id),
    trpc.travelers.myTravelers.query().catch(()=>null),
    trpc.travelers.myDocuments.query().catch(()=>null),
    trpc.bookings.myBookings.query().catch(()=>null),
  ]);
  const self = travelers?.find(t=>t.is_self) ?? null;
  const completion=profileCompletion(profile);
  const initials=(profile.full_name || profile.email || "Customer").trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase();
  const metrics=[
    {label:"Flight bookings",value:flight.error ? null:flight.count,icon:Plane,href:"/account/bookings?filter=all&type=flight"},
    {label:"Hotel bookings",value:hotel.error ? null:hotel.count,icon:BedDouble,href:"/account/bookings?filter=all&type=hotel"},
    {label:"Visa applications",value:visa.error ? null:visa.count,icon:FileText,href:"/account/visa"},
    {label:"Umrah bookings",value:umrah.error ? null:umrah.count,icon:Landmark,href:"/account/bookings?filter=all&type=umrah"},
    {label:"Saved travelers",value:travelers ? travelers.filter(t=>!t.is_self).length:null,icon:Users,href:"/account/travelers"},
    {label:"Documents saved",value:documents?.length ?? null,icon:FolderLock,href:"/account/documents"},
  ];
  const upcoming=(bookings?.bookings ?? []).filter(b=>bookingTimeframe(b)==="upcoming").sort((a,b)=>(a.travelDate ?? "9999").localeCompare(b.travelDate ?? "9999")).slice(0,3);
  return <div className="mx-auto w-full max-w-7xl space-y-5">
    <PageHeader title="My Account" />
    <Card className="gap-5 border-primary/15 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:p-7">
      <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/15 text-xl font-semibold text-primary" aria-hidden>{initials}</div>
      <div className="min-w-0 flex-1"><h2 className="text-xl font-semibold">{profile.full_name || "Your account"}</h2><div className="mt-1 break-all text-sm text-muted-foreground">{profile.email}</div></div>
      <div className="w-full space-y-2 sm:w-48"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Contact profile</span><span className="font-semibold text-foreground">{completion}%</span></div><Progress value={completion} aria-label="Contact profile completion" /></div>
      <Button variant="outline" render={<a href="#contact-details" />}><Pencil />Edit profile</Button>
    </Card>
    <Card className="grid grid-cols-2 gap-0 overflow-hidden py-0 lg:grid-cols-3 xl:grid-cols-6">{metrics.map(metric=><Link key={metric.label} href={metric.href} className="flex items-center gap-3 border-border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><metric.icon className="size-5" aria-hidden /></span><div><div className="text-xs text-muted-foreground">{metric.label}</div><div className="mt-1 text-xl font-semibold tabular-nums" title={metric.value === null ? "Currently unavailable":undefined}>{metric.value ?? "—"}</div></div></Link>)}</Card>
    <PassportExpiryAlert expiry={self?.passport_expiry} subject="Your passport" />
    <div className="grid items-stretch gap-5 xl:grid-cols-[0.9fr_1.1fr]"><ProfileForm profile={profile} /><IdentitySummary traveler={self} unavailable={!travelers} /></div>
    <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-3"><FolderLock className="size-5 text-primary" />Document vault</CardTitle><CardAction><Button variant="outline" size="sm" render={<Link href="/account/documents" />}>Manage documents</Button></CardAction></CardHeader><CardContent>
        {!documents ? <p role="status" className="text-sm text-muted-foreground">Documents are currently unavailable.</p> : documents.length===0 ? <div className="rounded-xl border border-dashed p-6 text-center"><FolderLock className="mx-auto mb-3 size-7 text-muted-foreground" /><div className="mb-4 text-sm">No saved documents</div><Button variant="outline" render={<Link href="/account/documents" />}>Upload document</Button></div> : <div className="grid gap-3 sm:grid-cols-3">{documents.slice(0,3).map(doc=><div key={doc.id} className="min-w-0 space-y-3 rounded-xl border p-4"><FileText className="size-6 text-primary" aria-hidden /><div className="truncate text-sm font-medium" title={doc.file_name}>{doc.file_name}</div><div className="text-xs text-muted-foreground">{doc.traveler?.full_name ?? "Account document"}</div><Badge variant={doc.expires_at && doc.expires_at < new Date().toISOString().slice(0,10) ? "warning":"neutral"}>{doc.expires_at && doc.expires_at < new Date().toISOString().slice(0,10) ? "Expired":"Saved"}</Badge><a className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={`/api/traveler-documents/${doc.id}`} target="_blank" rel="noopener noreferrer">View document <ArrowUpRight className="size-3" /></a></div>)}</div>}
      </CardContent></Card>
      <Card className="bg-primary/[0.03]"><CardHeader><CardTitle className="flex items-center gap-3"><Users className="size-5 text-primary" />Travel profile</CardTitle></CardHeader><CardContent className="space-y-3">{[{href:"/account/travelers",label:"Manage saved travelers"},{href:"/account/documents",label:"Manage travel documents"},{href:"/flights",label:"Search flights"}].map(item=><Link key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm font-medium hover:border-primary">{item.label}<ArrowUpRight className="size-4 text-primary" /></Link>)}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-3"><Luggage className="size-5 text-primary" />Upcoming travel & applications</CardTitle><CardAction><Button size="sm" variant="outline" render={<Link href="/account/bookings" />}>View all bookings</Button></CardAction></CardHeader><CardContent>{!bookings ? <p role="status" className="text-sm text-muted-foreground">Bookings are currently unavailable.</p> : upcoming.length===0 ? <p className="text-sm text-muted-foreground">No upcoming bookings</p> : <ul className="divide-y">{upcoming.map(booking=><li key={`${booking.type}-${booking.id}`} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{booking.title}</div><div className="mt-1 text-xs text-muted-foreground">{booking.travelDate?.slice(0,10) ?? booking.subtitle}</div></div><StatusBadge status={booking.status} /><Button size="sm" variant="outline" render={<Link href={booking.orderId ? `/account/bookings/${booking.orderId}` : booking.type === "visa" ? `/account/visa/${booking.id}` : "/account/bookings"} />}>View details</Button></li>)}</ul>}</CardContent></Card>
  </div>;
}
