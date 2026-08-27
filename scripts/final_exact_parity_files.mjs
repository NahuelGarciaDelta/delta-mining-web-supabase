import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const originalDir=fs.mkdtempSync(path.join(os.tmpdir(),'delta-original-exact-'));
execFileSync('git',['clone','--depth=1','https://github.com/NahuelGarciaDelta/delta-mining-ops.git',originalDir],{stdio:'inherit'});
const file='src/modules/equipment/EquipmentProfileWithLastRop02.jsx';
fs.writeFileSync(path.join(root,file),fs.readFileSync(path.join(originalDir,file),'utf8'));
console.log(`Alineado exactamente: ${file}`);
