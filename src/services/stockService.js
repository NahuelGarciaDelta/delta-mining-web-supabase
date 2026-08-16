import {clearStock,getStockSnapshot,replaceStock} from "./operationalSupabase.js";

export async function fetchStockStatus(_url){
  const value=await getStockSnapshot();
  return{ok:true,meta:value?.meta||{active:false},source:"supabase"};
}

export async function fetchStockData(_url){
  const value=await getStockSnapshot();
  return{ok:true,meta:value?.meta||{active:false},rows:Array.isArray(value?.rows)?value.rows:[],source:"supabase"};
}

export async function uploadStockExcel(_url,{file,rows,sheetName,replace=false}){
  const meta={
    fileName:file?.name||"Stock.xlsx",
    mimeType:file?.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sourceSheet:sheetName||"",
    activeSheet:"STOCK CRITICO",
    replace:Boolean(replace),
    validRows:Array.isArray(rows)?rows.length:0,
    rejectedRows:0,
    duplicateCodes:0,
  };
  return replaceStock(meta,Array.isArray(rows)?rows:[]);
}

export function clearSharedStock(_url){return clearStock();}
