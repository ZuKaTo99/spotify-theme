// =============================================================================
// Datei: tests/playlist-manager-v164.test.mjs
// Zweck: Playlist-Inhalte, URI-Duplikate und echte UI-Callbacks absichern.
// Spotify-Requests werden durch lokale Mocks ersetzt; nichts schreibt online.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const transfer = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const id = number => String(number).padStart(22, "0");
const playlist = number => `spotify:playlist:${id(number)}`;
const song = number => `spotify:track:${id(number)}`;

// Das neue Shared-Modul besitzt nur einen einzigen geprüften lokalen Import.
// Für diesen Test werden dessen Exporte ausdrücklich als Mock verdrahtet.
function loadSharedContent() {
  const filepath = path.join(root, "src/shared/spotify-playlist-content.ts");
  let code = stripTypeScriptTypes(readFileSync(filepath, "utf8"), { mode: "strip" });
  code = code.replace(/^import\s*\{[^}]+\}\s*from\s*"\.\/spotify-playlist-transfer";\s*/m, "");
  assert.ok(!/^import\s/m.test(code), "keine unerwarteten Runtime-Imports");
  const symbols = new Set();
  code = code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\s+)(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g,
    (whole, symbol) => { symbols.add(symbol); return whole.replace(/^export\s+/, ""); });
  assert.doesNotMatch(code, /\bexport\s*\{/);
  const exports = {};
  runInNewContext(code + "\n" + [...symbols].map(name => `exports.${name}=${name};`).join("\n"), {
    exports, URL, Map, Set, ...transfer,
  });
  return exports;
}
const api = loadSharedContent();
const details = loadDetailsShared();
function loadDetailsShared() {
  const file = path.join(root, "src/shared/spotify-playlist-details.ts");
  let src = stripTypeScriptTypes(readFileSync(file, "utf8"), { mode: "strip" });
  src = src.replace(/^import\s*\{[^}]+\}\s*from\s*"\.\/spotify-playlist-transfer";\s*/m, "");
  assert.ok(!/^import\s/m.test(src));
  const names = new Set();
  src = src.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\s+)(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g,
    (whole, name) => { names.add(name); return whole.replace(/^export\s+/, ""); });
  const exports = {};
  runInNewContext(src + "\n" + [...names].map(name => `exports.${name}=${name};`).join("\n"),
    { exports, URL, Map, Set, ...transfer });
  return exports;
}
// Der Verschiebe-Helfer importiert das URI-Parsing bewusst nur aus Shared.
// Im VM-Test wird exakt dieser Import kontrolliert an den lokalen Parser gebunden.
function loadReorderModule() {
  const filepath = path.join(root, "src/shared/spotify-playlist-reorder.ts");
  let code = stripTypeScriptTypes(readFileSync(filepath, "utf8"), { mode: "strip" });
  code = code.replace(/^import\s*\{[^}]+\}\s*from\s*"\.\/spotify-playlist-transfer";\s*/m, "");
  assert.ok(!/^import\s/m.test(code));
  const names = new Set();
  code = code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\s+)(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g,
    (whole, name) => { names.add(name); return whole.replace(/^export\s+/, ""); });
  const exports = {};
  runInNewContext(code + "\n" + [...names].map(name => `exports.${name}=${name};`).join("\n"),
    { exports, URL, Map, Set, ...transfer });
  return exports;
}
const reorder = loadReorderModule();

const spotifyPage = (offset, total, length = 50) => ({
  total, offset, limit: 50, next: "https://evil.example/nope",
  items: Array.from({ length }, (_, position) => ({
    item: { uri: song(offset + position), name: `Song ${offset + position}`,
      artists: [{ name: "Tester" }] },
  })),
});
const as = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));

