import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");

test("RABA03 reads from authoritative Google Sheet, not Supabase table",()=>{
  assert.match(source,/readRaba03FromGoogleSheet_/);
  assert.match(source,/sheetUrl_\("raba03"/);
  assert.match(source,/force:\"1\"/);
  assert.match(source,/raba03Source:\"google-sheet-authoritative\"/);
});

test("RABA03 writes persist to Google Sheet before reporting success",()=>{
  assert.match(source,/action:\"add_raba03_rows_append_only\"/);
  assert.match(source,/\?\"save_raba03_cant_enviada\"/);
  assert.match(source,/\?\"save_raba03_codigos\"/);
  assert.doesNotMatch(source,/rpc\(\"abastecimiento_append_raba03\"/);
  assert.doesNotMatch(source,/rpc\(\"abastecimiento_update_raba03\"/);
});

test("RABA03 stale local cache is invalidated after authoritative reads and writes",()=>{
  assert.match(source,/RABA03_LOCAL_CACHE_KEY/);
  assert.match(source,/clearDatasetCache\(RABA03_LOCAL_CACHE_KEY\)/);
});
