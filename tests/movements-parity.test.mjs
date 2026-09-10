import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");

test("movements refresh from Supabase and Ficha Única keeps generic justifications",()=>{
  const source=read("../src/services/equipmentMovements.js");
  assert.match(source,/getEquipmentMovementsSnapshot\(false,\{force:Boolean\(force\|\|revalidate\)\}\)/);
  assert.match(source,/\[\.\.\.\(Array\.isArray\(snapshot\.data\)\?snapshot\.data:\[\]\),\.\.\.tallerCanonical\]/);
});

test("Sheets movement synchronizers are service-only and included in the Apps Script cycle",()=>{
  const sql=read("../supabase/sql/20260910_movements_parity.sql");
  const script=read("../docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-09-POST-AUDIT.gs");
  assert.match(sql,/sync_app_equipment_movements_from_sheet/);
  assert.match(sql,/sync_app_taller_movements_from_sheet/);
  assert.match(sql,/grant execute .* to service_role/i);
  assert.match(script,/results\.movimientos_equipos=deltaSafeRun_\(deltaSyncEquipmentMovements_\)/);
  assert.match(script,/results\.movimientos_taller=deltaSafeRun_\(deltaSyncTallerMovements_\)/);
});