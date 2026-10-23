import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Logger } from "@nestjs/common";
import { createApp } from "./create-app";
import { validateEnv } from "./config/env";

async function bootstrap() {
  // Fail before anything starts when config is incomplete.
  const config = validateEnv(process.env);
  const app = await createApp();
  await app.listen(config.PORT);
  new Logger("Bootstrap").log(`listening on :${config.PORT} (REST at /health/me, tRPC at /trpc)`);
}

bootstrap();
