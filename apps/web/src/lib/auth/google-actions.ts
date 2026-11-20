"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { customerGoogleOrigin, customerGoogleReturnPath, GOOGLE_CALLBACK_PATH, GOOGLE_RETURN_COOKIE } from "./google-policy";
import type { ActionState } from "./actions";

export async function signInCustomerWithGoogle(_previous: ActionState, form: FormData): Promise<ActionState> {
  const origin = customerGoogleOrigin((await headers()).get("host"), process.env);
  if (!origin) return { error: "Google sign-in is unavailable." };

  const supabase = await createClient();
  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}${GOOGLE_CALLBACK_PATH}`,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
    },
  }).catch(() => null);
  if (!result) return { error: "Google sign-in could not be started." };
  const { data, error } = result;
  if (error || !data.url) return { error: "Google sign-in could not be started." };

  (await cookies()).set(GOOGLE_RETURN_COOKIE, customerGoogleReturnPath(form.get("redirect_to")), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  redirect(data.url);
}
