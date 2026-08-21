import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "./app.module";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: false, // auth travels as a bearer header, never a cookie, across this boundary
  });

  // Mounted directly on the underlying Express instance rather than through
  // a Nest controller — tRPC owns routing/serialization under /trpc, Nest
  // owns everything else (REST controllers, DI, module wiring). See
  // trpc/context.ts for why this doesn't share Nest's request-scoped DI.
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`[api] listening on :${port} (REST at /health/me, tRPC at /trpc)`);
}

bootstrap();
