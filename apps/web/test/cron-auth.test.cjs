const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function route(file) {
  const loadedModule = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  class NextResponse {
    constructor(body, options) { this.body = body; this.status = options?.status ?? 200; }
    static json(body, options) { return new NextResponse(body, options); }
  }
  new Function('require', 'module', 'exports', js)((id) => id === 'next/server' ? { NextResponse } : {}, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test('service-role cron routes reject requests when the secret is missing or wrong', async () => {
  const previous = process.env.CRON_SECRET;
  try {
    for (const name of ['notification-emails', 'umrah-housekeeping', 'admin-event-reminders']) {
      const handler = route(`apps/web/src/app/api/cron/${name}/route.ts`).GET;
      delete process.env.CRON_SECRET;
      assert.equal((await handler(new Request('http://localhost/'))).status, 401, name);
      process.env.CRON_SECRET = 'known-secret';
      assert.equal((await handler(new Request('http://localhost/', { headers: { authorization: 'Bearer wrong' } }))).status, 401, name);
    }
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
