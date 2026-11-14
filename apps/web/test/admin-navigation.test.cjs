const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
function load(relative,mocks={}){
 const file=path.join(root,relative),mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));const original=mod.require.bind(mod);
 mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.endsWith('.css')?{shell:'shell'}:id==='server-only'?{}:id.startsWith('@/')?new Proxy({},{get:()=>()=>null}):original(id);
 mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return mod.exports;
}
const navigation=load('apps/web/src/app/admin/(portal)/navigation.ts');
const {filterNavigationGroups}=load('apps/web/src/components/portal/navigation-search.ts');
const expected=['/admin','/admin/queue','/admin/calendar','/admin/orders','/admin/flights','/admin/umrah/requests','/admin/umrah/bookings','/admin/umrah/departures','/admin/visa','/admin/visa/appointments','/admin/hotels','/admin/events','/admin/catalog/visa','/admin/catalog/umrah','/admin/applications','/admin/agencies','/admin/agency-tiers','/admin/broadcasts','/admin/finance/top-ups','/admin/finance/withdrawals','/admin/refunds','/admin/reports/aging','/admin/users','/admin/security','/admin/integrations','/admin/site-settings','/admin/audit-log'];
const hrefs=groups=>groups.flatMap(g=>g.items.map(i=>i.href));

test('all existing admin destinations remain present exactly once',()=>{
 const routes=hrefs(navigation.ADMIN_NAV_GROUPS);assert.equal(new Set(routes).size,27);assert.deepEqual(routes.toSorted(),expected.toSorted());
 assert.deepEqual(navigation.ADMIN_NAV_GROUPS.map(g=>g.label),['Workspace','Bookings & fulfilment','Catalog & inventory','Partners & agencies','Finance','Administration']);
 assert.equal(navigation.ADMIN_NAV_GROUPS[0].alwaysOpen,true);
 assert.deepEqual(hrefs([navigation.ADMIN_NAV_GROUPS[0]]),['/admin','/admin/queue','/admin/calendar']);
});

test('queue badges retain their original destinations and review counts',()=>{
 const groups=navigation.getAdminNavGroups({queue:11,refunds:2,visa:5,visa_appointments:1,umrah_requests:4,partner_applications:3,payout_requests:6,topup_requests:7,markup_requests:2,earnings_reviews:3});
 const badges=Object.fromEntries(groups.flatMap(g=>g.items).filter(i=>i.badge).map(i=>[i.href,i.badge]));
 assert.deepEqual(badges,{'/admin/queue':11,'/admin/visa':5,'/admin/visa/appointments':1,'/admin/umrah/requests':4,'/admin/applications':3,'/admin/agencies':5,'/admin/finance/top-ups':7,'/admin/finance/withdrawals':6,'/admin/refunds':2});
 assert.ok(navigation.ADMIN_NAV_GROUPS.every(g=>g.items.every(i=>i.badge===undefined)));
 assert.ok(navigation.getAdminNavGroups({}).every(g=>g.items.every(i=>i.badge===undefined)));
});

for(const [query,paths]of [
 ['visa',['/admin/visa','/admin/visa/appointments','/admin/catalog/visa']],
 ['  VISA   applications  ',['/admin/visa']],
 ['flights',['/admin/orders','/admin/flights']],
 ['wallet',['/admin/finance/top-ups']],
 ['catalog hotels',['/admin/hotels']],
 ['receivables',['/admin/reports/aging']],
 ['agents',['/admin/applications','/admin/agencies','/admin/agency-tiers','/admin/broadcasts']],
 ['finance',['/admin/finance/top-ups','/admin/finance/withdrawals','/admin/refunds','/admin/reports/aging']],
 ['no-such-admin-page',[]],
])test(`navigation search: ${query}`,()=>assert.deepEqual(hrefs(filterNavigationGroups(navigation.getAdminNavGroups({visa:5}),query)),paths));

test('clearing search restores the complete menu without losing badges or metadata',()=>{
 const groups=navigation.getAdminNavGroups({queue:11,visa:5});const snapshot=JSON.stringify(groups);
 const visa=filterNavigationGroups(groups,'visa');assert.equal(visa[0].items[0].badge,5);assert.equal(JSON.stringify(groups),snapshot);
 assert.equal(filterNavigationGroups(groups,'  '),groups);assert.equal(hrefs(groups).length,27);
});

test('admin access is checked before sidebar data or background jobs are read',async()=>{
 let touched=0;
 const Layout=load('apps/web/src/app/admin/(portal)/layout.tsx',{
  'next/server':{after(){touched++;}},
  './navigation':navigation,'./admin-notification-bell':{AdminNotificationBell:()=>null},'./new-order-banner':{NewOrderBanner:()=>null},
  '@/lib/auth/session':{requireAdminPortalAccess:async()=>{throw new Error('access-denied');}},
  '@/lib/supabase/server':{createClient:async()=>{touched++;}},
 }).default;
 await assert.rejects(()=>Layout({children:null}),/access-denied/);assert.equal(touched,0);
});

test('authorized admin layout enables search and passes live navigation badges to the shell',async()=>{
 let scheduled=0;
 const Layout=load('apps/web/src/app/admin/(portal)/layout.tsx',{
  'next/server':{after(){scheduled++;}},'./navigation':navigation,'./admin-notification-bell':{AdminNotificationBell:()=>null},'./new-order-banner':{NewOrderBanner:()=>null},
  '@/lib/auth/session':{requireAdminPortalAccess:async()=>({id:'admin',full_name:'Admin',email:'admin@example.test',is_platform_admin:true})},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async name=>{assert.equal(name,'admin_nav_counts');return {data:{queue:11,visa:5}};}})},
  '@/lib/trpc/server':{getServerTrpc:async()=>({notifications:{unread:{query:async()=>[]}}})},
  '@/lib/auth/mfa':{hasVerifiedFactor:async()=>true},
  '@/modules/identity/queries':{getMyPartnerContexts:async()=>[]},
 }).default;
 const tree=await Layout({children:null});assert.equal(tree.props.searchableNavigation,true);assert.equal(tree.props.accent,'admin');
 assert.equal(tree.props.navGroups.flatMap(g=>g.items).find(i=>i.href==='/admin/queue').badge,11);assert.equal(scheduled,1);
});
