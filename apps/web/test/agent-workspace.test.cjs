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
const travellerProfile=load('apps/web/src/modules/agencies/traveller-profile.ts');
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
  '@/modules/agencies/queries':{getMyAgency:async()=>({agency:{id:'own-agency'}}),getAgencyCustomersWithStats:async id=>{assert.equal(id,'own-agency');return {customers:[{id:'client',full_name:'Amina',bookings:2}],total:31};},getAgencyCustomerTravelDocs:async(id,ids)=>{assert.equal(id,'own-agency');return new Map(ids.map(key=>[key,{passport_number:'P1234567'}]));}},
  '@/modules/agencies/booking-context':{getBookingCustomers:async()=>selected,getBookingCustomer:async()=>selected[0]??null},
  '@/modules/agencies/services':services,
  '@/lib/pagination':{parsePage:value=>Number(value)||1},
  './new-booking-customer-form':{NewBookingCustomerForm:Widget},'./customer-picker-table':{CustomerPickerTable:Widget},'../service-launcher':{ServiceLauncher:Widget},
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

test('new booking always starts with services, including when a previous customer is selected',async()=>{
 for(const selected of [[],[{id:'previous-client'}]]) {
  const mocks=deskMocks(selected);
  mocks['@/modules/agencies/queries'].getAgencyCustomersWithStats=async()=>assert.fail('The service step must not load the directory');
  const Page=load(portal+'book/page.tsx',mocks).default;
  const tree=await Page({searchParams:Promise.resolve({})});
  assert.ok(nodes(tree).some(n=>n.props?.desk===true));
  assert.ok(!nodes(tree).some(n=>n.props?.rows));
 }
});

test('new customer registration stays within the chosen service without loading the directory',async()=>{
 const mocks=deskMocks();
 mocks['@/modules/agencies/queries'].getAgencyCustomersWithStats=async()=>assert.fail('Registration must not load the directory');
 const Page=load(portal+'book/page.tsx',mocks).default;
 const tree=await Page({searchParams:Promise.resolve({service:'hotels',customer:'new'})});
 const form=nodes(tree).find(n=>n.props?.cancelHref);
 assert.equal(form.props.redirectTo,'/agent/book/hotels');
 assert.equal(form.props.cancelHref,'/agent/book?service=hotels');
});

