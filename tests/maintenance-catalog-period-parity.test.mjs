import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),"utf8");

test("Mantenimiento usa período operativo y no cambia rangos manuales",()=>{
  const deps=read("src/config/moduleDeps.jsx");
  const app=read("src/App.jsx");
  assert.match(deps,/MANTENIMIENTO_DEPS[\s\S]*?PeriodMonthYear,/);
  assert.match(app,/modo!=="periodo"\|\|!last/);
  assert.match(app,/getMonth\(\)\+1\).*26/);
});

test("el catálogo replica OPS: último comprobante por código y precio con IVA",()=>{
  const domain=read("src/shared/domain/index.jsx");
  const app=read("src/App.jsx");
  const dashboard=read("src/modules/home/ExecutiveDashboard.jsx");
  assert.match(domain,/function buildInsumosCatalog/);
  assert.match(domain,/fecha<current\._fecha/);
  assert.match(domain,/Precio unitario con IVA/);
  assert.match(app,/insumosMap=buildInsumosCatalog\(src\.insumos\.data\)/);
  assert.match(dashboard,/buildInsumosCatalog\(safe\(rawSources\?\.insumos\?\.data\)\)/);
});
