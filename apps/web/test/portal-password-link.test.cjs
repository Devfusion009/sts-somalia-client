const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function renderLink(origin, props = {}) {
  const exported = {};
  const stub = () => null;
  const mockRequire = id => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...p }) => React.createElement('a', p, children) };
    if (id === '@/lib/subdomain') return { rootOrigin: () => origin };
    if (id === '@/components/ui/field') return { FieldLabel: ({ children }) => React.createElement('label', {}, children) };
    if (id.startsWith('@/') || id === './auth-frame') return new Proxy({}, { get: () => stub });
    return require(id);
  };
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync('apps/web/src/components/auth/portal-login-form.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText)(mockRequire, exported);
  return renderToStaticMarkup(React.createElement(exported.PasswordLabelRow, props));
}
test('portal password recovery points at the working public recovery route', () => {
  assert.match(renderLink('https://scoutsts.com'), /href="https:\/\/scoutsts.com\/forgot-password"/);
});
test('local recovery remains relative and agent or manager overrides remain intact', () => {
  assert.match(renderLink(''), /href="\/forgot-password"/);
  assert.match(renderLink('https://scoutsts.com', { forgotHref: '/agent/forgot-password' }), /href="\/agent\/forgot-password"/);
});
