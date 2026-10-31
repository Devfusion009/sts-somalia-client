const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = resolve(__dirname, '../../..');
function load(relative, mocks = {}) {
  const file = resolve(root, relative);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, file);
  return mod.exports;
}
process.env.INTEGRATIONS_ENCRYPTION_KEY = 'isolated-test-key-not-a-real-credential';
const crypto = load('apps/web/src/lib/integrations-crypto.ts');
const applicationId = '10000000-0000-4000-8000-000000000001';
function fixture() {
  let next = 1, signedIn = null;
  const passwords = new Map([['applicant@example.test','ExistingCustomer!2026']]);
  const tables = {
    agency_applications: [{ id: applicationId, status: 'under_review', reference_number: 'STS-TA-TEST', applicant_id: 'customer', business_details: { contactEmail: 'contact@example.test', contactFullName: 'Amina', legalBusinessName: 'Test Travel' }, applicant: { email: 'applicant@example.test', full_name: 'Customer', phone: null } }],
    agent_login_credentials: [], profiles: [{ id: 'customer', email: 'applicant@example.test', app_metadata: {} }], agency_members: [], partner_document_reviews: [], notifications: [],
  };
  let created = 0, emailStatus = 'sent', adminAllowed = true, mail = [], cooldown = false;
  const client = {
    from(table) {
      let filters = [], payload, kind = 'read', single = false;
      const q = {
        select() { return q; }, limit() { return q; }, eq(k,v) { filters.push(r=>r[k]===v);return q; }, is(k,v) { return q.eq(k,v); }, not(k,_op,v) { filters.push(r=>r[k]!==v);return q; },
        maybeSingle() {single=true;return q;}, single() {single=true;return q;},
        insert(p) { payload=p;kind='insert';return q; }, upsert(p) {payload=p;kind='upsert';return q;}, update(p) {payload=p;kind='update';return q;},
        then(ok, fail) {
          let rows=(tables[table]??[]).filter(r=>filters.every(f=>f(r)));
          if(kind==='upsert') { const old=tables[table].find(r=>r.application_id===payload.application_id);if(!old) tables[table].push({...payload,agent_id:`AGT-2026-${String(next++).padStart(6,'0')}`,profile_id:null,approved_at:null,email_sent_at:null}); }
          if(kind==='insert') tables[table].push(payload);
          if(kind==='update') rows.forEach(r=>Object.assign(r,payload));
          return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(ok,fail);
        },
      };return q;
    },
    auth: { admin: {
      async createUser(input) { created++; const user={id:`agent-${created}`,email:input.email,app_metadata:input.app_metadata};tables.profiles.push(user); passwords.set(input.email,input.password);return {data:{user},error:null}; },
      async getUserById(id) {return {data:{user:tables.profiles.find(p=>p.id===id)},error:null};},
      async generateLink({email}) {return {data:{properties:{hashed_token:`token-for-${email}`}},error:null};},
    },
      async signInWithPassword({email,password}) { signedIn=passwords.get(email)===password?tables.profiles.find(p=>p.email===email):null;return {data:{user:signedIn},error:signedIn?null:{message:'Invalid'}}; },
      async getUser(){return {data:{user:signedIn}};}, async signOut(){signedIn=null;}, async getClaims(){return {data:{claims:{session_id:'test'}}};},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:'aal1',nextLevel:'aal1'}};}},
    },
    async rpc(name,input) {
      if(name==='approve_agency_application') {const c=tables.agent_login_credentials[0]; c.approved_at='2026-10-31';tables.agency_applications[0].status='approved';tables.agency_members.push({profile_id:c.profile_id,status:'active',agency_id:'agency'});tables.profiles.find(p=>p.id===c.profile_id).agent_code=c.agent_id;return {data:'agency',error:null};}
      if(name==='agent_login_identity') {const profile=tables.profiles.find(p=>p.agent_code===input.p_agent_id);return {data:profile?.email??null,error:null};}
      if(name==='claim_agent_password_recovery') {if(cooldown)return {data:[]};cooldown=true;const c=tables.agent_login_credentials[0];return {data:c&&c.agent_id===input.p_agent_id?[{login_email:c.login_email,contact_email:c.contact_email}]:[]};}
      throw new Error(name);
    },
  };
  const adminModule={createAdminClient:()=>client};
  const credentials=load('apps/web/src/lib/agents/credentials.ts', {'@/lib/supabase/admin':adminModule,'@/lib/integrations-crypto':crypto});
  const notices={ applicationRecipients:(to,account)=>({to:to??account,cc:[]}),async notifyApplicant(n){mail.push(n);return {email:emailStatus,emailSent:emailStatus==='sent'};} };
  const actions=load('apps/web/src/modules/admin/application-actions.ts', {
    '@/lib/agents/credentials':credentials,'@/lib/supabase/admin':adminModule,'@/lib/integrations-crypto':crypto,
    'next/cache':{revalidatePath(){}},'next/navigation':{redirect(url){throw Object.assign(new Error(url),{redirect:true});}},
    '@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/session':{requirePlatformAdmin:async()=>{if(!adminAllowed)throw Error('Denied');}},
    '@/lib/notifications/application-notify':notices,'@/modules/partner-applications/config':{docSlotsFor:()=>[]},
  });
  const auth=load('apps/web/src/lib/auth/actions.ts', {
    '@/lib/managers/identity':{managerIdPattern:/^MGR-\d{4}-\d{6,}$/},'@/lib/agents/credentials':credentials,'@/lib/supabase/admin':adminModule,'@/lib/supabase/server':{createClient:async()=>client},
    'next/navigation':{redirect(url){throw Object.assign(new Error(url),{redirect:true});}},'next/cache':{revalidatePath(){}},
    '@/lib/subdomain':{pathPrefixFor:p=>`/${p}`,portalHref:p=>`/${p}`,rootOrigin:()=>''},'@/lib/auth/login-history':{recordLoginEvent:async()=>{},recordSecurityEvent:async()=>{}},'@/lib/auth/device':{sessionIdFromAccessToken:()=>null},'@/lib/auth/recovery-codes':{consumeRecoveryCode:async()=>false},
  });
  const recovery=load('apps/web/src/lib/agents/recovery.ts',{
    './credentials':credentials,'@/lib/supabase/admin':adminModule,'@/lib/notifications/email':{sendEmail:async n=>{mail.push(n);return {sent:true};}},'@/lib/integrations':{getIntegrations:()=>({siteUrl:'https://example.test'})},'@/lib/notifications/email-layout':{escapeHtml:s=>s},
  });
  async function approve() { const form=new FormData();form.set('applicationId',applicationId);try{return await actions.approveApplication('agency',null,form);}catch(e){if(e.redirect)return {redirect:e.message};throw e;} }
  return {client,tables,passwords,credentials,auth,actions,recovery,approve,mail,setEmailStatus:s=>emailStatus=s,denyAdmin:()=>adminAllowed=false,get created(){return created;}};
}
function loginForm(id,password) {const f=new FormData();f.set('agentId',id);f.set('password',password);return f;}

