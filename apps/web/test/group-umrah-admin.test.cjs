const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const file = path.join(root, 'apps/api/src/modules/umrah/services/package-admin.service.ts');
function service(repository) {
 const mod = new Module(file, module);
 mod.filename = file;
 mod.require = id => {
  if (id === '@nestjs/common') return { Injectable: () => value => value, BadRequestException: Error, NotFoundException: Error };
  if (id === '@sts/shared-types') return { UMRAH_INCLUDE_KEYS: ['flights', 'hotel'] };
  return {};
 };
 mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true}}).outputText, file);
 return new mod.exports.PackageAdminService(repository, {}, {});
}
const input = {name:'Group Umrah', durationDays:12, includes:['hotel'], basePrice:1500, currency:'usd', status:'draft'};
test('creation returns the saved id and persists the selected route for configuration', async () => {
 let row;
 const result = await service({insertPackage:async value => {row=value; return 'new-id';}}).upsert({...input, originIata:'MGQ', destinationIata:'JED'});
 assert.deepEqual(result, {id:'new-id'});
 assert.equal(row.origin_iata, 'MGQ');
 assert.equal(row.destination_iata, 'JED');
 assert.equal(row.status, 'draft');
 assert.equal(row.currency, 'USD');
});
test('editing basic package fields preserves routes managed by the details form', async () => {
 let row;
 const result = await service({updatePackage:async (id,value) => {assert.equal(id,'existing');row=value;}}).upsert({...input,id:'existing'});
 assert.deepEqual(result,{id:'existing'});
 assert.equal(Object.hasOwn(row,'origin_iata'),false);
 assert.equal(Object.hasOwn(row,'destination_iata'),false);
});
test('save failure does not return a configuration id', async () => {
 await assert.rejects(service({insertPackage:async () => {throw Error('Save failed');}}).upsert(input), /Save failed/);
});
