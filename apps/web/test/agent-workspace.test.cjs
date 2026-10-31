const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve,dirname} = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const root = resolve(__dirname, '../../..');
const portal = 'apps/web/src/app/agent/(portal)/';
const Widget = props => React.createElement('div', props);
const widgets = new Proxy({}, {get:()=>Widget});
function load(relative, mocks={}) {
  const file=resolve(root,relative), mod=new Module(file,module);
  mod.filename=file; mod.paths=Module._nodeModulePaths(dirname(file));
  const original=mod.require.bind(mod);
  mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id==='server-only'?{}:id.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:key}):id.startsWith('@/')?widgets:original(id);
  mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
  return mod.exports;
}
const services=load('apps/web/src/modules/agencies/services.ts');
function nodes(element) {
  if(!element || typeof element!=='object')return [];
  return [element,...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
function redirect(url){throw Object.assign(new Error(url),{destination:url});}
function deskMocks(selected=[]) {
 return {
  'next/navigation':{redirect},
  '@/lib/auth/session':{requireUser:async()=>({id:'agent'})},
  '@/lib/supabase/server':{createClient:async()=>({})},
  '@/modules/agencies/queries':{getMyAgency:async()=>({agency:{id:'own-agency'}}),getAgencyCustomersWithStats:async id=>{assert.equal(id,'own-agency');return {customers:[{id:'client',full_name:'Amina',bookings:2}],total:31};}},
  '@/modules/agencies/booking-context':{getBookingCustomers:async()=>selected,getBookingCustomer:async()=>selected[0]??null},
  '@/modules/agencies/services':services,
  '@/lib/pagination':{parsePage:value=>Number(value)||1},
  './customer-picker-table':{CustomerPickerTable:Widget},'../service-launcher':{ServiceLauncher:Widget},
  './flight-quote-form':{FlightQuoteForm:Widget},'./start-application-button':{StartApplicationButton:Widget},
 };
}

test('all five service choices use known portal routes; untrusted values cannot become a destination',()=>{
 assert.deepEqual(services.AGENT_SERVICES.map(s=>s.key),['flights','hotels','visa','umrah','events']);
 for(const key of ['https://outside.test','//outside.test','../settings','unknown',null]) {
  assert.equal(services.getAgentService(key),undefined);
  assert.equal(services.agentServiceStartHref(key),'/agent/book');
 }
});

for(const service of services.AGENT_SERVICES) {
 test(`${service.label}: preserves service intent during customer search, pagination and selection`,async()=>{
  const Page=load(portal+'book/page.tsx',deskMocks()).default;
  const tree=await Page({searchParams:Promise.resolve({service:service.key,q:'Amina'})});
  const all=nodes(tree);
  assert.ok(all.some(n=>n.props?.redirectTo===service.href));
  assert.ok(all.some(n=>n.props?.name==='service' && n.props?.value===service.key));
  const pager=all.find(n=>typeof n.props?.hrefFor==='function');
  assert.equal(pager.props.hrefFor(2),`/agent/book?q=Amina&service=${service.key}&page=2`);
 });
 test(`${service.label}: an already selected customer opens the chosen service`,async()=>{
  const Page=load(portal+'book/page.tsx',deskMocks([{id:'client'}])).default;
  await assert.rejects(()=>Page({searchParams:Promise.resolve({service:service.key})}),e=>e.destination===service.href);
 });
 test(`${service.label}: opening the service without a customer returns to its customer selection`,async()=>{
  const Page=load(portal+`book/${service.key}/page.tsx`,deskMocks()).default;
  await assert.rejects(()=>Page({searchParams:Promise.resolve({})}),e=>e.destination===`/agent/book?service=${service.key}`);
 });
}

test('customer selection advances to the chosen service only after the action succeeds',async()=>{
 for(const error of [null,'Customer not found.']) {
  const jobs=[], destinations=[], notices=[];
  const Table=load(portal+'book/customer-picker-table.tsx',{
   react:{...React,useState:v=>[v,()=>{}],useTransition:()=>[false,fn=>jobs.push(fn())]},
   'next/navigation':{useRouter:()=>({push:url=>destinations.push(url),refresh:()=>destinations.push('refresh')})},
   '@/modules/agencies/booking-context-actions':{selectBookingCustomers:async ids=>{assert.deepEqual(ids,['client']);return {error};}},
   sonner:{toast:{error:message=>notices.push(message)}},
  }).CustomerPickerTable;
  const tree=Table({rows:[{id:'client',full_name:'Amina',bookings:2}],redirectTo:'/agent/book/flights'});
  const select=nodes(tree).find(n=>typeof n.props?.onClick==='function' && n.props.children==='Select');
  select.props.onClick(); await Promise.all(jobs);
  assert.deepEqual(destinations,error?[]:['/agent/book/flights']);
  assert.deepEqual(notices,error?[error]:[]);
 }
});

test('booking progress identifies the active step on canonical and rewritten portal paths',()=>{
 for(const [pathname,hasCustomer,expected] of [['/agent/book',false,'Customer'],['/book',true,'Service'],['/book/hotels',true,'Travel details'],['/agent/book/order/id',true,'Review & pay'],['/book/batch/id',true,'Review & pay']]) {
  const Steps=load(portal+'book/desk-steps.tsx',{'next/navigation':{usePathname:()=>pathname}}).DeskSteps;
  const current=nodes(Steps({hasCustomer})).find(n=>n.props?.['aria-current']==='step');
  assert.equal(current.props.children[1].props.children,expected);
 }
});

test('service tabs keep the active service on canonical and subdomain routes',()=>{
 for(const pathname of ['/agent/book/hotels/property','/book/hotels/property']) {
  const Tabs=load(portal+'book/service-tabs.tsx',{
   'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()},
   '@/modules/agencies/services':services,
   '@/lib/subdomain':{stripPortalPrefix:path=>path.replace(/^\/agent(?=\/|$)/,'')||'/'},
  }).ServiceTabs;
  const active=nodes(Tabs({hasCustomer:true})).find(n=>n.props?.['aria-current']==='page');
  assert.equal(active.props.href,'/agent/book/hotels');
 }
});

test('manager dashboard rejects a property outside the manager assignment',async()=>{
 const Page=load('apps/web/src/app/manager/[hotelId]/page.tsx',{
  'next/navigation':{notFound(){throw new Error('not-found');}},
  '@/lib/auth/session':{requireUser:async()=>({id:'manager'})},
  '@/modules/hotels/manager-queries':{getMyManagedHotel:async()=>null},
 }).default;
 await assert.rejects(()=>Page({params:Promise.resolve({hotelId:'foreign-hotel'}),searchParams:Promise.resolve({})}),/not-found/);
});

test('manager shortcuts and pricing actions follow assigned permissions',async()=>{
 const visit=node=>{
  if(!React.isValidElement(node))return [];
  return [node,...React.Children.toArray(node.props.children).flatMap(visit),...visit(node.props.render),...visit(node.props.actions)];
 };
 for(const permissions of [[],['bookings'],['rooms'],['availability'],['bookings','rooms','availability']]) {
  const managed={permissions,hotel:{name:'Test hotel',city:'Bosaso',country_code:'SO',status:'published',images:[]}};
  const Page=load('apps/web/src/app/manager/[hotelId]/page.tsx',{
   'next/navigation':{notFound(){throw new Error('not-found');}},
   '@/lib/auth/session':{requireUser:async()=>({id:'manager',manager_code:'MGR-2026-000001'})},
   '@/modules/hotels/manager-queries':{getMyManagedHotel:async()=>managed,hasPermission:(m,p)=>m.permissions.includes(p)},
   '@/modules/hotels/availability':{todayIso:()=> '2026-10-31'},
   '@/modules/hotels/images':{hotelImageUrls:()=>[]},
   '@/components/ui/badge':{Badge:Widget,statusBadgeVariant:()=> 'neutral'},
   '@/modules/hotels/partner-queries':{getHotelFrontDesk:async()=>({inHouse:[],arrivingToday:[],departingToday:[]}),getPartnerStats:async()=>({pendingCount:2}),getRecentPartnerBookings:async()=>[],getWeekForecast:async()=>({occupancyPct:60,arrivals:2,bookedNights:18,capacityNights:30})},
   '@/modules/hotels/booking-detail-queries':{getTodayCounts:async()=>({newToday:1,checkedOutToday:2,cancelledToday:0,noShowToday:0})},
  }).default;
  const tree=await Page({params:Promise.resolve({hotelId:'own-hotel'}),searchParams:Promise.resolve({})});
  const links=visit(tree).map(n=>n.props.href).filter(Boolean);
  assert.equal(links.includes('/manager/own-hotel/bookings/new'),permissions.includes('bookings'));
  assert.equal(links.includes('/manager/own-hotel/front-desk'),permissions.includes('bookings'));
  assert.equal(links.includes('/manager/own-hotel/rooms'),permissions.includes('rooms')||permissions.includes('availability'));
  assert.equal(links.includes('/manager/own-hotel/rates'),permissions.includes('rooms'));
 }
});

test('hotel photos preserve public asset paths and existing storage URLs',()=>{
 const images=load('apps/web/src/modules/hotels/images.ts');
 assert.equal(images.hotelImageUrl('/marketing/hotel.webp'),'/marketing/hotel.webp');
 assert.equal(images.hotelImageUrl('https://example.test/photo.webp'),'https://example.test/photo.webp');
 assert.equal(images.hotelImageUrl(null),null);
});
