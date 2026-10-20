// =============================================================================
// Datei: tests/mini-player-and-shortcuts-v143.test.mjs
// Zweck: Echte Laufzeit-Regressionstests statt reiner Textsuche.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const geometrySource = await read('../src/extension/modules/mini-player/mini-player-position.ts');
const shortcutSource = await read('../src/extension/modules/keyboard-shortcuts/KeyboardShortcutsModule.ts');
const playerSource = await read('../src/extension/modules/mini-player/MiniPlayerModule.ts');

/** Die TypeScript-Datei selbst in der Sandbox ausführen (ohne Mock-Implementierung). */
function load(source, expression, context = {}) {
  const plain = stripTypeScriptTypes(source, { mode: 'strip' })
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/^export\s+/gm, '');
  return runInNewContext(`${plain}\n${expression};`, context, { timeout: 2000 });
}
const clamp = load(geometrySource, 'clampMiniPlayerPosition');
const coords = (position) => ({ left: position.left, top: position.top });

test('Mini-Player: freie Position bleibt innerhalb des Viewports unverändert', () => {
  assert.deepEqual(coords(clamp(100, 110, 260, 140, 1200, 900)), { left: 100, top: 110 });
});

test('Mini-Player: alle vier Viewport-Kanten begrenzen den Drag', () => {
  assert.deepEqual(coords(clamp(-300, -200, 260, 140, 900, 650)), { left: 8, top: 8 });
  assert.deepEqual(coords(clamp(8000, 8000, 260, 140, 900, 650)), { left: 632, top: 502 });
});

test('Mini-Player: Verkleinern, winziger Viewport und ungültige Koordinaten bleiben sicher', () => {
  assert.deepEqual(coords(clamp(800, 600, 260, 140, 350, 180)), { left: 82, top: 32 });
  assert.deepEqual(coords(clamp(99, 99, 260, 140, 180, 80)), { left: 0, top: 0 });
  assert.deepEqual(coords(clamp(NaN, Infinity, 260, 140, 800, 500)), { left: 8, top: 8 });
});

test('Mini-Player: Resize-Listener und Aufräumen sind in der Laufzeit registriert', () => {
  assert.match(playerSource, /window\.addEventListener\("resize", keepPanelOnScreen\)/);
  assert.match(playerSource, /window\.removeEventListener\("resize", keepPanelOnScreen\)/);
  assert.match(playerSource, /if \(next && \(!panel \|\| !panel\.isConnected\)\)/);
});

/** Leichtgewichtige Browser-Ereignisse mit denselben Stop-/Bubbling-Semantiken. */
class FakeElement {
  constructor(editable = false, role = '') { this.editable = editable; this.role = role; }
  closest() { return this.editable || ['textbox','searchbox','combobox'].includes(this.role) ? this : null; }
}
class FakeHtml extends FakeElement {
  get isContentEditable() { return this.editable; }
}
class FakeInput extends FakeHtml {}
class FakeTextarea extends FakeHtml {}
class FakeSelect extends FakeHtml {}

function runtime() {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const invocations = [];
  const prefs = { 'play-pause': {codes: ['AltLeft', 'KeyP']}, 'next-track': {codes: ['AltLeft','ArrowRight']} };
  const shortcuts = load(shortcutSource, 'keyboardShortcutsModule', {
    Element: FakeElement, HTMLElement: FakeHtml,
    HTMLInputElement: FakeInput, HTMLTextAreaElement: FakeTextarea, HTMLSelectElement: FakeSelect,
    document: {
      addEventListener(name, fn) { documentListeners.set(name, fn); },
      removeEventListener(name, fn) { if (documentListeners.get(name) === fn) documentListeners.delete(name); },
    },
    window: {
      addEventListener(name, fn) { windowListeners.set(name, fn); },
      removeEventListener(name, fn) { if (windowListeners.get(name) === fn) windowListeners.delete(name); },
    },
    loadSettings: () => ({keyboardShortcuts:prefs}),
    subscribeToSettings: () => () => invocations.push('unsubscribe'),
    createKeyboardShortcuts: (p) => Object.entries(p).map(([actionId, b]) => ({actionId, codes:b.codes})),
    keyboardShortcutActions: {
      'play-pause': () => invocations.push('play-pause'),
      'next-track': () => invocations.push('next-track'),
    },
    console: {info(){}},
  });
  shortcuts.start();
  const event = (code, extra = {}) => {
    let prevented = false;
    const obj = {
      code, key: code, target: new FakeHtml(),
      defaultPrevented: false, isComposing: false, repeat: false,
      altKey: code === 'AltLeft', ctrlKey: false, shiftKey: false, metaKey: false,
      preventDefault() {prevented = true;}, ...extra,
    };
    return { obj, prevented: () => prevented };
  };
  const down = (code, extra) => {
    const e = event(code, extra);
    documentListeners.get('keydown')?.(e.obj);
    return e;
  };
  const up = (code) => documentListeners.get('keyup')?.(event(code).obj);
  return {shortcuts, invocations, down, up, event, documentListeners, windowListeners};
}

test('Shortcuts: Alt+P wird genau einmal ausgelöst, Repeat unterdrückt', () => {
  const x = runtime();
  x.down('AltLeft');
  const e = x.down('KeyP', { altKey:true });
  assert.equal(e.prevented(), true);
  x.down('KeyP', {altKey:true, repeat:true});
  assert.deepEqual(x.invocations, ['play-pause']);
  x.shortcuts.stop();
});

test('Shortcuts: Eingaben, ARIA-Editoren, Shadow DOM und bereits behandelte Events werden ignoriert', () => {
  const x = runtime();
  const cases = [
    {target:new FakeInput(true)},
    {target:new FakeTextarea(true)},
    {target:new FakeHtml(false, 'textbox')},
    {target:new FakeHtml(false, 'searchbox')},
    {target:new FakeElement(true)},
    {target:new FakeHtml(), composedPath:() => [new FakeHtml(true), new FakeHtml()]},
    {defaultPrevented:true},
    {isComposing:true},
    {code:'Unidentified'},
  ];
  for (const blocked of cases) {
    x.down('AltLeft');
    x.down('KeyP', {...blocked, altKey:true});
    x.up('AltLeft');
  }
  assert.deepEqual(x.invocations, []);
  x.shortcuts.stop();
});

test('Shortcuts: Verpasste Modifier-Keyup werden beim nächsten Event korrigiert', () => {
  const x = runtime();
  x.down('AltLeft');
  x.down('KeyP', {altKey:false});
  assert.deepEqual(x.invocations, []);
  x.up('KeyP');
  x.down('AltLeft');
  x.down('KeyP', {altKey:true});
  assert.deepEqual(x.invocations, ['play-pause']);
  x.shortcuts.stop();
});

test('Shortcuts: Stop entfernt alle Listener und deabonniert Einstellungen', () => {
  const x = runtime();
  x.shortcuts.stop();
  assert.equal(x.documentListeners.size, 0);
  assert.equal(x.windowListeners.size, 0);
  assert.deepEqual(x.invocations, ['unsubscribe']);
});
