// =============================================================================
// Datei: tests/settings-module-input-v153.test.mjs
// Zweck: Reale Eingabe- und Konfliktpfade der Modul-/Shortcut-Einstellungen
//        prüfen. Keine Spotify- oder Browser-Speicherdaten werden verändert.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { loadPureSharedModule } from './helpers/load-ts-module.mjs';
import { compileTsxForTest } from './helpers/compile-tsx-for-test.mjs';

const root = path.resolve(import.meta.dirname, '..');
const order = loadPureSharedModule(root, 'src/shared/feature-order.ts');

for (const [input, expected] of [['0', 0], ['1', 1], ['500', 500], ['10000', 10000], [' 123 ', 123]]) {
  test(`Modul-Sortierwert: ${JSON.stringify(input)} wird zu ${expected}`, () => {
    assert.equal(order.parseFeatureOrderDraft(input), expected);
  });
}

test('Modul-Sortierung: unvollständige/ungültige Eingaben ersetzen keinen gespeicherten Wert', () => {
  for (const value of ['', ' ', '-1', '10001', '1.2', '1e3', '1,2', 'NaN', 'Infinity', '+5', '1a']) {
    assert.equal(order.parseFeatureOrderDraft(value), null, value);
  }
  assert.equal(order.parseFeatureOrderDraft('999999999999999999999999'), null);
});

test('FeatureManager speichert Zahlen erst nach dem Verlassen und erlaubt Abbrechen', () => {
  const file = readFileSync(path.join(root, 'src/custom-app/modules/settings/FeatureManager.tsx'), 'utf8');
  assert.match(file, /value=\{orderDrafts\[definition\.id\]/);
  assert.match(file, /onBlur=\{handleOrderBlur\}/);
  assert.match(file, /onKeyDown=\{handleOrderKey\}/);
  assert.doesNotMatch(file, /order:\s*event\.target\.valueAsNumber/); // kein NaN mehr aus leeren Feldern
});

// Minimale React-Testumgebung: React-Hooks laufen tatsächlich, während die
// Eventhandler in der JS-Darstellung der TSX-Komponente aufgerufen werden.
function shortcutHarness() {
  const compiled = compileTsxForTest(root, 'src/custom-app/modules/settings/KeyboardShortcutsSettings.tsx');
  const defs = [
    { id: 'play-pause', defaultCodes: ['AltLeft', 'KeyP'] },
    { id: 'next-track', defaultCodes: ['AltLeft', 'ArrowRight'] },
  ];
  let bindings = Object.fromEntries(defs.map(d => [d.id, { codes: [...d.defaultCodes] }]));
  const listeners = new Map();
  const hooks = [];
  let cursor = 0;
  let pending = [];
  const same = (a, b) => a?.length === b?.length && a.every((item, i) => item === b[i]);
  const runtime = {
    Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: { current: initial } };
      return hooks[index].value;
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!hooks[index] || !same(hooks[index].deps, deps)) hooks[index] = { value: callback, deps };
      return hooks[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!hooks[index] || !same(hooks[index].deps, deps)) {
        hooks[index]?.cleanup?.();
        pending.push(() => { hooks[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const exports = {};
  const ctx = {
    exports, Spicetify: { React: runtime },
    window: { addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: (name, cb) => { if (listeners.get(name) === cb) listeners.delete(name); } },
    require: specifier => {
      if (specifier.includes('shared/settings')) return {loadSettings: () => ({keyboardShortcuts: bindings})};
      if (specifier.includes('keyboard-shortcuts')) return {
        KEYBOARD_SHORTCUT_DEFINITIONS: defs,
        findKeyboardShortcutConflict(id, codes, values) {
          if (!codes.length) return null;
          const signature = list => [...list].sort().join('|');
          return Object.keys(values).find(other => other !== id && signature(values[other].codes) === signature(codes)) ?? null;
        },
      };
      throw Error(`Unbekannter Laufzeitimport ${specifier}`);
    },
  };
  runInNewContext(compiled, ctx, { filename: 'KeyboardShortcutsSettings.js', timeout: 2000 });
  function render() {
    cursor = 0; pending = [];
    const tree = exports.KeyboardShortcutsSettings({
      keyboardShortcuts: bindings, t: key => key,
      onBack() {}, onChange: change => { bindings = change.keyboardShortcuts; },
    });
    for (const callback of pending) callback();
    return tree;
  }
  function all(tree, filter) {
    const found = [];
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      if (filter(node)) found.push(node);
      visit(node.props?.children);
    }
    visit(tree);
    return found;
  }
  function clickButton(tree, caption, nth = 0) {
    const buttons = all(tree, element => element.type === 'button' &&
      all(element.props.children, item => typeof item === 'object').length === 0 &&
      element.props.children.includes(caption));
    assert.ok(buttons[nth], `Button ${caption} vorhanden`);
    buttons[nth].props.onClick();
  }
  function key(code) {
    const handler = listeners.get('keydown');
    assert.ok(handler, `Aufnahme-Listener für ${code} registriert`);
    handler({ code, repeat: false, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} });
  }
  return { render, clickButton, key, get bindings() { return bindings; }, get listening() { return listeners.has('keydown'); }, all };
}

test('Shortcut-Aufnahme: ein Konflikt lässt die Aufnahme für den nächsten Versuch offen', () => {
  const h = shortcutHarness();
  h.clickButton(h.render(), 'shortcuts.edit', 1); // zweiten Shortcut bearbeiten
  h.render();
  h.key('AltLeft'); h.key('KeyP'); // schon für Play/Pause belegt
  const tree = h.render();
  assert.equal(h.listening, true);
  assert.ok(h.all(tree, e => e.props?.role === 'alert').length > 0);
  assert.deepEqual(h.bindings['next-track'].codes, ['AltLeft', 'ArrowRight']);
  // Neuer Versuch ohne erneut auf Bearbeiten klicken zu müssen.
  h.key('AltLeft'); h.key('KeyQ');
  h.render();
  assert.equal(h.listening, false);
  assert.deepEqual(Array.from(h.bindings['next-track'].codes), ['AltLeft', 'KeyQ']);
});

test('Shortcut-Aufnahme: Abbrechen löscht den Listener und verändert keine Belegung', () => {
  const h = shortcutHarness();
  h.clickButton(h.render(), 'shortcuts.edit', 0);
  const tree = h.render();
  assert.equal(h.listening, true);
  h.clickButton(tree, 'shortcuts.cancel');
  h.render();
  assert.equal(h.listening, false);
  assert.deepEqual(h.bindings['play-pause'].codes, ['AltLeft', 'KeyP']);
});


test('Shortcut-Aufnahme: Escape bricht ab und beendet den Capture-Listener', () => {
  const h = shortcutHarness();
  h.clickButton(h.render(), 'shortcuts.edit', 0);
  h.render();
  h.key('AltLeft'); h.key('Escape');
  h.render();
  assert.equal(h.listening, false);
  assert.deepEqual(h.bindings['play-pause'].codes, ['AltLeft', 'KeyP']);
});
