import type { Metadata } from "next";
import { headers } from "next/headers";
import { customerGoogleOrigin } from "@/lib/auth/google-policy";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const googleEnabled = Boolean(customerGoogleOrigin((await headers()).get("host"), process.env));
  return <SignupForm googleEnabled={googleEnabled} />;
}
