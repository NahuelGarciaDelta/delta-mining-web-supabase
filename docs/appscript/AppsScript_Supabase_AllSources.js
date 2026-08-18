var DELTA_BACKEND_VERSION_ = "2026-08-18-ALL-SOURCES-SUPABASE-V2";

// Este archivo documenta el bloque de sincronización de la app Supabase.
// Debe integrarse sobre el script completo vigente.

var SUPABASE_TYPED_DATASETS_ = ["rop05", "rma15_fs", "rma15_jm", "lista_equipos", "insumos"];
var SUPABASE_OUTBOX_MOV_DB_ID_ = "1eEgggHdcH0YhGnmlogN63nQgStNl2xoV0bkfF_DTPYU";
var SUPABASE_OUTBOX_MOV_SHEET_ = "MOVIMIENTOS_EQUIPOS";
var SUPABASE_OUTBOX_TALLER_SHEET_ = "MOVIMIENTOS_TALLER";

function syncTypedOperationalDatasetsToSupabase() {
  var results = {};
  SUPABASE_TYPED_DATASETS_.forEach(function (key) { results[key] = syncTypedDatasetToSupabase_(key); });
  return { ok: true, results: results, syncedAt: new Date().toISOString() };
}

function syncAllConfiguredDatasetsToSupabase() {
  var results = {};
  Object.keys(SHEETS_CONFIG).forEach(function (key) {
    if (String(key).indexOf("rop02_") === 0) {
      results[key] = { ok: true, skipped: true, reason: "ROP02 usa su sincronización específica existente" };
      return;
    }
    try { results[key] = syncDatasetToSupabase_(key); }
    catch (err) { results[key] = { ok: false, error: err.message }; }
  });
  try { results.movimientos_equipos = syncGenericDatasetToSupabase_("movimientos_equipos"); }
  catch (movementErr) { results.movimientos_equipos = { ok: false, error: movementErr.message }; }
  return { ok: Object.keys(results).every(function (key) { return results[key].ok !== false; }), results: results, syncedAt: new Date().toISOString() };
}

function backfillAllConfiguredDatasetsToSupabase() {
  return syncAllConfiguredDatasetsToSupabase();
}

function syncRop05ToSupabase() { return syncTypedDatasetToSupabase_("rop05"); }
function syncRma15ToSupabase() {
  return { ok: true, rma15_fs: syncTypedDatasetToSupabase_("rma15_fs"), rma15_jm: syncTypedDatasetToSupabase_("rma15_jm") };
}
function syncListaEquiposToSupabase() { return syncTypedDatasetToSupabase_("lista_equipos"); }
function syncInsumosToSupabase() { return syncTypedDatasetToSupabase_("insumos"); }
function syncUsuariosToSupabase() { return syncGenericDatasetToSupabase_("usuarios"); }
function syncRaba03ToSupabase() { return syncGenericDatasetToSupabase_("raba03"); }
function syncRemitosToSupabase() { return syncGenericDatasetToSupabase_("remitos_cargados"); }
function syncLicitacionesToSupabase() {
  return {
    ok: true,
    licitaciones_db: syncGenericDatasetToSupabase_("licitaciones_db"),
    licitacion_hitos_db: syncGenericDatasetToSupabase_("licitacion_hitos_db"),
    licitacion_equipos_db: syncGenericDatasetToSupabase_("licitacion_equipos_db")
  };
}
function syncPmToSupabase() {
  return {
    ok: true,
    pm_config: syncGenericDatasetToSupabase_("pm_config"),
    pm_registros: syncGenericDatasetToSupabase_("pm_registros")
  };
}
function syncMovimientosEquiposToSupabase() { return syncGenericDatasetToSupabase_("movimientos_equipos"); }

function syncDatasetToSupabase_(key) {
  return SUPABASE_TYPED_DATASETS_.indexOf(key) !== -1
    ? syncTypedDatasetToSupabase_(key)
    : syncGenericDatasetToSupabase_(key);
}