test('approval provisions an independent ID/password, emails only the application contact, and logs in',async()=>{
  const f=fixture();await f.approve();const c=f.tables.agent_login_credentials[0], notice=f.mail[0];
  assert.equal(f.created,1);assert.equal(notice.to,'contact@example.test');assert.deepEqual(notice.cc,[]);assert.equal(notice.agentLogin.agentId,c.agent_id);
  assert.notEqual(notice.agentLogin.password,'ExistingCustomer!2026');assert.equal(f.passwords.get('applicant@example.test'),'ExistingCustomer!2026');
  assert.equal(c.password_encrypted,null);assert.ok(c.email_sent_at);assert.notEqual(c.profile_id,'customer');
  assert.deepEqual(await f.auth.signInWithAgentIdAction(null,loginForm(c.agent_id.toLowerCase(),notice.agentLogin.password)),{error:null,destination:'/agent'});
  assert.ok((await f.auth.signInWithAgentIdAction(null,loginForm('contact@example.test',notice.agentLogin.password))).error);
  assert.ok((await f.auth.signInWithAgentIdAction(null,loginForm(c.agent_id,'ExistingCustomer!2026'))).error);
});
test('failed email retains only encrypted delivery credentials; retry uses the same ID and password',async()=>{
  const f=fixture();f.setEmailStatus('failed');await f.approve();const c=f.tables.agent_login_credentials[0],password=f.mail[0].agentLogin.password;
  assert.ok(c.password_encrypted);assert.ok(!c.password_encrypted.includes(password));assert.equal(c.email_sent_at,null);
  f.setEmailStatus('sent');await f.actions.retryAgentCredentialEmail(applicationId,null,new FormData());
  assert.equal(f.mail[1].agentLogin.password,password);assert.equal(f.mail[1].agentLogin.agentId,c.agent_id);assert.equal(f.created,1);assert.equal(c.password_encrypted,null);
  await f.approve();assert.equal(f.created,1);assert.equal(f.mail.length,2);
});
test('preparation retries reuse the reserved credential and identity',async()=>{
  const f=fixture();const a=await f.credentials.prepareAgentCredentials(applicationId,'contact@example.test','Amina');const b=await f.credentials.prepareAgentCredentials(applicationId,'contact@example.test','Amina');
  assert.equal(a.agent_id,b.agent_id);assert.equal(a.profile_id,b.profile_id);assert.equal(a.password_encrypted,b.password_encrypted);assert.equal(f.created,1);
});
test('application email is required and approval is admin-only',async()=>{
  const f=fixture();await assert.rejects(f.credentials.prepareAgentCredentials(applicationId,'invalid','Amina'),/contact email/);assert.equal(f.created,0);
  f.denyAdmin();await assert.rejects(f.approve(),/Denied/);await assert.rejects(f.actions.retryAgentCredentialEmail(applicationId,null,new FormData()),/Denied/);
});
test('ID recovery sends to the saved contact and leaves the password unchanged; cooldown suppresses repeats',async()=>{
  const f=fixture();await f.approve();const c=f.tables.agent_login_credentials[0],password=f.passwords.get(c.login_email);f.mail.length=0;
  assert.deepEqual(await f.recovery.requestAgentPasswordReset(null,loginForm(c.agent_id,'')),{error:null});assert.equal(f.mail.length,1);assert.equal(f.mail[0].to,'contact@example.test');assert.match(f.mail[0].text,/token_hash=/);
  await f.recovery.requestAgentPasswordReset(null,loginForm(c.agent_id,''));assert.equal(f.mail.length,1);assert.equal(f.passwords.get(c.login_email),password);
});
test('real agent email sign-in has no fallback; redirects stay on this origin',async()=>{
  const f=fixture();await f.approve();const c=f.tables.agent_login_credentials[0];const form=loginForm(c.agent_id,f.mail[0].agentLogin.password);form.set('redirect_to','https://outside.example');
  assert.equal((await f.auth.signInWithAgentIdAction(null,form)).destination,'/agent');
  form.set('email','applicant@example.test');assert.ok((await f.auth.signInToAgentPortalAction(null,form)).error);
});
test('email template contains issued credentials; WhatsApp contains no password',async()=>{
  const layout=load('apps/web/src/lib/notifications/email-layout.ts');
  const sent=[];
  const notices=load('apps/web/src/lib/notifications/application-notify.ts',{
    './email':{sendEmail:async n=>(sent.push(n),{sent:true,status:'sent'})},'./email-layout':layout,'./whatsapp-send':{sendWhatsAppMessage:async n=>(sent.push(n),{sent:true})},'@/lib/integrations':{getIntegrations:()=>({siteUrl:'https://example.test'})},'@/lib/subdomain':{portalHref:()=>'/agent',portalLoginHref:()=>'/agent/login'},
  });
  const input={type:'agency',event:'approved',referenceNumber:'STS-TA-TEST',applicantName:'Agency',recipientName:'Amina',to:'contact@example.test',cc:['customer@example.test'],phone:'+252000000',agentLogin:{agentId:'AGT-2026-000001',password:'Generated<Secret>!'}};
  const output=notices.renderApplicationEmail(input);
  assert.match(output.text,/AGT-2026-000001/);assert.ok(output.text.includes(input.agentLogin.password));assert.ok(output.html.includes('Generated&lt;Secret&gt;!'));assert.ok(!output.whatsapp.includes(input.agentLogin.password));assert.ok(!output.text.includes('STS account password'));
  await notices.notifyApplicant(input);assert.equal(sent[0].cc,undefined);assert.ok(!sent[1].body.includes(input.agentLogin.password));
});

