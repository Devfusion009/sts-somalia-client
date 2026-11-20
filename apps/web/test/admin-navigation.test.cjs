const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
function load(relative,mocks={}){
 const file=path.join(root,relative),mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));const original=mod.require.bind(mod);
 mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.endsWith('.css')?new Proxy({},{get:(_,key)=>key}):id==='server-only'?{}:id.startsWith('@/')?new Proxy({},{get:()=>()=>null}):original(id);
 mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return mod.exports;
}
const navigation=load('apps/web/src/app/admin/(portal)/navigation.ts');
const navigationHelpers=load('apps/web/src/components/portal/navigation-search.ts',{'@/lib/subdomain':load('apps/web/src/lib/subdomain.ts')});
const {filterNavigationGroups,findActiveNavigationItem}=navigationHelpers;
const expected=['/admin','/admin/queue','/admin/calendar','/admin/orders','/admin/flights','/admin/umrah/bookings','/admin/umrah/departures','/admin/visa','/admin/visa/appointments','/admin/hotels','/admin/events','/admin/catalog/visa','/admin/umrah/pool','/admin/applications','/admin/agencies','/admin/agency-tiers','/admin/broadcasts','/admin/finance/top-ups','/admin/finance/withdrawals','/admin/refunds','/admin/reports/aging','/admin/users','/admin/security','/admin/integrations','/admin/site-settings','/admin/audit-log','/admin/callbacks'];
const hrefs=groups=>groups.flatMap(g=>g.items.map(i=>i.href));

test('all existing admin destinations remain present exactly once',()=>{
 const routes=hrefs(navigation.ADMIN_NAV_GROUPS);assert.equal(new Set(routes).size,27);assert.deepEqual(routes.toSorted(),expected.toSorted());
 assert.deepEqual(navigation.ADMIN_NAV_GROUPS.map(g=>g.label),['Workspace','Visas','Umrah','Hotels & events','Partners & agencies','Finance','Administration']);
 assert.equal(navigation.ADMIN_NAV_GROUPS[0].alwaysOpen,true);
 assert.deepEqual(hrefs([navigation.ADMIN_NAV_GROUPS[0]]),['/admin','/admin/orders','/admin/flights','/admin/calendar','/admin/callbacks']);
});

test('queue badges retain their original destinations and review counts',()=>{
 const groups=navigation.getAdminNavGroups({queue:11,refunds:2,visa:5,visa_appointments:1,partner_applications:3,payout_requests:6,topup_requests:7,markup_requests:2,earnings_reviews:3});
 const badges=Object.fromEntries(groups.flatMap(g=>g.items).filter(i=>i.badge).map(i=>[i.href,i.badge]));
 assert.deepEqual(badges,{'/admin/queue':11,'/admin/visa':5,'/admin/visa/appointments':1,'/admin/applications':3,'/admin/agencies':5,'/admin/finance/top-ups':7,'/admin/finance/withdrawals':6,'/admin/refunds':2});
 assert.ok(navigation.ADMIN_NAV_GROUPS.every(g=>g.items.every(i=>i.badge===undefined)));
 assert.ok(navigation.getAdminNavGroups({}).every(g=>g.items.every(i=>i.badge===undefined)));
});

for(const [query,paths]of [
 ['visa',['/admin/visa','/admin/visa/appointments','/admin/catalog/visa']],
 ['  VISA   applications  ',['/admin/visa']],
 ['flights',['/admin/flights']],
 ['wallet',['/admin/finance/top-ups']],
 ['catalog hotels',['/admin/hotels','/admin/events']],
 ['receivables',['/admin/reports/aging']],
 ['agents',['/admin/agencies','/admin/applications','/admin/agency-tiers','/admin/broadcasts']],
 ['finance',['/admin/finance/top-ups','/admin/finance/withdrawals','/admin/refunds','/admin/reports/aging']],
 ['no-such-admin-page',[]],
])test(`navigation search: ${query}`,()=>assert.deepEqual(hrefs(filterNavigationGroups(navigation.getAdminNavGroups({visa:5}),query)),paths));

