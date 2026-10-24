"use client";

import { DemoLoginButton } from "./demo-login-button";
import type { ActionState } from "@/lib/auth/actions";

export type DemoAccountEntry = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  password: string;
  label: string;
};

/**
 * Every demo account in one place, each a genuine one-click sign-in — no
 * intermediate "pick a portal, then find its button" step. Each entry
 * still posts to that portal's own real sign-in action; this is purely a
 * single surface for what used to require visiting four separate pages.
 */
export function DemoAccountsList({ accounts }: { accounts: DemoAccountEntry[] }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-muted-foreground">Demo accounts</p>
      <div className="space-y-2">
        {accounts.map((account) => (
          <DemoLoginButton
            key={account.email}
            action={account.action}
            email={account.email}
            password={account.password}
            label={account.label}
          />
        ))}
      </div>
    </div>
  );
}
