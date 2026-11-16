"use client";
import Link from "next/link";
import { useState } from "react";
import { Fingerprint, Pencil, FolderLock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { countryName } from "@/lib/countries";
import { maskedPassport, passportState } from "@/modules/account/overview";
import { TravelerProfileCard } from "./traveler-profile-card";
import type { TravelerProfile } from "../queries";
export function IdentitySummary({traveler, unavailable=false}:{traveler:TravelerProfile|null;unavailable?:boolean}) {
 const [open,setOpen]=useState(false);
 const status=passportState(traveler?.passport_expiry,traveler?.passport_number);
 return <Card className="h-full"><CardHeader><CardTitle className="flex items-center gap-3"><Fingerprint className="size-5 text-primary" />Identity & travel documents</CardTitle></CardHeader><CardContent className="space-y-5">
 {unavailable ? <p role="status" className="text-sm text-muted-foreground">Travel details are currently unavailable.</p> : <><Badge variant={status==='Expired'?'destructive':status==='Expiring soon'?'warning':'neutral'}>{status}</Badge><dl className="grid gap-x-6 sm:grid-cols-2">{[["Passport holder",traveler?.full_name],["Date of birth",traveler?.date_of_birth],["Nationality",traveler?.nationality ? countryName(traveler.nationality):null],["Gender",traveler?.gender],["Passport number",maskedPassport(traveler?.passport_number)],["Issue date",traveler?.passport_issue_date],["Expiry date",traveler?.passport_expiry]].map(([label,value])=><div key={label} className="flex justify-between gap-4 border-b py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium capitalize">{value || "Not added"}</dd></div>)}</dl></>}
 <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={unavailable} onClick={()=>setOpen(true)}><Pencil />Edit details</Button><Button variant="outline" render={<Link href="/account/documents" />}><FolderLock />Manage documents</Button></div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Travel identity</DialogTitle></DialogHeader><TravelerProfileCard traveler={traveler} /></DialogContent></Dialog>
 </CardContent></Card>;
}
