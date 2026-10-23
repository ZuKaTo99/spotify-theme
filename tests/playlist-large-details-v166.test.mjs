// =============================================================================
// Datei: tests/playlist-large-details-v166.test.mjs
// Zweck: Große Spotify-Playlists und Eigentümer-Metadaten im echten UI-Callback
// kontrollieren. Sämtliche Spotify-Anfragen werden lokal gemockt.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const transfer = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const id = n => String(n).padStart(22, "0");
const playlist = `spotify:playlist:${id(5)}`;
const track = n => `spotify:track:${id(n)}`;
const as = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));

/** Echte getypte Shared-Dateien ohne Runtime-Import in isolierter Test-VM laden. */
function loadShared(file) {
  let source = stripTypeScriptTypes(readFileSync(path.join(root, file), "utf8"), { mode: "strip" });
  source = source.replace(/^import\s*\{[^}]+\}\s*from\s*"\.\/spotify-playlist-transfer";\s*/m, "");
  assert.doesNotMatch(source, /^import\s/m);
  const names = new Set();
  source = source.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class)\s+)(?:async\s+)?(?:function|const|class)\s+([\w$]+)/g,
    (whole, name) => { names.add(name); return whole.replace(/^export\s+/, ""); });
  const exports = {};
  runInNewContext(source + "\n" + [...names].map(name => `exports.${name}=${name};`).join("\n"),
    { exports, URL, Map, Set, ...transfer });
  return exports;
}
const content = loadShared("src/shared/spotify-playlist-content.ts");
const details = loadShared("src/shared/spotify-playlist-details.ts");
const reorder = loadShared("src/shared/spotify-playlist-reorder.ts");

const owns = {
  id: id(5), uri: playlist, name: "My Mix", description: "Old", owner: { id: "owner" },
};
const spotifyPage = (offset, total = 3000) => ({
  total, items: Array.from({ length: 50 }, (_, i) => ({
    item: { uri: track(offset + i), name: `Song ${offset + i}`, artists: [{ name: "Band" }] },
  })),
});
function walk(node, result = []) {
  if (Array.isArray(node)) node.forEach(n => walk(n, result));
  else if (node && typeof node === "object") {
    result.push(node);
    walk(node.props?.children, result);
  }
  return result;
}
/** State-Array beibehalten und nur Hook-Indices bei jedem Render zurücksetzen. */
function harness({ get, put = async () => undefined, confirm = true } = {}) {
  const requests = [], writes = [];
  const state = [], refs = [], exports = {};
  let hook = 0, ref = 0, confirms = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const n = hook++;
      if (state[n] === undefined) state[n] = initial;
      return [state[n], v => { state[n] = typeof v === "function" ? v(state[n]) : v; }];
    },
    useRef(initial) { const n = ref++; if (!refs[n]) refs[n] = { current: initial }; return refs[n]; },
    useEffect() {},
  };
  const mocked = { "spotify-playlist-transfer": transfer, "spotify-playlist-content": content,
    "spotify-playlist-details": details, "spotify-playlist-reorder": reorder,
    "PlaylistDestination": { PlaylistDestination: () => null } };
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistManager.tsx"), {
    exports, URL, Map, Set, console: { error() {} },
    Spicetify: { React: react, CosmosAsync: {
      get: async url => {
        requests.push(url);
        if (get) return get(url);
        if (url.endsWith("/me")) return { id: "owner" };
        if (url.includes("fields=id,uri")) return owns;
        const offset = Number(new URL(url).searchParams.get("offset"));
        return spotifyPage(offset);
      },
      put: async (url, body) => { writes.push({ url, body: as(body) }); return put(url, body); },
      del: async () => ({ snapshot_id: "s" }),
    } },
    window: { confirm: () => { confirms++; return confirm; } },
    require: spec => {
      for (const [key, value] of Object.entries(mocked)) if (spec.includes(key)) return value;
      throw Error(`Unexpected import ${spec}`);
    },
  });
  function render() {
    hook = 0; ref = 0;
    return walk(exports.PlaylistManager({ t: key => key, onQueue: async () => {} }));
  }
  function field(id) { return render().find(n => n.props?.id === id); }
  function button(text) { return render().find(n => n.type === "button" && n.props?.children?.includes(text)); }
  function change(id, value) { field(id).props.onChange({ currentTarget: { value } }); }
  async function load() {
    change("zukato-manager-source", playlist);
    button("playlistManager.load").props.onClick();
    await flush();
  }
  return { render, field, button, change, load, requests, writes,
    get confirms() { return confirms; } };
}

