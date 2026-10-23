// =============================================================================
// Datei: tests/playlist-reorder-v165.test.mjs
// Zweck: Positionstreue Playlist-Verschiebung und echte UI-Klicks testen.
// Es finden KEINE echten Spotify-Netzwerkaktionen statt.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const transfer = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const id = n => String(n).padStart(22, "0");
const source = `spotify:playlist:${id(10)}`;
const uri = n => `spotify:track:${id(n)}`;
const as = data => JSON.parse(JSON.stringify(data));
const flush = () => new Promise(resolve => setImmediate(resolve));

function loadShared(file, injected) {
  let code = stripTypeScriptTypes(readFileSync(path.join(root, file), "utf8"), { mode: "strip" });
  code = code.replace(/^import\s*\{[^}]+\}\s*from\s*"\.\/spotify-playlist-transfer";\s*/m, "");
  assert.ok(!/^import\s/m.test(code));
  const names = new Set();
  code = code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\s+)(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g,
    (whole, name) => { names.add(name); return whole.replace(/^export\s+/, ""); });
  const exports = {};
  runInNewContext(code + "\n" + [...names].map(name => `exports.${name}=${name};`).join("\n"),
    { exports, URL, Map, Set, ...injected });
  return exports;
}
const reorder = loadShared("src/shared/spotify-playlist-reorder.ts", transfer);
const content = loadShared("src/shared/spotify-playlist-content.ts", transfer);
const details = loadShared("src/shared/spotify-playlist-details.ts", transfer);

function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(n => nodes(n, result));
  else if (node && typeof node === "object") {
    result.push(node);
    nodes(node.props?.children, result);
  }
  return result;
}
function harness({ total = 3, get = async url => url.includes("fields=snapshot_id")
    ? { snapshot_id: "s-before" }
    : { total, items: Array.from({ length: total }, (_, i) => ({
      item: { uri: i === 1 ? uri(1) : uri(1), name: `Occurrence ${i}`, artists: [{ name: "Artist" }] },
    })) },
    put = async () => ({ snapshot_id: "s-after" }), confirm = true } = {}) {
  let hook = 0, ref = 0, confirms = 0;
  const state = [], refs = [], reads = [], writes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const n = hook++;
      if (state[n] === undefined) state[n] = initial;
      return [state[n], update => { state[n] = typeof update === "function" ? update(state[n]) : update; }];
    },
    useRef: initial => { const n = ref++; if (!refs[n]) refs[n] = { current: initial }; return refs[n]; },
    useEffect() {},
  };
  const compiled = compileTsxForTest(root, "src/custom-app/components/PlaylistManager.tsx");
  const exports = {};
  runInNewContext(compiled, {
    exports, URL, Map, Set, console: { error() {} },
    Spicetify: { React: react, CosmosAsync: {
      get: async url => { reads.push(url); return get(url); },
      put: async (url, body) => { writes.push({ url, body: as(body) }); return put(url, body); },
      del: async () => ({ snapshot_id: "deleted" }),
    } },
    window: { confirm: () => { confirms++; return confirm; } },
    require: spec => {
      if (spec.includes("spotify-playlist-transfer")) return transfer;
      if (spec.includes("spotify-playlist-content")) return content;
      if (spec.includes("spotify-playlist-reorder")) return reorder;
      if (spec.includes("spotify-playlist-details")) return details;
      if (spec.includes("PlaylistDestination")) return { PlaylistDestination: () => null };
      throw Error(`Unexpected dependency ${spec}`);
    },
  });
  function render() { hook = 0; ref = 0; return nodes(exports.PlaylistManager({ t: key => key, onQueue: async () => {} })); }
  const byId = id => render().find(n => n.props?.id === id);
  const named = label => render().find(n => n.type === "button" && n.props?.children?.includes(label));
  async function load() {
    byId("zukato-manager-source").props.onChange({ currentTarget: { value: source } });
    named("playlistManager.load").props.onClick();
    await flush();
  }
  function selectOccurrence(position) {
    const buttons = render().filter(n => n.type === "button" && n.props?.["aria-label"] === "playlistManager.chooseMove");
    assert.ok(buttons[position], "Verschiebeauswahl vorhanden");
    buttons[position].props.onClick();
  }
  return { render, byId, named, load, selectOccurrence, reads, writes,
    get confirms() { return confirms; } };
}

test("Positionsplan: nach oben, nach unten, an das Ende, gleiche Position", () => {
  assert.deepEqual(as(reorder.playlistReorderPositions(4, 0, 10)),
    { range_start: 4, insert_before: 0, range_length: 1 });
  assert.deepEqual(as(reorder.playlistReorderPositions(2, 3, 10)),
    { range_start: 2, insert_before: 4, range_length: 1 });
  assert.deepEqual(as(reorder.playlistReorderPositions(0, 9, 10)),
    { range_start: 0, insert_before: 10, range_length: 1 });
  assert.equal(reorder.playlistReorderPositions(5, 5, 10), null);
});

