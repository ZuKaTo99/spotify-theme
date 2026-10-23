// =============================================================================
// Datei: tests/listening-insights-v170.test.mjs
// Zweck: Die neue Musikstatistik mit reiner Datenlogik und realen TSX-Callbacks
// testen. Keine Spotify-API, kein Internet und keine Veränderungen am Storage.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { analyzeListeningHistory } = loadPureSharedModule(root, "src/shared/listening-insights.ts");
const now = new Date(2026, 9, 23, 12, 30).getTime();
const atDay = (daysAgo, hour = 12) => new Date(2026, 9, 23 - daysAgo, hour).getTime();
const entry = (uri, daysAgo = 0, artist = "A", title = uri, playedAt = atDay(daysAgo)) =>
  ({ uri, title, artist, album: "", playedAt });

test("7 Tage meint Kalender-Tage ab Mitternacht, einschließlich heute", () => {
  const data = [entry("today", 0), entry("six", 6, "A", "six", atDay(6, 0)), entry("seven", 7)];
  const result = analyzeListeningHistory(data, "7d", now);
  assert.equal(result.events, 2);
  assert.equal(result.unique, 2);
  assert.equal(result.today, 1);
  assert.equal(result.activeDays, 2);
});

test("30 Tage enthält genau den ersten eingeschlossenen Tag", () => {
  const result = analyzeListeningHistory([entry("29", 29), entry("30", 30)], "30d", now);
  assert.equal(result.events, 1);
});

test("Gesamter Verlauf ignoriert nicht die ältesten gültigen Songwechsel", () => {
  assert.equal(analyzeListeningHistory([entry("old", 900), entry("recent", 0)], "all", now).events, 2);
});

test("Fehlerhafte, negative und zukünftige Zeitstempel zählen niemals", () => {
  const data = [entry("ok"), entry("future", 0, "A", "future", now + 1),
    entry("bad", 0, "A", "bad", NaN), entry("negative", 0, "A", "negative", -1),
    entry("wrong", 0, "A", "wrong", "2026")];
  assert.equal(analyzeListeningHistory(data, "all", now).events, 1);
});

test("Sieben Tagesbalken enthalten echte Nulltage ohne erfundene Daten", () => {
  const result = analyzeListeningHistory([entry("a", 0), entry("b", 3)], "all", now);
  assert.equal(result.daily.length, 7);
  assert.deepEqual(Array.from(result.daily, x => x.count), [0, 0, 0, 1, 0, 0, 1]);
  assert.equal(result.daily[6].start, atDay(0, 0));
});

test("Songtitel-Kollisionen zählen nach URI separat", () => {
  const result = analyzeListeningHistory([entry("spotify:track:a", 0, "A", "Intro"),
    entry("spotify:track:b", 0, "A", "Intro"), entry("spotify:track:a", 0, "A", "Intro")], "all", now);
  assert.equal(result.unique, 2);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.tracks[0].uri, "spotify:track:a");
  assert.equal(result.tracks[0].count, 2);
});

test("Unbekannter Künstler darf keine leere Top-Künstler-Zeile erzeugen", () => {
  const result = analyzeListeningHistory([entry("a", 0, " "), entry("b", 0, "B")], "all", now);
  assert.deepEqual(Array.from(result.artists, item => item.name), ["B"]);
});

test("Ranglisten behalten bei Gleichstand stabile Reihenfolge", () => {
  const result = analyzeListeningHistory([entry("a", 0, "First"), entry("b", 0, "Second")], "all", now);
  assert.deepEqual(Array.from(result.artists, item => item.name), ["First", "Second"]);
});

test("Ranglisten werden auf zehn Einträge begrenzt, ohne den Verlauf zu ändern", () => {
  const data = Array.from({ length: 14 }, (_, i) => entry(`item${i}`, 0, `artist${i}`));
  const before = JSON.stringify(data);
  const result = analyzeListeningHistory(data, "all", now);
  assert.equal(result.artists.length, 10);
  assert.equal(result.tracks.length, 10);
  assert.equal(JSON.stringify(data), before);
});