test("10.000 Positionen erlauben auch Seite 192 ohne Zwischenseiten", () => {
  assert.equal(content.CONTENT_LIMIT, 10000);
  assert.equal(content.playlistItemPageOffset(192, 10000), 9550);
  assert.equal(content.playlistItemsUrl(playlist, 9550),
    `https://api.spotify.com/v1/playlists/${id(5)}/items?limit=50&offset=9550`);
  assert.equal(content.normalizePlaylistItemsPage(spotifyPage(9550, 10000), playlist, 9550).hasMore, true);
  assert.equal(content.normalizePlaylistItemsPage(spotifyPage(9950, 12000), playlist, 9950).hasMore, false);
});

test("Ungültige API-Seitenzahlen und ungültige Offsets werden früh verworfen", () => {
  for (const [page, total] of [[0, 3000], [-1, 1000], [61, 3000], [201, 12000],
    [1.5, 3000], [Infinity, 3000], [1, 0], [1, 1000001]]) {
    assert.throws(() => content.playlistItemPageOffset(page, total));
  }
  assert.throws(() => content.playlistItemsUrl(playlist, 10000));
});

test("Weit entfernte Seiten führen weder Überschreibungen noch Positionsduplikate aus", () => {
  const first = content.normalizePlaylistItemsPage(spotifyPage(0), playlist, 0).items;
  const remote = content.normalizePlaylistItemsPage(spotifyPage(1550), playlist, 1550).items;
  const merged = content.mergePlaylistItems(first, remote);
  assert.equal(merged.length, 100);
  assert.deepEqual(as(merged.map(x => x.position).slice(49, 52)), [49, 1550, 1551]);
  assert.equal(content.mergePlaylistItems(merged, remote).length, 100);
});

test("Eigentümerprüfung liest nur Spotify-API und bestätigt korrekte Quelle", async () => {
  const urls = [];
  const got = await details.fetchOwnedPlaylistDetails(playlist, async url => {
    urls.push(url);
    return url.endsWith("/me") ? { id: "owner" } : owns;
  });
  assert.deepEqual(as(got), { uri: playlist, name: "My Mix", description: "Old", ownerId: "owner" });
  assert.deepEqual(urls, ["https://api.spotify.com/v1/me",
    `https://api.spotify.com/v1/playlists/${id(5)}?fields=id,uri,name,description,owner(id)`]);
});

test("Fremde, fehlende und vertauschte Eigentümerdaten werden abgelehnt", () => {
  assert.throws(() => details.parseOwnedPlaylistDetails(playlist, { id: "visitor" }, owns));
  assert.throws(() => details.parseOwnedPlaylistDetails(playlist, { id: "owner" },
    { ...owns, uri: `spotify:playlist:${id(9)}` }));
  assert.equal(details.parseOwnedPlaylistDetails(playlist, { id: "owner" },
    { ...owns, description: null }).description, "");
  assert.throws(() => details.parseOwnedPlaylistDetails(playlist, { id: "owner" },
    { ...owns, description: undefined }));
  assert.throws(() => details.playlistDetailsUrl("https://example.org/playlist"));
});

test("Metadaten validieren Namen/Beschreibung; keine Sichtbarkeit verändern", () => {
  assert.deepEqual(as(details.validatePlaylistDetailsChange(" Name ", " Beschr. ")),
    { name: "Name", description: "Beschr." });
  for (const [name, description] of [["", ""], ["X".repeat(101), ""],
    ["Ok", "X".repeat(301)], ["Bad\u0000", ""], ["Ok", "B\nad"]]) {
    assert.throws(() => details.validatePlaylistDetailsChange(name, description));
  }
});

test("PUT bestätigt auch eine leere Erfolgsantwort und versendet nur zwei Felder", async () => {
  const writes = [];
  const got = await details.updateSpotifyPlaylistDetails(
    { uri: playlist, name: "Old", description: "Old", ownerId: "owner" },
    "New", "Fresh", async (url, body) => { writes.push({ url, body: as(body) }); return undefined; });
  assert.equal(got, true);
  assert.deepEqual(writes, [{ url: `https://api.spotify.com/v1/playlists/${id(5)}`,
    body: { name: "New", description: "Fresh" } }]);
});

