// =============================================================================
// v1.73: Wiederentdecken nutzt ausschließlich lokalen Hörverlauf und echte
// Eventhandler; gespeicherte Favoriten/Songs werden nicht still verändert.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = loadPureSharedModule(root, "src/shared/library-discovery.ts");
const collection = loadPureSharedModule(root, "src/shared/collection-view.ts");
const select = loadPureSharedModule(root, "src/shared/bulk-selection.ts");
const uri = n => `spotify:track:${String(n).padStart(22, "0")}`;
const mk = (n, time, artist = "Künstler") => ({ uri: uri(n), title: `Titel ${n}`, artist, album: "Album", playedAt: time });
const now = Date.UTC(2026, 9, 23, 12, 0);
const hist = [mk(1, now - 100), mk(2, now - 1_000_000), mk(1, now - 10000), mk(2, now - 3_000_000), mk(2, now - 5_000_000), mk(3, now - 200)];
const flat = v => Array.from(v);

test("Wiederentdecken: häufigste bisher nicht gemerkte Titel zuerst", () => {
  const items = api.discoverLibraryTracks(hist, [], "frequent", 2, true, now);
  assert.deepEqual(flat(items.map(x => x.uri)), [uri(2), uri(1)]);
  assert.deepEqual(flat(items.map(x => x.count)), [3, 2]);
  assert.equal(items[1].lastPlayedAt, now - 100);
});
test("Wiederentdecken: lange nicht gehört basiert auf neuestem Songwechsel", () => {
  const items = api.discoverLibraryTracks(hist, [], "missed", 2, true, now);
  assert.deepEqual(flat(items.map(x => x.uri)), [uri(2), uri(1)]);
});
test("Favoriten werden wahlweise verborgen oder gekennzeichnet", () => {
  const favorite = [{ ...mk(2, now), playedAt: undefined }];
  assert.deepEqual(flat(api.discoverLibraryTracks(hist, favorite, "frequent", 2, true, now).map(x => x.uri)), [uri(1)]);
  const all = api.discoverLibraryTracks(hist, favorite, "frequent", 2, false, now);
  assert.equal(all.find(x => x.uri === uri(2)).isFavorite, true);
  assert.equal(all.find(x => x.uri === uri(1)).isFavorite, false);
});
test("Grenzen: ungültige URIs, Zukunft und kaputte Daten dürfen nicht zählen", () => {
  const poisoned = [...hist, mk(1, now + 1), mk(1, -100), mk(2, Number.NaN),
    { ...mk(1, now), uri: "spotify:track:short" },
    { ...mk(1, now), uri: "spotify:album:" + "X".repeat(22) }];
  const items = api.discoverLibraryTracks(poisoned, [], "frequent", 2, true, now);
  assert.deepEqual(flat(items.map(x => x.count)), [3, 2]);
});
test("Gleichnamige Songs werden anhand der Spotify-ID unterschieden", () => {
  const input = [mk(1, now - 1000), mk(2, now - 1000), mk(1, now), mk(2, now)];
  input.forEach(x => { x.title = "Identischer Titel"; });
  assert.equal(api.discoverLibraryTracks(input, [], "frequent", 2, true, now).length, 2);
});
test("Neue Metadaten werden nur von neuestem gültigem Songwechsel übernommen", () => {
  const input = [mk(1, now - 200, "Alt"), mk(1, now - 100, "Neu"), mk(1, now - 300, "Älter")];
  const result = api.discoverLibraryTracks(input, [], "frequent", 2, true, now);
  assert.equal(result[0].artist, "Neu");
  assert.equal(result[0].count, 3);
});
test("Ungültige Mindestzahl verwendet 2 und verändert Daten nicht", () => {
  const snapshot = JSON.stringify(hist);
  assert.equal(api.discoverLibraryTracks(hist, [], "frequent", 0, true, now).length, 2);
  assert.equal(api.discoverLibraryTracks(hist, [], "frequent", 3, true, now).length, 1);
  assert.equal(api.discoverLibraryTracks(hist, [], "frequent", 1, true, now).length, 3);
  assert.equal(JSON.stringify(hist), snapshot);
});
test("Tie-Breaker ist von der Reihenfolge des Hörverlaufs unabhängig", () => {
  const a = mk(1, now - 100), b = mk(2, now - 100);
  const result1 = api.discoverLibraryTracks([a, b], [], "frequent", 1, true, now);
  const result2 = api.discoverLibraryTracks([b, a], [], "frequent", 1, true, now);
  assert.deepEqual(flat(result1.map(x => x.uri)), flat(result2.map(x => x.uri)));
});

