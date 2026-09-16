import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const base=path.join(root,"docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-09-POST-AUDIT.gs");
const patches=[
  path.join(root,"docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-ONDEMAND-OUTBOX-V2.gs"),
  path.join(root,"docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-AUTHORITATIVE-SHEETS-V3.gs"),
  path.join(root,"docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-16-INCREMENTAL-SYNC-V4.gs"),
  path.join(root,"docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-16-INCREMENTAL-LOCKFIX-V4B.gs"),
];
const out=path.join(root,"docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-15.gs");

const parts=[fs.readFileSync(base,"utf8").trimEnd(),...patches.map(p=>fs.readFileSync(p,"utf8").trim())];
const output=parts.join("\n\n")+"\n";
fs.writeFileSync(out,output,"utf8");
console.log(`Apps Script final generado: ${path.relative(root,out)} (${output.length} caracteres)`);
