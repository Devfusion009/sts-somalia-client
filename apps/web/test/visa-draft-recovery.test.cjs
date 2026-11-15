const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/modules/visa/draft-recovery.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText)(m,m.exports);
const {recoveredDraft}=m.exports;
const saved=(overrides={})=>JSON.stringify({revision:'r1',at:100000,values:{fullName:'QA Unsaved',arrivalDate:'2090-01-01',choices:'["A","B"]'},...overrides});
test('unsaved fields recover within the same application revision including multi-select values',()=>{assert.deepEqual(recoveredDraft(saved(),'r1',101000),{fullName:'QA Unsaved',arrivalDate:'2090-01-01',choices:'["A","B"]'});});
test('stale, expired, future and corrupt drafts cannot overwrite persisted data',()=>{for(const raw of [null,'{bad',saved({revision:'old'}),saved({at:0}),saved({at:9999999}),saved({values:[]})])assert.equal(recoveredDraft(raw,'r1',1900000),null);});
test('recovery never restores credentials or unexpected non-text values',()=>{assert.deepEqual(recoveredDraft(saved({values:{fullName:'QA',password:'hidden',access_token:'hidden',secret:'hidden',file:{name:'passport.png'}}}),'r1',101000),{fullName:'QA'});});
