const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { z } = require('zod');
function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '../src', relative);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports);
  return mod.exports;
}
const schemas = load('modules/visa/schemas.ts', { '@/lib/countries': { COUNTRY_NAMES: { SO: 'Somalia' } } });
test('mandatory customer answers reject blanks and require explicit choices', () => {
  const valid = {fullName:'QA Traveller',dateOfBirth:'1985-01-01',gender:'female',nationality:'SO',passportNumber:'QA12345',passportExpiry:'2099-01-01',email:'qa@example.com',mobile:'+252 615551234'};
  assert(schemas.personalInfoSchema.safeParse(valid).success);
  for (const field of Object.keys(valid)) assert(!schemas.personalInfoSchema.safeParse({...valid,[field]:''}).success, field);
  for (const field of ['fullName','passportNumber']) assert(!schemas.personalInfoSchema.safeParse({...valid,[field]:'   '}).success, field);
  for (const type of ['yes_no','multi_choice']) {
    const section = {key:'details',title:'Details',scope:'application',fields:[{key:'answer',label:'Answer',type,required:true,options:['A','B']}]};
    assert(schemas.sectionAnswerError(section, {}));
    assert.equal(schemas.sectionAnswerError(section, {answer:type==='yes_no'?'no':['B']}), null);
  }
});
const { describeOrderItem } = load('modules/admin/order-items.ts');
test('admin sees travel dates saved by the customer, including legacy applications', () => {
  for (const travel_details of [{arrival_date:'2027-02-01',departure_date:'2027-02-10'}, {arrivalDate:'2027-02-01',departureDate:'2027-02-10'}]) {
    const result=describeOrderItem({item_type:'visa',visa_application:{travel_details}});
    assert.equal(result.from,'2027-02-01'); assert.equal(result.to,'2027-02-10');
  }
});
const source = fs.readFileSync(path.resolve(__dirname,'../src/modules/visa/actions.ts'),'utf8');
const start=source.indexOf('export async function saveTravelInfo(');
const end=source.indexOf('// Step 4 — document upload',start);
const body=ts.transpileModule(source.slice(start,end).replace('export async','async')+'\nreturn saveTravelInfo;', {compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
test('failed atomic travel save does not advance and sends the displayed revision', async () => {
 let advanced=false;const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {error:{message:'Save failed'}};}};
 const app={id:'11111111-1111-4111-8111-111111111111',updated_at:'2026-11-15T00:00:00Z',current_step:3,visa_type:{application_sections:[]},members:[{id:'member',full_name:'QA',details:{}}],traveler_details:{passport_expiry:'2099-01-01'}};
 const dependencies={z,travelInfoSchema:schemas.travelInfoSchema,requireUser:async()=>({id:'user'}),getEditableApplication:async()=>({supabase:db,application:app}),parseRequirementSections:()=>[],orderedMembers:v=>v,sectionInputName:()=>'',requirementAnswersError:()=>null,travelFormValues:()=>({}),formValues:()=>({}),advanceWizard:()=>{advanced=true;}};
 const action=new Function(...Object.keys(dependencies),body)(...Object.values(dependencies));const form=new FormData();
 for(const [key,value] of Object.entries({applicationId:app.id,expectedUpdatedAt:app.updated_at,arrivalDate:'2090-02-01',departureDate:'2090-02-10',purposeOfVisit:'tourism',addressAtDestination:'QA hotel'}))form.set(key,value);
 const result=await action(null,form);assert.equal(result.error,'Save failed');assert.equal(advanced,false);assert.equal(calls.length,1);assert.equal(calls[0].name,'visa_save_draft_step');assert.equal(calls[0].args.p_expected_updated_at,app.updated_at);assert.equal(calls[0].args.p_values.departure_date,'2090-02-10');
});

test('travel dates reject departure before arrival and allow a valid trip', () => {
  const trip = {arrivalDate:'2090-02-10',departureDate:'2090-02-01',purposeOfVisit:'tourism',addressAtDestination:'Test hotel'};
  const invalid = schemas.travelInfoSchema.safeParse(trip);
  assert.equal(invalid.success, false);
  assert(invalid.error.issues.some(issue => issue.path.includes('departureDate')));
  assert(schemas.travelInfoSchema.safeParse({...trip,departureDate:'2090-02-15'}).success);
});
