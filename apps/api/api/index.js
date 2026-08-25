// Vercel serverless entry point. Deliberately plain JS, not TypeScript: it
// requires the ALREADY-COMPILED dist/create-app.js (tsc, not Vercel's own
// esbuild transform) so Nest's decorator metadata — which esbuild does not
// emit correctly — reaches the runtime intact. See vercel.json's
// buildCommand, which runs `npm run build` before this function is traced.
//
// main.ts (the long-running entry point for Docker/EC2/Lightsail) and this
// file both call the same createApp() from src/create-app.ts, so moving off
// Vercel later means deleting this file and vercel.json, nothing more.
let cachedHandler;

module.exports = async (req, res) => {
  if (!cachedHandler) {
    const { createApp } = require("../dist/create-app");
    const app = await createApp();
    await app.init();
    cachedHandler = app.getHttpAdapter().getInstance();
  }
  cachedHandler(req, res);
};
