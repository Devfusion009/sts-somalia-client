import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
}) {
  const { redirect_to, error } = await searchParams;
  const notice = error === "confirmation_failed" ? "That link is invalid or has expired." : undefined;

  return <LoginForm redirectTo={redirect_to} notice={notice} />;
}
