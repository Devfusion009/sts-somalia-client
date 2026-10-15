"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Banknote, CheckCircle2, XCircle } from "lucide-react";
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

type PendingEntry = {
  id: string;
  amount: number;
  orderNumber: string | null;
  createdAt: string;
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

/**
 * Bulk approve/reject over the entries the admin actually ticks. Approving
 * is what releases commission to the agent as withdrawable, so it stays an
 * explicit selection — never an implicit "everything pending".
 */
export function CommissionEntryReview({ agencyId, entries }: { agencyId: string; entries: PendingEntry[] }) {
  const [state, formAction] = useActionState(reviewAgencyCommissionEntries, null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedTotal = entries.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + e.amount, 0);
  const allSelected = selected.size === entries.length;

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border rounded-lg border border-border">
        <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)))}
          />
          {selected.size} of {entries.length} selected · {money(selectedTotal)}
        </label>
        {entries.map((entry) => (
          <label key={entry.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={selected.has(entry.id)}
              onChange={() => toggle(entry.id)}
            />
            <span className="font-mono text-xs">{entry.orderNumber ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "d MMM yyyy")}</span>
            <span className="ml-auto font-semibold">{money(entry.amount)}</span>
          </label>
        ))}
      </div>

      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="rejected" />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="entryIds" value={id} />
          ))}
          <SubmitButton size="sm" variant="outline" className="gap-1" disabled={selected.size === 0} pendingText="Reversing…">
            <XCircle className="size-3.5" /> Reverse
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="decision" value="approved" />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="entryIds" value={id} />
          ))}
          <SubmitButton size="sm" className="gap-1" disabled={selected.size === 0} pendingText="Approving…">
            <CheckCircle2 className="size-3.5" /> Approve {money(selectedTotal)}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
              <SubmitButton size="sm" className="gap-1" pendingText="Approving…">
                <CheckCircle2 className="size-3.5" /> Approve
              </SubmitButton>
            </form>
            <Button
              type="button"
              size="sm"
              variant={rejecting ? "destructive" : "outline"}
              className="gap-1"
              onClick={() => setRejecting((v) => !v)}
            >
              <XCircle className="size-3.5" /> Decline
            </Button>
          </>
        ) : null}

        {status === "approved" ? (
          <Button type="button" size="sm" className="gap-1" onClick={() => setRecording((v) => !v)}>
            <Banknote className="size-3.5" /> Record transfer
          </Button>
        ) : null}

        {status === "processing" ? (
          <form action={settleAction}>
            <input type="hidden" name="agencyId" value={agencyId} />
            <input type="hidden" name="requestId" value={requestId} />
            <SubmitButton size="sm" className="gap-1" pendingText="Confirming…">
              <CheckCircle2 className="size-3.5" /> Confirm received
            </SubmitButton>
          </form>
        ) : null}

        {status === "approved" || status === "processing" ? (
          <Button
            type="button"
            size="sm"
            variant={failing ? "destructive" : "outline"}
            className="gap-1"
            onClick={() => setFailing((v) => !v)}
          >
            <AlertTriangle className="size-3.5" /> Mark failed
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-right text-xs text-destructive">{error}</p> : null}

      {rejecting ? (
        <form action={rejectAction} className="space-y-1.5">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="rejected" />
          <Textarea name="note" placeholder="Reason (shown to the agency)" rows={2} required />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Declining…">
              Confirm
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {recording ? (
        <form action={landed ? settleAction : sentAction} className="space-y-2 text-left">
          <input type="hidden" name="agencyId" value={agencyId} />
          <input type="hidden" name="requestId" value={requestId} />
          <select name="method" defaultValue="bank_transfer" className={selectClass} required>
            {PAYOUT_METHODS.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
          <Input name="reference" placeholder="Transfer reference" />
          <Input type="date" name={landed ? "paidAt" : "sentAt"} defaultValue={today()} max={today()} />
          <FileField name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" label="Transfer proof" compact />
          <div className="space-y-1 text-xs">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!landed} onChange={() => setLanded(false)} />
              Sent — not confirmed yet
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={landed} onChange={() => setLanded(true)} />
              Completed — money landed
            </label>
          </div>
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
          <Textarea name="reason" placeholder="What went wrong (shown to the agency)" rows={2} required />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setFailing(false)}>
              Cancel
            </Button>
            <SubmitButton size="sm" variant="destructive" pendingText="Saving…">
              Confirm
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
