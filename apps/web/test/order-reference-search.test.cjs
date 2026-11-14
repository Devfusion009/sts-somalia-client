const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const file=path.resolve(__dirname,'../src/modules/admin/order-reference-search.ts');
function load(deny=false){
 const calls=[];const q={select:(...a)=>{calls.push(['select',...a]);return q;},ilike:(...a)=>{calls.push(['ilike',...a]);return q;},order:()=>q,range:(...a)=>{calls.push(['range',...a]);return Promise.resolve({data:[{id:'order-match'}],count:30,error:null});}};
 const mocks={'server-only':{},'@/lib/auth/session':{requirePlatformAdmin:async()=>{if(deny)throw Error('Forbidden');}},'@/lib/supabase/server':{createClient:async()=>({from:()=>q})},'@/lib/pagination':{ADMIN_PAGE_SIZE:25,pageRange:p=>({from:(p-1)*25})}};
 const mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(id=>mocks[id],mod,mod.exports);
 return {find:mod.exports.findOrderReferences,calls};
}
test('order-reference search queries the full dataset and paginates matches',async()=>{
 const {find,calls}=load();assert.deepEqual(await find('STS-2026-000071',2),{ids:['order-match'],total:30});
 assert.deepEqual(calls.find(c=>c[0]==='ilike'),['ilike','order_number','%STS-2026-000071%']);
 assert.deepEqual(calls.find(c=>c[0]==='range'),['range',25,49]);
});
test('wildcard-only search cannot accidentally match every order',async()=>{
 const {find,calls}=load();assert.deepEqual(await find('%_()',1),{ids:[],total:0});assert.equal(calls.length,0);
});
test('order search requires admin access before reading any orders',async()=>{
 const {find,calls}=load(true);await assert.rejects(find('STS',1),/Forbidden/);assert.equal(calls.length,0);
});
