// Type-only import, from apps/api's COMPILED declaration output
// (dist/trpc/router.d.ts), not its raw src/trpc/router.ts. Importing the
// .ts source directly pulls Nest's decorator-using files into apps/web's
// type-check (apps/web's tsconfig has no experimentalDecorators, apps/api's
// does — real conflict, not just theoretical), so apps/api must be built
// (`npm run build -w api`) at least once, and again after any AppRouter
// shape change, for these types to be present/current. This is the
// necessary bootstrapping step in a plain npm-workspaces monorepo with no
// task-graph tool (Turborepo, Nx) wiring up "build api before checking
// web" automatically — worth adding if this friction becomes real.
import type { AppRouter } from "api/dist/trpc/router";

export type { AppRouter };

export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
