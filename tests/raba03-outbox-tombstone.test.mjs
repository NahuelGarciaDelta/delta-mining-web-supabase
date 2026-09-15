import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync("supabase/sql/20260915_raba03_delete_tombstone_outbox.sql","utf8");
const patch=fs.readFileSync("docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-ONDEMAND-OUTBOX-V2.gs","utf8");

test("la baja RABA03 usa tombstone y outbox",()=>{
  assert.match(sql,/abastecimiento_raba03_delete_tombstones/);
  assert.match(sql,/delete_solicitud/);
  assert.match(sql,/abastecimiento_raba03_block_tombstone_trg/);
  assert.match(sql,/delta_raba03_block_tombstone_trg/);
  assert.match(sql,/abastecimiento_raba03_confirm_sheet_delete/);
});

test("Apps Script procesa cant_enviada, códigos y eliminación RABA03",()=>{
  assert.match(patch,/domain==="raba03"/);
  assert.match(patch,/handleSaveRABA03CantEnviada_/);
  assert.match(patch,/handleSaveRABA03Codigos_/);
  assert.match(patch,/deltaDeleteRaba03SolicitudFromSheets_/);
  assert.match(patch,/abastecimiento_raba03_active_tombstones/);
  assert.match(patch,/abastecimiento_raba03_confirm_sheet_delete/);
});
