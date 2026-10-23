// =============================================================================
// Datei: tests/playlist-workbench-v162.test.mjs
// Zweck: Reale Auswahl-, Sortier- und Versand-Callbacks des Playlist-Workbenchs.
// Kein Spotify-Konto, kein DOM und keine produktiven Daten nötig.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const song = n => `spotify:track:${String(n).padStart(22, "0")}`;
const episode = n => `spotify:episode:${String(n).padStart(22, "0")}`;
const asArray = values => Array.from(values);

test("Sortierung behält gültige Titel genau einmal und ignoriert fremde Einträge", () => {
  const input = [song(1), song(2), song(3)];
  const reordered = api.orderPastedTracks(input, [song(3), "malicious", song(3), song(1)]);
  assert.deepEqual(asArray(reordered), [song(3), song(1), song(2)]);
  assert.deepEqual(input, [song(1), song(2), song(3)]);
});

test("Einzelne Verschiebung tauscht nur Nachbarn", () => {
  const input = [song(1), song(2), song(3)];
  assert.deepEqual(asArray(api.movePastedTrack(input, song(2), -1)), [song(2), song(1), song(3)]);
  assert.deepEqual(asArray(api.movePastedTrack(input, song(2), 1)), [song(1), song(3), song(2)]);
  assert.deepEqual(asArray(api.movePastedTrack(input, song(1), -1)), input);
  assert.deepEqual(asArray(api.movePastedTrack(input, "bad", 1)), input);
  assert.deepEqual(input, [song(1), song(2), song(3)]);
});

test("Auswahl verwendet die geänderte Reihenfolge, ohne Quellen zu verändern", () => {
  const ordered = [episode(4), song(3), song(2), song(1)];
  assert.deepEqual(asArray(api.selectedPastedTracks(ordered, [song(3), "old-state"])),
    [episode(4), song(2), song(1)]);
  assert.deepEqual(ordered, [episode(4), song(3), song(2), song(1)]);
});

test("500 Einträge bleiben auf 17 Seiten zu höchstens 30 erreichbar", () => {
  const input = Array.from({length: 500}, (_, i) => song(i));
  const pages = [];
  for (let i = 0; i < 17; i++) {
    const page = api.pagePastedTracks(input, "", i);
    assert.equal(page.pages, 17);
    assert.ok(page.items.length <= 30);
    pages.push(...page.items);
  }
  assert.deepEqual(asArray(pages), input);
});

test("Suche und ungültige Seitenzahlen verändern nie die Gesamtmenge", () => {
  const input = [song(10), episode(1), song(1)];
  assert.deepEqual(asArray(api.pagePastedTracks(input, "EPISODE", 99).items), [episode(1)]);
  assert.equal(api.pagePastedTracks(input, "", Infinity).page, 0);
  assert.equal(api.pagePastedTracks(input, "", -15).page, 0);
  assert.equal(api.pagePastedTracks(input, "nichts", 2).pages, 0);
  assert.deepEqual(input, [song(10), episode(1), song(1)]);
});

