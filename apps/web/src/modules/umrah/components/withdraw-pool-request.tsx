"use client";
import { useActionState } from "react";
import { withdrawPoolRequest } from "../pool-request-actions";
import { SubmitButton } from "@/components/submit-button";
export function WithdrawPoolRequest({ id }: { id: string }) {
  const [state,action]=useActionState(withdrawPoolRequest,null);
  return <form action={action} className="space-y-3"><input type="hidden" name="requestId" value={id} /><SubmitButton variant="outline">Withdraw request</SubmitButton>{state?.error ? <div role="alert" className="text-destructive">{state.error}</div> : null}</form>;
}