function syncGenericDatasetToSupabase_(key) {
  var config = SHEETS_CONFIG[key];
  var sheet = null;
  var headerRow = 1;
  var sourceVersion = getDatasetVersion_(key);

  if (key === "movimientos_equipos") {
    var movementDb = SpreadsheetApp.openById(MOVIMIENTOS_EQUIPOS_DB_ID_);
    sheet = movementDb.getSheetByName(MOVIMIENTOS_EQUIPOS_SHEET_);
    if (!sheet) return typedSupabaseRpc_("sync_generic_dataset", { p_dataset: key, p_rows: [], p_source_version: sourceVersion });
  } else {
    if (!config) throw new Error("Dataset no configurado: " + key);
    var ss = SpreadsheetApp.openById(config.id);
    sheet = findSheetByGidOrName(ss, config.gid, config.sheet);
    headerRow = Number(config.headerRow || 1);
  }

  if (!sheet) throw new Error("No se encontró la hoja de " + key);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0
    ? sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(function (h, idx) { return String(h || "").trim() || ("col_" + (idx + 1)); })
    : [];
  var values = lastRow > headerRow && lastCol > 0
    ? sheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getValues()
    : [];
  var rows = [];

  values.forEach(function (valuesRow, index) {
    if (!typedRowHasData_(valuesRow)) return;
    var raw = {};
    headers.forEach(function (header, col) { raw[header] = typedJsonValue_(valuesRow[col]); });
    rows.push({ source_row: headerRow + 1 + index, row_data: raw });
  });

  var response = typedSupabaseRpc_("sync_generic_dataset", {
    p_dataset: key,
    p_rows: rows,
    p_source_version: sourceVersion
  });
  response.sheetRows = rows.length;
  response.lastPhysicalRow = lastRow;
  return response;
}

function onDatasetSheetChange_(e) {
  try {
    var spreadsheetId = e && e.source ? e.source.getId() : "";
    var keys = datasetKeysForSpreadsheetId_(spreadsheetId);

    keys.forEach(function (key) { bumpDatasetVersion_(key); });
    refreshRop02AcceleratorsForEvent_(e, keys);

    keys.forEach(function (key) {
      if (String(key).indexOf("rop02_") === 0) return;
      try { syncDatasetToSupabase_(key); }
      catch (syncErr) { console.error("No se pudo sincronizar " + key + " con Supabase:", syncErr); }
    });

    clearAllCache_();
  } catch (err) {
    console.error("Error actualizando versiones/sincronización:", err);
  }
}

/* =========================================================
   APP -> SUPABASE -> GOOGLE SHEETS
   Cola app_sync_outbox. La SERVICE ROLE se guarda SOLO en
   PropertiesService, nunca en el frontend ni en GitHub.
   ========================================================= */

function supabaseOutboxConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty("SUPABASE_URL") || "").replace(/\/+$/, "");
  var key = String(props.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "");
  if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Propiedades del script.");
  return { url: url, key: key };
}

function supabaseOutboxRpc_(fn, payload) {
  var cfg = supabaseOutboxConfig_();
  var response = UrlFetchApp.fetch(cfg.url + "/rest/v1/rpc/" + fn, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var text = response.getContentText();
  if (status < 200 || status >= 300) throw new Error("Supabase RPC " + fn + " HTTP " + status + ": " + text);
  return text ? JSON.parse(text) : null;
}

function movimientosSheet_() {
  var ss = SpreadsheetApp.openById(SUPABASE_OUTBOX_MOV_DB_ID_);
  var sh = ss.getSheetByName(SUPABASE_OUTBOX_MOV_SHEET_);
  if (!sh) sh = ss.insertSheet(SUPABASE_OUTBOX_MOV_SHEET_);
  var headers = ["ID","FECHA_HORA","INTERNO","INTERNO_NORMALIZADO","PROYECTO_ORIGEN","PROYECTO_DESTINO","TIPO_MOVIMIENTO","MOTIVO","OBSERVACION","USUARIO","FECHA_ULTIMO_ROP02","ESTADO","ACTIVO"];
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function findMovimientoRowById_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return 0;
  var finder = sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : 0;
}

function movementPayloadRow_(p) {
  p = p || {};
  return [
    p.id || "", p.fechaHora || "", p.interno || "", p.internoNormalizado || p.interno || "",
    p.proyectoOrigen || "", p.proyectoDestino || "", p.tipoMovimiento || "", p.motivo || "",
    p.observacion || "", p.usuario || "", p.fechaUltimoRop02 || "", p.estado || "ACEPTADO",
    p.activo === false ? false : true
  ];
}

function applyMovimientoOutboxEvent_(event) {
  var sheet = movimientosSheet_();
  var id = String(event.record_key || (event.payload && event.payload.id) || "");
  if (!id) throw new Error("Movimiento sin ID en outbox " + event.id);
  var row = findMovimientoRowById_(sheet, id);

  if (String(event.operation || "").toLowerCase() === "cancel") {
    if (!row) return;
    sheet.getRange(row,12).setValue("CANCELADO");
    sheet.getRange(row,13).setValue(false);
    return;
  }

  var values = movementPayloadRow_(event.payload || {});
  if (row) sheet.getRange(row,1,1,values.length).setValues([values]);
  else sheet.appendRow(values);
}

function syncSupabaseOutboxToSheets() {
  var events = supabaseOutboxRpc_("app_sync_outbox_pull", { p_limit: 100 }) || [];
  if (!Array.isArray(events) || !events.length) return { ok:true, processed:0, acked:0 };
  var ack = [];
  var errors = [];
  events.forEach(function(event) {
    try {
      if (event.domain === "movimientos_equipos") applyMovimientoOutboxEvent_(event);
      else throw new Error("Dominio de outbox no implementado por este bloque: " + event.domain);
      ack.push(Number(event.id));
    } catch (err) {
      errors.push({ id:event.id, domain:event.domain, error:err.message });
    }
  });
  if (ack.length) supabaseOutboxRpc_("app_sync_outbox_ack", { p_ids: ack });
  SpreadsheetApp.flush();
  return { ok:errors.length===0, processed:events.length, acked:ack.length, errors:errors };
}

function instalarTriggerSupabaseOutbox() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "syncSupabaseOutboxToSheets") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("syncSupabaseOutboxToSheets").timeBased().everyMinutes(5).create();
  return "Trigger maestro Supabase -> Sheets instalado cada 5 minutos.";
}

