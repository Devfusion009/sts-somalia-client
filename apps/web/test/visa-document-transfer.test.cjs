const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const mod={exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(id=>mocks[id],mod,mod.exports);
  return mod.exports;
}
const {transferFile}=load('modules/visa/transfer-file.ts');
class FakeXHR {
  constructor(){ FakeXHR.latest=this;this.upload={};this.status=200; }
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(){}
  send(body){this.body=body;}
  abort(){this.aborted=true;this.onabort?.();}
}
global.XMLHttpRequest=FakeXHR;
const file=new File(['test'],'proof.pdf',{type:'application/pdf'});
test('upload reports actual byte progress and completes only on a successful response',async()=>{
  const progress=[];const task=transferFile('https://storage.test/signed',file,new AbortController().signal,p=>progress.push(p));
  const xhr=FakeXHR.latest;xhr.upload.onprogress({lengthComputable:true,loaded:2,total:4});
  assert.deepEqual(progress,[50]);assert.equal(xhr.method,'PUT');assert.equal(xhr.body.get('').name,'proof.pdf');
  xhr.onload();await task;
});
test('cancel aborts the transfer and rejects instead of reporting success',async()=>{
  const controller=new AbortController();const task=transferFile('https://storage.test/signed',file,controller.signal,()=>{});
  controller.abort();await assert.rejects(task,{name:'AbortError'});assert.equal(FakeXHR.latest.aborted,true);
});
test('network timeout and failed response are visible failures',async()=>{
  for(const event of ['ontimeout','onerror','onload']){
    const task=transferFile('https://storage.test/signed',file,new AbortController().signal,()=>{});
    FakeXHR.latest.status=500;FakeXHR.latest[event]();await assert.rejects(task);
  }
});
const data={applicationId:'10000000-0000-4000-8000-000000000001',targetId:'20000000-0000-4000-8000-000000000001',kind:'request',name:'proof.pdf',size:4,type:'application/pdf'};
const uuid='30000000-0000-4000-8000-000000000001';
function actions({owner='user',status='requested',infoError=null,rpcError=null}={}){
 const calls=[];
 const client={from:table=>{
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='visa_applications'?{submitted_by:owner,status:'additional_info_required'}:{status,document_id:'doc',is_current:true,review_status:'rejected'}})};return q;
 },storage:{from:()=>({createSignedUploadUrl:async path=>{calls.push(['sign',path]);return {data:{signedUrl:'https://storage.test/signed'},error:null};},info:async()=>({data:{size:4,contentType:'application/pdf'},error:infoError})})},rpc:async(...args)=>{calls.push(['rpc',...args]);return {error:rpcError};}};
 const exports=load('modules/visa/portal-upload-actions.ts',{'node:crypto':{randomUUID:()=>uuid},zod:require('zod'),'next/cache':{revalidatePath:()=>{}},'@/lib/auth/session':{requireUser:async()=>({id:'user'})},'@/lib/supabase/server':{createClient:async()=>client}});
 return {...exports,calls};
}
test('signed uploads are scoped to an eligible request belonging to the customer',async()=>{
 const a=actions();const result=await a.preparePortalUpload(data);assert.equal(result.path,`${data.applicationId}/request-${data.targetId}-${uuid}`);
 for(const config of [{owner:'someone-else'},{status:'received'}]){const b=actions(config);assert((await b.preparePortalUpload(data)).error);assert.equal(b.calls.length,0);}
});
test('completion verifies actual stored file before fulfilling a request',async()=>{
 const a=actions();const path=`${data.applicationId}/request-${data.targetId}-${uuid}`;
 assert.deepEqual(await a.completePortalUpload(data,path),{error:null});assert.equal(a.calls[0][1],'visa_fulfil_document_request');
 const b=actions({infoError:{message:'Not found'}});assert((await b.completePortalUpload(data,path)).error);assert.equal(b.calls.length,0);
 const c=actions();assert((await c.completePortalUpload(data,`other/${uuid}`)).error);assert.equal(c.calls.length,0);
});
test('storage uploads do not silently succeed when linking fails',async()=>{
 const a=actions({rpcError:{message:'Request already resolved'}});
 assert.match((await a.completePortalUpload(data,`${data.applicationId}/request-${data.targetId}-${uuid}`)).error,/already resolved/);
});
const source=fs.readFileSync(path.resolve(__dirname,'../src/modules/visa/admin-actions.ts'),'utf8');
const start=source.indexOf('export async function adminResolveDocumentRequest(');
const end=source.indexOf('/** Attach the final',start);
const resolveBody=ts.transpileModule(source.slice(start,end).replace('export async','async')+'\nreturn adminResolveDocumentRequest;',{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
test('admin verification reports a database refusal and cannot verify a missing upload',async()=>{
 for(const status of ['requested','uploaded']){
  let called=false,refreshed=false;
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{application_id:data.applicationId,status,document_id:status==='uploaded'?'doc':null}})};
  const deps={z:require('zod').z,requireVisaPermission:async()=>{},createClient:async()=>({from:()=>q,rpc:async()=>{called=true;return {error:{message:'Request already resolved'}};}}),rpcMessage:m=>m,revalidateVisaViews:()=>{refreshed=true;}};
  const resolveAction=new Function(...Object.keys(deps),resolveBody)(...Object.values(deps));
  const form=new FormData();form.set('applicationId',data.applicationId);form.set('requestId',data.targetId);form.set('resolution','received');
  const result=await resolveAction(null,form);
  assert(result.error);assert.equal(called,status==='uploaded');assert.equal(refreshed,false);
 }
});
