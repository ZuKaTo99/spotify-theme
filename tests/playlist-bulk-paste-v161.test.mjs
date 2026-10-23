// =============================================================================
// Datei: tests/playlist-bulk-paste-v161.test.mjs
// Zweck: Mehrfach-Einfügen, Mengenlimits, Playlist-Verlauf und echte UI-Klicks.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const song = n => `spotify:track:${String(n).padStart(22,"0")}`;
const episode = n => `spotify:episode:${String(n).padStart(22,"0")}`;
const dest = n => `spotify:playlist:${String(n).padStart(22,"0")}`;

function plain(report) {
  return {uris: Array.from(report.uris), total: report.total,
    invalid: report.invalid, duplicates: report.duplicates, issue: report.issue};
}

test("Mehrfachimport: Trenner, Links, Episoden, Reihenfolge und ungültige Werte", () => {
  const link = `https://open.spotify.com/intl-de/track/${"0".repeat(21)}1?si=xyz`;
  assert.deepEqual(plain(api.analyzePastedSpotifyLinks(
    `${song(3)},${link};${episode(2)}\n${song(3)}\tbad`,
  )), { uris: [song(3),song(1),episode(2)], total:5, invalid:1, duplicates:1, issue:null });
});

test("Mehrfachimport: Leerstring sendet keine Titel und wirft nicht", () => {
  assert.deepEqual(plain(api.analyzePastedSpotifyLinks("  \n\t")),
    { uris: [], total:0, invalid:0, duplicates:0, issue:null });
});

test("Mehrfachimport: genau 500 Titel bleiben erhalten", () => {
  const input = Array.from({length:500}, (_,i)=>song(i)).join("\n");
  const result = api.analyzePastedSpotifyLinks(input);
  assert.equal(result.uris.length,500);
  assert.equal(result.issue,null);
  assert.equal(result.uris[499],song(499));
});

test("Mehrfachimport: 501 unterschiedliche Titel sperren die gesamte Aktion", () => {
  const input = Array.from({length:501}, (_,i)=>song(i)).join("\n");
  const result = api.analyzePastedSpotifyLinks(input);
  assert.equal(result.issue,"items");
  assert.equal(result.uris.length,500);
});

test("Mehrfachimport: ungültige und doppelte Einträge zählen nicht zum 500er-Limit", () => {
  const input = [...Array.from({length:500},(_,i)=>song(i)),song(1),"bad",song(2)].join("\n");
  const result = api.analyzePastedSpotifyLinks(input);
  assert.equal(result.issue,null);
  assert.equal(result.uris.length,500);
  assert.equal(result.invalid,1);
  assert.equal(result.duplicates,2);
});

test("Mehrfachimport: zu langer Text wird vor Analyse abgelehnt", () => {
  const result = api.analyzePastedSpotifyLinks("x".repeat(60_001));
  assert.equal(result.issue,"characters");
  assert.equal(result.uris.length,0);
});

test("Mehrfachimport: zu viele Tokens werden abgelehnt", () => {
  const result = api.analyzePastedSpotifyLinks(Array(2_001).fill("x").join(" "));
  assert.equal(result.issue,"tokens");
});

test("Playlist-Verlauf: korrupte und fremde Ziele sowie Duplikate entfernen", () => {
  assert.deepEqual(Array.from(api.normalizeRecentPlaylists([dest(1),"bad",dest(1),
    `https://open.spotify.com/playlist/${String(2).padStart(22,"0")}?si=a`,42, dest(3)])),
    [dest(1),dest(2),dest(3)]);
  assert.deepEqual(Array.from(api.normalizeRecentPlaylists({anything:true})),[]);
});