function repararEInstalarMovimientosTaller() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var fn = trigger.getHandlerFunction();
    if (fn === "sincronizarMovimientosTaller" || fn === "instalarMovimientosTaller") ScriptApp.deleteTrigger(trigger);
  });
  var ss = SpreadsheetApp.openById(SUPABASE_OUTBOX_MOV_DB_ID_);
  var sheet = ss.getSheetByName(SUPABASE_OUTBOX_TALLER_SHEET_);
  if (!sheet) sheet = ss.insertSheet(SUPABASE_OUTBOX_TALLER_SHEET_);
  sheet.clear();
  var headers = [["ID","FECHA_HORA","TIPO","EQUIPO","MARCA","MODELO","PROPIEDAD","INTERNO_ORIGEN","HOROMETRO","PROYECTO_ORIGEN","PROYECTO_DESTINO","INTERNO_DESTINO","MOTIVO","OBSERVACION","USUARIO","ESTADO"]];
  sheet.getRange(1,1,1,headers[0].length).setValues(headers).setFontWeight("bold").setBackground("#1f2937").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  var formula = '=ARRAYFORMULA(IFERROR(FILTER({' +
    'MOVIMIENTOS_EQUIPOS!A2:A,MOVIMIENTOS_EQUIPOS!B2:B,' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[TIPO:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[EQUIPO:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[MARCA:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[MODELO:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[PROPIEDAD:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[INTERNO:([^]]*)\\]"),MOVIMIENTOS_EQUIPOS!C2:C),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[HOROMETRO:([^]]*)\\]"),""),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[ORIGEN:([^]]*)\\]"),MOVIMIENTOS_EQUIPOS!E2:E),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[DESTINO:([^]]*)\\]"),MOVIMIENTOS_EQUIPOS!F2:F),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[INTERNO_DESTINO:([^]]*)\\]"),MOVIMIENTOS_EQUIPOS!C2:C),' +
    'IFERROR(REGEXEXTRACT(MOVIMIENTOS_EQUIPOS!I2:I,"\\[MOTIVO:([^]]*)\\]"),MOVIMIENTOS_EQUIPOS!H2:H),' +
    'MOVIMIENTOS_EQUIPOS!I2:I,MOVIMIENTOS_EQUIPOS!J2:J,MOVIMIENTOS_EQUIPOS!L2:L' +
    '},REGEXMATCH(MOVIMIENTOS_EQUIPOS!I2:I,"\\[DM_TALLER:1\\]")),""))';
  sheet.getRange("A2").setFormula(formula);
  sheet.getRange("B:B").setNumberFormat("dd/mm/yyyy hh:mm");
  sheet.autoResizeColumns(1,headers[0].length);
  SpreadsheetApp.flush();
  return "MOVIMIENTOS_TALLER reparada. Usá instalarTriggerSupabaseOutbox() para la cola maestra.";
}
