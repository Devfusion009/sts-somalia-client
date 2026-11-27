import type { Metadata } from "next";
import { headers } from "next/headers";
import { customerGoogleOrigin, customerGoogleReturnPath } from "@/lib/auth/google-policy";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ redirect_to?: string }> }) {
  const { redirect_to } = await searchParams;
  const googleEnabled = Boolean(customerGoogleOrigin((await headers()).get("host")));
  return <SignupForm googleEnabled={googleEnabled} redirectTo={customerGoogleReturnPath(redirect_to || "/")} />;
}
