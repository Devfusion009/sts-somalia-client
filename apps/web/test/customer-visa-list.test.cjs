const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const out={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/modules/visa/customer-list.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,out.exports);
const {filterCustomerVisas,visaListCounts}=out.exports;
const base={id:'a',status:'submitted',application_ref:'STS-VISA-000031',created_at:'2026-10-01',submitted_at:'2026-11-15',visa_type:{name:'Egypt Tourist Visa',destination_country_code:'EG'}};
const names=code=>({EG:'Egypt',TR:'Turkey'}[code] ?? code);
test('search matches reference, destination and visa name without mutating source order',()=>{
 const rows=[base,{...base,id:'b',application_ref:'OTHER',visa_type:{name:'Turkey e-Visa',destination_country_code:'TR'}}];
 for(const q of ['000031','Egypt','Tourist','EG'])assert.deepEqual(filterCustomerVisas(rows,{q},names).map(x=>x.id),['a']);
 assert.deepEqual(rows.map(x=>x.id),['a','b']);
});
test('country, stage and date combine using the displayed submission date',()=>{
 const now=Date.parse('2026-11-16');const rows=[base,{...base,id:'b',status:'draft',submitted_at:null}];
 assert.equal(filterCustomerVisas(rows,{country:'EG',status:'submitted',days:'7'},names,now).length,1);
 assert.equal(filterCustomerVisas(rows,{country:'TR'},names,now).length,0);
 assert.equal(filterCustomerVisas(rows,{days:'7'},names,now).length,1);
});
test('oldest sort reverses date order with stable ID tiebreakers',()=>{
 const rows=[base,{...base,id:'b',submitted_at:'2026-11-10'}];
 assert.deepEqual(filterCustomerVisas(rows,{},names).map(x=>x.id),['a','b']);
 assert.deepEqual(filterCustomerVisas(rows,{sort:'oldest'},names).map(x=>x.id),['b','a']);
});
test('summary counts never classify refused and cancelled cases as successfully completed',()=>{
 const rows=['draft','submitted','processing','ready_for_processing','approved','issued','rejected','cancelled'].map(status=>({status}));
 assert.deepEqual(visaListCounts(rows),{total:8,progress:2,ready:1,completed:2});
});
