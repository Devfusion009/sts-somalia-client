const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const file = resolve(__dirname, '../src/modules/hotels/components/manager-permission-controls.tsx');
const permissions = [{ key: 'bookings', label: 'Bookings' }, { key: 'photos', label: 'Photos' }];

function render({ state = null, pending = false, granted = ['bookings'], propertyField = 'hotelId' } = {}) {
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  const original = mod.require.bind(mod);
  const action = async () => ({ error: null });
  const dispatch = () => {};
  let actionStates = 0;
  mod.require = id => id === 'react'
    ? { ...React, useActionState(received) { assert.equal(received, action); actionStates++; return [state, dispatch, pending]; } }
    : id === '@/lib/utils' ? { cn: (...classes) => classes.filter(Boolean).join(' ') }
      : original(id);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
  const tree = mod.exports.ManagerPermissionControls({ action, propertyField, propertyId: 'own-property', managerId: 'assigned-manager', grantedPermissions: granted, permissions });
  const nodes = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
  return { nodes: nodes(tree), dispatch, actionStates };
}

for (const propertyField of ['hotelId', 'venueId']) {
  test(`${propertyField}: toggles only the selected permission and retains assignment scope`, () => {
    const { nodes } = render({ propertyField });
    const forms = nodes.filter(node => node.type === 'form');
    const inputs = form => React.Children.toArray(form.props.children).filter(node => node.type === 'input');
    for (const form of forms) {
      assert.equal(inputs(form).find(node => node.props.name === propertyField).props.value, 'own-property');
      assert.equal(inputs(form).find(node => node.props.name === 'managerId').props.value, 'assigned-manager');
    }
    assert.deepEqual(inputs(forms[0]).filter(node => node.props.name === 'permissions').map(node => node.props.value), []);
    assert.deepEqual(inputs(forms[1]).filter(node => node.props.name === 'permissions').map(node => node.props.value), ['bookings', 'photos']);
    assert.deepEqual(nodes.filter(node => node.type === 'button').map(node => node.props['aria-pressed']), [true, false]);
  });
}

test('one pending state disables every permission control in this manager assignment', () => {
  const { nodes, dispatch, actionStates } = render({ pending: true });
  assert.equal(actionStates, 1);
  const fieldset = nodes.find(node => node.type === 'fieldset');
  assert.equal(fieldset.props.disabled, true);
  assert.equal(fieldset.props['aria-busy'], true);
  for (const form of nodes.filter(node => node.type === 'form')) assert.equal(form.props.action, dispatch);
});

test('failed updates expose the server error and leave controls available for retry', () => {
  const { nodes } = render({ state: { error: 'Permission update failed.' } });
  assert.equal(nodes.find(node => node.props.role === 'alert').props.children, 'Permission update failed.');
  assert.equal(nodes.find(node => node.type === 'fieldset').props.disabled, false);
});

test('refreshed permissions are reflected without stale local selection', () => {
  const { nodes } = render({ state: { error: null }, granted: ['photos'] });
  assert.deepEqual(nodes.filter(node => node.type === 'button').map(node => node.props['aria-pressed']), [false, true]);
  assert.equal(nodes.some(node => node.props.role === 'alert'), false);
});
