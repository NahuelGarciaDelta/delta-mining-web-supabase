import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",import.meta.url),"utf8");
const viewSources=fs.readFileSync(new URL("../src/config/viewSources.js",import.meta.url),"utf8");

test("Atraso conserva snapshot y ventana reciente como apoyo",()=>{
  assert.match(source,/getRop02LatestByEquipmentProject/);
  assert.match(source,/start\.setDate\(start\.getDate\(\)-45\)/);
  assert.match(source,/getRop02\(\{desde,hasta:reference,limit:"all"/);
  assert.match(source,/const atrasoSource=remoteRop02\|\|rop02All/);
});

test("Atraso vuelve a disponer de las cuatro fuentes ROP02 globales",()=>{
  assert.match(viewSources,/atrasoROP02:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(source,/if\(view==="atrasoROP02"\)return <ViewAtrasoROP02/);
});
