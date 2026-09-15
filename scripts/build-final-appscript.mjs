import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const base=path.join(root,"docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-09-POST-AUDIT.gs");
const patch=path.join(root,"docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-ONDEMAND-OUTBOX-V2.gs");
const out=path.join(root,"docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-15.gs");

const baseText=fs.readFileSync(base,"utf8").trimEnd();
const patchText=fs.readFileSync(patch,"utf8").trim();
const output=baseText+"\n\n"+patchText+"\n";
fs.writeFileSync(out,output,"utf8");
console.log(`Apps Script final generado: ${path.relative(root,out)} (${output.length} caracteres)`);
