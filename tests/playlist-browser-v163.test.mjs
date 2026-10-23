// =============================================================================
// Datei: tests/playlist-browser-v163.test.mjs
// Zweck: Playlist-Browser: Spotify-API-Validierung und reale UI-Klicks ohne Konto.
// Der Browser darf auf keinen Fall Titel ohne Bestätigung hinzufügen.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const id = n => String(n).padStart(22, "0");
const playlist = n => `spotify:playlist:${id(n)}`;
const song = n => `spotify:track:${id(n)}`;
const entry = n => ({ id: id(n), uri: playlist(n), name: `Playlist ${n}`, owner: { display_name: "Tester" }, items: { total: n } });
const page = (offset, total, count = 50) => ({
  offset, limit: 50, total,
  // Spotify kann einen veralteten oder unpassenden Next-Link liefern.
  next: "https://evil.example/unsafe-next-page",
  items: Array.from({ length: count }, (_, n) => entry(offset + n)),
});

function treeNodes(rootNode) {
  const result = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    result.push(node);
    visit(node.props?.children);
  }
  visit(rootNode);
  return result;
}
function uiHarness(get) {
  const exports = {};
  const state = [];
  const refs = [];
  let hook = 0, ref = 0, posts = 0, confirmations = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const index = hook++;
      if (state[index] === undefined) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useRef: initial => {
      const index = ref++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect() {},
  };
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistDestination.tsx"), {
    exports, Spicetify: { React: react, CosmosAsync: {
      get, post: async () => { posts++; },
    } },
    window: { confirm: () => { confirmations++; return true; } },
    console: { error() {} },
    require: spec => { if (spec.includes("spotify-playlist-transfer")) return api; throw Error(spec); },
  });
  return {
    render: () => { hook = 0; ref = 0; return treeNodes(exports.PlaylistDestination({
      t: key => key, uris: [song(1)], idPrefix: "test-browser",
    })); },
    button: (nodes, label) => nodes.find(n => n.type === "button" && n.props.children.includes(label)),
    select: (nodes, suffix) => nodes.find(n => n.type === "select" && n.props.id === `test-browser-${suffix}`),
    get posts() { return posts; },
    get confirmations() { return confirmations; },
    get state() { return state; },
  };
}

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

test("Browser-URL verwendet nur Spotify und sichere 50er-Offsets", () => {
  assert.equal(api.playlistBrowserUrl(0), "https://api.spotify.com/v1/me/playlists?limit=50&offset=0");
  assert.equal(api.playlistBrowserUrl(450), "https://api.spotify.com/v1/me/playlists?limit=50&offset=450");
  for (const value of [-1, 1, 51, 500, Infinity, NaN, "0", 0.5]) {
    assert.throws(() => api.playlistBrowserUrl(value), /offset/);
  }
});

test("Metadaten aus Spotify werden geprüft und begrenzt, kein fremder Next-Link", () => {
  const raw = page(0, 111);
  raw.items[1] = { ...raw.items[1], uri: "spotify:album:" + id(1), id: "BAD", name: "Invalid" };
  const out = api.normalizePlaylistBrowserPage(raw, 0);
  assert.equal(out.items.length, 49);
  assert.equal(out.nextOffset, 50);
  assert.equal(out.hasMore, true);
  assert.equal(out.items[0].itemCount, 0);
  assert.equal(out.items[0].owner, "Tester");
  assert.ok(!JSON.stringify(out).includes("evil.example"));
});

test("Leere letzte Seite, kaputte Antwort und übergroße API-Antwort werden sicher behandelt", () => {
  assert.equal(api.normalizePlaylistBrowserPage(page(50, 51, 1), 50).hasMore, false);
  assert.equal(api.normalizePlaylistBrowserPage(page(450, 2000, 50), 450).hasMore, false);
  for (const bad of [null, {}, { items: [], total: -1 }, { items: Array(51).fill(entry(1)), total: 51 }]) {
    assert.throws(() => api.normalizePlaylistBrowserPage(bad, 0));
  }
});

