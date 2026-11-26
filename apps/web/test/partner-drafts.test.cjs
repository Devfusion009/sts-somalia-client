const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file) {
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  mod.require = id => id.startsWith('.') ? load(resolve(dirname(file), `${id}.ts`)) : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
  return mod.exports;
}
const draft = load(resolve(__dirname, '../src/modules/partner-applications/draft-fields.ts'));
const { canApplicantEdit } = load(resolve(__dirname, '../src/modules/partner-applications/config.ts'));

test('only never-submitted drafts can be edited', () => {
  assert.equal(canApplicantEdit('draft', null), true);
  for (const status of ['pending', 'under_review', 'more_info_requested', 'approved', 'rejected']) {
    assert.equal(canApplicantEdit(status, null), false);
    assert.equal(canApplicantEdit(status, new Date().toISOString()), false);
  }
  assert.equal(canApplicantEdit('draft', new Date().toISOString()), false);
});

test('partial drafts retain unfinished values without permitting workflow or identity injection', () => {
  assert.deepEqual(draft.draftFields('agency', 2, { contactFullName: 'A', contactEmail: 'unfinished@', contactMobile: '', _wizard_step: '6', status: 'approved', applicant_id: 'someone-else', intent: 'continue' }), {
    contactFullName: 'A', contactMobile: '', contactEmail: 'unfinished@',
  });
  assert.deepEqual(draft.draftFields('affiliate', 4, { bankName: 'x' }), {});
  assert.deepEqual(draft.draftFields('agency', 1, { legalBusinessName: 'x'.repeat(20001) }), {});
});

test('repeatable rows, multi-selects and settlement choices restore as control defaults', () => {
  const fields = { branchesJson: '[{"name":"Branch","location":"Mogadishu"}]', roomTypesJson: '[{"typeName":"Double","count":""}]', handlesJson: '[{"platform":"Web","handle":""}]', products: 'flights,hotels', amenities: '', eventTypes: 'wedding', requestedMarkupPreset: 'custom', requestedMarkupCustom: '7.5' };
  const result = draft.draftDetails({ products: ['old'], logoPath: 'kept' }, fields);
  assert.deepEqual(result.products, ['flights', 'hotels']);
  assert.deepEqual(result.amenities, []);
  assert.equal(result.branches[0].location, 'Mogadishu');
  assert.equal(result.roomTypes[0].count, '');
  assert.equal(result.requestedMarkupPercent, '7.5');
  assert.equal(result.logoPath, 'kept');
  assert.deepEqual(draft.draftDetails({}, { branchesJson: 'invalid' }).branches, []);
});

test('offline recovery rejects corrupt, expired and future snapshots', () => {
  const now = 1000000000;
  const value = { fields: { contactFullName: 'Customer' }, savedAt: now - 1000, revision: 2 };
  assert.deepEqual(draft.readLocalDraft(JSON.stringify(value), now), value);
  for (const raw of ['bad JSON', 'null', JSON.stringify({ ...value, savedAt: now - draft.DRAFT_MAX_AGE - 1 }), JSON.stringify({ ...value, savedAt: now + 120000 })]) {
    assert.equal(draft.readLocalDraft(raw, now), null);
  }
});

test('review returns to the earliest unconfirmed edit but accepts confirmed drafts', () => {
  assert.equal(draft.unconfirmedDraftStep([{ step: 2, fields: { contactFullName: 'New' }, confirmed_fields: { contactFullName: 'Old' } }, { step: 1, fields: { legalBusinessName: 'Partial' }, confirmed_fields: null }]), 1);
  assert.equal(draft.unconfirmedDraftStep([{ step: 2, fields: { b: '2', a: '1' }, confirmed_fields: { a: '1', b: '2' } }]), null);
});
