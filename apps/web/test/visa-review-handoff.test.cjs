const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('module','exports',ts.transpileModule(readFileSync(resolve(__dirname,'../src/modules/visa/review-handoff.ts'),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod,mod.exports);
const { visaReviewHandoff } = mod.exports;
test('confirmed payments lead submitted and reviewing cases to document review', () => {
  for (const stage of ['submitted','in_review']) {
    const next = visaReviewHandoff(stage,'paid');
    assert.equal(next.tab,'documents');
    assert.equal(next.label,'Review documents');
    assert.match(next.message,/Payment received/);
  }
});
test('an accepted deposit is described accurately under the existing review policy', () => {
  assert.match(visaReviewHandoff('submitted','partially_paid').message,/Deposit received/);
});
test('unpaid cases and cases beyond review never show a misleading payment-to-review prompt', () => {
  for (const payment of ['pending','not_billed','refunded','failed',null]) assert.equal(visaReviewHandoff('submitted',payment),null);
  for (const stage of ['draft','additional_info_required','ready_for_processing','processing','approved','issued','rejected','cancelled',null]) assert.equal(visaReviewHandoff(stage,'paid'),null);
});
