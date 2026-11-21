const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const YAML = require('yaml');
const { validatePreviewUrl } = require('../validate-preview-url.cjs');
const root = resolve(__dirname, '../..');
const workflow = (name) => YAML.parse(readFileSync(resolve(root, '.github/workflows', name), 'utf8'));
const releases = [
  ['deploy.yml', 'main', 'QA deployment'],
  ['deploy-production.yml', 'production', 'Production deployment'],
  ['client_impression.yml', 'client_impression', 'client_impression'],
];

for (const [file, branch, name] of releases) {
  test(`${name}: only the intended branch can deploy, including manual runs`, () => {
    const w = workflow(file);
    assert.equal(w.name, name);
    assert.deepEqual(w.on.push.branches, [branch]);
    assert.equal(w.on.pull_request, undefined);
    assert.match(w.jobs.verify.if, new RegExp(`github.ref == 'refs/heads/${branch}'`));
    assert.equal(w.jobs.verify.uses, './.github/workflows/ci.yml');
    for (const [jobName, job] of Object.entries(w.jobs)) {
      if (jobName === 'verify') continue;
      const needs = [].concat(job.needs ?? []);
      assert.ok(needs.length, `${jobName} must depend on quality checks or a gated build`);
      assert.ok(needs.every(n => w.jobs[n]), `${jobName} references unknown jobs`);
      assert.doesNotMatch(job.if ?? '', /always\(|failure\(|cancelled\(/);
    }
    assert.equal(w.concurrency['cancel-in-progress'], false);
  });
}

test('Vercel auto-deploy is disabled; only Actions may deploy after quality checks', () => {
  const cfg = JSON.parse(readFileSync(resolve(root, 'apps/web/vercel.json'), 'utf8'));
  assert.deepEqual(cfg.git.deploymentEnabled, { '*': false });
  assert.equal(cfg.env.DEPLOYMENT_ENV, 'preview');
  assert.equal(cfg.env.CUSTOMER_GOOGLE_LOGIN_ENABLED, 'false');
  const w = workflow('client_impression.yml');
  const job = w.jobs.deploy;
  assert.equal(job.needs, 'verify');
  assert.equal(job.if, "github.ref == 'refs/heads/client_impression'");
  const commands = job.steps.map(s => s.run ?? '').join('\n');
  assert.match(commands, /deploy --yes --target=preview/);
  assert.doesNotMatch(commands, /--prod\b|--target[= ]production|vercel promote/);
  assert.match(commands, /vercel alias set/);
  assert.equal(job.env.PREVIEW_ALIAS, 'stssomaliaclient-git-fea-d257c9-sasmalsubhadip80-6309s-projects.vercel.app');
});

test('shared quality checks cover all three PR targets and regression suites', () => {
  const w = workflow('ci.yml');
  assert.deepEqual(w.on.pull_request.branches, ['main', 'production', 'client_impression']);
  assert.ok(Object.hasOwn(w.on, 'workflow_call'));
  assert.ok(w.jobs['deployment-policy']);
  const api = w.jobs.api.steps.map(s => s.run ?? '').join('\n');
  const web = w.jobs.web.steps.map(s => s.run ?? '').join('\n');
  assert.match(api, /umrah-capacity-integration/);
  assert.match(api, /my-bookings-page-integration/);
  assert.match(web, /tsc --noEmit/);
  assert.match(web, /google-customer-auth/);
  assert.match(web, /pool-email/);
  assert.match(web, /npm run lint/);
});

test('all workflow documents parse and embedded GitHub scripts compile', () => {
  for (const file of readdirSync(resolve(root, '.github/workflows')).filter(f => f.endsWith('.yml'))) {
    const w = workflow(file);
    assert.ok(w.on && w.jobs, file);
    for (const job of Object.values(w.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/github-script@')) {
          new Function('github', 'context', 'core', `return async () => {${step.with.script}}`);
        }
      }
    }
  }
});

test('deployment output rejects foreign hosts, credentials, injection and non-HTTPS URLs', () => {
  assert.equal(validatePreviewUrl('https://stssomaliaclient-test.vercel.app\n'), 'https://stssomaliaclient-test.vercel.app');
  for (const value of [
    'http://stssomaliaclient-test.vercel.app',
    'https://attacker.vercel.app',
    'https://stssomaliaclient-test.vercel.app.evil.com',
    'https://user:secret@stssomaliaclient-test.vercel.app',
    'https://stssomaliaclient-test.vercel.app/path',
    'https://stssomaliaclient-test.vercel.app?token=x',
    'https://stssomaliaclient-test.vercel.app\nurl=evil',
  ]) assert.throws(() => validatePreviewUrl(value), value);
});
