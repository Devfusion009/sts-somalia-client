"use server";
import { revalidatePath } from "next/cache";
import { saveSandboxConfiguration, startSandboxTest, inspectSandboxTest } from "./service";
import { SANDBOX_PATH, type SandboxState } from "./shared";
export async function saveSandboxCredentials(_previous: SandboxState, form: FormData): Promise<SandboxState> {
  const result = await saveSandboxConfiguration(form);
  if (!result.error) revalidatePath(SANDBOX_PATH);
  return result;
}
export async function createSandboxCheckout(_previous: SandboxState, form: FormData): Promise<SandboxState> {
  return startSandboxTest(form);
}
export async function checkSandboxCheckout(reference: string): Promise<SandboxState> {
  return inspectSandboxTest(reference);
}
