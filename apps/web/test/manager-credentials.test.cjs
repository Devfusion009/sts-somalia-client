const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), Module=require('node:module'), ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
function load(relative,mocks={}){const file=path.resolve(root,relative),mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));const original=mod.require.bind(mod);mod.require=id=>id==='server-only'?{}:Object.hasOwn(mocks,id)?mocks[id]:original(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText,file);return mod.exports;}
process.env.INTEGRATIONS_ENCRYPTION_KEY='isolated-manager-test-key';
const crypto=load('apps/web/src/lib/integrations-crypto.ts'),layout=load('apps/web/src/lib/notifications/email-layout.ts');
const property='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
function fixture(){
 const tables={profiles:[{id:'customer',email:'contact@example.test',role:'customer',manager_code:null,app_metadata:{}}],manager_login_credentials:[],hotel_managers:[],venue_managers:[]};
 const passwords=new Map([['contact@example.test','Customer!2026']]);let created=0,status='sent',allowed=true,assignedError=false,user=null,cooldown=false;const mail=[];
 const client={from(table){let filters=[],mode='read',payload,single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){return q.eq(k,v);},not(k,_op,v){filters.push(r=>r[k]!==v&&r[k]!==undefined);return q;},limit(){return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},upsert(p){mode='upsert';payload=p;return q;},update(p){mode='update';payload=p;return q;},then(ok,fail){let rows=(tables[table]??[]).filter(r=>filters.every(f=>f(r)));if(mode==='upsert'&&!tables[table].some(r=>r.contact_email===payload.contact_email))tables[table].push({...payload,id:'20000000-0000-4000-8000-000000000001',manager_code:'MGR-2026-000001',profile_id:null,email_sent_at:null});if(mode==='update')rows.forEach(r=>Object.assign(r,payload));return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(ok,fail);}};return q;},
 auth:{admin:{async createUser(input){created++;const p={id:`manager-${created}`,email:input.email,app_metadata:input.app_metadata,manager_code:null};tables.profiles.push(p);passwords.set(input.email,input.password);return {data:{user:p},error:null};},async getUserById(id){return {data:{user:tables.profiles.find(p=>p.id===id)},error:null};},async generateLink({email}){return {data:{properties:{hashed_token:'token-for-'+email}},error:null};}},async signInWithPassword({email,password}){user=passwords.get(email)===password?tables.profiles.find(p=>p.email===email):null;return {data:{user},error:user?null:{message:'Invalid'}};},async getUser(){return {data:{user}};},async signOut(){user=null;},async getClaims(){return {data:{claims:{session_id:'test'}}};},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:'aal1',nextLevel:'aal1'}};}}},
 async rpc(name,input){
  if(name.startsWith('can_manage_'))return {data:allowed,error:null};
  if(name==='manager_login_identity'){const p=tables.profiles.find(p=>p.manager_code===input.p_manager_code),active=p&&[...tables.hotel_managers,...tables.venue_managers].some(m=>m.profile_id===p.id&&m.status==='active');return {data:active?p.email:null,error:null};}
  if(name==='claim_manager_password_recovery'){if(cooldown)return {data:[]};cooldown=true;const p=tables.profiles.find(p=>p.manager_code===input.p_manager_code),c=tables.manager_login_credentials.find(c=>c.profile_id===p?.id);return {data:p?[{login_email:p.email,contact_email:c?.contact_email??p.email}]:[]};}
  if(name==='add_hotel_manager'||name==='add_venue_manager'){if(assignedError)return {data:null,error:{message:'Assignment denied'}};const kind=name==='add_hotel_manager'?'hotel':'venue',p=tables.profiles.find(p=>p.email===input.p_email),row={id:kind==='hotel'?'30000000-0000-4000-8000-000000000001':'30000000-0000-4000-8000-000000000002',[`${kind}_id`]:input[`p_${kind}_id`],profile_id:p.id,status:'active',permissions:input.p_permissions};tables[`${kind}_managers`].push(row);return {data:row,error:null};}
  throw new Error(name);
 }};
 const admin={'@/lib/supabase/admin':{createAdminClient:()=>client}},common={...admin,'@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/session':{requireUser:async()=>({id:'operator'})},'next/cache':{revalidatePath(){}},'next/navigation':{unstable_rethrow(){},redirect(url){throw Object.assign(Error(url),{redirect:true});}},'@/lib/notifications/email':{sendEmail:async input=>{mail.push(input);return {status,sent:status==='sent'};}},'@/lib/notifications/email-layout':layout,'@/lib/integrations':{getIntegrations:()=>({siteUrl:'https://example.test'})},'@/lib/subdomain':{portalLoginHref:()=>'/manager/login',portalHref:p=>`/${p}`,pathPrefixFor:p=>`/${p}`,rootOrigin:()=>''}};
 const credentials=load('apps/web/src/lib/managers/credentials.ts',{...common,'@/lib/integrations-crypto':crypto});
 const permissions={'@/modules/hotels/manager-permissions':{MANAGER_PERMISSION_KEYS:['bookings','photos'],isManagerPermission:p=>['bookings','photos'].includes(p)},'@/modules/events/venue-manager-permissions':{VENUE_MANAGER_PERMISSION_KEYS:['bookings','photos'],isVenueManagerPermission:p=>['bookings','photos'].includes(p)}};
 const actions={hotel:load('apps/web/src/modules/hotels/manager-invite-actions.ts',{...common,...permissions,'@/lib/managers/credentials':credentials}),venue:load('apps/web/src/modules/events/venue-manager-invite-actions.ts',{...common,...permissions,'@/lib/managers/credentials':credentials})};
 const auth=load('apps/web/src/lib/auth/actions.ts',{...common,'@/lib/managers/identity':{managerIdPattern:/^MGR-\d{4}-\d{6,}$/},'@/lib/agents/credentials':{agentIdPattern:/^AGT-\d{4}-\d{6,}$/},'@/lib/auth/login-history':{recordLoginEvent:async()=>{},recordSecurityEvent:async()=>{}},'@/lib/auth/device':{sessionIdFromAccessToken:()=>null},'@/lib/auth/recovery-codes':{consumeRecoveryCode:async()=>false}});
 const form=(kind,id=property)=>{const f=new FormData();f.set(`${kind}Id`,id);f.set('email','contact@example.test');f.set('managerId',kind==='hotel'?'30000000-0000-4000-8000-000000000001':'30000000-0000-4000-8000-000000000002');f.append('permissions','bookings');return f;};
 const recovery=load('apps/web/src/lib/managers/recovery.ts',{'./identity':{managerIdPattern:/^MGR-\d{4}-\d{6,}$/},'./credentials':credentials});
 return {tables,passwords,mail,credentials,actions,auth,recovery,form,setStatus:v=>status=v,deny:()=>allowed=false,failAssignment:()=>assignedError=true,get created(){return created;}};
}
function login(code,password){const f=new FormData();f.set('managerCode',code);f.set('password',password);return f;}
for(const kind of ['hotel','venue']){
 const label=kind==='hotel'?'Hotel':'Venue';
 test(`${kind}: new manager receives ID/password after assignment, leaving customer credentials unchanged`,async()=>{
  const f=fixture(),result=await f.actions[kind][`add${label}Manager`](null,f.form(kind)),c=f.tables.manager_login_credentials[0];
  assert.equal(result.error,null);assert.equal(result.managerCode,c.manager_code);assert.equal(result.emailStatus,'sent');assert.equal(f.mail[0].to,'contact@example.test');assert.ok(f.mail[0].text.includes(c.manager_code));assert.equal(c.password_encrypted,null);assert.equal('newPassword'in result,false);assert.equal(f.passwords.get('contact@example.test'),'Customer!2026');
  const password=f.passwords.get(`${c.id}@manager-login.scoutsts.invalid`);
  assert.deepEqual(await f.auth.signInWithManagerIdAction(null,login(c.manager_code.toLowerCase(),password)),{error:null,destination:'/manager'});
  assert.ok((await f.auth.signInWithManagerIdAction(null,login('contact@example.test',password))).error);
 });
 test(`${kind}: denied property permissions prevent provisioning and retry/reset`,async()=>{
  const f=fixture();f.deny();assert.ok((await f.actions[kind][`add${label}Manager`](null,f.form(kind))).error);assert.equal(f.created,0);
  assert.ok((await f.actions[kind][`retry${label}ManagerCredentialEmail`](null,f.form(kind))).error);
  assert.ok((await f.actions[kind][`reset${label}ManagerPassword`](null,f.form(kind))).error);assert.equal(f.mail.length,0);
 });
 test(`${kind}: failed assignment sends no email and grants no access`,async()=>{
  const f=fixture();f.failAssignment();assert.ok((await f.actions[kind][`add${label}Manager`](null,f.form(kind))).error);assert.equal(f.mail.length,0);assert.equal(f.tables[`${kind}_managers`].length,0);
 });
 test(`${kind}: failed delivery retry preserves ID/password; wrong-property retry is blocked`,async()=>{
  const f=fixture();f.setStatus('failed');await f.actions[kind][`add${label}Manager`](null,f.form(kind));const c=f.tables.manager_login_credentials[0],encrypted=c.password_encrypted;assert.ok(encrypted);
  const password=crypto.decryptCredentials(encrypted).password;assert.ok(!encrypted.includes(password));f.setStatus('sent');
  assert.ok((await f.actions[kind][`retry${label}ManagerCredentialEmail`](null,f.form(kind,other))).error);
  assert.equal((await f.actions[kind][`retry${label}ManagerCredentialEmail`](null,f.form(kind))).error,null);assert.ok(f.mail[1].text.includes(password));assert.equal(c.password_encrypted,null);assert.equal(f.created,1);
 });
 test(`${kind}: reset control sends a link without changing the manager password`,async()=>{
  const f=fixture();await f.actions[kind][`add${label}Manager`](null,f.form(kind));const c=f.tables.manager_login_credentials[0],alias=`${c.id}@manager-login.scoutsts.invalid`,password=f.passwords.get(alias);
  const result=await f.actions[kind][`reset${label}ManagerPassword`](null,f.form(kind));assert.equal(result.error,null);assert.equal(f.passwords.get(alias),password);assert.equal(f.mail[1].to,'contact@example.test');assert.match(f.mail[1].text,/token_hash=/);assert.ok(!f.mail[1].text.includes(password));
 });
}
test('one identity is reused across a hotel and venue; repeated assignment does not rotate credentials',async()=>{
 const f=fixture();await f.actions.hotel.addHotelManager(null,f.form('hotel'));await f.actions.venue.addVenueManager(null,f.form('venue'));await f.actions.hotel.addHotelManager(null,f.form('hotel'));assert.equal(f.created,1);assert.equal(f.tables.hotel_managers.length,1);assert.equal(f.tables.venue_managers.length,1);assert.equal(f.mail.length,1);
});
test('real email fallback is rejected; unknown ID and wrong password produce the same response',async()=>{
 const f=fixture();await f.actions.hotel.addHotelManager(null,f.form('hotel'));const a=await f.auth.signInWithManagerIdAction(null,login('MGR-2026-000001','wrong')),b=await f.auth.signInWithManagerIdAction(null,login('MGR-2026-999999','wrong'));assert.equal(a.error,b.error);
 const form=login('MGR-2026-000001','wrong');form.set('email','contact@example.test');assert.ok((await f.auth.signInToManagerPortalAction(null,form)).error);
});
test('legacy manager retains ID and password and receives an ID-bearing reset link',async()=>{
 const f=fixture();f.tables.profiles[0].manager_code='MGR-2026-000088';const result=await f.actions.hotel.addHotelManager(null,f.form('hotel'));assert.equal(result.managerCode,'MGR-2026-000088');assert.equal(f.created,0);assert.equal(f.passwords.get('contact@example.test'),'Customer!2026');assert.match(f.mail[0].text,/MGR-2026-000088/);
});

