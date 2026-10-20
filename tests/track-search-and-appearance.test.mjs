// =============================================================================
// Datei: tests/track-search-and-appearance.test.mjs
// Testet reine Funktionslogik ohne Browser/Spotify-Live-Client:
// Link-Parsing, defensive API-Antworten, Farbvalidierung, Farbkontrast.
// TypeScript wird aus lokalen devDependencies zur Laufzeit transpiliert.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Kein `require("typescript").transpileModule`: TypeScript 7 hat diese
// öffentliche CommonJS-API nicht mehr. Siehe gemeinsamen Test-Helfer.
const loadModule = (file, globals = {}) => loadPureSharedModule(root, file, globals);
const search = loadModule("src/shared/track-search.ts");

test("Spotify-Links, intl-Pfade und URIs werden als Titel erkannt", () => {
  const id = "4iV5W9uYEdYUVa79Axb7Rh";
  assert.equal(search.parseSpotifyTrackInput(`https://open.spotify.com/track/${id}?si=example`), `spotify:track:${id}`);
  assert.equal(search.parseSpotifyTrackInput(`https://open.spotify.com/intl-de/track/${id}`), `spotify:track:${id}`);
  assert.equal(search.parseSpotifyTrackInput(`spotify:track:${id}`), `spotify:track:${id}`);
  assert.equal(search.parseSpotifyTrackInput(`https://open.spotify.com/playlist/${id}`), null);
  assert.equal(search.parseSpotifyTrackInput(`https://not-spotify.com/track/${id}`), null);
  assert.equal(search.parseSpotifyTrackInput(`javascript:alert(1)`), null);
});

test("API-Suchergebnisse validieren, sortieren und doppelte Titel filtern", () => {
  const id = "4iV5W9uYEdYUVa79Axb7Rh";
  const response = { tracks: { items: [
    { uri: `spotify:track:${id}`, name: "Test-Song", artists: [{ name: "Künstlerin" }], album: { name: "Album" } },
    { uri: `spotify:track:${id}`, name: "Doppelt" },
    { uri: "https://example.com/track/xx", name: "Unbekannt" },
    null,
  ] } };
  const found = search.parseSpotifySearchResponse(response);
  assert.equal(found.length, 1);
  assert.equal(found[0].title, "Test-Song");
  assert.equal(found[0].artist, "Künstlerin");
  assert.equal(found[0].album, "Album");
});

test("Nur offizielle Spotify-Endpunkte werden für die Suche verwendet", async () => {
  let requested = "";
  const api = loadModule("src/shared/track-search.ts", { Spicetify: { CosmosAsync: {
    get: async (url) => { requested = url; return { tracks: { items: [] } }; },
  } } });
  await api.searchSpotifyTracks("Björk & Friends");
  assert.match(requested, /^https:\/\/api\.spotify\.com\/v1\/search\?/);
  assert.ok(requested.includes("q=Bj%C3%B6rk%20%26%20Friends"));
});

const appearance = loadModule("src/shared/appearance.ts");
test("24 Presetfarben, alte Preset-IDs und HEX-Schutz", () => {
  assert.equal(Object.keys(appearance.PALETTES).length, 24);
  assert.equal(appearance.normalizePalette("emerald"), "emerald");
  assert.equal(appearance.normalizePalette("#AaBBcc"), "#aabbcc");
  assert.equal(appearance.normalizePalette("red; background:url(x)"), "emerald");
  assert.equal(appearance.onAccentColor("#ffffff"), "#101410");
  assert.equal(appearance.onAccentColor("#000000"), "#ffffff");
});
