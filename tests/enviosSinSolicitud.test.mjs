import test from "node:test";
import assert from "node:assert/strict";
import { buildEnviosSinSolicitudRows } from "../src/modules/abastecimiento/enviosSinSolicitud.js";

const normCode = (value) => String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "").trim();
const toNumber = (value) => Number(String(value ?? "0").replace(",", ".")) || 0;
const normalizeCentroCosto = (value) => {
  const text = String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (text.includes("JOSE MARIA") || /\bJM\b/.test(text)) return "JOSE MARIA";
  if (text.includes("FILO DEL SOL") || /\bFDS\b/.test(text) || /\bFS\b/.test(text)) return "FILO DEL SOL";
  return text.trim();
};
const parseChronoDateMs = (value) => {
  const raw = String(value || "").trim();
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(m[2]) - 1, Number(m[1])).getTime();
  }
  return 0;
};

const remito = {
  id: "r1",
  comprobante: "TIN 00001-00000604",
  fecha: "2026-09-07",
  proyecto: "FILO DEL SOL",
  items: [{ codigo: "30", descripcion: "Insumo", cantidad: 5 }],
};

const run = (raba03Rows) => buildEnviosSinSolicitudRows({
  raba03Rows,
  remitos: [remito],
  normCode,
  toNumber,
  normalizeCentroCosto,
  parseChronoDateMs,
});

test("muestra un remito sin vínculo RABA03 explícito", () => {
  const result = run([{
    "Código de articulo": "30",
    "Centro de Costo": "FILO DEL SOL",
    "Fecha de solicitud": "2026-07-01",
    "Nº Remito": "",
  }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].numeroRemito, "TIN 00001-00000604");
});

test("oculta un remito cuando RABA03 lo vincula explícitamente", () => {
  assert.deepEqual(run([{
    "Código de articulo": "30",
    "Centro de Costo": "FILO DEL SOL",
    "Fecha de solicitud": "2026-07-01",
    "Nº Remito": "TIN 00001-00000604",
  }]), []);
});

test("una solicitud posterior al envío no lo oculta", () => {
  assert.equal(run([{
    "Código de articulo": "30",
    "Centro de Costo": "FILO DEL SOL",
    "Fecha de solicitud": "2026-09-08",
    "Nº Remito": "TIN 00001-00000604",
  }]).length, 1);
});
