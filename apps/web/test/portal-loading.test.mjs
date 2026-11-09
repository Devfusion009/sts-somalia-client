import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Run the real TS/TSX with controlled network dependencies, without a dev server.
function load(source, mocks = {}, fallback) {
  const filename = new URL(`../src/${source}`, import.meta.url);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename.pathname,
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports,
    require: (id) => {
      if (id in mocks) return mocks[id];
      if (id === "react" || id.startsWith("react/")) return require(id);
      if (fallback) return fallback(id);
      throw new Error(`Missing dependency: ${id}`);
    },
  });
  return compiled.exports;
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const UI = new Proxy({}, { get: () => ({ children }) => React.createElement("div", null, children) });

test("agent booking controls and wallet stream before slow analytics and finance reads", { timeout: 5000 }, async () => {
  const metrics = deferred(), activity = deferred(), onboarding = deferred(), team = deferred(), pending = deferred(), finance = deferred();
  const { default: Page } = load("app/agent/(portal)/page.tsx", {
    "@/lib/auth/session": { requireUser: async () => ({ id: "u1", agent_code: "AGT-1" }) },
    "@/modules/agencies/queries": {
      getMyAgency: async () => ({ agency: { id: "a1", name: "Test agency", status: "active", credit_balance: 505, credit_limit: 5000, commission_rate: 10, commission_rate_set_at: "2026-01-01" } }),
      getAgencyPeriodMetrics: () => metrics.promise,
      getAgencyOnboardingStatus: () => onboarding.promise,
      getAgencyRecentActivity: () => activity.promise,
      getAgencyTeamCount: () => team.promise,
      getAgencyPendingPayments: () => pending.promise,
      // Intentionally no wallet-history or team-roster reader: neither is needed.
    },
    "@/lib/date-range": { resolveDateRange: () => ({ key: "30d", label: "Last 30 days", granularity: "day" }), percentChange: () => null, bucketLabel: (key) => key },
    "@/lib/money": { money: (amount) => `USD ${amount}` },
    "@/components/portal/agent-money": load("components/portal/agent-money.tsx", {}, () => ({ __esModule: true, default: {} })),
    "@/modules/agencies/components/finance-priorities": { FinancePriorities: async () => { await finance.promise; return "Finance loaded"; } },
    "@/components/ui/page-header": { PageHeader: ({ title, meta }) => React.createElement("header", null, title, meta) },
    "@/components/portal/workspace-cover": { WorkspaceCover: ({ title }) => React.createElement("h2", null, title) },
    "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) },
  }, (id) => id.endsWith(".css") ? { __esModule: true, default: {} } : UI);

  const element = await Page({ searchParams: Promise.resolve({}) });
  const output = new PassThrough();
  let html = "";
  output.on("data", (chunk) => { html += chunk.toString(); });
  const ended = new Promise((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  const shell = deferred();
  const errors = [];
  const stream = renderToPipeableStream(element, {
    onShellReady() { stream.pipe(output); shell.resolve(); },
    onShellError(error) { errors.push(error); shell.resolve(); },
    onError(error) { errors.push(error); },
  });
  try {
    await shell.promise;
    assert.match(html, /Start a booking/);
    assert.match(html.replace(/<[^>]*>/g, ""), /USD 5505/);
    assert.match(html, /href="\/agent\/finance\/top-up"/);
    assert.doesNotMatch(html, /Finance loaded/);
    metrics.resolve({ revenue: { current: 120, previous: 0, series: [120], currency: "USD" }, bookings: { current: 2, previous: 0, series: [2] }, earned: { current: 12, previous: 0 }, buckets: ["2026-11-09"] });
    activity.resolve([]); onboarding.resolve({}); team.resolve(1); pending.resolve({ count: 1, amounts: [{ amount: 75, currency: "USD" }] }); finance.resolve();
    await ended;
    assert.match(html.replace(/<[^>]*>/g, ""), /USD 120/);
    assert.match(html.replace(/<[^>]*>/g, ""), /USD 75/);
    assert.match(html, /Finance loaded/);
    assert.deepEqual(errors, []);
  } finally {
    stream.abort();
    output.destroy();
  }
});

test("bell and banner share a notification fetch; dismissal updates both without page refresh", async () => {
  let unread = [{ id: "n1", type: "new_order" }];
  let reads = 0;
  const client = new QueryClient();
  let options;
  const { usePortalNotifications } = load("components/portal/use-portal-notifications.ts", {
    "@/lib/trpc/react": { trpc: { notifications: { unread: { useQuery(input, queryOptions) {
      options = { queryKey: ["notifications", "unread", input], queryFn: async () => { reads++; return unread; }, ...queryOptions };
    } } } } },
  });
  usePortalNotifications();
  const bell = new QueryObserver(client, options);
  const banner = new QueryObserver(client, options);
  const stopBell = bell.subscribe(() => {}), stopBanner = banner.subscribe(() => {});
  try {
    await bell.refetch();
    assert.equal(reads, 1);
    assert.equal(banner.getCurrentResult().data[0].id, "n1");
    unread = [];
    await client.invalidateQueries({ queryKey: ["notifications", "unread"] });
    assert.equal(reads, 2);
    assert.deepEqual(bell.getCurrentResult().data, []);
    assert.deepEqual(banner.getCurrentResult().data, []);
    assert.equal(options.refetchIntervalInBackground, false);
    usePortalNotifications(false);
    assert.equal(options.refetchInterval, false);
  } finally {
    stopBell(); stopBanner(); client.clear();
  }
});

function onboardingReader({ account = true, reviews = [] } = {}) {
  const reads = [];
  const db = { from(table) {
    const query = { table, filters: {} };
    reads.push(query);
    const response = () => ({ data: table === "partner_accounts" ? (account ? { application_id: "app1" } : null) : table === "agency_applications" ? { id: "app1" } : reviews });
    return {
      select(columns) { query.columns = columns; return this; },
      eq(key, value) { query.filters[key] = value; return this; },
      maybeSingle: async () => response(),
      then(resolve) { return Promise.resolve(response()).then(resolve); },
    };
  } };
  const { getAgencyOnboardingChecklist } = load("modules/admin/partner-accounts.ts", {
    "server-only": {},
    "@/lib/supabase/server": { createClient: async () => db },
    "@/modules/partner-applications/config": { docSlotsFor: () => [{ key: "license" }, { key: "optional", optional: true }] },
    "./partner-account-shared": {},
  });
  return { getAgencyOnboardingChecklist, reads };
}

test("agent onboarding keeps commission, required-document, funding and team checks without admin history", async () => {
  const { getAgencyOnboardingChecklist, reads } = onboardingReader({ reviews: [{ doc_key: "license", status: "verified" }] });
  const checklist = await getAgencyOnboardingChecklist({ id: "a1", credit_balance: 0, credit_limit: 5000, commission_rate_set_at: "2026-11-01" });
  assert.deepEqual(Array.from(checklist, (item) => [item.key, item.done]), [["commission_configured", true], ["docs_verified", true], ["funding", true], ["team_active", true]]);
  assert.equal(reads.length, 3);
  assert.equal(reads[0].filters.entity_id, "a1");
  assert.equal(reads[2].filters.application_id, "app1");
  assert.equal(reads.some((r) => /events|payouts|members/.test(r.table)), false);
});

test("incomplete onboarding remains incomplete, and missing partner accounts have no banner", async () => {
  const { getAgencyOnboardingChecklist } = onboardingReader();
  const agency = { id: "a1", credit_balance: -10, credit_limit: 0, commission_rate_set_at: null };
  const checklist = await getAgencyOnboardingChecklist(agency);
  assert.deepEqual(Array.from(checklist, (item) => item.done), [false, false, false, true]);
  const missing = onboardingReader({ account: false });
  assert.equal(await missing.getAgencyOnboardingChecklist(agency), null);
  assert.equal(missing.reads.length, 1);
});

for (const [name, source] of [
  ["agent", "components/portal/agent-notification-bell.tsx"],
  ["admin", "app/admin/(portal)/admin-notification-bell.tsx"],
]) {
  test(`${name} notification dismissal invalidates client reads without refreshing server pages`, async () => {
    let mutationOptions, invalidations = 0;
    const effects = [];
    const notification = { id: "n1", type: "new_order", title: "New order", body: null, created_at: "2026-11-09T00:00:00Z" };
    const exports = load(source, {
      react: { ...React, useEffect: (fn) => effects.push(fn), useRef: (value) => ({ current: value }) },
      "next/navigation": { useRouter: () => ({ refresh() { assert.fail("Notification changes must not reload the portal"); } }) },
      "@/components/portal/use-portal-notifications": { usePortalNotifications: () => ({ data: [notification] }) },
      "@/components/portal/use-bell-alert": { useBellAlert: () => ({ current: null }) },
      "@/lib/trpc/react": { trpc: {
        useUtils: () => ({ notifications: { unread: { invalidate: async () => { invalidations++; } } } }),
        notifications: { dismiss: { useMutation: (options) => { mutationOptions = options; return {}; } } },
      } },
      "@/lib/notifications/actionable-types": { ACTIONABLE_TYPES: new Set() },
      "@/lib/utils": { cn: () => "" },
      "./new-order-banner": { newOrderHref: () => null },
      sonner: { toast: { info() { assert.fail("Initial unread notifications must not produce new-arrival toasts"); } } },
    }, (id) => id === "date-fns" ? { format: () => "Nov 9" } : UI);
    exports[name === "admin" ? "AdminNotificationBell" : "AgentNotificationBell"]();
    effects.forEach((fn) => fn());
    await mutationOptions.onSuccess();
    assert.equal(invalidations, 1);
  });
}

test("agent shell does not wait for optional account switching lookups", { timeout: 3000 }, async () => {
  const accountLookup = deferred();
  let shellProps;
  const { default: Layout } = load("app/agent/(portal)/layout.tsx", {
    "@/lib/auth/session": { requireUserForPortal: async () => ({ id: "agent", full_name: "Amina", email: "agent@sts.test" }) },
    "@/modules/agencies/queries": { getMyAgency: async () => ({ agency: { id: "own", name: "Agency", status: "active" }, roleInAgency: "owner" }) },
    "@/modules/agencies/logo": { agencyLogoUrl: () => null },
    "@/modules/identity/queries": { getMyPartnerContexts: () => accountLookup.promise },
    "@/modules/admin/partner-accounts": { getAgencyOnboardingChecklist: async () => null },
    "@/modules/agencies/services": { AGENT_SERVICES: [] },
    "@/components/portal/portal-shell": { PortalShell: (props) => { shellProps = props; return React.createElement("main", null, props.children); } },
    "next/link": { __esModule: true, default: ({ children }) => React.createElement("a", null, children) },
  }, (id) => id.endsWith('.css') ? { __esModule: true, default: {} } : UI);
  try {
    const element = await Layout({ children: "Booking page ready" });
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => { html += chunk.toString(); });
    const ended = new Promise((resolve) => output.on('end', resolve));
    let stream;
    stream = renderToPipeableStream(element, { onShellReady: () => stream.pipe(output) });
    await ended;
    assert.match(html, /Booking page ready/);
    assert.equal(typeof shellProps.contexts.then, 'function');
    assert.equal(shellProps.brandName, 'Agency');
  } finally { accountLookup.resolve([]); }
});
