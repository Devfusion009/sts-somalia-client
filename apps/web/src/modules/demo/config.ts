import "server-only";

/**
 * One-click demo sign-in — hosted only.
 *
 * Gated on a plain (non-secret) env var set exclusively in
 * .github/workflows/deploy.yml's web deploy step. Never set in a local
 * .env.local or .env.example, so this is unreachable in local dev by
 * construction, not by a runtime check anyone could get wrong.
 *
 * The four accounts themselves are created by migration 20260903000008 —
 * that migration runs everywhere migrations always run (local included),
 * so the rows exist locally too. They just sit unused there: nothing local
 * ever renders the button that signs into them.
 */
export const DEMO_LOGIN_ENABLED = process.env.DEMO_LOGIN_ENABLED === "true";

export type DemoPortal = "customer" | "agent" | "admin" | "manager";

/**
 * Fixed and deliberately not secret: reaching this password requires
 * nothing more than being able to see the login page it's rendered next
 * to. It only ever opens one of these four disposable, clearly-labeled
 * demo identities — never a path to real customer data.
 */
const DEMO_PASSWORD = "StsDemo!2026";

export const DEMO_ACCOUNTS: Record<DemoPortal, { email: string; password: string; label: string }> = {
  customer: { email: "demo.customer@stssomalia.com", password: DEMO_PASSWORD, label: "Try demo customer account" },
  agent: { email: "demo.agent@stssomalia.com", password: DEMO_PASSWORD, label: "Try demo agent account" },
  admin: { email: "demo.admin@stssomalia.com", password: DEMO_PASSWORD, label: "Try demo admin account" },
  manager: { email: "demo.manager@stssomalia.com", password: DEMO_PASSWORD, label: "Try demo hotel manager account" },
};