test('clearing search restores the complete menu without losing badges or metadata',()=>{
 const groups=navigation.getAdminNavGroups({queue:11,visa:5});const snapshot=JSON.stringify(groups);
 const visa=filterNavigationGroups(groups,'visa');assert.equal(visa[0].items[0].badge,5);assert.equal(JSON.stringify(groups),snapshot);
 assert.equal(filterNavigationGroups(groups,'  '),groups);assert.equal(hrefs(groups).length,27);
});

test('every menu destination exists and retired duplicates stay out of navigation',()=>{
 for(const href of expected) {
  const relative=href.slice('/admin'.length);
  assert.ok(fs.existsSync(path.join(root,'apps/web/src/app/admin/(portal)',relative,'page.tsx')),href);
 }
 const routes=hrefs(navigation.ADMIN_NAV_GROUPS);
 assert.ok(!routes.includes('/admin/catalog/umrah'));
 assert.ok(!routes.includes('/admin/umrah/requests'));
});

test('detail routes resolve to one destination in both path and subdomain routing',()=>{
 const items=navigation.ADMIN_NAV_GROUPS.flatMap(g=>g.items);
 for(const [pathname,href] of [
  ['/admin','/admin'],['/','/admin'],
  ['/admin/visa/appointments','/admin/visa/appointments'],
  ['/visa/appointments','/admin/visa/appointments'],
  ['/admin/visa/case-123/documents','/admin/visa'],
  ['/catalog/visa/centres','/admin/catalog/visa'],
  ['/admin/catalog/umrah/package-123','/admin/umrah/pool'],
  ['/catalog/umrah/package-123','/admin/umrah/pool'],
  ['/admin/partners/hotel/partner-123','/admin/applications'],
  ['/admin/umrah/bookings/requests/request-123','/admin/umrah/bookings'],
  ['/admin/visas-unknown',undefined],
 ]) assert.equal(findActiveNavigationItem(items,pathname)?.href,href,pathname);
});

// Render the component's React element tree with controlled hooks. This exercises
// the real handlers without a browser, a server, or additional test dependencies.
function sectionHarness(overrides={}) {
 let selection=null,cleared=0,closed=0,expanded=0;
 const sidebar={state:'expanded',isMobile:false,setOpen(){expanded++;sidebar.state='expanded';},setOpenMobile(value){if(!value)closed++;}};
 const props={navGroups:navigation.getAdminNavGroups({visa:5,refunds:2}),activeHref:'/admin/visa',pathname:'/admin/visa',query:'',
  onNavigate(){cleared++;props.query='';},icons:new Proxy({},{get:()=> 'svg'}),...overrides};
 const {SectionNavigation}=load('apps/web/src/components/portal/section-navigation.tsx',{
  react:{useId:()=> 'nav-test',useState:()=>[selection,value=>{selection=value;}]},
  './navigation-search':navigationHelpers,
  '@/components/ui/sidebar':{SidebarMenu:'ul',SidebarMenuItem:'li',SidebarMenuButton:'button',useSidebar:()=>sidebar},
 });
 const nodes=element=>Array.isArray(element)?element.flatMap(nodes):element&&typeof element==='object'?[element,...nodes(element.props?.children)]:[];
 return {props,sidebar,counts:()=>({cleared,closed,expanded}),render:()=>nodes(SectionNavigation(props))};
}
const sectionButton=(nodes,label)=>nodes.find(n=>n.type==='button'&&n.props['aria-label']===label&&n.props['aria-expanded']!==undefined);
const expandedSections=nodes=>nodes.filter(n=>n.type==='button'&&n.props['aria-expanded']===true).map(n=>n.props['aria-label']);
const clickSection=button=>button.props.onClick({currentTarget:{closest:()=>null}});

test('only one service opens, daily links stay available, and route changes reveal their section',()=>{
 const h=sectionHarness();let nodes=h.render();
 assert.deepEqual(expandedSections(nodes),['Visas']);
 assert.equal(nodes.filter(n=>n.props['aria-current']==='page').length,1);
 assert.ok(nodes.some(n=>n.props.render?.props.href==='/admin'));
 clickSection(sectionButton(nodes,'Finance'));
 nodes=h.render();assert.deepEqual(expandedSections(nodes),['Finance']);
 clickSection(sectionButton(nodes,'Finance'));assert.deepEqual(expandedSections(h.render()),[]);
 h.props.pathname='/admin/umrah/bookings/123';h.props.activeHref='/admin/umrah/bookings';
 assert.deepEqual(expandedSections(h.render()),['Umrah']);
});

