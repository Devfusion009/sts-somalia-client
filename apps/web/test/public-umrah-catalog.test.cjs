const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const shared = require('@sts/shared-types');
function load(relative, mocks={}) {
 const compiled={exports:{}};
 const source=fs.readFileSync(path.resolve(__dirname,'../../..',relative),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,experimentalDecorators:true}}).outputText;
 new Function('require','module','exports',output)(id=> {
  if(Object.hasOwn(mocks,id))return mocks[id];
  if(id==='@sts/shared-types')return shared;
  if(id==='@nestjs/common')return {Injectable:()=>target=>target};
  if(id.startsWith('.'))return {};
  return require(id);
 },compiled,compiled.exports);
 return compiled.exports;
}
const mapper=load('apps/api/src/modules/umrah/mappers/package.mapper.ts');
const future='2099-03-01';
const departure={departure_date:future,total_seats:5,booked_seats:0,offline_seats:0,sales_close_days:0,status:'open'};
const pkg={id:'id',slug:'group',package_type:'group',name:'Group Umrah',tagline:null,tier:null,is_featured:false,origin_iata:'MGQ',destination_iata:'JED',duration_days:10,base_price:1000,original_price:null,currency:'USD',includes:[],images:[],umrah_package_hotels:[],umrah_package_departures:[departure]};
test('card chooses available future departure, skipping sold-out, closed, cancelled and past pools',()=> {
 const card=mapper.toPackageCard({...pkg,umrah_package_departures:[{...departure,booked_seats:5},{...departure,status:'closed'},{...departure,status:'cancelled'},{...departure,departure_date:'2000-01-01'},{...departure,departure_date:'2099-04-01'}]},'2099-01-01');
 assert.equal(card.nextDeparture.departure_date,'2099-04-01');
});
test('offline sales also remove the final seat from public availability',()=>assert.equal(mapper.toPackageCard({...pkg,umrah_package_departures:[{...departure,offline_seats:5}]},'2099-01-01').nextDeparture,null));
test('catalog immediately hides a sold-out group and relists released seats without caching',async()=> {
 let rows=[pkg], reads=0;
 const {UmrahCatalogService}=load('apps/api/src/modules/umrah/services/umrah-catalog.service.ts',{'../mappers/package.mapper':mapper});
 const catalog=new UmrahCatalogService({findPublishedCards:async()=>{reads++;return rows;}},{},{},{},{},{cachedRead:assert.fail});
 assert.equal((await catalog.allPackages()).length,1);
 rows=[{...pkg,umrah_package_departures:[{...departure,booked_seats:5}]}];
 assert.equal((await catalog.allPackages()).length,0);
 rows=[pkg]; assert.equal((await catalog.allPackages()).length,1);assert.equal(reads,3);
});
test('featured limit excludes full groups and retired private packages',async()=> {
 const {UmrahCatalogService}=load('apps/api/src/modules/umrah/services/umrah-catalog.service.ts',{'../mappers/package.mapper':mapper});
 const soldOut={...pkg,umrah_package_departures:[{...departure,booked_seats:5}]};
 const catalog=new UmrahCatalogService({findPublishedCards:async()=>[soldOut,pkg,{...soldOut,id:'private',package_type:'private'}]},{},{},{},{},{});
 assert.equal((await catalog.featuredPackages(1))[0].id,'id');
 assert.deepEqual((await catalog.allPackages()).map(p=>p.id),['id']);
});
test('customer and agent package details show authored facilities, stay nights and responsible contact',()=> {
 const {PublicPackageDetails}=load('apps/web/src/modules/umrah/components/public-package-details.tsx');
 const {renderToStaticMarkup}=require('react-dom/server');
 const html=renderToStaticMarkup(PublicPackageDetails({pkg:{facilities:'Wheelchair assistance',accommodation_details:'Quad rooms',flight_details:'MGQ–JED return',transport_details:'Coach transfers',meals_note:'Full board',nights_makkah:5,nights_madinah:4,contact_person_name:'Trip Coordinator',contact_person_phone:'+252 611 444 420',agent_contacts:[{name:'Local Agent',phone:'+252 611 222 333'}]}}));
 for(const value of ['Wheelchair assistance','Quad rooms','MGQ–JED return','Coach transfers','Full board','5 nights','4 nights','Trip Coordinator','tel:+252611444420','Local Agent','tel:+252611222333'])assert.ok(html.includes(value),value);
});