test("Mehrere Playlist-Seiten werden ohne Duplikate zusammengeführt", () => {
  const first = api.normalizePlaylistBrowserPage(page(0, 80), 0).items;
  const second = api.normalizePlaylistBrowserPage(page(50, 80, 30), 50).items;
  assert.deepEqual(Array.from(api.mergeBrowsedPlaylists(first, [first[0], ...second]).map(x => x.uri)),
    Array.from({ length: 80 }, (_, n) => playlist(n)));
});

test("UI: Playlist-Laden ausschließlich nach Klick, nichts wird an Spotify geschrieben", async () => {
  const calls = [];
  const ui = uiHarness(async url => { calls.push(url); return page(0, 2, 2); });
  assert.equal(calls.length, 0);
  const first = ui.render();
  assert.equal(ui.button(first, "playlistBrowser.load").props.disabled, false);
  ui.button(first, "playlistBrowser.load").props.onClick();
  await flush();
  const after = ui.render();
  assert.equal(calls.length, 1);
  assert.ok(after.some(n => n.type === "option" && n.props.value === playlist(0)));
  assert.equal(ui.posts, 0);
  assert.equal(ui.confirmations, 0);
});

test("UI: Auswahl nach Namen und Besitzer setzt nur Ziel; keine automatische Übertragung", async () => {
  const ui = uiHarness(async () => page(0, 3, 3));
  ui.button(ui.render(), "playlistBrowser.load").props.onClick();
  await flush();
  const nodes = ui.render();
  const filter = nodes.find(n => n.type === "input" && n.props.id === "test-browser-browse-filter");
  filter.props.onChange({ currentTarget: { value: "Playlist 2" } });
  const filtered = ui.render();
  const options = filtered.filter(n => n.type === "option" && n.props.value?.startsWith("spotify:playlist"));
  assert.deepEqual(Array.from(options.map(n => n.props.value)), [playlist(2)]);
  ui.select(filtered, "browse-select").props.onChange({ currentTarget: { value: playlist(2) } });
  assert.equal(ui.render().find(n => n.type === "input" && n.props.id === "test-browser-destination").props.value, playlist(2));
  assert.equal(ui.posts, 0);
});

test("UI: Folgeseiten erhalten Treffer, URLs bleiben auf /me/playlists", async () => {
  const calls = [];
  const ui = uiHarness(async url => {
    calls.push(url);
    return url.includes("offset=50") ? page(50, 52, 2) : page(0, 52);
  });
  ui.button(ui.render(), "playlistBrowser.load").props.onClick();
  await flush();
  ui.button(ui.render(), "playlistBrowser.more").props.onClick();
  await flush();
  assert.deepEqual(calls, [api.playlistBrowserUrl(0), api.playlistBrowserUrl(50)]);
  assert.equal(ui.render().filter(n => n.type === "option" && n.props.value?.startsWith("spotify:playlist")).length, 52);
});

test("UI: parallele Klicks senden nur einen GET-Request", async () => {
  let resolve;
  const wait = new Promise(r => { resolve = r; });
  let requests = 0;
  const ui = uiHarness(async () => { requests++; await wait; return page(0, 1, 1); });
  const button = ui.button(ui.render(), "playlistBrowser.load");
  button.props.onClick();
  button.props.onClick();
  assert.equal(requests, 1);
  resolve();
  await flush();
  assert.equal(ui.posts, 0);
});

test("UI: API-Ausfall meldet Fehler, kein POST und kein automatischer Retry", async () => {
  let requests = 0;
  const ui = uiHarness(async () => { requests++; throw Error("403 forbidden"); });
  ui.button(ui.render(), "playlistBrowser.load").props.onClick();
  await flush();
  assert.equal(requests, 1);
  assert.equal(ui.posts, 0);
  assert.ok(ui.render().some(n => n.type === "p" && n.props.role === "alert"));
});
