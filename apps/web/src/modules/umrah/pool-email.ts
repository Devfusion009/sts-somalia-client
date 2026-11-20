export type PoolMailKind = "received" | "payment_due" | "reminder" | "expired" | "cancelled" | "paid";
export type PoolMailRequest = {
  id: string; reference: string; status: string; total: number | string; currency: string;
  num_pilgrims: number; payment_due_at: string | null; agency_id: string | null;
  quote_snapshot: { packageName: string; departureDate: string };
};
export function poolMailIsCurrent(kind: PoolMailKind, request: PoolMailRequest, now = Date.now()) {
  if (kind === "received") return request.status === "requested";
  if (kind === "payment_due" || kind === "reminder") return request.status === "payment_due" && !!request.payment_due_at && Date.parse(request.payment_due_at) > now;
  if (kind === "paid") return request.status === "paid";
  return request.status === kind;
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function renderPoolEmail(kind: PoolMailKind, r: PoolMailRequest, origin: string) {
  const titles: Record<PoolMailKind,string> = {received:"Umrah request received",payment_due:"Umrah group confirmed — payment due",reminder:"Umrah payment reminder",expired:"Umrah payment deadline expired",cancelled:"Umrah request cancelled",paid:"Umrah booking confirmed"};
  const amount=`${r.currency} ${Number(r.total).toFixed(2)}`;
  const places=`${r.num_pilgrims} ${r.num_pilgrims === 1 ? "place" : "places"}`;
  const deadline=r.payment_due_at ? new Date(r.payment_due_at).toLocaleString("en-GB",{timeZone:"Africa/Mogadishu"})+" EAT" : "";
  const line=kind==='payment_due'||kind==='reminder'
    ? `Your group for ${r.quote_snapshot.packageName} on ${r.quote_snapshot.departureDate} is confirmed. Complete payment of ${amount} by ${deadline} to confirm your ${places}.`
    : kind==='received' ? `Your request for ${places} on ${r.quote_snapshot.packageName} has been received. Payment opens after the group is confirmed.`
    : kind==='paid' ? `Payment of ${amount} has been received. Your booking is confirmed.`
    : kind==='expired' ? "Your payment deadline has passed. Your places have been released." : "Your Umrah request has been cancelled. Open your booking for payment or refund updates.";
  const href=`${origin.replace(/\/$/,"")}${r.agency_id?"/agent":"/account"}/umrah/requests/${encodeURIComponent(r.id)}`;
  return {subject:`${titles[kind]} — ${r.reference}`,text:`${line}\nReference: ${r.reference}\n${href}`,html:`<h1>${escape(titles[kind])}</h1><p>${escape(line)}</p><p>Reference: ${escape(r.reference)}</p><a href="${escape(href)}">Open booking</a>`};
}
