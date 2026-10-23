// =============================================================================
// Datei: tests/playlist-create-v165.test.mjs
// Zweck: Neue Spotify-Playlist erstellen, ohne automatisch Titel einzufüllen.
// Spotify-Cosmos ist vollständig simuliert; tatsächliche POSTs sind ausgeschlossen.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = loadPureSharedModule(root, "src/shared/spotify-playlist-transfer.ts");
const playlist = `spotify:playlist:${"Z".repeat(22)}`;
const track = `spotify:track:${"A".repeat(22)}`;
const flush = () => new Promise(resolve => setImmediate(resolve));
const as = v => JSON.parse(JSON.stringify(v));

function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(value => nodes(value, result));
  else if (node && typeof node === "object") {
    result.push(node);
    nodes(node.props?.children, result);
  }
  return result;
}
function harness({ confirm = true, post = async url => url.endsWith("/me/playlists")
  ? { id: "Z".repeat(22), uri: playlist } : { snapshot_id: "ok" } } = {}) {
  const state = [], refs = [], posts = [];
  let hook = 0, ref = 0, confirmations = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const n = hook++;
      if (state[n] === undefined) state[n] = initial;
      return [state[n], next => { state[n] = typeof next === "function" ? next(state[n]) : next; }];
    },
    useRef: initial => {
      const n = ref++;
      if (!refs[n]) refs[n] = { current: initial };
      return refs[n];
    },
    useEffect() {},
  };
  const exports = {};
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/PlaylistDestination.tsx"), {
    exports,
    Spicetify: { React: react, CosmosAsync: {
      post: async (url, body) => { posts.push({ url, body: as(body) }); return post(url, body); },
      get: async () => ({ items: [], total: 0 }),
    } },
    window: { confirm: () => { confirmations++; return confirm; },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} } },
    console: { error() {} },
    require: spec => { if (spec.includes("spotify-playlist-transfer")) return api; throw Error(spec); },
  });
  function render() {
    hook = 0; ref = 0;
    return nodes(exports.PlaylistDestination({ t: k => k, uris: [track], idPrefix: "create-test" }));
  }
  const button = name => render().find(node => node.type === "button" && node.props?.children?.includes(name));
  const field = id => render().find(node => node.props?.id === `create-test-${id}`);
  function openAndFill(name = "Meine Mixliste") {
    button("playlistCreate.toggle").props.onClick();
    field("create-name").props.onChange({ currentTarget: { value: name } });
  }
  return { render, button, field, openAndFill, posts,
    get confirmations() { return confirmations; } };
}

test("Name, Beschreibung und Privatsphäre werden vor Netzwerkvalidierung geprüft", () => {
  assert.deepEqual(as(api.validateNewPlaylist("  Mix  ", "  Beschreibung  ", false)),
    { name: "Mix", description: "Beschreibung", public: false });
  for (const name of ["", " ", "X".repeat(101), "Hi\nAttack"]) {
    assert.throws(() => api.validateNewPlaylist(name, "", false));
  }
  for (const desc of ["X".repeat(301), "desc\u0000bad"]) {
    assert.throws(() => api.validateNewPlaylist("Mix", desc, false));
  }
  assert.throws(() => api.validateNewPlaylist("Mix", "", "false"));
});

test("Neuanlage verwendet POST /me/playlists, standardmäßig privat, ohne Songs", async () => {
  const writes = [];
  const result = await api.createSpotifyPlaylist(" Test ", " Bonus ", false,
    async (url, body) => {
      writes.push({ url, body: as(body) });
      return { id: "Z".repeat(22), uri: playlist };
    });
  assert.equal(result, playlist);
  assert.deepEqual(writes, [{ url: "https://api.spotify.com/v1/me/playlists",
    body: { name: "Test", description: "Bonus", public: false } }]);
});

test("Ungültige Serverantwort ergibt keinen angeblichen Erfolg und keinen Retry", async () => {
  let attempts = 0;
  await assert.rejects(() => api.createSpotifyPlaylist("Name", "", true, async () => {
    attempts++;
    return { id: "invalid", uri: "spotify:playlist:"+"A".repeat(22) };
  }));
  assert.equal(attempts, 1);
  await assert.rejects(() => api.createSpotifyPlaylist("Name", "", false, async () => ({
    id: "B".repeat(22), uri: "spotify:playlist:"+"C".repeat(22),
  })));
});

test("UI: Neue Playlist bleibt ohne Interaktion zu und löst keine Schreibaktion aus", () => {
  const ui = harness();
  assert.equal(ui.posts.length, 0);
  assert.equal(ui.field("create-name"), undefined);
  ui.openAndFill("Mix");
  assert.equal(ui.field("create-visibility").props.value, "private");
  assert.equal(ui.posts.length, 0);
});

test("UI: Bestätigung erstellt leere Playlist, füllt nur das Ziel und versendet keine Songs", async () => {
  const ui = harness();
  ui.openAndFill("Neuer Mix");
  ui.field("create-description").props.onChange({ currentTarget: { value: "Kleine Sammlung" } });
  ui.button("playlistCreate.submit").props.onClick();
  await flush();
  assert.equal(ui.confirmations, 1);
  assert.equal(ui.posts.length, 1);
  assert.equal(ui.posts[0].url, "https://api.spotify.com/v1/me/playlists");
  assert.equal(ui.posts[0].body.public, false);
  assert.deepEqual(Object.keys(ui.posts[0].body).sort(), ["description", "name", "public"]);
  assert.equal(ui.field("destination").props.value, playlist);
  assert.ok(ui.render().some(n => n.type === "p" && n.props?.children?.includes("playlistCreate.success")));
});

test("UI: Öffentlich nur nach aktiver Auswahl; kein POST ohne Bestätigung", async () => {
  const ui = harness({ confirm: false });
  ui.openAndFill("Public Mix");
  ui.field("create-visibility").props.onChange({ currentTarget: { value: "public" } });
  ui.button("playlistCreate.submit").props.onClick();
  await flush();
  assert.equal(ui.confirmations, 1);
  assert.equal(ui.posts.length, 0);
});

test("UI: Doppelklick auf Erstellen ruft Spotify höchstens einmal auf", async () => {
  let finish;
  const wait = new Promise(resolve => { finish = resolve; });
  const ui = harness({ post: async () => { await wait; return { uri: playlist }; } });
  ui.openAndFill("Doppelklick");
  const action = ui.button("playlistCreate.submit");
  action.props.onClick();
  action.props.onClick();
  await flush();
  assert.equal(ui.posts.length, 1);
  finish();
  await flush();
  assert.equal(ui.posts.length, 1);
});

test("UI: Serverausfall behält Eingaben und meldet mögliche Neuanlage", async () => {
  const ui = harness({ post: async () => { throw Error("timeout"); } });
  ui.openAndFill("Wichtige Liste");
  ui.button("playlistCreate.submit").props.onClick();
  await flush();
  assert.equal(ui.posts.length, 1);
  assert.equal(ui.field("create-name").props.value, "Wichtige Liste");
  assert.ok(ui.render().some(n => n.type === "p" && n.props?.children?.includes("playlistCreate.failed")));
});
