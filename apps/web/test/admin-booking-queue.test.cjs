const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function queue(failedTable) {
 const mod={exports:{}};
 const client={from(table){const q={};for(const method of ['select','eq'])q[method]=()=>q;q.order=async()=>({data:[],error:table===failedTable?{message:'Unavailable'}:null});return q;}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/modules/admin/queue-queries.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(id=>id==='@/lib/supabase/server'?{createClient:async()=>client}:{eventTypeLabel:x=>x},mod,mod.exports);
 return mod.exports.getBookingQueue;
}
test('a genuine empty queue returns no pending requests',async()=>assert.deepEqual(await queue()(),[]));
test('failure of any booking source cannot appear as Queue is clear',async()=>{
 for(const source of ['hotel_bookings','hall_bookings']) await assert.rejects(queue(source)(),/could not be loaded/);
});
