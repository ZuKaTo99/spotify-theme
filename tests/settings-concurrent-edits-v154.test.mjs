// =============================================================================
// Datei: tests/settings-concurrent-edits-v154.test.mjs
// Zweck: Schnelle Einstellungen müssen sich auf den zuletzt gespeicherten
//        Zustand beziehen – auch ohne dazwischenliegendes React-Render.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** Lädt den tatsächlichen TSX-Eventhandler in eine isolierte React-Simulation. */
function loadComponent(filename, stubs, runtime) {
  const compiled = compileTsxForTest(root, filename);
  const exports = {};
  runInNewContext(compiled, {
    exports, Spicetify: { React: runtime },
    require: name => {
      const key = Object.keys(stubs).find(fragment => name.includes(fragment));
      if (!key) throw Error(`Nicht unterstützter Import: ${name}`);
      return stubs[key];
    },
  }, { timeout: 2000 });
  return exports;
}

/** Ein minimales React-Test-DOM, das Eventhandler unverändert ausführt. */
function reactElements() {
  return {
    Fragment: Symbol("Fragment"),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
  };
}

function findNodes(node, predicate, results = []) {
  if (Array.isArray(node)) { node.forEach(child => findNodes(child, predicate, results)); return results; }
  if (!node || typeof node !== "object") return results;
  if (predicate(node)) results.push(node);
  findNodes(node.props?.children, predicate, results);
  return results;
}

test("FeatureManager: zwei schnelle Modulschalter überschreiben sich nicht", () => {
  const defs = [
    { id: "dashboard", required: false, customizableTitle: true, surface: "custom-app" },
    { id: "favorites", required: false, customizableTitle: true, surface: "custom-app" },
  ];
  let stored = Object.fromEntries(defs.map(d => [d.id, { enabled: true, order: 10, customTitle: "" }]));
  const initialProps = structuredClone(stored); // absichtlich veralteter React-Snapshot
  const runtime = reactElements();
  const component = loadComponent("src/custom-app/modules/settings/FeatureManager.tsx", {
    "feature-order": { parseFeatureOrderDraft: value => Number(value) },
    "shared/settings": { loadSettings: () => ({ features: stored }) },
    "feature-titles": { getFeatureTitle: id => id, getDefaultFeatureTitle: id => id },
    "shared/features": { getFeaturesBySurface: surface => defs.filter(d => d.surface === surface) },
  }, runtime).FeatureManager;
  const tree = component({
    features: initialProps, t: key => key,
    onChange: changes => { stored = changes.features; },
  });
  const toggles = findNodes(tree, element => element.type === "input" && element.props?.type === "checkbox");
  assert.equal(toggles.length, 2);
  toggles[0].props.onChange({ target: { checked: false } });
  toggles[1].props.onChange({ target: { checked: false } });
  assert.equal(stored.dashboard.enabled, false);
  assert.equal(stored.favorites.enabled, false);
});

test("Shortcut-Einstellungen: zwei schnelle Löschaktionen bleiben beide erhalten", () => {
  const defs = [
    { id: "play-pause", defaultCodes: ["AltLeft", "KeyP"] },
    { id: "next-track", defaultCodes: ["AltLeft", "ArrowRight"] },
  ];
  let stored = Object.fromEntries(defs.map(d => [d.id, { codes: [...d.defaultCodes] }]));
  const snapshot = structuredClone(stored);
  const runtime = { ...reactElements(),
    useRef: initial => ({ current: initial }),
    useCallback: fn => fn,
    useEffect: () => {},
  };
  const component = loadComponent("src/custom-app/modules/settings/KeyboardShortcutsSettings.tsx", {
    "shared/settings": { loadSettings: () => ({ keyboardShortcuts: stored }) },
    "keyboard-shortcuts": {
      KEYBOARD_SHORTCUT_DEFINITIONS: defs,
      findKeyboardShortcutConflict: (actionId, codes, bindings) => {
        if (!codes.length) return null;
        const signature = keys => [...keys].sort().join("|");
        return Object.keys(bindings).find(other => other !== actionId &&
          signature(bindings[other].codes) === signature(codes)) ?? null;
      },
    },
  }, runtime).KeyboardShortcutsSettings;
  const tree = component({ keyboardShortcuts: snapshot, t: key => key,
    onBack() {}, onChange: change => { stored = change.keyboardShortcuts; } });
  const buttons = findNodes(tree, e => e.type === "button" &&
    e.props?.children?.includes("shortcuts.clear"));
  assert.equal(buttons.length, 2);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(Array.from(stored["play-pause"].codes), []);
  assert.deepEqual(Array.from(stored["next-track"].codes), []);
});

test("Shortcut-Einstellungen: Konflikte mit zwischenzeitlich gespeicherten Belegungen erkennen", () => {
  const defs = [
    { id: "play-pause", defaultCodes: ["AltLeft", "KeyP"] },
    { id: "next-track", defaultCodes: ["AltLeft", "ArrowRight"] },
  ];
  let stored = Object.fromEntries(defs.map(d => [d.id, { codes: [...d.defaultCodes] }]));
  const snapshot = structuredClone(stored);
  const runtime = { ...reactElements(), useRef: initial => ({ current: initial }),
    useCallback: fn => fn, useEffect: () => {} };
  const component = loadComponent("src/custom-app/modules/settings/KeyboardShortcutsSettings.tsx", {
    "shared/settings": { loadSettings: () => ({ keyboardShortcuts: stored }) },
    "keyboard-shortcuts": {
      KEYBOARD_SHORTCUT_DEFINITIONS: defs,
      findKeyboardShortcutConflict: (id, codes, bindings) => Object.keys(bindings).find(other =>
        other !== id && codes.length > 0 &&
        [...bindings[other].codes].sort().join("|") === [...codes].sort().join("|")) ?? null,
    },
  }, runtime).KeyboardShortcutsSettings;
  const tree = component({ keyboardShortcuts: snapshot, t: key => key,
    onBack() {}, onChange: change => { stored = change.keyboardShortcuts; } });
  // Eine andere Aktion belegt zwischen Render und Klick die Standardkombination.
  stored = { ...stored, "next-track": { codes: ["AltLeft", "KeyP"] },
    "play-pause": { codes: [] } };
  const resets = findNodes(tree, e => e.type === "button" &&
    e.props?.children?.includes("shortcuts.reset"));
  resets[0].props.onClick();
  assert.deepEqual(Array.from(stored["play-pause"].codes), []); // Konflikt -> kein Speichern
  assert.deepEqual(stored["next-track"].codes, ["AltLeft", "KeyP"]);
});