function traverse(node, result = []) {
  if (Array.isArray(node)) { node.forEach(item => traverse(item, result)); return result; }
  if (node && typeof node === "object") {
    result.push(node);
    traverse(node.props?.children, result);
  }
  return result;
}
function harness({ get = async url => url.includes("?fields=snapshot_id")
  ? { snapshot_id: "snapshot-preflight" } : spotifyPage(0, 3, 3),
  del = async () => ({ snapshot_id: "s" }),
  put = async () => ({ snapshot_id: "snapshot-new" }), confirm = true } = {}) {
  const exports = {};
  let hook = 0, ref = 0, confirmed = 0;
  const state = [], refs = [], queued = [], reads = [], deletions = [], writes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const index = hook++;
      if (state[index] === undefined) state[index] = initial;
      return [state[index], update => { state[index] = typeof update === "function" ? update(state[index]) : update; }];
    },
    useRef: initial => {
      const index = ref++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect() {},
  };
  const mocked = {
    "spotify-playlist-transfer": transfer,
    "spotify-playlist-content": api,
    "spotify-playlist-reorder": reorder,
    "spotify-playlist-details": details,
    "PlaylistDestination": { PlaylistDestination: () => null },
  };
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistManager.tsx"), {
    exports, URL, Map, Set, console: { error() {} },
    Spicetify: { React: react, CosmosAsync: {
      get: async url => { reads.push(url); return get(url); },
      del: async (url, body) => { deletions.push({ url, body }); return del(url, body); },
      put: async (url, body) => { writes.push({ url, body }); return put(url, body); },
    } },
    window: { confirm: () => { confirmed++; return confirm; } },
    require: spec => {
      for (const [key, value] of Object.entries(mocked)) if (spec.includes(key)) return value;
      throw new Error(`Unexpected runtime import: ${spec}`);
    },
  });
  function render() {
    hook = 0; ref = 0;
    return traverse(exports.PlaylistManager({
      t: key => key,
      onQueue: async uris => { queued.push(Array.from(uris)); },
    }));
  }
  const find = (nodes, type, prop, value) => nodes.find(n => n.type === type && n.props?.[prop] === value);
  const button = (nodes, key) => nodes.find(n => n.type === "button" && n.props?.children?.includes(key));
  async function loadSource(uri = playlist(1)) {
    find(render(), "input", "id", "zukato-manager-source").props.onChange({ currentTarget: { value: uri } });
    button(render(), "playlistManager.load").props.onClick();
    await flush();
  }
  return { render, find, button, loadSource, reads, deletions, writes, queued,
    get confirmed() { return confirmed; }, state };
}

test("Playlist-Item-URLs nutzen nur feste Spotify-Endpoints und 50er-Offsets", () => {
  assert.equal(api.playlistItemsUrl(playlist(1), 0),
    `https://api.spotify.com/v1/playlists/${id(1)}/items?limit=50&offset=0`);
  for (const value of [1, -50, 10000, Infinity, "0", NaN]) {
    assert.throws(() => api.playlistItemsUrl(playlist(1), value));
  }
  assert.throws(() => api.playlistItemsUrl("https://evil.example/x", 0));
});

test("Playlist-API liest item/track, überspringt lokale und kaputte Titel", () => {
  const page = spotifyPage(0, 5, 5);
  page.items[1] = { is_local: true, item: { uri: song(1), name: "lokal" } };
  page.items[2] = { track: { uri: song(2), name: "Legacy", show: { publisher: "Podcast" } } };
  page.items[3] = { item: { uri: "spotify:album:" + id(3) } };
  const loaded = api.normalizePlaylistItemsPage(page, playlist(1), 0);
  assert.deepEqual(as(loaded.items.map(x => [x.uri, x.position, x.artist])),
    [[song(0), 0, "Tester"], [song(2), 2, "Podcast"], [song(4), 4, "Tester"]]);
  assert.equal(loaded.hasMore, false);
});

test("Paginierung nutzt sichere Spotify-Offsets bis 10.000 Positionen", () => {
  assert.deepEqual(as(api.normalizePlaylistItemsPage(spotifyPage(0, 50), playlist(1), 0).hasMore), false);
  assert.equal(api.normalizePlaylistItemsPage(spotifyPage(450, 1200), playlist(1), 450).hasMore, true);
  assert.equal(api.normalizePlaylistItemsPage(spotifyPage(9950, 15000), playlist(1), 9950).hasMore, false);
  for (const data of [{}, null, { items: [], total: -1 },
    { items: Array(51).fill({ item: { uri: song(1) } }), total: 51 }]) {
    assert.throws(() => api.normalizePlaylistItemsPage(data, playlist(1), 0));
  }
});

test("Doppelte Spotify-URIs bleiben als zwei Positionen in der Ansicht erhalten", () => {
  const raw = spotifyPage(0, 2, 2);
  raw.items[1].item.uri = song(0);
  const first = api.normalizePlaylistItemsPage(raw, playlist(1), 0).items;
  assert.equal(first.length, 2);
  assert.notEqual(first[0].key, first[1].key);
  assert.deepEqual(as(api.selectedPlaylistUris(first, [song(0), song(0), song(9)])), [song(0)]);
  assert.equal(api.mergePlaylistItems(first, first).length, 2);
});

test("DELETE nimmt nur bestätigte, geladene URIs und nur /items", async () => {
  const loaded = api.normalizePlaylistItemsPage(spotifyPage(0, 3, 3), playlist(2), 0).items;
  const calls = [];
  const result = await api.removePlaylistUris(playlist(2), loaded,
    [song(2), song(9), song(0), song(2)], async (url, body) => {
      calls.push({ url, body }); return { snapshot_id: "snap" };
    });
  assert.deepEqual(as(result), { removed: 2, total: 2 });
  assert.deepEqual(as(calls), [{ url: `https://api.spotify.com/v1/playlists/${id(2)}/items`,
    body: { items: [{ uri: song(0) }, { uri: song(2) }] } }]);
});

