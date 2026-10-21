// =============================================================================
// Datei: tests/spotify-playlist-transfer-v160.test.mjs
// Zweck: Playlist-Export vollständig offline prüfen (keine echten API-Aufrufe).
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const transfer = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const playlistId = "A".repeat(22);
const playlist = `spotify:playlist:${playlistId}`;
const track = n => `spotify:track:${String(n).padStart(22,"0")}`;
const episode = n => `spotify:episode:${String(n).padStart(22,"0")}`;

test("Spotify-Playlist URI, Original-Link und intl-Link sind gültig", () => {
  assert.equal(transfer.parseSpotifyPlaylistInput(` ${playlist} `), playlist);
  assert.equal(transfer.parseSpotifyPlaylistInput(`https://open.spotify.com/playlist/${playlistId}?si=x`), playlist);
  assert.equal(transfer.parseSpotifyPlaylistInput(`https://open.spotify.com/intl-de/playlist/${playlistId}`), playlist);
});

test("Fremde Domains, Playlist-Kürzel und andere URI-Typen sind ungültig", () => {
  for (const input of ["spotify:playlist:short", `spotify:album:${playlistId}`,
    `https://open.spotify.com.evil.example/playlist/${playlistId}`,
    `http://open.spotify.com/playlist/${playlistId}`, `https://open.spotify.com/user/a/playlist/${playlistId}`]) {
    assert.equal(transfer.parseSpotifyPlaylistInput(input), null, input);
  }
});

test("Nur track/episode, Original- und normale Links werden normalisiert", () => {
  assert.equal(transfer.parsePlaylistItem(`https://open.spotify.com/track/${"1".repeat(22)}?si=hi`),
    `spotify:track:${"1".repeat(22)}`);
  assert.equal(transfer.parsePlaylistItem(episode(1)), episode(1));
  assert.equal(transfer.parsePlaylistItem(`spotify:album:${"1".repeat(22)}`), null);
});

test("250 Songs werden in 100/100/50 Blöcken in Originalreihenfolge gesendet", async () => {
  const sent = [];
  const songs = Array.from({ length: 250 }, (_, i) => track(i));
  const result = await transfer.addItemsToSpotifyPlaylist(playlist, songs, async (url, body) => {
    assert.equal(url, `https://api.spotify.com/v1/playlists/${playlistId}/items`);
    sent.push([...body.uris]);
    return { snapshot_id: "ok" };
  });
  assert.deepEqual(sent.map(b => b.length), [100,100,50]);
  assert.deepEqual(sent.flat(), songs);
  assert.deepEqual({ added: result.added, skipped: result.skipped }, { added: 250, skipped: 0 });
});

test("Duplikate und ungültige URIs werden ausgelassen und gezählt", async () => {
  let sent = [];
  const result = await transfer.addItemsToSpotifyPlaylist(playlist,
    [track(1), track(1), "broken", episode(2), track(4)], async (_, body) => { sent = [...body.uris]; });
  assert.deepEqual(sent, [track(1), episode(2), track(4)]);
  assert.equal(result.skipped, 2);
  assert.equal(result.added, 3);
});

test("Ungültiges Ziel wird vor JEDEM Request abgelehnt", async () => {
  let requests = 0;
  await assert.rejects(transfer.addItemsToSpotifyPlaylist("wrong", [track(1)], async () => { requests++; }));
  assert.equal(requests, 0);
});

test("Nur ungültige Einträge führen zu keinem Spotify-Aufruf", async () => {
  let requests = 0;
  const result = await transfer.addItemsToSpotifyPlaylist(playlist, ["broken", "bad"], async () => { requests++; });
  assert.equal(requests, 0);
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 2);
});

test("API-Fehler nach erstem Batch meldet Teilmenge und stoppt sofort", async () => {
  let requests = 0;
  await assert.rejects(
    transfer.addItemsToSpotifyPlaylist(playlist, Array.from({ length: 240 }, (_, i) => track(i)), async () => {
      requests++;
      if (requests === 2) throw Error("permission denied");
    }),
    e => e.name === "PlaylistTransferError" && e.added === 100 && e.totalValid === 240,
  );
  assert.equal(requests, 2);
});

test("UI bietet Playlist-Transfer aus Favoriten und Hörverlauf", () => {
  const component = readFileSync(path.join(root,"src/custom-app/components/BulkTrackActions.tsx"),"utf8");
  const tool = readFileSync(path.join(root,"src/custom-app/modules/playlist-tools/PlaylistTools.tsx"),"utf8");
  assert.match(component, /<PlaylistDestination t=\{t\} uris=\{selected\.map/);
  assert.match(tool, /<PlaylistDestination t=\{t\} uris=\{favorites\.map/);
  const ui = readFileSync(path.join(root,"src/custom-app/components/PlaylistDestination.tsx"),"utf8");
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /if \(inFlight\.current/);
  assert.match(ui, /Spicetify\.CosmosAsync\.post/);
});

// Tatsächliche TSX-Callback-Prüfung: keine bloße Quelltextsuche.
test("UI: Gültiges Ziel braucht Bestätigung, Doppelklick verschickt nur einmal", async () => {
  const { runInNewContext } = await import("node:vm");
  const { compileTsxForTest } = await import("./helpers/compile-tsx-for-test.mjs");
  const exports = {};
  let confirmCalls = 0;
  let requests = 0;
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  // Hooks werden für diesen Test bewusst isoliert; useState wird neu gerendert
  // simuliert, indem sein aktueller Wert im Array aktualisiert wird.
  let state = [playlist, false, ""];
  let hookIndex = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const index = hookIndex++;
      if (state[index] === undefined) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useRef: initial => ({ current: initial }),
    useEffect() {},
  };
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistDestination.tsx"), {
    exports,
    Spicetify: { React: react, CosmosAsync: { post: async () => { requests++; await gate; } } },
    window: { confirm: () => { confirmCalls++; return true; } },
    console: { error() {} },
    require: spec => {
      if (spec.includes("spotify-playlist-transfer")) return transfer;
      throw Error(`Unknown import ${spec}`);
    },
  }, { timeout: 4000 });
  const tree = exports.PlaylistDestination({ t: x => x, uris: [track(1)] });
  const nodes = (item, found = []) => {
    if (Array.isArray(item)) { for (const x of item) nodes(x, found); return found; }
    if (item && typeof item === "object") {
      if (item.type === "button") found.push(item);
      nodes(item.props?.children, found);
    }
    return found;
  };
  const action = nodes(tree)[0];
  assert.equal(action.props.disabled, false);
  action.props.onClick();
  action.props.onClick();
  await Promise.resolve();
  assert.equal(confirmCalls, 1);
  assert.equal(requests, 1);
  unblock();
  await gate;
});

test("UI: Ungültiges Playlist-Ziel lässt die Aktion deaktiviert", async () => {
  const { runInNewContext } = await import("node:vm");
  const { compileTsxForTest } = await import("./helpers/compile-tsx-for-test.mjs");
  const exports = {};
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistDestination.tsx"), {
    exports,
    Spicetify: { React: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: initial => [initial, () => {}],
      useRef: initial => ({ current: initial }),
      useEffect() {},
    } },
    require: () => transfer,
  }, { timeout: 4000 });
  const tree = exports.PlaylistDestination({ t: x => x, uris: [track(1)] });
  const action = tree.props.children[1].props.children[1];
  assert.equal(action.type, "button");
  assert.equal(action.props.disabled, true);
});
