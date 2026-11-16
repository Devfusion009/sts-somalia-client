const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {zipSync, unzipSync, strToU8, strFromU8}=require('fflate');
function load(relative,mocks={}){
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText)(id=>mocks[id],mod,mod.exports);return mod.exports;
}
const countries={countryName:code=>({SA:'Saudi Arabia',IN:'India'}[code]??code)};
const schemas=load('modules/visa/schemas.ts',{'@/lib/countries':{COUNTRY_NAMES:{SA:'Saudi Arabia',IN:'India'}},zod:require('zod'),'@sts/shared-types':require('@sts/shared-types')});
const packet=load('modules/visa/submission-packet.ts',{'@/lib/countries':countries,'./schemas':schemas});
function fixture(){return {
 paymentState:'paid',readiness:[{key:'documents_complete',applies:true,ok:true},{key:'documents_reviewed',applies:true,ok:true},{key:'lodgement',label:'Submitted to centre',applies:true,ok:false}],
 documentSlots:[{label:'Passport',versions:[{id:'passport'}]},{label:'Driving licence',versions:[{id:'licence'}]}],
 application:{status:'ready_for_processing',application_ref:'STS-VISA-TEST',applicant_type:'family',agency_id:null,traveler_details:{full_name:'Test Primary',gender:'female'},contact_details:{email:'test@example.test',mobile:'+252611234567'},travel_details:{arrival_date:'2027-01-01',departure_date:'2027-01-10',purpose:'tourism',address:'Test Hotel'},visa_type:{name:'Umrah Visa',entry_type:'single',destination_country_code:'SA',application_sections:[]},members:[{id:'m1',full_name:'Test Primary',relationship:'self',date_of_birth:'1985-01-01',nationality:'IN',passport_number:'TEST001',passport_expiry:'2030-01-01',details:{}},{id:'m2',full_name:'Test Child',relationship:'child',date_of_birth:'2015-01-01',nationality:'IN',passport_number:'TEST002',passport_expiry:'2030-01-01',details:{}}],document_requests:[{id:'r1',status:'received'}],documents:[{id:'passport',is_current:true,document_type:'passport_bio',review_status:'accepted',file_name:'passport.pdf'},{id:'old',is_current:false,document_type:'passport_bio',review_status:'rejected',file_name:'old.pdf'},{id:'licence',is_current:true,document_type:'request:Driving licence',request_id:'r1',review_status:'accepted',file_name:'licence.pdf'},{id:'receipt',is_current:true,document_type:'submission_receipt',review_status:'accepted',file_name:'internal.pdf'}]}
};}
test('submission includes every current applicant document and received requested proof',()=>{
 assert.deepEqual(packet.submissionDocuments(fixture()).map(d=>d.id),['passport','licence']);
 const f=fixture();f.application.document_requests[0].status='waived';assert.deepEqual(packet.submissionDocuments(f).map(d=>d.id),['passport']);
});
test('submission is blocked for unpaid, incomplete, unreviewed or non-ready cases',()=>{
 assert.equal(packet.submissionBlocker(fixture()),null);
 for(const change of [f=>f.paymentState='pending',f=>f.application.status='submitted',f=>f.readiness[0].ok=false,f=>f.application.documents[0].review_status='pending']){
 const f=fixture();change(f);assert(packet.submissionBlocker(f));}
});
test('preparing a submission precedes lodgement but still requires applicable appointments',()=>{
 const f=fixture();assert.equal(packet.submissionBlocker(f),null);
 f.readiness.push({key:'appointment',label:'Appointment attended',applies:true,ok:false});
 assert.equal(packet.submissionBlocker(f),'Appointment attended is outstanding.');
});
test('the email summary includes all travellers, passport details, travel, contact and requested documents',()=>{
 const text=packet.submissionEmailText(fixture());
 for(const expected of ['Test Primary','Test Child','TEST001','TEST002','Saudi Arabia','test@example.test','2027-01-10','Test Hotel','Driving licence','Direct customer'])assert(text.includes(expected),expected);
 assert(!text.includes('internal.pdf'));assert(!text.includes('old.pdf'));
});
test('the ZIP preserves all attachment bytes and filenames',()=>{
 const original={'application-summary.txt':strToU8(packet.submissionEmailText(fixture())),'documents/1-passport.pdf':strToU8('synthetic passport'),'documents/2-licence.pdf':strToU8('synthetic licence')};
 const restored=unzipSync(zipSync(original,{level:0}));assert.deepEqual(Object.keys(restored),Object.keys(original));
 for(const key of Object.keys(original))assert.equal(strFromU8(restored[key]),strFromU8(original[key]));
});
const applicationId='10000000-0000-4000-8000-000000000001';
function route({failFile=false,changed=false,denied=false}={}){
 let reads=0;const accesses=[];
 const api=load('app/api/visa/[applicationId]/submission-email/route.ts',{
  'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},fflate:require('fflate'),zod:require('zod'),
  '@/modules/visa/staff-auth':{requireVisaPermission:async()=>{if(denied)throw Error('Forbidden');return {email:'staff@example.test'};}},
  '@/modules/visa/case-queries':{getVisaCase:async()=>{const f=fixture();if(changed && reads++>0) f.application.documents[0].review_status='rejected';return f;}},
  '@/modules/visa/submission-packet':packet,
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(_,args)=>{accesses.push(args.p_document_id);return {data:args.p_document_id,error:null};},storage:{from:()=>({download:async path=>failFile && path==='licence'?{error:{message:'unavailable'},data:null}:{error:null,data:new Blob([path],{type:'application/pdf'})}})}})},
 });return {...api,accesses};
}
function request(overrides={}){
 const form=new FormData();for(const [key,value] of Object.entries({officeName:'Test Visa Office',email:'office@example.test',phone:'+252611234567',subject:'Visa application',body:'Test message',...overrides}))form.set(key,value);
 return new Request('https://sts.test/api/visa/id/submission-email',{method:'POST',body:form});
}
test('export authorises staff and includes all verified files without sending or changing submission stage',async()=>{
 const r=route();const result=await r.POST(request(),{params:Promise.resolve({applicationId})});assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'private, no-store');
 const files=unzipSync(new Uint8Array(await result.arrayBuffer()));assert.equal(strFromU8(files['documents/1-passport.pdf']),'passport');assert.equal(strFromU8(files['documents/2-licence.pdf']),'licence');assert.match(strFromU8(files['email-message.txt']),/office@example.test/);assert.deepEqual(r.accesses,['passport','licence']);
 await assert.rejects(route({denied:true}).POST(request(),{params:Promise.resolve({applicationId})}),/Forbidden/);
});
test('a missing file, changed review or invalid email never produces a partial submission pack',async()=>{
 for(const [options,form,status] of [[{failFile:true},request(),502],[{changed:true},request(),409],[{},request({email:'not-an-email'}),400]]){
 const result=await route(options).POST(form,{params:Promise.resolve({applicationId})});assert.equal(result.status,status);assert.match(result.headers.get('content-type'),/json/);
 }
});
