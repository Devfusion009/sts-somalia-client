import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { configurePoolSchema, poolRequestStatusSchema, type SubmitPoolRequestInput } from "@sts/shared-types";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";

const requestSchema = z.object({
  id: z.string(), reference: z.string(), departure_id: z.string(), status: poolRequestStatusSchema,
  num_pilgrims: z.number(), currency: z.string(), total: z.coerce.number(), unit_price: z.coerce.number(),
  agency_id: z.string().nullable(), agency_customer_id: z.string().nullable(),
  order_id: z.string().nullable(), payment_due_at: z.string().nullable(), created_at: z.string(),
  quote_snapshot: z.object({ packageName: z.string(), departureDate: z.string(), returnDate: z.string(), terms: z.string() }),
  closed_reason: z.string().nullable(),
});
const departureSchema = z.object({
  id: z.string(), departure_date: z.string(), return_date: z.string(), total_seats: z.number(), booked_seats: z.number(),
  booking_mode: z.enum(["immediate_payment", "request_then_pay"]), formation_status: z.string(),
  formation_closes_at: z.string().nullable(), payment_cutoff_at: z.string().nullable(), payment_window_hours: z.number(),
  request_terms: z.string().nullable(), activation_error: z.string().nullable(), replacement_sales_open: z.boolean(),
});
export type UmrahPoolRequestView = z.infer<typeof requestSchema>;
export type UmrahPoolDepartureView = z.infer<typeof departureSchema>;

@Injectable()
export class PoolRequestService {
  constructor(private readonly rls: RlsSupabaseService) {}
  async enabled(): Promise<boolean> {
    const {data,error}=await this.rls.get().from("platform_settings").select("value").eq("key","umrah_request_pools_enabled").maybeSingle();
    if(error) throw new BadRequestException("Pool settings could not be loaded.");
    return data?.value === true;
  }
  async submit(input: SubmitPoolRequestInput): Promise<{ id: string; reference: string }[]> {
    const { data, error } = await this.rls.get().rpc("submit_umrah_pool_requests", {
      p_departure_id: input.departureId, p_key: input.idempotencyKey, p_parties: input.parties, p_terms_accepted: input.termsAccepted,
    });
    if (error) throw new BadRequestException(error.message);
    return z.array(z.object({ id: z.string(), reference: z.string() })).parse(data);
  }
  async list(departureId?: string): Promise<UmrahPoolRequestView[]> {
    const rows: UmrahPoolRequestView[] = [];
    // Read every page: PostgREST's response limit must not hide applicants or alter capacity totals.
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = this.rls.get().from("umrah_pool_requests").select("*")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
      if (departureId) query = query.eq("departure_id", departureId);
      const { data, error } = await query;
      if (error) throw new BadRequestException("Umrah requests could not be loaded.");
      const page = requestSchema.array().parse(data);
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async get(requestId: string) {
    const { data, error } = await this.rls.get().from("umrah_pool_requests").select("*").eq("id", requestId).maybeSingle();
    if (error || !data) throw new NotFoundException("Request not found.");
    const request = requestSchema.parse(data);
    const travelers = await this.rls.get().from("umrah_pool_request_travelers").select("id,full_name,gender").eq("request_id", requestId);
    if (travelers.error) throw new BadRequestException("Travelers could not be loaded.");
    const payments = request.order_id ? await this.rls.get().from("payments").select("id,status").eq("order_id",request.order_id) : {data:[],error:null};
    if(payments.error) throw new BadRequestException("Payment status could not be loaded.");
    const pendingIds = payments.data?.filter(p => p.status === "requires_action").map(p => p.id) ?? [];
    const proofs = pendingIds.length ? await this.rls.get().from("payment_proofs").select("status").in("payment_id",pendingIds).eq("status","submitted").limit(1) : {data:[],error:null};
    if(proofs.error) throw new BadRequestException("Payment proof status could not be loaded.");
    const paymentReview = (proofs.data?.length ?? 0) > 0;
    const paymentInstructions = pendingIds.length > 0 && !paymentReview;
    const paymentProcessing = payments.data?.some(p => p.status === "processing") ?? false;
    const canPay = request.status === "payment_due" && !!request.payment_due_at && Date.parse(request.payment_due_at)>Date.now() && !paymentReview && !paymentProcessing;
    return { ...request, canPay, paymentReview, paymentInstructions, paymentProcessing, travelers: z.array(z.object({ id: z.string(), full_name: z.string(), gender: z.string() })).parse(travelers.data) };
  }
  async withdraw(requestId: string) {
    const { error } = await this.rls.get().rpc("withdraw_umrah_pool_request", { p_request_id: requestId });
    if (error) throw new BadRequestException(error.message);
  }
  async configure(input: z.infer<typeof configurePoolSchema>) {
    const { error } = await this.rls.get().rpc("configure_umrah_request_pool", {
      p_departure_id: input.departureId, p_closes_at: input.formationClosesAt, p_cutoff_at: input.paymentCutoffAt,
      p_window: input.paymentWindowHours, p_terms: input.terms,
    });
    if (error) throw new BadRequestException(error.message);
  }
  async openReplacements(departureId: string) {
    const { error } = await this.rls.get().rpc("open_umrah_pool_replacements", { p_departure: departureId });
    if (error) throw new BadRequestException(error.message);
  }
  async resend(jobId: string) {
    const { error } = await this.rls.get().rpc("resend_umrah_pool_email", { p_id: jobId });
    if (error) throw new BadRequestException(error.message);
  }
  async delivery(departureId: string) {
    const {data,error} = await this.rls.get().from("umrah_pool_email_jobs").select("id,kind,status,attempts,last_error,request:umrah_pool_requests!inner(reference,departure_id)").eq("request.departure_id",departureId).order("created_at",{ascending:false}).limit(200);
    if (error) throw new BadRequestException("Notification delivery could not be loaded.");
    return z.array(z.object({id:z.string(),kind:z.string(),status:z.string(),attempts:z.number(),last_error:z.string().nullable(),request:z.object({reference:z.string(),departure_id:z.string()})})).parse(data);
  }
  async departures(packageId: string): Promise<UmrahPoolDepartureView[]> {
    const { data, error } = await this.rls.get().from("umrah_package_departures").select("*").eq("package_id", packageId).order("departure_date");
    if (error) throw new BadRequestException("Pool configuration could not be loaded.");
    return departureSchema.array().parse(data);
  }
}
