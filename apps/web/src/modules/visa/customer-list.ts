export type VisaListFilters = { q?: string; country?: string; status?: string; days?: string; sort?: string };
export const VISA_LIST_CLOSED = new Set(["approved", "issued", "rejected", "cancelled"]);
export function visaListCounts(rows: Array<{status:string}>) {
  return {total:rows.length,progress:rows.filter(row=>row.status!=="draft" && row.status!=="ready_for_processing" && !VISA_LIST_CLOSED.has(row.status)).length,ready:rows.filter(row=>row.status==="ready_for_processing").length,completed:rows.filter(row=>["approved","issued"].includes(row.status)).length};
}
export function filterCustomerVisas<T extends {id:string;status:string;application_ref:string;created_at:string;submitted_at:string|null;visa_type:{name:string;destination_country_code:string}|null}>(rows:T[],filters:VisaListFilters,countryLabel:(code:string)=>string, now=Date.now()):T[] {
 const term=(filters.q ?? "").trim().slice(0,100).toLocaleLowerCase();
 return rows.filter(row=>!term || [row.application_ref,row.visa_type?.name,row.visa_type?.destination_country_code,row.visa_type ? countryLabel(row.visa_type.destination_country_code):""].some(value=>value?.toLocaleLowerCase().includes(term)))
 .filter(row=>!filters.country || row.visa_type?.destination_country_code===filters.country)
 .filter(row=>!filters.status || row.status===filters.status)
 .filter(row=>!["7","30","90"].includes(filters.days ?? "") || Date.parse(row.submitted_at ?? row.created_at)>=now-Number(filters.days)*86400000)
 .sort((a,b)=>{
   const difference=(b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at)||b.id.localeCompare(a.id);
   return filters.sort==="oldest" ? -difference : difference;
 });
}