test('a selected service marks Customer as the second step on both portal paths',()=>{
 for(const pathname of ['/agent/book','/book']) {
  const Steps=load(portal+'book/desk-steps.tsx',{'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams('service=hotels')},'@/modules/agencies/services':services}).DeskSteps;
  const current=nodes(Steps()).find(n=>n.props?.['aria-current']==='step');
  assert.equal(current.props.children[1].props.children,'Customer');
 }
 assert.deepEqual(services.AGENT_BOOKING_STEPS,['Service','Customer','Travel details','Review & pay']);
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
 test(`${service.label}: a previous customer does not skip explicit customer selection`,async()=>{
  const Page=load(portal+'book/page.tsx',deskMocks([{id:'client'}])).default;
  const tree=await Page({searchParams:Promise.resolve({service:service.key})});
  assert.ok(nodes(tree).some(n=>n.props?.redirectTo===service.href));
 });
 test(`${service.label}: opening the service without a customer returns to its customer selection`,async()=>{
  const Page=load(portal+`book/${service.key}/page.tsx`,deskMocks()).default;
  await assert.rejects(()=>Page({searchParams:Promise.resolve({})}),e=>e.destination===`/agent/book?service=${service.key}`);
 });
}

function pickerTable({selection=[],select,destinations,notices=[],jobs}) {
 return load(portal+'book/customer-picker-table.tsx',{
  react:{...React,useState:v=>[v,()=>{}],useSyncExternalStore:()=>selection,useTransition:()=>[false,fn=>jobs.push(fn())]},
  'next/navigation':{useRouter:()=>({push:url=>destinations.push(url),refresh:()=>destinations.push('refresh')})},
  '@/modules/agencies/booking-context-actions':{selectBookingCustomers:select},
  '@/modules/agencies/traveller-profile':travellerProfile,
  sonner:{toast:{error:message=>notices.push(message)}},
 }).CustomerPickerTable;
}

test('customer selection advances to the chosen service only after the action succeeds',async()=>{
 for(const error of [null,'Customer not found.']) {
  const jobs=[], destinations=[], notices=[];
  const Table=pickerTable({jobs,destinations,notices,select:async ids=>{assert.deepEqual(ids,['client']);return {error};}});
  const tree=Table({rows:[{id:'client',full_name:'Amina',bookings:2}],redirectTo:'/agent/book/flights'});
  const select=nodes(tree).find(n=>typeof n.props?.onClick==='function' && n.props?.['aria-label']==='Continue for Amina');
  select.props.onClick(); await Promise.all(jobs);
  assert.deepEqual(destinations,error?[]:['/agent/book/flights']);
  assert.deepEqual(notices,error?[error]:[]);
 }
});

test('every row has a selection box and ticked travellers continue together',async()=>{
 const jobs=[],destinations=[];
 const selection=[{id:'first',name:'Amina',ready:true},{id:'second',name:'Yusuf',ready:false}];
 const Table=pickerTable({selection,jobs,destinations,select:async ids=>{assert.deepEqual(ids,['first','second']);return {error:null};}});
 const tree=Table({rows:[{id:'first',full_name:'Amina'},{id:'third',full_name:'Omar'}],redirectTo:'/agent/book/hotels'});
 const all=nodes(tree);
 assert.equal(all.find(n=>n.props?.['aria-label']==='Select Amina').props.checked,true);
 assert.equal(all.find(n=>n.props?.['aria-label']==='Select Omar').props.checked,false);
 assert.ok(all.some(n=>n.props?.['aria-label']==='Continue for Omar'));
 const bar=all.find(n=>n.props?.['aria-label']==='Selected travellers');
 assert.ok(nodes(bar).some(n=>n.props?.['aria-label']==='Remove Yusuf'));
 // Amina is on screen without passport details; Yusuf was stored incomplete.
 assert.ok(nodes(bar).some(n=>Array.isArray(n.props?.children) && n.props.children.includes(2) && n.props.children.includes(' incomplete')));
 const next=nodes(bar).find(n=>typeof n.props?.onClick==='function' && Array.isArray(n.props.children) && n.props.children.includes('Continue with '));
 next.props.onClick();await Promise.all(jobs);
 assert.deepEqual(destinations,['/agent/book/hotels']);
});

test('the picker never exceeds the group limit',()=>{
 const notices=[];
 const selection=Array.from({length:travellerProfile.MAX_BATCH_CUSTOMERS},(_,i)=>({id:`c${i}`,name:`C${i}`,ready:true}));
 const Table=pickerTable({selection,jobs:[],destinations:[],notices,select:assert.fail});
 const all=nodes(Table({rows:[{id:'extra',full_name:'Extra'}]}));
 assert.equal(all.find(n=>n.props?.['aria-label']==='Select Extra').props.disabled,true);
 assert.equal(all.find(n=>n.props?.['aria-label']==='Select all on this page').props.disabled,true);
});

test('passport readiness flags missing, expired and soon-to-expire passports',()=>{
 const today=new Date('2026-11-12T00:00:00Z');
 assert.equal(travellerProfile.passportStatus(null,today),'missing');
 assert.equal(travellerProfile.passportStatus('2026-11-12',today),'expired');
 assert.equal(travellerProfile.passportStatus('2027-05-01',today),'expiring');
 assert.equal(travellerProfile.passportStatus('2028-01-01',today),'valid');
 const full={gender:'male',date_of_birth:'1990-01-01',nationality:'SO',passport_number:'P1',passport_expiry_date:'2030-01-01'};
 assert.equal(travellerProfile.travellerReady(full,today),true);
 assert.equal(travellerProfile.travellerReady({...full,passport_expiry_date:'2026-01-01'},today),false);
 assert.deepEqual(travellerProfile.travellerGaps({...full,nationality:null}),['Nationality']);
 assert.equal(travellerProfile.travellerName({full_name:'Amina',first_name:'Amina',middle_name:'H',last_name:'Ali'}),'Amina H Ali');
});

test('the directory forwards passport details to the picker rows',async()=>{
 const Page=load(portal+'book/page.tsx',deskMocks()).default;
 const tree=await Page({searchParams:Promise.resolve({service:'visa'})});
 const table=nodes(tree).find(n=>Array.isArray(n.props?.rows));
 assert.equal(table.props.rows[0].passport_number,'P1234567');
});

test('booking progress identifies the active step on canonical and rewritten portal paths',()=>{
 for(const [pathname,hasCustomer,expected] of [['/agent/book',false,'Service'],['/book',true,'Service'],['/book/hotels',true,'Travel details'],['/agent/book/order/id',true,'Review & pay'],['/book/batch/id',true,'Review & pay']]) {
  const Steps=load(portal+'book/desk-steps.tsx',{'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()},'@/modules/agencies/services':services}).DeskSteps;
  const current=nodes(Steps({hasCustomer})).find(n=>n.props?.['aria-current']==='step');
  assert.equal(current.props.children[1].props.children,expected);
 }
});

test('flight steps book and pay; public Umrah uses the standard review',()=>{
 for(const pathname of ['/agent/book/flights','/book/flights','/agent/book/umrah','/book/umrah/package']) {
  const Steps=load(portal+'book/desk-steps.tsx',{'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()},'@/modules/agencies/services':services}).DeskSteps;
  const labels=nodes(Steps({hasCustomer:true})).filter(n=>n.type==='li').map(n=>n.props.children[1].props.children);
  assert.equal(labels.at(-1),pathname.includes('flights')?'Book & pay':'Review & pay');
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
