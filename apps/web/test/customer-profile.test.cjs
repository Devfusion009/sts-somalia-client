const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = resolve(__dirname, '../../..');
function load(relative, mocks = {}) {
 const file = resolve(root, relative), mod = new Module(file, module);
 mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
 const original = mod.require.bind(mod);
 mod.require = id => {
  if (Object.hasOwn(mocks, id)) return mocks[id];
  if (id === 'server-only') return {};
  if (id.startsWith('@/') || id.startsWith('.')) {
   const target = id.startsWith('@/') ? resolve(root, 'apps/web/src', id.slice(2)) : resolve(dirname(file), id);
   for (const candidate of [target + '.ts', target + '.tsx']) if (existsSync(candidate)) return load(candidate, mocks);
  }
  return original(id);
 };
 mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
 return mod.exports;
}
const path = 'apps/web/src/modules/agencies/customer-profile.ts';
function form(overrides = {}, passport = true) {
 const data = new FormData();
 const fields = {firstName:'Amina',lastName:'Mohamed',gender:'female',dateOfBirth:'1990-02-20',nationality:'SO',email:'amina@example.com',phone:'+252610000001',passportNumber:'p1234567',passportIssuingCountry:'SO',passportIssueDate:'2020-01-01',passportExpiryDate:'2035-01-01',residenceCountry:'SO',city:'Mogadishu',emergencyContactName:'Yusuf',emergencyContactPhone:'+252610000002',emergencyContactRelationship:'Brother',preferredCabin:'economy',travelPreferences:'Aisle seat',...overrides};
 for(const [key,value] of Object.entries(fields))data.set(key,value);
 if(passport)data.set('passportCopy',new File(['%PDF-1.7'], 'passport.pdf',{type:'application/pdf'}));
 return data;
}
function storageDb() {
 const uploads=[];
 return {uploads,storage:{from:bucket=>{assert.equal(bucket,'customer-documents');return {upload:async(path,file)=>{uploads.push({path,file});return {error:null};}};}}};
}

test('registration saves identity, address, emergency details and a tenant-scoped passport copy',async()=>{
 const db=storageDb();
 const result=await load(path).buildCustomerProfile(db,'own-agency','agent',form());
 assert.equal(result.error,undefined);
 assert.equal(result.row.full_name,'Amina Mohamed');
 assert.equal(result.row.passport_number,'P1234567');
 assert.equal(result.row.city,'Mogadishu');
 assert.equal(result.row.emergency_contact_name,'Yusuf');
 assert.equal(result.row.travel_preferences,'Aisle seat');
 assert.equal(result.row.agency_id,'own-agency');
 assert.equal(result.row.created_by,'agent');
 assert.equal(result.fields.created_by,undefined);
 assert.match(db.uploads[0].path,/^own-agency\/.+-passport\.pdf$/);
});

test('invalid dates and missing passport documents fail before uploading',async()=>{
 for(const [overrides,passport] of [[{dateOfBirth:'1990-02-30'},true],[{passportIssueDate:'1980-01-01'},true],[{passportExpiryDate:'2019-01-01'},true],[{},false]]) {
  const db=storageDb();const result=await load(path).buildCustomerProfile(db,'own','agent',form(overrides,passport));
  assert.ok(result.error);assert.equal(db.uploads.length,0);
 }
});

test('editing retains the server-verified document and ignores a submitted storage path',async()=>{
 const db=storageDb(),data=form({},false);
 data.set('passportFilePath','another-agency/stolen.pdf');
 const result=await load(path).buildCustomerProfile(db,'own','agent',data,'own/existing.pdf');
 assert.equal(result.fields.passport_file_path,'own/existing.pdf');
 assert.equal(result.uploadedPath,null);assert.equal(db.uploads.length,0);
});

test('editing a customer outside the agency stops before any profile or file mutation',async()=>{
 const filters=[];
 const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},async maybeSingle(){return {data:null};}};
 const actions=load('apps/web/src/modules/agencies/customer-actions.ts',{
  'next/cache':{revalidatePath:assert.fail},
  '@/lib/auth/session':{requireUser:async()=>({id:'agent'})},
  '@/lib/supabase/server':{createClient:async()=>({from:()=>query})},
  '@/modules/orders/helpers':{getActiveAgencyId:async()=> 'own'},
  './customer-profile':{buildCustomerProfile:assert.fail},
 });
 const data=form();data.set('customerId','foreign-customer');
 assert.deepEqual(await actions.updateAgencyCustomer(null,data),{error:'Customer not found.'});
 assert.deepEqual(filters,[['id','foreign-customer'],['agency_id','own']]);
});

for(const document of ['other/private.pdf','own/passport.pdf']) {
 test(`passport access scopes the customer and storage path (${document.startsWith('own/')?'allowed':'denied'})`,async()=>{
  const filters=[],signed=[];
  const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},async maybeSingle(){return {data:{passport_file_path:document}};}};
  const {GET}=load('apps/web/src/app/agent/(portal)/customers/[id]/passport/route.ts',{
   'next/server':{NextResponse:class extends Response {static redirect(url){return new Response(null,{status:307,headers:{Location:url}});}}},
   '@/lib/auth/session':{requireUser:async()=>({id:'agent'})},
   '@/modules/agencies/queries':{getMyAgency:async()=>({agency:{id:'own',status:'active'}})},
   '@/lib/supabase/server':{createClient:async()=>({from:()=>query,storage:{from:()=>({createSignedUrl:async(path,expires)=>{signed.push([path,expires]);return {data:{signedUrl:'https://storage.example.test/signed'},error:null};}})}})},
  });
  const response=await GET(new Request('https://portal.test'),{params:Promise.resolve({id:'customer'})});
  assert.deepEqual(filters,[['id','customer'],['agency_id','own']]);
  if(document.startsWith('own/')){assert.equal(response.status,307);assert.deepEqual(signed,[[document,60]]);assert.equal(response.headers.get('cache-control'),'private, no-store');}
  else{assert.equal(response.status,404);assert.equal(signed.length,0);}
 });
}

 test('missing or invalid contact details fail before any passport upload', async () => {
  for (const overrides of [{email:''}, {email:'invalid'}, {phone:''}, {phone:'123'}, {email:'   '}]) {
   const db=storageDb();
   const result=await load(path).buildCustomerProfile(db,'own','agent',form(overrides));
   assert.ok(result.error);
   assert.equal(db.uploads.length,0);
  }
 });
