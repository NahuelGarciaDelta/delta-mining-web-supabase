import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/services/abastecimientoSupabase.js',import.meta.url),'utf8');

test('Abastecimiento reads the complete RABA03 dataset from Supabase snapshot',()=>{
  const fn=source.match(/export async function getAbastecimientoSnapshot[\s\S]*?\n}\n\nexport function invalidateAbastecimientoSnapshot/)?.[0]||'';
  assert.match(fn,/requireSupabase\(\)\.rpc\("abastecimiento_snapshot",\{\}\)/);
  assert.match(fn,/raba03Source:"supabase"/);
  assert.doesNotMatch(fn,/readRaba03FromGoogleSheet_/);
  assert.doesNotMatch(fn,/limit:\s*"all"/);
});