test("Keine Änderung, ungültige Eingabe und veraltete UI verhindern PUT", async () => {
  const original = { uri: playlist, name: "Old", description: "Old", ownerId: "owner" };
  let writes = 0;
  const put = async () => { writes++; };
  assert.equal(await details.updateSpotifyPlaylistDetails(original, "Old", "Old", put), false);
  assert.equal(await details.updateSpotifyPlaylistDetails(original, "New", "New", put, () => false), false);
  await assert.rejects(() => details.updateSpotifyPlaylistDetails(original, "", "New", put));
  assert.equal(writes, 0);
});

test("Bei Metadaten-Timeout nie wiederholt schreiben", async () => {
  let attempts = 0;
  await assert.rejects(() => details.updateSpotifyPlaylistDetails(
    { uri: playlist, name: "Old", description: "Old", ownerId: "owner" }, "New", "X",
    async () => { attempts++; throw Error("timeout"); }));
  assert.equal(attempts, 1);
});

test("UI lädt Seite 31 direkt; nur 100 geladene Einträge im Arbeitsbereich", async () => {
  const ui = harness();
  await ui.load();
  ui.change("zukato-manager-remote-page", "31");
  ui.button("playlistManager.jump").props.onClick();
  await flush();
  assert.equal(ui.requests.length, 2);
  assert.match(ui.requests[1], /offset=1500$/);
  assert.equal(ui.render().filter(n => n.type === "input" && n.props.type === "checkbox").length, 50);
  assert.ok(ui.render().some(n => n.type === "strong" && n.props?.children?.includes("Song 1500")));
  assert.ok(ui.render().some(n => n.type === "span" && n.props?.children?.includes("playlistManager.selected")));
});

test("UI blockiert ungültige Seiten vor dem Netzwerkaufruf", async () => {
  const ui = harness();
  await ui.load();
  ui.change("zukato-manager-remote-page", "9999");
  assert.equal(ui.button("playlistManager.jump").props.disabled, true);
  assert.equal(ui.requests.length, 1);
});

test("UI ändert ohne Klick oder ohne Besitzerprüfung keine Playlist-Metadaten", async () => {
  const ui = harness({ get: async url => url.endsWith("/me") ? { id: "other" }
    : url.includes("fields=id,uri") ? owns : spotifyPage(0) });
  ui.change("zukato-manager-source", playlist);
  assert.equal(ui.writes.length, 0);
  ui.button("playlistManager.detailsLoad").props.onClick();
  await flush();
  assert.equal(ui.field("zukato-manager-details-name"), undefined);
  assert.equal(ui.writes.length, 0);
});

test("UI fragt vor Metadatenänderung; PUT ohne Song- oder Sichtbarkeitsänderung", async () => {
  const ui = harness();
  ui.change("zukato-manager-source", playlist);
  ui.button("playlistManager.detailsLoad").props.onClick();
  await flush();
  ui.change("zukato-manager-details-name", "New Mix");
  ui.change("zukato-manager-details-description", "Summer");
  ui.button("playlistManager.detailsSave").props.onClick();
  await flush();
  assert.equal(ui.confirms, 1);
  assert.equal(ui.writes.length, 1);
  assert.deepEqual(ui.writes[0].body, { name: "New Mix", description: "Summer" });
  assert.equal(ui.field("zukato-manager-details-name"), undefined);
});

test("UI: abgelehnte Bestätigung und Doppelklick senden keine doppelte Änderung", async () => {
  const refused = harness({ confirm: false });
  refused.change("zukato-manager-source", playlist);
  refused.button("playlistManager.detailsLoad").props.onClick();
  await flush();
  refused.change("zukato-manager-details-name", "Other");
  refused.button("playlistManager.detailsSave").props.onClick();
  await flush();
  assert.equal(refused.writes.length, 0);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const ui = harness({ put: async () => { await pending; } });
  ui.change("zukato-manager-source", playlist);
  ui.button("playlistManager.detailsLoad").props.onClick();
  await flush();
  ui.change("zukato-manager-details-name", "Other");
  const button = ui.button("playlistManager.detailsSave");
  button.props.onClick(); button.props.onClick();
  await flush();
  assert.equal(ui.writes.length, 1);
  release(); await flush();
  assert.equal(ui.writes.length, 1);
});
