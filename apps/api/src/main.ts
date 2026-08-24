import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import "reflect-metadata";
import { ModuleRef, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "./app.module";
import { appRouter } from "./trpc/router";
import { createContextFactory } from "./trpc/context";

async function bootstrap() {
  // rawBody: true — the Stripe webhook needs the exact raw request body
  // (not Nest's parsed JSON) to verify its HMAC signature; without this,
  // request.rawBody is undefined in the webhook controller.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
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

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`[api] listening on :${port} (REST at /health/me, tRPC at /trpc)`);
}

bootstrap();