/** Ein kleiner Stateful-React-Ersatz: Buttons und Inputs führen denselben
 * Handler wie im Spotify-UI aus; nach setState erzeugen wir einen neuen Baum. */
function uiHarness() {
  const slots = []; let index = 0;
  const runtime = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useMemo: fn => fn(), useEffect() {},
  };
  const exports = {};
  runInNewContext(compileTsxForTest(root, "src/custom-app/components/LibraryDiscovery.tsx"), {
    exports, Spicetify: { React: runtime },
    require: spec => {
      if (spec.includes("library-discovery")) return api;
      if (spec.includes("collection-view")) return collection;
      if (spec.includes("bulk-selection")) return select;
      if (spec.includes("BulkTrackActions")) return { BulkTrackActions: function BulkTrackActions() {} };
      if (spec.includes("TrackList")) return { TrackList: function TrackList() {} };
      throw Error(`Unexpected import: ${spec}`);
    },
  }, { timeout: 2000 });
  return { render: (data = {}) => { index = 0; return exports.LibraryDiscovery({ history: hist.map(entry => ({ ...entry, playedAt: Date.now() - (now - entry.playedAt) })),
    favorites: [], t: (key, args = {}) => key.replace(/^discovery\.details$/, `${args.count}/${args.date}`), ...data }); } };
}
function elements(node, match, results = []) {
  if (Array.isArray(node)) { node.forEach(x => elements(x, match, results)); return results; }
  if (!node || typeof node !== "object") return results;
  if (match(node)) results.push(node);
  elements(node.props?.children, match, results);
  return results;
}
const of = (root, name) => elements(root, e => e.type?.name === name)[0];

test("UI: Statistik zeigt eine echte auswählbare Liste und gemeinsame Sammelaktionen", () => {
  const ui = uiHarness(), root = ui.render();
  assert.equal(of(root, "TrackList").props.tracks.length, 2);
  assert.equal(of(root, "BulkTrackActions").props.mode, "history");
  assert.equal(of(root, "BulkTrackActions").props.sourceTracks.length, 2);
});
test("UI: einzelne Checkbox wählt Song für Favorit, Queue und Playlist zugleich", () => {
  const ui = uiHarness(), first = ui.render(), list = of(first, "TrackList");
  list.props.onSelectionChange(uri(2), true);
  const second = ui.render();
  assert.equal(of(second, "BulkTrackActions").props.selectedUris.has(uri(2)), true);
  assert.equal(of(second, "BulkTrackActions").props.selectedUris.size, 1);
  assert.deepEqual(flat(of(second, "TrackList").props.tracks.map(x => x.uri)), [uri(2), uri(1)]);
});
test("UI: Mindesthäufigkeit und vorhandene Favoriten ändern die Vorschläge", () => {
  const ui = uiHarness(), view = ui.render();
  const minimum = elements(view, e => e.type === "select")[1];
  minimum.props.onChange({ currentTarget: { value: "3" } });
  assert.deepEqual(flat(of(ui.render(), "TrackList").props.tracks.map(x => x.uri)), [uri(2)]);
  assert.equal(of(ui.render({ favorites: [mk(2, now)] }), "TrackList").props.tracks.length, 0);
});
test("UI: Suchen löscht alte Auswahl, ohne Daten an Spotify zu schicken", () => {
  const ui = uiHarness();
  of(ui.render(), "TrackList").props.onSelectionChange(uri(2), true);
  const search = elements(ui.render(), e => e.type === "input" && e.props?.type === "search")[0];
  search.props.onChange({ currentTarget: { value: "Titel 1" } });
  const page = ui.render();
  assert.equal(of(page, "BulkTrackActions").props.selectedUris.size, 0);
  assert.deepEqual(flat(of(page, "TrackList").props.tracks.map(x => x.uri)), [uri(1)]);
});
test("UI: Umsortieren ändert Auswahl/Quellbibliothek nicht, filtert keine anderen Titel hinein", () => {
  const ui = uiHarness();
  const sort = elements(ui.render(), e => e.type === "select")[0];
  sort.props.onChange({ currentTarget: { value: "missed" } });
  assert.equal(of(ui.render(), "BulkTrackActions").props.sourceTracks.length, 2);
});
