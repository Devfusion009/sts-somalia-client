const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/modules/umrah/facility-options.ts');
const mod = new Module(file, module);
mod.filename = file;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText, file);

const { splitUmrahFacilities, umrahFacilitiesFromForm } = mod.exports;

test('selected facilities and custom details survive editing', () => {
  const form = new FormData();
  form.append('facility', 'Airport reception');
  form.append('facility', 'Hotel Wi-Fi');
  form.append('facilitiesOther', 'Special assistance at check-in');
  const saved = umrahFacilitiesFromForm(form);
  assert.deepEqual(splitUmrahFacilities(saved), {
    selected: ['Airport reception', 'Hotel Wi-Fi'],
    other: 'Special assistance at check-in',
  });
});

test('unlisted checkbox values are ignored', () => {
  const form = new FormData();
  form.append('facility', 'Invented benefit');
  form.append('facility', 'Haram shuttle');
  form.append('facility', 'Haram shuttle');
  assert.equal(umrahFacilitiesFromForm(form), 'Haram shuttle');
});
