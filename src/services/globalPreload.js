import {getRop02,getRop05,getRma15,refreshHistoricalDataset} from "../data/historicalDataService.js";
import {buildRequestKey,runDedupedRequest} from "./requestCoordinator.js";

const ALLOWED_DATASETS=Object.freeze({rop02:getRop02,rop05:getRop05,rma15:getRma15});
const completed=new Set();

export function isHistoricalPreloadReady(dataset){
  if(dataset)return completed.has(String(dataset));
  return completed.size>0;
}

// API opt-in: ya no existe una precarga histórica global implícita. Un consumidor
// debe declarar qué dataset necesita calentar y el coordinador comparte la request.
export function preloadHistoricalDatasets({force=false,datasets=[],params={}}={}){
  const requested=[...new Set((datasets||[]).map(String).filter(name=>ALLOWED_DATASETS[name]))];
  if(!requested.length)return Promise.resolve(false);
  const common={limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc",...(params||{})};
  const key=buildRequestKey("historical-preload",{datasets:requested.slice().sort(),params:common});
  return runDedupedRequest(key,async()=>{
    const jobs=requested.map(dataset=>force?refreshHistoricalDataset(dataset,common):ALLOWED_DATASETS[dataset](common));
    const results=await Promise.allSettled(jobs);
    results.forEach((result,index)=>{if(result.status==="fulfilled")completed.add(requested[index]);});
    return results.some(result=>result.status==="fulfilled");
  },{dataset:requested.join(",")});
}
