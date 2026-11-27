const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(deps){const file='apps/web/src/modules/umrah/pool-worker.ts';const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id]||{},m,m.exports);return m.exports;}
for(const agency of [null,'qa-agency'])test(`path-based ${agency?'agent':'customer'} email uses site URL and records delivery`,async()=>{
 let origin,finished;const calls=[];const request={id:'r',agency_id:agency,customer_id:'c',status:'requested'};
 const db={rpc:async(name,args)=>{calls.push(name);if(name==='claim_umrah_pool_emails')return{data:[{id:'j',request_id:'r',kind:'received',claim_token:'lease'}]};if(name==='finish_umrah_pool_email')finished=args;return{data:{}}},from:table=>({select:()=>({in:async()=>({data:table==='umrah_pool_requests'?[request]:table==='agencies'?[{id:'qa-agency',contact_email:'agent@example.test'}]:[{id:'c',email:'customer@example.test'}],error:null})})})};
 const worker=load({'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/integrations':{getIntegrations:()=>({email:{provider:'smtp'},siteUrl:'http://localhost:3000'})},'@/lib/subdomain':{portalOrigin:()=>'',rootOrigin:()=>''},'./pool-email':{poolMailIsCurrent:()=>true,renderPoolEmail:(kind,r,url)=>{origin=url;return{subject:'QA',text:'QA'}}},'@/lib/notifications/email':{sendEmail:async()=>({sent:true})}});
 const result=await worker.processUmrahPools();assert.equal(result.sent,1);assert.deepEqual(calls.slice(0,4),['release_public_umrah_checkouts','_expire_unpaid_umrah_orders','process_umrah_request_pools','expire_umrah_pool_requests']);assert.equal(origin,'http://localhost:3000');assert.equal(finished.p_outcome,'sent');assert.equal(finished.p_token,'lease');
});
test('cleanup failure stops pool activation and mail delivery',async()=>{
 const calls=[];
 const db={rpc:async(name)=>{calls.push(name);return {error:{message:'database unavailable'}}}};
 const worker=load({'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/integrations':{getIntegrations:()=>({email:{provider:null}})}});
 await assert.rejects(worker.processUmrahPools(),/checkout expiry failed/);
 assert.deepEqual(calls,['release_public_umrah_checkouts']);
});
test('pool email worker batches recipient reads and sends at most four messages together',async()=>{
 let reads=0,active=0,peak=0;
 const jobs=Array.from({length:5},(_,i)=>({id:`job-${i}`,request_id:`request-${i}`,kind:'received',claim_token:`token-${i}`}));
 const requests=jobs.map((job)=>({id:job.request_id,agency_id:null,customer_id:'customer',status:'requested'}));
 const db={rpc:async(name)=>({data:name==='claim_umrah_pool_emails'?jobs:{},error:null}),from:table=>({select:()=>({in:async()=>{reads++;return{data:table==='umrah_pool_requests'?requests:[{id:'customer',email:'customer@example.test'}],error:null};}})})};
 const worker=load({'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/integrations':{getIntegrations:()=>({email:{provider:'smtp'},siteUrl:'http://localhost:3000'})},'@/lib/subdomain':{portalOrigin:()=>'',rootOrigin:()=>''},'./pool-email':{poolMailIsCurrent:()=>true,renderPoolEmail:()=>({subject:'QA',text:'QA'})},'@/lib/notifications/email':{sendEmail:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return{sent:true};}}});
 const result=await worker.processUmrahPools();
 assert.equal(result.sent,5);assert.equal(reads,2);assert.equal(peak,4);
});
