import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { compileTsxForTest } from "./helpers/compile-tsx-for-test.mjs";

const output = {};
runInNewContext(compileTsxForTest(path.resolve(import.meta.dirname, ".."),
  "src/custom-app/components/ListeningLandscape.tsx"), { exports: output });

test("Hörlandschaft: Nulltage bleiben auf Grundlinie, reale Maxima bilden die Spitze", () => {
  const data = [0, 0, 2, 0, 4, 0, 8].map((count, start) => ({ count, start }));
  const geometry = output.listeningLandscapeGeometry(data);
  assert.equal(geometry.points.length, 7);
  assert.equal(geometry.points[0].y, 174);
  assert.equal(geometry.points[6].y, 62);
  assert.ok(geometry.area.endsWith("Z"));
  assert.ok(!geometry.line.includes("NaN"));
});

test("Hörlandschaft: leere und beschädigte Tageswerte erzeugen keinen ungültigen Pfad", () => {
  assert.equal(output.listeningLandscapeGeometry([]).line, "");
  const geometry = output.listeningLandscapeGeometry([{ count: Number.NaN }, { count: -4 }]);
  assert.deepEqual(Array.from(geometry.points, ({ y }) => y), [174, 174]);
  assert.ok(!geometry.area.includes("NaN"));
});
