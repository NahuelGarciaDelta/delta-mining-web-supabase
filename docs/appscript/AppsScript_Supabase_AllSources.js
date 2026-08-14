var DELTA_BACKEND_VERSION_ = "2026-08-14-ALL-SOURCES-SUPABASE-V1";

// Este archivo documenta únicamente el bloque de sincronización agregado al
// Apps Script principal. Debe integrarse sobre el script completo vigente.

var SUPABASE_TYPED_DATASETS_ = ["rop05", "rma15_fs", "rma15_jm", "lista_equipos", "insumos"];

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
