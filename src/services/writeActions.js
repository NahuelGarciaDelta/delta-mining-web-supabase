import {appAlert} from "./dialogService.js";
import {dmCanEditArea} from "../shared/access.js";
import {runOperationalWrite} from "./operationalSupabase.js";

const DM_ACTION_REQUIRED_AREA={add_lista_equipo:"TALLER CENTRAL",update_lista_equipo:"TALLER CENTRAL",bulk_update_lista_equipos_from_app:"TALLER CENTRAL",update_rop02_row:"OFICINA TÉCNICA"};

export async function postToAppsScript(payloadObj){
  const action=String(payloadObj?.action||"");
  const requiredArea=DM_ACTION_REQUIRED_AREA[action];
  if(requiredArea&&!dmCanEditArea(requiredArea)){
    const msg=`Modo solo lectura: únicamente el área ${requiredArea} puede guardar cambios en esta sección.`;
    await appAlert(msg,"Sin permiso de edición");
    throw new Error(msg);
  }
  return runOperationalWrite(action,payloadObj||{});
}

export const postAddListaEquipo=row=>postToAppsScript({action:"add_lista_equipo",row});
export const postUpdateListaEquipo=(originalKeys,row)=>postToAppsScript({action:"update_lista_equipo",originalKeys,row});
export const postBulkUpdateListaEquipos=updates=>postToAppsScript({action:"bulk_update_lista_equipos_from_app",updates});
export const postUpdateROP02Row=(target,rowKey,fields)=>postToAppsScript({action:"update_rop02_row",target,rowKey,fields});