test("Ungültige Positionen und fremde Playlist-Links lösen keine Requests aus", async () => {
  for (const triple of [[-1, 2, 3], [0, 3, 3], [1.5, 2, 3], [0, NaN, 3], [1, 0, Infinity], [0, 1, 0]]) {
    assert.throws(() => reorder.playlistReorderPositions(...triple));
  }
  assert.throws(() => reorder.playlistReorderEndpoints("https://evil.example/playlist/"+id(10)));
  let called = false;
  await assert.rejects(() => reorder.moveSpotifyPlaylistEntry("evil", 0, 1, 3,
    async () => { called = true; }, async () => { called = true; }));
  assert.equal(called, false);
});

test("Spotify-Snapshot wird VOR dem PUT geholt und zur Positionierung genutzt", async () => {
  const calls = [];
  const moved = await reorder.moveSpotifyPlaylistEntry(source, 0, 2, 4,
    async url => { calls.push({ method: "GET", url }); return { snapshot_id: "old" }; },
    async (url, body) => { calls.push({ method: "PUT", url, body: as(body) }); return { snapshot_id: "new" }; });
  assert.equal(moved, true);
  assert.deepEqual(calls.map(x => x.method), ["GET", "PUT"]);
  assert.equal(calls[0].url, `https://api.spotify.com/v1/playlists/${id(10)}?fields=snapshot_id`);
  assert.equal(calls[1].url, `https://api.spotify.com/v1/playlists/${id(10)}/items`);
  assert.deepEqual(calls[1].body, { range_start: 0, insert_before: 3, range_length: 1, snapshot_id: "old" });
});

test("Gleiches Ziel löst auch keinen Snapshot-GET aus", async () => {
  let requests = 0;
  assert.equal(await reorder.moveSpotifyPlaylistEntry(source, 1, 1, 3,
    async () => { requests++; }, async () => { requests++; }), false);
  assert.equal(requests, 0);
});

test("Fehlender Snapshot verhindert PUT; unklare PUT-Antwort löst keinen Retry aus", async () => {
  let writes = 0;
  await assert.rejects(() => reorder.moveSpotifyPlaylistEntry(source, 0, 1, 3,
    async () => ({}), async () => { writes++; }));
  assert.equal(writes, 0);
  await assert.rejects(() => reorder.moveSpotifyPlaylistEntry(source, 0, 1, 3,
    async () => ({ snapshot_id: "ok" }), async () => { writes++; return {}; }));
  assert.equal(writes, 1);
});

test("Quellenwechsel während Snapshot-GET verhindert nachfolgenden PUT", async () => {
  let writes = 0;
  const moved = await reorder.moveSpotifyPlaylistEntry(source, 0, 1, 3,
    async () => ({ snapshot_id: "old" }), async () => { writes++; }, () => false);
  assert.equal(moved, false);
  assert.equal(writes, 0);
});

test("UI: dreifacher Song lässt sich genau an seiner zweiten Position verschieben", async () => {
  const ui = harness();
  await ui.load();
  ui.selectOccurrence(1);
  ui.byId("zukato-manager-move-target").props.onChange({ currentTarget: { value: "3" } });
  ui.named("playlistManager.moveApply").props.onClick();
  await flush();
  assert.equal(ui.confirms, 1);
  assert.equal(ui.writes.length, 1);
  assert.deepEqual(ui.writes[0].body, {
    range_start: 1, insert_before: 3, range_length: 1, snapshot_id: "s-before",
  });
  assert.equal(ui.render().filter(n => n.props?.type === "checkbox").length, 0, "Ansicht nach PUT invalidiert");
});

test("UI: Abbrechen, unveränderter Platz und ungültiges Ziel senden kein PUT", async () => {
  const ui = harness();
  await ui.load();
  ui.selectOccurrence(0);
  assert.equal(ui.named("playlistManager.moveApply").props.disabled, true);
  ui.byId("zukato-manager-move-target").props.onChange({ currentTarget: { value: "4" } });
  assert.equal(ui.named("playlistManager.moveApply").props.disabled, true);
  ui.named("playlistManager.moveCancel").props.onClick();
  assert.equal(ui.writes.length, 0);
});

test("UI: Verweigerte Bestätigung und Spotify-Timeout führen zu keinem automatischen Retry", async () => {
  const declined = harness({ confirm: false });
  await declined.load(); declined.selectOccurrence(0);
  declined.byId("zukato-manager-move-target").props.onChange({ currentTarget: { value: "2" } });
  declined.named("playlistManager.moveApply").props.onClick();
  await flush();
  assert.equal(declined.writes.length, 0);

  const failed = harness({ put: async () => { throw Error("timeout"); } });
  await failed.load(); failed.selectOccurrence(0);
  failed.byId("zukato-manager-move-target").props.onChange({ currentTarget: { value: "2" } });
  failed.named("playlistManager.moveApply").props.onClick();
  await flush();
  assert.equal(failed.writes.length, 1);
  assert.equal(failed.render().filter(n => n.props?.type === "checkbox").length, 0);
  assert.ok(failed.render().some(n => n.type === "p" && n.props?.role === "alert"));
});
