import "reflect-metadata";
import { ModuleRef, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "./app.module";
import { appRouter } from "./trpc/router";
import { createContextFactory } from "./trpc/context";

/**
 * Builds and initializes the Nest app without binding it to a port —
 * shared by main.ts (a long-running process on Docker/EC2/Lightsail, which
 * calls app.listen() itself) and api/index.ts (a Vercel serverless
 * function, which hands requests to the underlying Express instance
 * directly). Keeping this the one place that wires CORS and the tRPC
 * middleware is what makes the two entry points behave identically.
 */
export async function createApp(): Promise<NestExpressApplication> {
  // rawBody: true — the Stripe webhook needs the exact raw request body
  // (not Nest's parsed JSON) to verify its HMAC signature; without this,
  // request.rawBody is undefined in the webhook controller.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // WEB_ORIGIN is a comma-separated list: the public site plus every portal
  // origin (admin., agent., manager., ...) that calls tRPC from the browser.
  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: false, // auth travels as a bearer header, never a cookie, across this boundary
  });

  // Mounted directly on the underlying Express instance rather than through
  // a Nest controller — tRPC owns routing/serialization under /trpc, Nest
  // owns everything else (REST controllers, DI, module wiring). Still
  // shares Nest's real request-scoped DI: createContextFactory closes over
  // ModuleRef so every procedure's ctx.resolve() pulls actual DI-managed
  // providers, same as a REST controller would get (see trpc/context.ts).
  const moduleRef = app.get(ModuleRef);
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(moduleRef),
    })
  );

  return app;
}
