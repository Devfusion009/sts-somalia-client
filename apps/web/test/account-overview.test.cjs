const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {updateProfileSchema}=require('@sts/shared-types');
function load(file,mocks={}){const out={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText)(id=>mocks[id] ?? {},out,out.exports);return out.exports;}
const {profileCompletion,maskedPassport,passportState}=load(path.resolve(__dirname,'../src/modules/account/overview.ts'));
test('completion excludes optional identity documents',()=>{
 assert.equal(profileCompletion({full_name:'Customer',email:'c@example.com',phone:'+252611222333',country_code:'SO'}),100);
 assert.equal(profileCompletion({full_name:'Customer',email:'c@example.com'}),50);
 assert.equal(profileCompletion({full_name:'  ',email:null}),0);
});
test('passport summaries mask short and long numbers',()=>{
 assert.equal(maskedPassport('A12345678'),'•••• 5678');assert.equal(maskedPassport('123'),'•••');assert.equal(maskedPassport(null),'Not added');
});
test('expiry states do not claim document verification',()=>{
 const now=Date.parse('2026-11-16T12:00:00Z');
 assert.equal(passportState('2026-11-01','A123',now),'Expired');
 assert.equal(passportState('2026-12-01','A123',now),'Expiring soon');
 assert.equal(passportState('2030-01-01','A123',now),'Details saved');
 assert.equal(passportState(null,'A123',now),'Details incomplete');
});
test('contact numbers normalize to international format',()=>{
 const value=updateProfileSchema.parse({fullName:'  Amina Ali  ',phone:'+252 (61) 222-3333',countryCode:'so'});
 assert.equal(value.fullName,'Amina Ali');assert.equal(value.phone,'+252612223333');assert.equal(value.countryCode,'SO');
 for(const phone of ['abc','0612345678','+00000000'])assert.equal(updateProfileSchema.safeParse({fullName:'Amina Ali',phone}).success,false);
});
test('vault reads require ownership and fail visibly on database error',async()=>{
 const calls=[];const q={select:()=>q,eq:(...args)=>{calls.push(args);return q;},order:async()=>({data:null,error:{message:'Unavailable'}})};
 const {TravelersService}=load(path.resolve(__dirname,'../../api/src/modules/travelers/travelers.service.ts'),{'@nestjs/common':{Injectable:()=>x=>x}});
 await assert.rejects(new TravelersService({get:()=>({from:()=>q})}).getMyDocuments('owner-id'),/Documents could not be loaded/);
 assert.deepEqual(calls,[['owner_id','owner-id']]);
});
