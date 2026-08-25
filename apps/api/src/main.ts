import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`[api] listening on :${port} (REST at /health/me, tRPC at /trpc)`);
}

bootstrap();
