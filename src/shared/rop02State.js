const normalizeStateText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
const hasCode=(text,code)=>new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`).test(text);

export function classifyRop02State({hours=0,description="",observations="",originalState=""}={}){
  const numericHours=Number(String(hours??0).replace(",","."));
  if(Number.isFinite(numericHours)&&numericHours>0)return"TRABAJO";
  const text=normalizeStateText(`${originalState} ${description} ${observations}`);
  if(hasCode(text,"OD")||text.includes("A DISPOSICION")||text.includes("ORDEN DEL DIA"))return"OD";
  if(hasCode(text,"FS")||text.includes("FUERA DE SERVICIO"))return"FS";
  if(hasCode(text,"EM")||text.includes("EN MANTENIMIENTO")||text.includes("MANTENIMIENTO"))return"EM";
  return"SIN REGISTRO";
}
