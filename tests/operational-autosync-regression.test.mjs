import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { operationalFreshnessVitePlugin } from "../scripts/operational-freshness-vite-plugin.mjs";

const read=path=>fs.readFileSync(path,"utf8");

test("ROP02 no espera a que terminen las cuatro fuentes para renderizar",()=>{
  const source=read("src/App.jsx");
  const transformed=operationalFreshnessVitePlugin().transform(source,"/src/App.jsx");
  assert.ok(transformed?.code);
  assert.match(transformed.code,/commitSource\(key,result\.value\)/);
  assert.doesNotMatch(transformed.code,/const results=await Promise\.allSettled\(toCheck\.map/);
  assert.match(transformed.code,/OPERATIONAL_SOURCE_TIMEOUT_MS=30000/);
  assert.match(transformed.code,/withOperationalSourceTimeout\(getOperationalSource\(key\),key\)/);
});

test("la app revalida por versión Supabase y no conserva insumos viejos del cache",()=>{
  const source=read("src/App.jsx");
  const transformed=operationalFreshnessVitePlugin().transform(source,"/src/App.jsx");
  assert.match(transformed.code,/getOperationalSourceVersions\(versionKeys\)/);
  assert.match(transformed.code,/const changed=serverVersion>0&&serverVersion!==localVersion/);
  assert.match(transformed.code,/fetchedWithVersion=serverVersion>0/);
  const rpc=read("supabase/sql/20260916_operational_source_versions.sql");
  assert.match(rpc,/create or replace function public\.operational_source_versions/i);
  assert.match(rpc,/select 'insumos'/i);
  assert.match(rpc,/max\(synced_at\)/i);
});

test("cada edición de Sheet agenda sincronización automática rápida a Supabase",()=>{
  const patch=read("docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-16-AUTOSYNC-V5.gs");
  const generator=read("scripts/build-final-appscript.mjs");
  assert.match(patch,/2026-09-16-SHEETS-AUTOSYNC-V5/);
  assert.match(patch,/function onDatasetSheetChange_\(e\)/);
  assert.match(patch,/deltaMarkDatasetsDirty_\(keys\)/);
  assert.match(patch,/deltaEnsureFastSync_\(\)/);
  assert.match(patch,/\.after\(DELTA_FAST_SYNC_DELAY_MS_\)/);
  assert.match(patch,/everyMinutes\(5\)/);
  assert.match(patch,/everyHours\(1\)/);
  assert.match(generator,/AUTOSYNC-V5\.gs/);
});