test('an interrupted Auth-create response reuses only an identity tagged for this application',async()=>{
  const f=fixture();const a=await f.credentials.prepareAgentCredentials(applicationId,'contact@example.test','Amina');
  f.tables.agent_login_credentials[0].profile_id=null;
  const recovered=await f.credentials.prepareAgentCredentials(applicationId,'contact@example.test','Amina');
  assert.equal(recovered.profile_id,a.profile_id);assert.equal(f.created,1);
  const g=fixture();g.tables.profiles.push({id:'rogue',email:`application-${applicationId}@agent-login.scoutsts.invalid`,app_metadata:{}});
  await assert.rejects(g.credentials.prepareAgentCredentials(applicationId,'contact@example.test','Amina'),/could not be verified/);
  assert.equal(g.tables.agency_members.length,0);
});
test('dedicated agent credentials cannot sign in through the B2C form',async()=>{
  const f=fixture();await f.approve();const c=f.tables.agent_login_credentials[0];const form=loginForm(c.agent_id,f.mail[0].agentLogin.password);form.set('email',c.login_email);
  assert.ok((await f.auth.signInAction(null,form)).error);
  form.set('email','applicant@example.test');form.set('password','ExistingCustomer!2026');
  await assert.rejects(f.auth.signInAction(null,form),e=>e.redirect&&e.message==='/');
});
test('agent recovery is public on the agent subdomain while protected pages retain the session gate',async()=>{
  let checks=0;
  const {proxy}=load('apps/web/src/proxy.ts',{
    'next/server':{NextResponse:{rewrite:url=>({kind:'rewrite',url:url.pathname}),next:()=>({kind:'next'}),redirect:url=>({kind:'redirect',url:url.pathname})}},
    '@/lib/subdomain':{portalSubdomainFor:()=> 'agent',pathPrefixFor:p=>`/${p}`,rootOrigin:()=>'',portalsAreIsolated:()=>true},
    '@/lib/auth/edge-session':{readEdgeSession:async()=>{checks++;return {kind:'none'};}},
    '@/lib/supabase/proxy':{refreshSession:async()=>[],withSession:r=>r},
  });
  function request(path){const url=new URL(`https://agent.example.test${path}`);url.clone=()=>new URL(url);return {headers:new Map([['host','agent.example.test']]),nextUrl:url};}
  assert.deepEqual(await proxy(request('/forgot-password')),{kind:'rewrite',url:'/agent/forgot-password'});
  assert.deepEqual(await proxy(request('/agent/forgot-password')),{kind:'next'});
  assert.equal(checks,0);
  assert.equal((await proxy(request('/finance'))).kind,'redirect');assert.equal(checks,1);
});

test('existing agency members retain their password and sign in using their personal ID',async()=>{
  const f=fixture();f.tables.profiles[0].agent_code='AGT-2026-000008';f.tables.agency_members.push({profile_id:'customer',status:'active',agency_id:'legacy-agency'});
  assert.deepEqual(await f.auth.signInWithAgentIdAction(null,loginForm('AGT-2026-000008','ExistingCustomer!2026')),{error:null,destination:'/agent'});
  assert.equal(f.created,0);
});
