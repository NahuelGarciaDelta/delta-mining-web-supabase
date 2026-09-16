import { requireSupabase } from "../services/supabaseClient.js";

export async function getOperationalSourceVersions(sources=[]){
  const requested=[...new Set((sources||[]).map(String).filter(Boolean))];
  if(!requested.length)return{};
  const {data,error}=await requireSupabase().rpc("operational_source_versions",{p_sources:requested});
  if(error)throw new Error(`Supabase operational_source_versions: ${error.message}`);
  return Object.fromEntries((data||[]).map(row=>[
    String(row.source||""),
    {serverVersion:Number(row.server_version||0),rowCount:Number(row.row_count||0)}
  ]).filter(([key])=>key));
}