test("Playlist-Verlauf: höchstens 5 Ziele, neues Ziel zuerst", () => {
  const first = Array.from({length:5},(_,i)=>dest(i));
  assert.deepEqual(Array.from(api.rememberPlaylistDestination(first,dest(3))),
    [dest(3),dest(0),dest(1),dest(2),dest(4)]);
  assert.deepEqual(Array.from(api.rememberPlaylistDestination(first,dest(5))),
    [dest(5),dest(0),dest(1),dest(2),dest(3)]);
  assert.deepEqual(Array.from(api.rememberPlaylistDestination(first,"bad")),first);
});

test("UI enthält Vorschau und getrennte Queue- und Playlist-Aktionen", () => {
  const file = readFileSync(path.join(root,"src/custom-app/components/BulkLinkImporter.tsx"),"utf8");
  const entry = readFileSync(path.join(root,"src/custom-app/modules/playlist-tools/PlaylistTools.tsx"),"utf8");
  assert.match(file, /<PlaylistDestination t=\{t\} uris=/);
  assert.match(file, /<textarea /);
  assert.match(file, /role="status"/);
  assert.match(entry, /<BulkLinkImporter t=\{t\}/);
});

// Testet echte TSX-Eventhandler; die Callbacks sind nicht nur via Regex geprüft.
function mountPaste(raw, confirmResult=true) {
  const exports = {};
  let hookIndex = 0;
  let count = 0;
  let confirmCalls = 0;
  let submitted;
  const submittedPromise = new Promise(resolve => { submitted = resolve; });
  const state = [raw, false];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: init => {
      const i = hookIndex++;
      if (state[i] === undefined) state[i] = init;
      return [state[i], next => { state[i] = typeof next === "function" ? next(state[i]) : next; }];
    },
    useRef: init => ({current:init}),
  };
  runInNewContext(compileTsxForTest(root,"src/custom-app/components/BulkLinkImporter.tsx"), {
    exports,
    Spicetify: { React: react },
    window: { confirm: () => { confirmCalls++; return confirmResult; } },
    require: spec => {
      if (spec.includes("spotify-playlist-transfer")) return api;
      if (spec.includes("PlaylistDestination")) return {PlaylistDestination:()=>null};
      throw Error(`Unexpected import ${spec}`);
    },
  });
  const onQueue = async uris => { count++; submitted(Array.from(uris)); };
  const render = () => {
    hookIndex=0;
    return exports.BulkLinkImporter({t:key=>key, onQueue});
  };
  function find(tree,type, found=[]) {
    if (Array.isArray(tree)) { for(const item of tree) find(item,type,found); return found; }
    if (tree && typeof tree === "object") {
      if (tree.type===type) found.push(tree);
      find(tree.props?.children,type,found);
    }
    return found;
  }
  return { render, find, get count(){return count;}, get confirmCalls(){return confirmCalls;}, submittedPromise };
}

test("UI: 3 gültige Links werden genau einmal eingereiht", async () => {
  const ui=mountPaste(`${song(1)}\n${song(2)},${song(1)}\n${episode(3)}`);
  const tree=ui.render();
  const button=ui.find(tree,"button")[0];
  assert.equal(button.props.disabled,false);
  button.props.onClick();button.props.onClick();
  assert.deepEqual(await ui.submittedPromise,[song(1),song(2),episode(3)]);
  assert.equal(ui.count,1);
  assert.equal(ui.confirmCalls,0);
});

test("UI: große Auswahl verlangt Bestätigung und respektiert Abbruch", async () => {
  const ui=mountPaste(Array.from({length:26},(_,i)=>song(i)).join("\n"),false);
  const button=ui.find(ui.render(),"button")[0];
  button.props.onClick();
  await Promise.resolve();
  assert.equal(ui.confirmCalls,1);
  assert.equal(ui.count,0);
});

test("UI: über 500 verschiedene Titel deaktivieren Queue und Playlist", () => {
  const ui=mountPaste(Array.from({length:501},(_,i)=>song(i)).join("\n"));
  const tree=ui.render();
  assert.equal(ui.find(tree,"button")[0].props.disabled,true);
  assert.ok(tree);
});