test('public manager recovery uses the stored email, suppresses repeat sends, and does not reveal unknown IDs',async()=>{
 const f=fixture();await f.actions.hotel.addHotelManager(null,f.form('hotel'));f.mail.length=0;
 const a=await f.recovery.requestManagerPasswordReset(null,login('MGR-2026-000001',''));assert.deepEqual(a,{error:null});assert.equal(f.mail[0].to,'contact@example.test');
 const b=await f.recovery.requestManagerPasswordReset(null,login('MGR-2026-999999',''));assert.deepEqual(b,a);
 await f.recovery.requestManagerPasswordReset(null,login('MGR-2026-000001',''));assert.equal(f.mail.length,1);
});
test('new manager identity does not take over the existing B2C account',async()=>{
 const f=fixture();await f.actions.hotel.addHotelManager(null,f.form('hotel'));const c=f.tables.manager_login_credentials[0],alias=`${c.id}@manager-login.scoutsts.invalid`,form=login(c.manager_code,f.passwords.get(alias));form.set('email',alias);
 assert.ok((await f.auth.signInAction(null,form)).error);
 form.set('email','contact@example.test');form.set('password','Customer!2026');await assert.rejects(f.auth.signInAction(null,form),e=>e.redirect&&e.message==='/');
});
test('manager recovery route bypasses only the sign-in gate on the manager subdomain',async()=>{
 let gates=0;const {proxy}=load('apps/web/src/proxy.ts',{
  'next/server':{NextResponse:{rewrite:url=>({kind:'rewrite',path:url.pathname}),next:()=>({kind:'next'}),redirect:()=>({kind:'redirect'})}},
  '@/lib/subdomain':{portalSubdomainFor:()=> 'manager',pathPrefixFor:p=>`/${p}`,rootOrigin:()=>'',portalsAreIsolated:()=>true},
  '@/lib/auth/edge-session':{readEdgeSession:async()=>{gates++;return {kind:'none'};}},'@/lib/supabase/proxy':{refreshSession:async()=>[],withSession:r=>r},
 });
 const request=pathname=>{const url=new URL(`https://manager.example.test${pathname}`);url.clone=()=>new URL(url);return {headers:new Map([['host','manager.example.test']]),nextUrl:url};};
 assert.deepEqual(await proxy(request('/forgot-password')),{kind:'rewrite',path:'/manager/forgot-password'});assert.equal(gates,0);assert.equal((await proxy(request('/security'))).kind,'redirect');assert.equal(gates,1);
});