test("Leerer Verlauf liefert keine Rankings und sieben Null-Tagesbalken", () => {
  const result = analyzeListeningHistory([], "all", now);
  assert.equal(result.today, 0);
  assert.equal(result.events, 0);
  assert.equal(result.activeDays, 0);
  assert.equal(result.artists.length, 0);
  assert.ok(result.daily.every(day => day.count === 0));
});

test("7-Tage-Kurve bleibt auch bei Filter 'Gesamter Verlauf' eine 7-Tage-Kurve", () => {
  const result = analyzeListeningHistory([entry("ancient", 60)], "all", now);
  assert.equal(result.events, 1);
  assert.equal(result.daily.reduce((sum, item) => sum + item.count, 0), 0);
});

function findNodes(node, predicate, result = []) {
  if (Array.isArray(node)) { node.forEach(item => findNodes(item, predicate, result)); return result; }
  if (!node || typeof node !== "object") return result;
  if (predicate(node)) result.push(node);
  findNodes(node.props?.children, predicate, result);
  return result;
}

test("Statistik: echte Zeitraum-Buttons wechseln Anzeige zwischen 7d und all", () => {
  const compiled = compileTsxForTest(root, "src/custom-app/modules/statistics/Statistics.tsx");
  const logs = [entry("recent", 0, "A", "recent", Date.now() - 60000),
    entry("old", 90, "A", "old", Date.now() - 90 * 86400000)];
  let state;
  const react = {
    Fragment: Symbol("Fragment"),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [state ?? initial, value => { state = value; }],
    useMemo: fn => fn(),
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Spicetify: { React: react },
    require: name => {
      if (name.includes("listening-insights")) return { analyzeListeningHistory };
      if (name.includes("useToolkitData")) return { useToolkitData: () => ({ history: logs, favorites: [], notes: [] }) };
      if (name.includes("ListeningActivity")) return { ListeningActivity: () => null };
      // v1.73: eigener Bibliotheksbereich wird separat getestet.
      if (name.includes("LibraryDiscovery")) return { LibraryDiscovery: () => null };
      throw new Error(`Unerwarteter Import ${name}`);
    },
  }, { timeout: 2000 });
  const t = key => key;
  const tree = () => exports.Statistics({ t });
  const metricValue = rootNode => findNodes(rootNode, n => n.type === "strong" && n.props?.children?.includes(1)).length;
  assert.ok(metricValue(tree()) >= 1);
  const buttons = findNodes(tree(), node => node.type === "button" &&
    node.props?.children?.some?.(value => String(value).startsWith("stats.period.")));
  assert.equal(buttons.length, 3);
  assert.equal(buttons[1].props["aria-pressed"], true);
  buttons[2].props.onClick();
  const nextTree = tree();
  const allButton = findNodes(nextTree, n => n.type === "button" && n.props?.children?.includes("stats.period.all"))[0];
  assert.equal(allButton.props["aria-pressed"], true);
  const values = findNodes(nextTree, n => n.type === "strong").map(n => n.props?.children?.[0]);
  assert.ok(values.includes(2), "Alle lokalen Songwechsel sollen erscheinen");
});

test("Dashboard bietet Aktivitätsansicht und Link nur für aktivierte Statistik", () => {
  const source = readFileSync(path.join(root, "src/custom-app/modules/dashboard/Dashboard.tsx"), "utf8");
  assert.match(source, /analyzeListeningHistory\(history, "7d"\)/);
  assert.match(source, /<ListeningActivity daily=\{insights\.daily\}/);
  assert.match(source, /visible\.has\("statistics"\).*onNavigate\("statistics"\)/s);
  assert.match(source, /dashboard\.activitySummary/);
});
