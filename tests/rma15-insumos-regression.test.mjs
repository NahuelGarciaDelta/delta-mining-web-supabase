import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("RMA15 conserva y valoriza insumos cuando la posición tipada comienza en cero",()=>{
  const source=fs.readFileSync(new URL("../src/shared/domain/index.jsx",import.meta.url),"utf8");
  assert.match(source,/const posiciones=new Set\(Array\.from\(\{length:10\},\(_,i\)=>i\+1\)\)/);
  assert.match(source,/match\(\/\^codigo\\s\+\(\\d\+\)\$\/i\)/);
  assert.match(source,/for\(const i of \[\.\.\.posiciones\]\.sort\(\(a,b\)=>a-b\)\)/);
});