test("DELETE bricht bei unsicherer Antwort ab, ohne zweiten Batch oder Retry", async () => {
  const entries = Array.from({ length: 105 }, (_, i) =>
    ({ key: `${i}:${song(i)}`, position: i, title: String(i), artist: "", uri: song(i) }));
  const selected = entries.map(item => item.uri);
  const calls = [];
  await assert.rejects(() => api.removePlaylistUris(playlist(3), entries, selected, async (_url, body) => {
    calls.push(as(body));
    if (calls.length === 2) throw Error("429");
    return { snapshot_id: "ack" };
  }), error => error.removed === 100 && error.total === 105);
  assert.equal(calls.length, 2);
  await assert.rejects(() => api.removePlaylistUris(playlist(3), entries, selected,
    async () => ({})), error => error.removed === 0);
});

test("UI: Lesen nur nach Klick, Auswahl verändert weder Queue noch Playlist", async () => {
  const ui = harness();
  assert.equal(ui.reads.length, 0);
  await ui.loadSource();
  assert.equal(ui.reads.length, 1);
  const nodes = ui.render();
  assert.equal(nodes.filter(n => n.type === "input" && n.props.type === "checkbox").length, 3);
  assert.equal(ui.queued.length, 0);
  assert.equal(ui.deletions.length, 0);
  ui.find(nodes, "input", "type", "checkbox").props.onChange();
  assert.equal(ui.queued.length, 0);
  assert.equal(ui.deletions.length, 0);
});

test("UI: gefilterte Auswahl geht an Queue und Playlist-Ziel unverändert", async () => {
  const ui = harness();
  await ui.loadSource();
  ui.find(ui.render(), "input", "id", "zukato-manager-search").props.onChange({ currentTarget: { value: "Song 1" } });
  ui.button(ui.render(), "playlistManager.selectResults").props.onClick();
  const nodes = ui.render();
  assert.equal(ui.button(nodes, "playlistManager.queue").props.disabled, false);
  assert.equal(ui.button(nodes, "playlistManager.remove").props.disabled, false);
  ui.button(nodes, "playlistManager.queue").props.onClick();
  await flush();
  assert.deepEqual(ui.queued, [[song(1)]]);
  assert.equal(ui.deletions.length, 0);
});

test("UI: Löschen nur nach ausdrücklicher Bestätigung", async () => {
  const ui = harness({ confirm: false });
  await ui.loadSource();
  ui.find(ui.render(), "input", "type", "checkbox").props.onChange();
  ui.button(ui.render(), "playlistManager.remove").props.onClick();
  await flush();
  assert.equal(ui.confirmed, 1);
  assert.equal(ui.deletions.length, 0);
});

test("UI: Bestätigtes Entfernen aktualisiert Ansicht und sperrt Folge-Offsets", async () => {
  const ui = harness();
  await ui.loadSource();
  ui.find(ui.render(), "input", "type", "checkbox").props.onChange();
  ui.button(ui.render(), "playlistManager.remove").props.onClick();
  await flush();
  assert.equal(ui.deletions.length, 1);
  assert.equal(ui.render().filter(n => n.type === "input" && n.props?.type === "checkbox").length, 2);
});

test("UI: Unsicherer DELETE macht alte Ansicht ungültig; kein weiterer Versand", async () => {
  const ui = harness({ del: async () => { throw Error("timeout"); } });
  await ui.loadSource();
  ui.find(ui.render(), "input", "type", "checkbox").props.onChange();
  ui.button(ui.render(), "playlistManager.remove").props.onClick();
  await flush();
  assert.equal(ui.deletions.length, 1);
  assert.ok(ui.render().some(n => n.type === "p" && n.props.role === "alert"));
  assert.ok(!ui.render().some(n => n.type === "input" && n.props.type === "checkbox"));
});

test("UI: Quellenwechsel während laufendem GET ignoriert veraltete Antwort", async () => {
  let resolve;
  const wait = new Promise(r => { resolve = r; });
  const ui = harness({ get: async () => { await wait; return spotifyPage(0, 2, 2); } });
  ui.find(ui.render(), "input", "id", "zukato-manager-source").props.onChange({ currentTarget: { value: playlist(1) } });
  ui.button(ui.render(), "playlistManager.load").props.onClick();
  ui.find(ui.render(), "input", "id", "zukato-manager-source").props.onChange({ currentTarget: { value: playlist(2) } });
  resolve();
  await flush();
  assert.equal(ui.reads.length, 1);
  assert.equal(ui.render().filter(n => n.type === "input" && n.props.type === "checkbox").length, 0);
});

test("UI: Laden eigener Playlists ist nur lesend und löst keine Löschung aus", async () => {
  const ui = harness({ get: async url => url.includes("/me/playlists")
    ? { total: 1, items: [{ uri: playlist(1), name: "Owned", owner: { id: "u" } }] }
    : spotifyPage(0, 1, 1) });
  ui.button(ui.render(), "playlistManager.myPlaylists").props.onClick();
  await flush();
  assert.equal(ui.reads.length, 1);
  assert.equal(ui.deletions.length, 0);
  assert.ok(ui.render().some(n => n.type === "option" && n.props.value === playlist(1)));
});