test('search reveals matching destinations, preserves badges, and restores section state',()=>{
 const h=sectionHarness({query:'finance'});let nodes=h.render();
 assert.deepEqual(expandedSections(nodes),['Finance']);
 assert.equal(nodes.filter(n=>n.props.render).length,4);
 assert.ok(nodes.some(n=>n.props['aria-label']==='2 notifications'));
 h.props.query='no-such-page';assert.ok(h.render().some(n=>n.props.role==='status'));
 h.props.query='';assert.deepEqual(expandedSections(h.render()),['Visas']);
});

test('collapsed sidebar retains section controls and opens the requested section',()=>{
 const h=sectionHarness();h.sidebar.state='collapsed';let nodes=h.render();
 assert.deepEqual(expandedSections(nodes),[]);
 clickSection(sectionButton(nodes,'Umrah'));
 assert.equal(h.counts().expanded,1);assert.deepEqual(expandedSections(h.render()),['Umrah']);
});

test('choosing a search result clears search and closes the mobile drawer',()=>{
 const h=sectionHarness({query:'visa products'});h.sidebar.isMobile=true;h.sidebar.state='collapsed';
 const link=h.render().find(n=>n.props.render?.props.href==='/admin/catalog/visa').props.render;
 link.props.onClick({});
 assert.deepEqual(h.counts(),{cleared:1,closed:1,expanded:0});
 assert.equal(h.props.query,'');
});

test('modified link clicks keep the current navigation intact',()=>{
 const h=sectionHarness({query:'visa products'});
 h.render().find(n=>n.props.render?.props.href==='/admin/catalog/visa').props.render.props.onClick({ctrlKey:true});
 assert.deepEqual(h.counts(),{cleared:0,closed:0,expanded:0});
});

test('admin access is checked before sidebar data or background jobs are read',async()=>{
 let touched=0;
 const Layout=load('apps/web/src/app/admin/(portal)/layout.tsx',{
  'next/server':{after(){touched++;}},
  './admin-portal-shell':{AdminPortalShell:()=>null},'./navigation':navigation,'./admin-notification-bell':{AdminNotificationBell:()=>null},'./new-order-banner':{NewOrderBanner:()=>null},
  '@/lib/auth/session':{requireAdminPortalAccess:async()=>{throw new Error('access-denied');}},
  '@/lib/supabase/server':{createClient:async()=>{touched++;}},
 }).default;
 await assert.rejects(()=>Layout({children:null}),/access-denied/);assert.equal(touched,0);
});

test('authorized admin layout enables search and passes live navigation badges to the shell',async()=>{
 let scheduled=0;
 const Layout=load('apps/web/src/app/admin/(portal)/layout.tsx',{
  'next/server':{after(){scheduled++;}},'./admin-portal-shell':{AdminPortalShell:()=>null},'./navigation':navigation,'./admin-notification-bell':{AdminNotificationBell:()=>null},'./new-order-banner':{NewOrderBanner:()=>null},
  '@/lib/auth/session':{requireAdminPortalAccess:async()=>({id:'admin',full_name:'Admin',email:'admin@example.test',is_platform_admin:true})},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async name=>{assert.equal(name,'admin_nav_counts');return {data:{queue:11,visa:5}};},from:()=>({select:()=>({eq:()=>({eq:()=>({is:async()=>({count:2})})})})})})},
  '@/lib/trpc/server':{getServerTrpc:async()=>({notifications:{unread:{query:async()=>[]}}})},
  '@/lib/auth/mfa':{hasVerifiedFactor:async()=>true},
  '@/modules/identity/queries':{getMyPartnerContexts:async()=>[]},
 }).default;
 const tree=await Layout({children:null});assert.equal(tree.props.searchableNavigation,true);assert.equal(tree.props.accent,'admin');
 assert.equal(tree.props.navGroups.flatMap(g=>g.items).find(i=>i.href==='/admin/queue').badge,11);assert.equal(scheduled,1);
});
