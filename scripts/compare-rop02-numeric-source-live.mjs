import fs from "node:fs";

const fileEnv=fs.existsSync(".env.local")?Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(x=>x&&!x.startsWith("#")&&x.includes("=")).map(x=>{const i=x.indexOf("=");return[x.slice(0,i),x.slice(i+1)]})):{};
const env={...fileEnv,...process.env};
const base=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY,app=env.VITE_APPS_SCRIPT_URL;
if(!base||!key||!app)throw new Error("Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o VITE_APPS_SCRIPT_URL.");
const headers={apikey:key,Authorization:`Bearer ${key}`};
const sources=["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"];
const norm=v=>String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const pick=(row,names)=>{const wanted=names.map(norm);for(const [k,v] of Object.entries(row||{}))if(wanted.includes(norm(k)))return v;return""};
const toOriginalNumber=value=>{if(value===null||value===undefined||value==="")return 0;if(typeof value==="number")return Number.isFinite(value)?value:0;let s=String(value).trim().replace(/[^\d,.-]/g,"");if(!s)return 0;const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");if(comma!==-1&&dot!==-1)s=comma>dot?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");else if(comma!==-1){const decimals=s.length-comma-1;s=decimals>0&&decimals<=2?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");}else if(dot!==-1){const decimals=s.length-dot-1;s=decimals>0&&decimals<=2?s.replace(/,/g,""):s.replace(/\./g,"");}return parseFloat(s)||0;};
async function sheet(action){const url=new URL(app);url.search=new URLSearchParams({action,limit:"all",force:"1",compact:"0",_t:String(Date.now())});const response=await fetch(url),json=await response.json();if(!response.ok||!json.ok)throw new Error(`${action}: ${JSON.stringify(json.error||json)}`);return json.data||[];}
async function db(source){const rows=[];for(let offset=0;;offset+=1000){const url=`${base}/rest/v1/rop02?select=source_dataset,source_row,fecha,interno,cantidad_horas,combustible&source_dataset=eq.${source}&order=source_row.asc&offset=${offset}&limit=1000`,response=await fetch(url,{headers}),page=await response.json();if(!response.ok)throw new Error(`${source}: ${JSON.stringify(page)}`);rows.push(...page);if(page.length<1000)break;}return rows;}
const valid=row=>String(pick(row,["Fecha","Fecha:","col_0"])||"").trim()&&String(pick(row,["Interno","Código Interno","Codigo Interno","col_1"])||"").trim();
const number=value=>Number(value??0),results={};
for(const source of sources){
  const [sheetRows,database]=await Promise.all([sheet(source),db(source)]),expected=sheetRows.map((row,index)=>({source_row:5+index,row})).filter(entry=>valid(entry.row)),databaseByRow=new Map(database.map(row=>[Number(row.source_row),row])),missing=[],differences=[];
  for(const entry of expected){const actual=databaseByRow.get(entry.source_row);if(!actual){missing.push(entry.source_row);continue;}const hours=toOriginalNumber(pick(entry.row,["Cant. Hs.","Cantidad de horas","Cant Hs","Horas"])),fuel=toOriginalNumber(pick(entry.row,["Combustible","Cantidad Combustible"]));if(hours!==number(actual.cantidad_horas)||fuel!==number(actual.combustible))differences.push({sourceRow:entry.source_row,fecha:actual.fecha,interno:actual.interno,hoursSheet:hours,hoursDb:actual.cantidad_horas,fuelSheet:fuel,fuelDb:actual.combustible});}
  const expectedRows=new Set(expected.map(entry=>entry.source_row)),extra=database.filter(row=>!expectedRows.has(Number(row.source_row))).map(row=>row.source_row);
  results[source]={sheetRows:sheetRows.length,validRows:expected.length,dbRows:database.length,missingRows:missing.length,extraRows:extra.length,differences:differences.length,sample:{missing:missing.slice(0,20),extra:extra.slice(0,20),numeric:differences.slice(0,20)},hoursSheet:expected.reduce((sum,entry)=>sum+toOriginalNumber(pick(entry.row,["Cant. Hs.","Cantidad de horas","Cant Hs","Horas"])),0),hoursDb:database.reduce((sum,row)=>sum+number(row.cantidad_horas),0),fuelSheet:expected.reduce((sum,entry)=>sum+toOriginalNumber(pick(entry.row,["Combustible","Cantidad Combustible"])),0),fuelDb:database.reduce((sum,row)=>sum+number(row.combustible),0)};
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
