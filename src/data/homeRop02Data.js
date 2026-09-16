import {requireSupabase} from "../services/supabaseClient.js";
import {refreshHistoricalDataset} from "./historicalDataService.js";

const normalizeProjects=projects=>{
  if(!Array.isArray(projects))return null;
  const values=[...new Set(projects.map(value=>String(value||"").trim()).filter(Boolean))];
  return values.length?values:null;
};

export async function getHomeRop02AvailableDays(projects=null,limit=90){
  const {data,error}=await requireSupabase().rpc("rop02_available_days",{
    p_projects:normalizeProjects(projects),
    p_limit:Math.max(1,Math.min(Number(limit)||90,365)),
  });
  if(error)throw new Error(`Supabase rop02_available_days: ${error.message}`);
  return (data||[])
    .map(row=>({fecha:String(row?.fecha||"").slice(0,10),registros:Number(row?.registros)||0}))
    .filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.fecha));
}

export async function getHomeRop02DayRows(day,projects=null){
  const fecha=String(day||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))return[];
  const response=await refreshHistoricalDataset("rop02",{
    desde:fecha,
    hasta:fecha,
    proyecto:normalizeProjects(projects),
    limit:"all",
    offset:0,
    sortBy:"fecha",
    sortDirection:"asc",
  });
  return Array.isArray(response?.data)?response.data:[];
}
