import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('../docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-09-POST-AUDIT.gs', import.meta.url),
);

test('post-install Apps Script keeps a verifiable audit and covers pending datasets', async () => {
  const source = await readFile(scriptPath, 'utf8');
  assert.match(source, /DELTA_SUPABASE_SYNC_VERSION_\s*=\s*"2026-09-10-MOVEMENTS-PARITY-V1"/);
  assert.match(source, /sync_authoritative_abastecimiento_storage/);
  assert.match(source, /deltaSyncStock_/);
  assert.match(source, /deltaSyncEquipmentMovements_/);
  assert.match(source, /deltaSyncTallerMovements_/);
  assert.match(source, /DELTA_SUPABASE_AUDIT_PROPERTY_/);
  assert.match(source, /datasets:datasets/);
  assert.match(source, /deltaStoreSyncAudit_\(push\.results,at\)/);
});