function mount(raw) {
  const exports = {};
  const state = [raw, false];
  let cursor = 0;
  const sent = [];
  let confirmations = 0;
  let confirmAllowed = true;
  const react = {
    createElement: (type, props, ...children) => ({type, props:{...props, children}}),
    useState: initial => {
      const index = cursor++;
      if (state[index] === undefined) state[index] = initial;
      return [state[index], next => {state[index] = typeof next === "function" ? next(state[index]) : next;}];
    },
    useRef: initial => ({current: initial}),
  };
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/BulkLinkImporter.tsx"), {
    exports,
    Spicetify: {React:react},
    window: {confirm: () => {confirmations++; return confirmAllowed;}},
    require: spec => {
      if (spec.includes("spotify-playlist-transfer")) return api;
      if (spec.includes("PlaylistDestination")) return {PlaylistDestination:()=>null};
      throw new Error(`Unerwarteter Runtime-Import: ${spec}`);
    },
  }, {timeout: 5000});
  function walk(node, found = []) {
    if (Array.isArray(node)) {for (const child of node) walk(child, found); return found;}
    if (node && typeof node === "object") {found.push(node); walk(node.props?.children, found);}
    return found;
  }
  const render = () => {cursor=0; return exports.BulkLinkImporter({t:key=>key, onQueue:async uris => {sent.push(asArray(uris));}});};
  const button = (tree, key) => walk(tree).find(n=>n.type==="button" && n.props?.children?.includes(key));
  const checkboxes = tree => walk(tree).filter(n=>n.type==="input" && n.props?.type==="checkbox");
  const inputs = tree => walk(tree).filter(n=>n.type==="input" && n.props?.type==="search");
  const move = (tree, label) => walk(tree).find(n=>n.type==="button" && n.props?.["aria-label"]===label);
  const playlistProps = tree => walk(tree).find(n=>typeof n.type === "function" && n.type.name === "PlaylistDestination")?.props;
  return {render, button, checkboxes, inputs, move, playlistProps, sent, state,
    get confirmations(){return confirmations;}, setConfirm(value){confirmAllowed=value;}};
}

test("UI: Abwählen eines Titels beschränkt Queue UND Playlist auf dieselbe Auswahl", async () => {
  const ui = mount([song(1),song(2),song(3)].join("\n"));
  const before = ui.render();
  assert.equal(ui.checkboxes(before).length, 3);
  ui.checkboxes(before)[1].props.onChange();
  const after = ui.render();
  assert.deepEqual(asArray(ui.playlistProps(after).uris), [song(1),song(3)]);
  ui.button(after, "playlistPaste.queue").props.onClick();
  await Promise.resolve();
  assert.deepEqual(ui.sent, [[song(1),song(3)]]);
});

test("UI: Auswahl aufheben blockiert beide Versandarten, Alle setzt sie zurück", () => {
  const ui=mount([song(1),song(2)].join("\n"));
  ui.button(ui.render(),"playlistPaste.selectNone").props.onClick();
  let tree=ui.render();
  assert.equal(ui.button(tree,"playlistPaste.queue").props.disabled,true);
  assert.deepEqual(asArray(ui.playlistProps(tree).uris), []);
  ui.button(tree,"playlistPaste.selectAll").props.onClick();
  tree=ui.render();
  assert.equal(ui.button(tree,"playlistPaste.queue").props.disabled,false);
  assert.deepEqual(asArray(ui.playlistProps(tree).uris),[song(1),song(2)]);
});

test("UI: echte Pfeil-Aktion ändert die Reihenfolge ohne Duplikat", async () => {
  const ui=mount([song(1),song(2),song(3)].join("\n"));
  const button=ui.move(ui.render(),"playlistPaste.moveItemUp");
  // Textübersetzung im Test ist die Key-Zeichenkette, nicht die URI.
  assert.equal(button.props.disabled,true);
  const tree=ui.render();
  const all=[];
  function scan(n) {if(Array.isArray(n)) return n.forEach(scan); if(n&&typeof n==="object") {if(n.type==="button"&&n.props?.title==="playlistPaste.moveUp") all.push(n);scan(n.props?.children);}}
  scan(tree);
  assert.equal(all.length,3);
  all[1].props.onClick();
  const after=ui.render();
  assert.deepEqual(asArray(ui.playlistProps(after).uris),[song(2),song(1),song(3)]);
  ui.button(after,"playlistPaste.queue").props.onClick();
  await Promise.resolve();
  assert.deepEqual(ui.sent, [[song(2),song(1),song(3)]]);
});

test("UI: Filter ändert nicht die gewählten Titel für den Versand", () => {
  const ui=mount([song(1),episode(2),song(3)].join("\n"));
  ui.inputs(ui.render())[0].props.onChange({currentTarget:{value:"episode"}});
  const after=ui.render();
  assert.equal(ui.checkboxes(after).length,1);
  assert.deepEqual(asArray(ui.playlistProps(after).uris),[song(1),episode(2),song(3)]);
});

