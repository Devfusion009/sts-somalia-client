import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { AuthCard } from "@/components/auth/auth-frame";
import { ManagerRecoveryForm } from "./recovery-form";
export const metadata: Metadata = { title: "Manager password recovery" };
export default function ManagerRecoveryPage() {
  return <PortalLoginShell portalLabel="Manager Portal" accent="manager"><AuthCard title="Reset manager password"><ManagerRecoveryForm /></AuthCard></PortalLoginShell>;
}
