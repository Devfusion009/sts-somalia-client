const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the loader's hooks and delegated clicks with a controlled clock.
// Animation callbacks deliberately never fire: dismissal must not need them.
function harness() {
  let state = null;
  let pathname = '/visa';
  let effect;
  let listener;
  let now = 0;
  const timers = new Map();
  let nextTimer = 0;
  const refs = { current: [] };
  class Element {
    constructor(href) { this.href = `https://sts.test${href}`; }
    closest(selector) { return selector === 'a[href]' || selector === '[data-nav-loader]' ? this : null; }
    hasAttribute() { return false; }
  }
  const location = { href: 'https://sts.test/visa', origin: 'https://sts.test', pathname, search: '' };
  const mocks = {
    react: {
      useState: () => [state, value => { state = typeof value === 'function' ? value(state) : value; }],
      useRef: () => refs,
      useEffect: callback => { effect ??= callback; },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams() },
    'motion/react': { AnimatePresence: () => null, motion: {} },
    '@/components/ui/aceternity/motion-primitives': { usePrefersReducedMotion: () => false },
    './nav-loader-art': {},
  };
  const context = {
    exports: {}, require: id => mocks[id], URL, Element,
    window: { location },
    document: {
      addEventListener: (_, callback) => { listener = callback; },
      removeEventListener: () => { listener = null; },
    },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const filename = resolve(__dirname, '../src/components/marketing/nav-loader.tsx');
  vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021 },
  }).outputText, context);
  const render = () => context.exports.NavLoader();
  render();
  const cleanup = effect();
  return {
    render, cleanup,
    click: href => listener({ button: 0, target: new Element(href) }),
    arrive: path => { pathname = path; location.pathname = path; },
    advance: duration => {
      now += duration;
      for (const [id, timer] of timers) {
        if (timer.at <= now) { timers.delete(id); timer.callback(); }
      }
    },
    timerCount: () => timers.size,
  };
}

test('completed navigation removes the overlay without animation callbacks', () => {
  const app = harness();
  app.click('/umrah');
  assert.equal(app.render().props.section, 'umrah');
  app.arrive('/umrah');
  assert.ok(app.render());
  app.advance(650);
  assert.equal(app.render(), null);
  app.cleanup();
  assert.equal(app.timerCount(), 0);
});

test('stalled navigation removes the entire overlay at the timeout', () => {
  const app = harness();
  app.click('/umrah');
  app.advance(7999);
  assert.ok(app.render());
  app.advance(1);
  assert.equal(app.render(), null);
  app.cleanup();
});

test('a subsequent click gets its own timeout and same-page clicks do not load', () => {
  const app = harness();
  app.click('/visa');
  assert.equal(app.render(), null);
  app.click('/umrah');
  app.advance(7000);
  app.click('/hotels');
  app.advance(1000);
  assert.equal(app.render().props.section, 'hotels');
  app.advance(7000);
  assert.equal(app.render(), null);
  app.cleanup();
});
