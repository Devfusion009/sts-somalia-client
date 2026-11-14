const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../src/modules/admin/actions.ts'),'utf8');
const start=source.indexOf('export async function updateOrderStatus');
const body=ts.transpileModule(source.slice(start,source.indexOf('const visaTypeSchema',start)).replace('export async','async')+'\nreturn updateOrderStatus;',{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
function action(currentStatus) {
 let wrote=false;
 const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{status:currentStatus}}),update:()=>{wrote=true;return query;},then:resolve=>Promise.resolve({error:null}).then(resolve)};
 return {run:new Function('requirePlatformAdmin','createClient','orderStatuses','revalidatePath',body)(async()=>{},async()=>({from:()=>query}),['pending_payment','partially_paid','paid','processing','completed','cancelled','refunded'],()=>{}),wrote:()=>wrote};
}
for(const status of ['paid','partially_paid','refunded'])test(`order dropdown cannot directly set ${status}`,async()=>{
 const service=action('pending_payment'); const form=new FormData();form.set('orderId','order');form.set('status',status);
 assert((await service.run(null,form)).error);assert.equal(service.wrote(),false);
});
for(const status of ['processing','completed'])test(`unpaid order cannot skip payment by becoming ${status}`,async()=>{
 const service=action('pending_payment');const form=new FormData();form.set('orderId','order');form.set('status',status);
 assert((await service.run(null,form)).error);assert.equal(service.wrote(),false);
});
test('paid order can enter operational processing',async()=>{
 const service=action('paid');const form=new FormData();form.set('orderId','order');form.set('status','processing');
 assert.equal((await service.run(null,form)).error,null);assert.equal(service.wrote(),true);
});
