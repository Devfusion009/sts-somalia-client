const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(relative){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>({}),mod,mod.exports);return mod.exports;}
const {ADMIN_NAV_GROUPS}=load('app/admin/(portal)/navigation.ts');
const {poolCapacity,poolStatus}=load('modules/umrah/pool.ts');
test('workspace comes first and Umrah inventory has one destination',()=>{
 assert.equal(ADMIN_NAV_GROUPS[0].label,'Workspace');
 assert.ok(ADMIN_NAV_GROUPS.find(g=>g.label==='Umrah').items.some(x=>x.href==='/admin/umrah/pool'));
 assert.equal(ADMIN_NAV_GROUPS.flatMap(g=>g.items).filter(x=>x.href==='/admin/umrah/pool').length,1);
 assert.equal(ADMIN_NAV_GROUPS.flatMap(g=>g.items).some(x=>x.href==='/admin/catalog/umrah'),false);
});
test('filled, held and available reconcile to capacity, including offline sales',()=>{
 assert.deepEqual(poolCapacity({total_seats:40,confirmed_seats:30,held_seats:2,offline_seats:2}),{total:40,filled:32,held:2,remaining:6,percent:80});
});
test('status distinguishes private, full, closed and draft pools',()=>{
 const row={package_status:'published',departure_status:'open',departure_date:'2099-01-01',pool_visibility:'public',total_seats:5,confirmed_seats:2,held_seats:0,offline_seats:0};
 assert.equal(poolStatus(row),'Open');assert.equal(poolStatus({...row,pool_visibility:'private'}),'Private');assert.equal(poolStatus({...row,held_seats:3}),'Full');assert.equal(poolStatus({...row,departure_status:'cancelled'}),'Closed');assert.equal(poolStatus({...row,package_status:'draft'}),'Draft');
});
