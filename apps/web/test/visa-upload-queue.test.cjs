const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = resolve(__dirname, '../src/modules/visa/upload-queue.ts');
const mod = new Module(file, module);
mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, file);
const { createUploadQueue } = mod.exports;

test('documents selected together upload in order, with only one request active', async () => {
  const enqueue = createUploadQueue();
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = enqueue(async () => {
    events.push('first started');
    await gate;
    events.push('first saved');
    return 'first';
  });
  const second = enqueue(async () => {
    events.push('second started');
    return 'second';
  });
  await Promise.resolve();
  assert.deepEqual(events, ['first started']);
  release();
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
  assert.deepEqual(events, ['first started', 'first saved', 'second started']);
});

test('a failed document does not block later uploads or a retry', async () => {
  const enqueue = createUploadQueue();
  const failed = enqueue(async () => { throw new Error('Connection lost'); });
  const next = enqueue(async () => 'next saved');
  await assert.rejects(failed, /Connection lost/);
  assert.equal(await next, 'next saved');
  assert.equal(await enqueue(async () => 'retry saved'), 'retry saved');
});


test('three files transfer together while later files wait and failures release capacity', async () => {
  const enqueue = createUploadQueue(3);
  let active=0, peak=0;
  const releases=[];
  const work=Array.from({length:8},(_,i)=>enqueue(async()=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>releases.push(resolve));
    active--;
    if(i===1)throw new Error('One failed file');
    return i;
  }));
  const settled=Promise.allSettled(work);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(active,3);
  while(releases.length){releases.shift()();await new Promise(resolve=>setImmediate(resolve));}
  const results=await settled;
  assert.equal(peak,3);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,7);
  assert.equal(results[1].status,'rejected');
  assert.equal(await enqueue(async()=> 'retry'), 'retry');
});
