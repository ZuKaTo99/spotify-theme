// =============================================================================
// Dashboard-Karten: stabile Reihenfolge, Migration und lokale Speicherung.
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadPureSharedModule } from "./helpers/load-ts-module.mjs";
const root=path.resolve(import.meta.dirname,"..");
function load(storage=new Map(),blocked=false){
  const window={localStorage:{getItem(k){if(blocked)throw Error("locked");return storage.get(k)??null},setItem(k,v){if(blocked)throw Error("locked");storage.set(k,v)}}};
  return {...loadPureSharedModule(root,"src/shared/dashboard-preferences.ts",{window}),storage};
}
const arr=x=>Array.from(x);
const expected=["stats","activity","recent","overview","favorites","notes"];
test("v1.72: sechs Dashboard-Karten mit stabilen IDs",()=>{
  const m=load();assert.deepEqual(arr(m.DASHBOARD_SECTIONS),expected);assert.deepEqual(arr(m.defaultDashboardPreferences().cardOrder),expected);
});
test("v1.72: alte Dashboard-Konfiguration ohne Reihenfolge bleibt kompatibel",()=>{
  const m=load(),v=m.normalizeDashboardPreferences({shortcuts:["favorites"],period:"30d",hiddenSections:["recent"]});
  assert.deepEqual(arr(v.cardOrder),expected);assert.deepEqual(arr(v.shortcuts),["favorites"]);assert.equal(v.period,"30d");assert.deepEqual(arr(v.hiddenSections),["recent"]);
});
test("v1.72: unbekannte und doppelte Karten-IDs werden verworfen",()=>{
  const m=load(),v=m.normalizeDashboardPreferences({cardOrder:["notes","other","notes",42,"favorites","stats"]});
  assert.deepEqual(arr(v.cardOrder),["notes","favorites","stats","activity","recent","overview"]);
});
test("v1.72: Verschieben verändert die ursprüngliche Konfiguration nicht",()=>{
  const m=load(),v=m.defaultDashboardPreferences(),changed=m.moveDashboardCard(v,"activity",-1);
  assert.deepEqual(arr(changed.cardOrder),["activity","stats","recent","overview","favorites","notes"]);assert.deepEqual(arr(v.cardOrder),expected);
});
test("v1.72: Grenzen und unbekannte Ziele bleiben ohne Effekt",()=>{
  const m=load(),v=m.defaultDashboardPreferences();for(const [id,d] of [["stats",-1],["notes",1],["nope",1]])assert.deepEqual(arr(m.moveDashboardCard(v,id,d).cardOrder),expected);
});
test("v1.72: Verstecken lässt Reihenfolge und Schnellzugriffe erhalten",()=>{
  const m=load(),v=m.moveDashboardCard(m.defaultDashboardPreferences(),"favorites",-1),h=m.toggleDashboardSection(v,"favorites");
  assert.ok(h.hiddenSections.includes("favorites"));assert.deepEqual(arr(h.cardOrder),arr(v.cardOrder));assert.deepEqual(arr(h.shortcuts),arr(v.shortcuts));
});
test("v1.72: Reihenfolge übersteht lokales Speichern und Neuladen",()=>{
  const storage=new Map(),m=load(storage);let v=m.defaultDashboardPreferences();v=m.moveDashboardCard(v,"notes",-1);v=m.moveDashboardCard(v,"notes",-1);m.rememberDashboardPreferences(v);
  assert.deepEqual(arr(load(storage).readDashboardPreferences().cardOrder),arr(v.cardOrder));
});
test("v1.72: gesperrter Speicher verhindert lokales Umsortieren nicht",()=>{
  const m=load(new Map(),true);const v=m.moveDashboardCard(m.readDashboardPreferences(),"notes",-1);assert.equal(v.cardOrder.indexOf("notes"),4);assert.doesNotThrow(()=>m.rememberDashboardPreferences(v));
});
test("v1.72: Reset stellt volle Kartenreihenfolge wieder her",()=>{
  const m=load(),v=m.moveDashboardCard(m.defaultDashboardPreferences(),"notes",-1);assert.notDeepEqual(arr(v.cardOrder),expected);assert.deepEqual(arr(m.defaultDashboardPreferences().cardOrder),expected);
});
