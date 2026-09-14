import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {abastecimientoFifoDashboardParityVitePlugin} from '../scripts/abastecimiento-fifo-dashboard-parity-vite-plugin.mjs';

const root=process.cwd();

test('Abastecimiento dashboard/export/save use FIFO allocations and unmatched ignores rejected requests',()=>{
  const source=fs.readFileSync(path.join(root,'src/modules/abastecimiento/AbastecimientoModule.jsx'),'utf8');
  const plugin=abastecimientoFifoDashboardParityVitePlugin();
  const result=plugin.transform(source,path.join(root,'src/modules/abastecimiento/AbastecimientoModule.jsx'));
  assert.ok(result?.code,'transform must produce code');
  const code=result.code;
  const dash=code.match(/const raba03DashboardRows=useMemo\(\(\)=>\{[\s\S]*?\},\[assignedRows,calcularIndicadorRABA03\]\);/)?.[0]||'';
  assert.match(dash,/_matchedRemitos/);
  assert.doesNotMatch(dash,/remitosByCode/);
  const download=code.match(/const raba03DownloadRows=useMemo\(\(\)=>\{[\s\S]*?\},\[sortedRows,calcularIndicadorRABA03\]\);/)?.[0]||'';
  assert.match(download,/_matchedRemitos/);
  assert.doesNotMatch(download,/remitosByCode/);
  const save=code.match(/const guardarDatosRABA03=useCallback\(async\(\)=>\{[\s\S]*?\},\[rows,toNumber,loadRaba03\]\);/)?.[0]||'';
  assert.match(save,/_matchedRemitos/);
  assert.doesNotMatch(save,/remitosByCode/);
  assert.match(code,/solicitudesValidas=\(rows\|\|\[\]\)\.filter\(row=>!rejectedSolicitudes\?\.\[buildSolicitudKey\(row\)\]\)/);
  assert.match(code,/allocateRemitosToRequests\(base,remitos\)\.unmatched/);
  assert.doesNotMatch(code,/buildEnviosSinSolicitudRows\s*\(\s*\{/);
});