"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Banknote, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { PAYOUT_METHODS } from "@/modules/payments/payout";
import {
  failAgencyPayoutRequest,
  markAgencyPayoutSent,
  reviewAgencyCommissionEntries,
  reviewAgencyPayoutRequest,
  settleAgencyPayoutRequest,
} from "@/modules/agencies/admin-actions";
import { FileField } from "@/components/ui/upload";
import { money } from "@/lib/money";
import { selectClass } from "./form-footer";

type PendingEntry = {
  id: string;
  amount: number;
  orderNumber: string | null;
  createdAt: string;
  /** Last service date; commission is approved only after it has passed. */
  serviceEndsOn: string | null;
  approvable: boolean;
};

const usd = (amount: number) => money(amount, "USD");

/**
 * Bulk approve/reject over the entries the admin actually ticks. Approving
 * is what releases commission to the agent as withdrawable, so it stays an
 * explicit selection — never an implicit "everything pending".
 */
export function CommissionEntryReview({ agencyId, entries }: { agencyId: string; entries: PendingEntry[] }) {
  const [state, formAction] = useActionState(reviewAgencyCommissionEntries, null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(entries.filter((e) => e.approvable).map((e) => e.id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedEntries = entries.filter((entry) => selected.has(entry.id));
  const selectedIds = selectedEntries.map((entry) => entry.id);
  const selectedTotal = selectedEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const allSelected = selectedIds.length === entries.length;
  const approveEntries = selectedEntries.filter((entry) => entry.approvable);
  const approveTotal = approveEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-3">
      <div className="-mx-1 divide-y divide-border">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-2 text-xs font-medium text-muted-foreground tabular-nums">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)))}
          />
          {selectedIds.length} of {entries.length} selected · {usd(selectedTotal)}
        </label>
        {entries.map((entry) => (
          <label
            key={entry.id}
            className="flex cursor-pointer items-center gap-2.5 px-1 py-2 text-sm transition-colors hover:bg-muted/40"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selected.has(entry.id)}
              onChange={() => toggle(entry.id)}
            />
            <span className="font-mono text-xs">{entry.orderNumber ?? "—"}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {format(new Date(entry.createdAt), "d MMM yyyy")}
            </span>
            {entry.approvable ? null : (
              <Badge variant="warning">
                {entry.serviceEndsOn ? `Travel ends ${format(parseISO(entry.serviceEndsOn), "d MMM yyyy")}` : "Service not complete"}
              </Badge>
            )}
            <span className="ml-auto font-medium tabular-nums">{usd(entry.amount)}</span>
          </label>
        ))}
      </div>

      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="rejected" />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="entryIds" value={id} />
          ))}
          <SubmitButton size="sm" variant="outline" disabled={selectedIds.length === 0} pendingText="Reversing…">
            <X data-icon="inline-start" /> Reverse
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="approved" />
          {approveEntries.map((entry) => (
            <input key={entry.id} type="hidden" name="entryIds" value={entry.id} />
          ))}
          <SubmitButton size="sm" disabled={approveEntries.length === 0} pendingText="Approving…">
            <Check data-icon="inline-start" /> Approve <span className="tabular-nums">{usd(approveTotal)}</span>
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The whole offline payout run, one request at a time: approve, record what
 * left the bank, confirm it landed, or mark it bounced. The recording form
 * posts to a different action depending on the outcome the admin picks,
 * because "sent" and "landed" are genuinely different events — one reserves
 * the money in transit, the other settles the commission entries behind it.
 */
export function PayoutRequestActions({
  agencyId,
  requestId,
  status,
}: {
  agencyId: string;
  requestId: string;
  status: string;
}) {
  const [approveState, approveAction] = useActionState(reviewAgencyPayoutRequest, null);
  const [rejectState, rejectAction] = useActionState(reviewAgencyPayoutRequest, null);
  const [sentState, sentAction] = useActionState(markAgencyPayoutSent, null);
  const [settleState, settleAction] = useActionState(settleAgencyPayoutRequest, null);
  const [failState, failAction] = useActionState(failAgencyPayoutRequest, null);
  const [rejecting, setRejecting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [failing, setFailing] = useState(false);
  const [landed, setLanded] = useState(false);
  const error =
    approveState?.error ?? rejectState?.error ?? sentState?.error ?? settleState?.error ?? failState?.error;

  if (status === "paid" || status === "rejected" || status === "failed") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {status === "pending" ? (
          <>
            <form action={approveAction}>
              <input type="hidden" name="agencyId" value={agencyId} />
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="decision" value="approved" />
              <SubmitButton size="sm" pendingText="Approving…">
                <Check data-icon="inline-start" /> Approve
              </SubmitButton>
            </form>
            <Button
              type="button"
              size="sm"
              variant={rejecting ? "destructive" : "outline"}
              aria-expanded={rejecting}
              onClick={() => setRejecting((v) => !v)}
            >
              <X data-icon="inline-start" /> Decline
            </Button>
          </>
        ) : null}

        {status === "approved" ? (
          <Button type="button" size="sm" aria-expanded={recording} onClick={() => setRecording((v) => !v)}>
            <Banknote data-icon="inline-start" /> Record transfer
          </Button>
        ) : null}

        {status === "processing" ? (
          <form action={settleAction}>
            <input type="hidden" name="agencyId" value={agencyId} />
            <input type="hidden" name="requestId" value={requestId} />
            <SubmitButton size="sm" pendingText="Confirming…">
              <Check data-icon="inline-start" /> Confirm received
            </SubmitButton>
          </form>
        ) : null}

        {status === "approved" || status === "processing" ? (
          <Button
            type="button"
            size="sm"
            variant={failing ? "destructive" : "outline"}
            aria-expanded={failing}
            onClick={() => setFailing((v) => !v)}
          >
            <AlertTriangle data-icon="inline-start" /> Mark failed
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="rejected" />
          <Textarea name="note" placeholder="Reason (shown to the agency)" rows={2} required aria-label="Reason" />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Declining…">
              Decline request
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {recording ? (
        <form action={landed ? settleAction : sentAction} className="space-y-2 text-left">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <select name="method" defaultValue="bank_transfer" className={selectClass} required aria-label="Method">
            {PAYOUT_METHODS.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
          <Input name="reference" placeholder="Transfer reference" aria-label="Transfer reference" />
          <Input
            type="date"
            name={landed ? "paidAt" : "sentAt"}
            defaultValue={today()}
            max={today()}
            aria-label={landed ? "Paid on" : "Sent on"}
          />
          <FileField name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" label="Transfer proof" compact />
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            <legend className="sr-only">Transfer state</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" className="size-4 accent-primary" checked={!landed} onChange={() => setLanded(false)} />
              Sent
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" className="size-4 accent-primary" checked={landed} onChange={() => setLanded(true)} />
              Landed
            </label>
          </fieldset>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRecording(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" pendingText="Recording…">
              Save
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {failing ? (
        <form action={failAction} className="space-y-1.5">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <Textarea
            name="reason"
            placeholder="What went wrong (shown to the agency)"
            rows={2}
            required
            aria-label="Failure reason"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setFailing(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Saving…">
              Mark failed
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
