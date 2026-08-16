from pathlib import Path

p=Path('tests/rop02-supabase-boundary.test.mjs')
s=p.read_text(encoding='utf-8')
s=s.replace('''test("Supabase sigue siendo la fuente ROP02 predeterminada del servicio histórico",()=>{\n  const service=read("../src/data/historicalDataService.js");\n  assert.match(service,/VITE_ROP02_SOURCE\\|\\|"supabase"/);\n  assert.match(service,/dataset==="rop02"&&ROP02_SOURCE!=="legacy"/);\n  assert.match(service,/legacy-fallback/);\n});''','''test("el servicio histórico ROP02 es exclusivamente Supabase",()=>{\n  const service=read("../src/data/historicalDataService.js");\n  assert.match(service,/getRop02Page/);\n  assert.match(service,/getSupabaseOperationalSnapshot/);\n  assert.doesNotMatch(service,/legacy-fallback|APPS_SCRIPT_URL|query_dataset/);\n});''')
p.write_text(s,encoding='utf-8')

p=Path('tests/typed-operational-consumers.test.mjs')
s=p.read_text(encoding='utf-8')
s=s.replace('''test("ROP05 y RMA15 usan Supabase con fallback legacy puntual",()=>{\n  assert.match(service,/dataset==="rop05"\\?getRop05Page:dataset==="rma15"\\?getRma15Page/);\n  assert.match(service,/legacy-fallback/);\n  assert.match(service,/fetchAllOperationalPages/);\n});''','''test("ROP05 y RMA15 usan exclusivamente Supabase",()=>{\n  assert.match(service,/dataset==="rop05"\\?getRop05Page:dataset==="rma15"\\?getRma15Page/);\n  assert.doesNotMatch(service,/legacy-fallback|APPS_SCRIPT_URL/);\n  assert.match(service,/fetchAllOperationalPages/);\n});''')
p.write_text(s,encoding='utf-8')

p=Path('tests/stock-auth-session.test.mjs')
s=p.read_text(encoding='utf-8')
start=s.index('test("Stock usa GET sin actor')
end=s.index('\n});',start)+4
replacement='''test("Stock compartido usa Supabase y no Apps Script", async () => {\n  const source=(await import("node:fs")).readFileSync("src/services/stockService.js","utf8");\n  assert.match(source,/getStockSnapshot/);\n  assert.match(source,/replaceStock/);\n  assert.match(source,/clearStock/);\n  assert.doesNotMatch(source,/fetch\\(|APPS_SCRIPT_URL|base64/i);\n});'''
s=s[:start]+replacement+s[end:]
p.write_text(s,encoding='utf-8')