test("UI: Seitennavigation zeigt maximal 30 Titel, Auswahl bleibt bestehen", () => {
  const ui=mount(Array.from({length:55},(_,i)=>song(i)).join("\n"));
  let tree=ui.render();
  assert.equal(ui.checkboxes(tree).length,30);
  ui.checkboxes(tree)[0].props.onChange();
  ui.button(ui.render(),"playlistPaste.next").props.onClick();
  tree=ui.render();
  assert.equal(ui.checkboxes(tree).length,25);
  assert.equal(ui.playlistProps(tree).uris.length,54);
});

test("UI: nur Auswahl übernehmen verlangt Bestätigung und verändert nicht Spotify", () => {
  const ui=mount([song(1),"broken",song(2)].join("\n"));
  ui.checkboxes(ui.render())[1].props.onChange();
  ui.setConfirm(false);
  ui.button(ui.render(),"playlistPaste.keepOnly").props.onClick();
  assert.ok(ui.state[0].includes("broken"));
  ui.setConfirm(true);
  ui.button(ui.render(),"playlistPaste.keepOnly").props.onClick();
  assert.equal(ui.state[0],song(1));
  assert.equal(ui.sent.length,0);
  assert.equal(ui.confirmations,2);
});

test("UI: Nach neuer Eingabe verschwinden alte Auswahl und alte Sortierung", () => {
  const ui=mount([song(1),song(2)].join("\n"));
  ui.checkboxes(ui.render())[0].props.onChange();
  const tree=ui.render();
  const textarea=(()=>{let result;function scan(n){if(Array.isArray(n))return n.forEach(scan);if(n&&typeof n==="object"){if(n.type==="textarea")result=n;scan(n.props?.children);}}scan(tree);return result;})();
  textarea.props.onChange({currentTarget:{value:song(9)}});
  const after=ui.render();
  assert.deepEqual(asArray(ui.playlistProps(after).uris),[song(9)]);
});

test("UI: Markieren und Verschieben ändern nicht unbemerkt den eingefügten Text", () => {
  const input = [song(1), "invalid", song(2)].join("\n");
  const ui=mount(input);
  ui.checkboxes(ui.render())[0].props.onChange();
  const tree=ui.render();
  const down=[];
  function scan(n) {if(Array.isArray(n))return n.forEach(scan);if(n&&typeof n==="object") {if(n.type==="button"&&n.props?.title==="playlistPaste.moveDown")down.push(n);scan(n.props?.children);}}
  scan(tree);
  down[0].props.onClick();
  assert.equal(ui.state[0], input);
});

test("UI: zwei Playlist-Ziele auf einer Seite erhalten unterschiedliche Label-IDs", () => {
  const exports={};
  const react={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState:initial=>[initial,()=>{}],
    useRef:initial=>({current:initial}),
    useEffect(){},
  };
  runInNewContext(compileTsxForTest(root,"src/custom-app/components/PlaylistDestination.tsx"), {
    exports,
    Spicetify:{React:react},
    require:spec=>{if(spec.includes("spotify-playlist-transfer"))return api;throw Error(spec);},
  });
  function collect(node,found=[]) {
    if(Array.isArray(node)){for(const item of node)collect(item,found);return found;}
    if(node&&typeof node==="object") {found.push(node);collect(node.props?.children,found);}
    return found;
  }
  const first=collect(exports.PlaylistDestination({t:x=>x,uris:[song(1)]}));
  const second=collect(exports.PlaylistDestination({t:x=>x,uris:[song(1)],idPrefix:"zukato-paste-playlist"}));
  const input1=first.find(n=>n.type==="input");
  const input2=second.find(n=>n.type==="input");
  assert.notEqual(input1.props.id,input2.props.id);
  assert.equal(first.find(n=>n.type==="label").props.htmlFor,input1.props.id);
  assert.equal(second.find(n=>n.type==="label").props.htmlFor,input2.props.id);
});
