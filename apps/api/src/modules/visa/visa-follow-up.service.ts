import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { AdminSupabaseService } from "../../infra/supabase/admin-supabase.service";

/**
 * Runs the visa follow-up rules (visa_run_follow_ups in SQL) every 15
 * minutes: applicant reminders, cancellation with a full refund when a
 * case that was never filed waits 14 days on the applicant, staff
 * status-check reminders and the overdue flag. The rules and their
 * once-only bookkeeping live in SQL, so overlapping runs are harmless.
 */
@Injectable()
export class VisaFollowUpService {
  private readonly logger = new Logger(VisaFollowUpService.name);
  private running = false;

  constructor(private readonly admin: AdminSupabaseService) {}

  @Interval(15 * 60_000)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { data, error } = await this.admin.get().rpc("visa_run_follow_ups");
      if (error) throw new Error(error.message);
      const counts = (data ?? {}) as Record<string, number>;
      if (Object.values(counts).some((n) => n > 0)) this.logger.log(`[visa] follow-ups ${JSON.stringify(counts)}`);
    } catch (error) {
      this.logger.warn(`[visa] follow-ups failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
