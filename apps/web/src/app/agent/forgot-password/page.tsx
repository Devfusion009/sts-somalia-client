import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { AuthCard } from "@/components/auth/auth-frame";
import { AgentRecoveryForm } from "./recovery-form";
export const metadata: Metadata = { title: "Agent password recovery" };
export default function AgentRecoveryPage() {
  return <PortalLoginShell portalLabel="Agent Portal" accent="agent"><AuthCard title="Reset agent password"><AgentRecoveryForm /></AuthCard></PortalLoginShell>;
}
