const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const exports_ = {};
new Function('exports', ts.transpileModule(fs.readFileSync('apps/web/src/app/agent/(portal)/portal-guide-content.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(exports_);
const { agentGuideSteps, parseGuideProgress } = exports_;

test('six ordered lessons have real destinations for every agency role', () => {
  for (const role of ['owner', 'admin', 'booking_staff', 'accountant', 'viewer']) {
    const steps = agentGuideSteps(role);
    assert.deepEqual(steps.map(s => s.id), ['overview', 'account', 'wallet', 'customers', 'booking', 'tracking']);
    for (const step of steps) {
      assert.equal(step.tasks.length, 3);
      const route = step.action.href.replace('/agent', '') || '';
      assert.ok(fs.existsSync(path.join('apps/web/src/app/agent/(portal)', route, 'page.tsx')), step.action.href);
    }
  }
});
test('only owners and admins receive profile setup and top-up actions', () => {
  for (const role of ['owner', 'admin']) {
    const steps = agentGuideSteps(role);
    assert.equal(steps[1].action.href, '/agent/settings');
    assert.equal(steps[2].action.href, '/agent/finance/top-up');
  }
  for (const role of ['booking_staff', 'accountant', 'viewer', 'unknown']) {
    const steps = agentGuideSteps(role);
    assert.equal(steps[1].action.href, '/agent/security');
    assert.equal(steps[2].action.href, '/agent/finance');
  }
});
test('read-only and finance roles are not invited to create bookings', () => {
  for (const role of ['accountant', 'viewer', 'unknown']) {
    const steps = agentGuideSteps(role);
    assert.equal(steps[4].action.href, '/agent/bookings');
    assert.equal(steps[5].action.href, '/agent/bookings');
  }
  assert.equal(agentGuideSteps('booking_staff')[4].action.href, '/agent/book');
});
test('valid saved progress preserves resume, dismissal and completion', () => {
  for (const status of ['in_progress', 'dismissed', 'complete']) {
    assert.deepEqual(parseGuideProgress(JSON.stringify({ status, step: 3 }), 6), { status, step: 3 });
  }
});
test('missing, corrupted and obsolete saved progress starts fresh', () => {
  for (const raw of [null, '', 'bad json', 'null', '{}', '{"status":"bad","step":1}', ...[-1, 6, 1.5, '1', null].map(step => JSON.stringify({ status: 'in_progress', step }))]) {
    assert.equal(parseGuideProgress(raw, 6), null);
  }
});

function mountGuide(saved = null, blockedStorage = false, autoShow = true, seen = false) {
  const react = require('react');
  const key = 'sts:agent-guide:v1:agency:user';
  const storage = new Map(saved ? [[key, JSON.stringify(saved)]] : []);
  if (seen) storage.set(`${key}:seen`, "1");
  const state = [];
  let cursor = 0;
  const timers = [];
  const localStorage = {
    getItem: k => { if (blockedStorage) throw Error('blocked'); return storage.get(k) ?? null; },
    setItem: (k, v) => { if (blockedStorage) throw Error('blocked'); storage.set(k, v); },
  };
  const exported = {};
  const stub = () => null;
  const mockRequire = name => {
    if (name === 'react') return { ...react, useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }];
    }, useEffect: callback => { if (!timers.length) callback(); } };
    if (name === './portal-guide-content') return exports_;
    if (name.endsWith('.css')) return { __esModule: true, default: {} };
    if (name.includes('/ui/dialog')) return { Dialog: stub, DialogContent: stub, DialogTitle: stub, DialogDescription: stub, DialogTrigger: stub };
    if (name === 'next/link') return { __esModule: true, default: stub };
    return require(name);
  };
  new Function('require', 'exports', 'window', 'localStorage', ts.transpileModule(fs.readFileSync('apps/web/src/app/agent/(portal)/portal-guide.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText)(mockRequire, exported, { setTimeout: callback => { timers.push(callback); return 1; }, clearTimeout() {} }, localStorage);
  const render = () => { cursor = 0; return exported.AgentPortalGuide({ userId: 'user', agencyId: 'agency', role: 'owner', autoShow }); };
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const find = (node, label) => {
    if (!node) return null;
    if (Array.isArray(node)) return node.map(n => find(n, label)).find(Boolean);
    if (node.props?.onClick && text(node.props.children) === label) return node;
    return find(node.props?.children, label);
  };
  render(); timers[0]?.();
  return { render, state, progress: () => JSON.parse(storage.get(key) || 'null'), click: label => {
    const target = find(render(), label);
    assert.ok(target, `Missing control: ${label}`);
    target.props.onClick();
  } };
}

test('first visit opens, next and back save progress, skip closes and replay resets', () => {
  const guide = mountGuide();
  assert.equal(guide.render().props.open, true);
  guide.click('Next step');
  assert.deepEqual(guide.progress(), { status: 'in_progress', step: 1 });
  guide.click('Back');
  assert.equal(guide.progress().step, 0);
  guide.click('Skip tour');
  assert.equal(guide.render().props.open, false);
  assert.equal(guide.progress().status, 'dismissed');
  guide.click('Portal guide');
  assert.equal(guide.render().props.open, true);
  assert.deepEqual(guide.progress(), { status: 'in_progress', step: 0 });
});
test('subsequent visits never auto-open, including unfinished tours', () => {
  for (const status of ['in_progress', 'dismissed', 'complete']) {
    assert.equal(mountGuide({ status, step: 3 }).render().props.open, false);
  }
  assert.equal(mountGuide(null, false, true, true).render().props.open, false);
});
test('established agents can open the guide manually without an automatic prompt', () => {
  const guide = mountGuide(null, false, false);
  assert.equal(guide.render().props.open, false);
  guide.click('Portal guide');
  assert.equal(guide.render().props.open, true);
});
test('completion persists and unavailable storage keeps automatic prompts off', () => {
  const guide = mountGuide();
  for (let i = 0; i < 5; i++) guide.click('Next step');
  guide.click('Create a booking');
  assert.deepEqual(guide.progress(), { status: 'complete', step: 5 });
  assert.equal(guide.render().props.open, false);
  const blocked = mountGuide(null, true);
  assert.equal(blocked.render().props.open, false);
  blocked.click('Portal guide');
  assert.equal(blocked.render().props.open, true);
  blocked.click('Next step');
  assert.equal(blocked.state[1], 1);
  blocked.click('Skip tour');
  assert.equal(blocked.render().props.open, false);
});
test('only memberships within the first seven days qualify for an automatic welcome', () => {
  const now = Date.parse('2026-11-27T12:00:00Z');
  for (const joinedAt of ['2026-11-27T12:00:00Z', '2026-11-21T12:00:00Z']) assert.equal(exports_.isNewAgent(joinedAt, now), true);
  for (const joinedAt of ['2026-11-20T12:00:00Z', '2026-10-01T12:00:00Z', '2026-11-28T12:00:00Z', 'invalid']) assert.equal(exports_.isNewAgent(joinedAt, now), false);
});
