import {getRop02,getRop05,getRma15,refreshHistoricalDataset} from "../data/historicalDataService.js";

let preloadPromise=null;
let preloadDone=false;

export function isHistoricalPreloadReady(){return preloadDone;}

export function preloadHistoricalDatasets({force=false}={}){
  if(preloadDone&&!force)return Promise.resolve(true);
  if(preloadPromise&&!force)return preloadPromise;

  const common={limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"};
  const jobs=force
    ?[
      refreshHistoricalDataset("rop02",common),
      refreshHistoricalDataset("rop05",common),
      refreshHistoricalDataset("rma15",common),
    ]
    :[
      getRop02(common),
      getRop05(common),
      getRma15(common),
    ];

  const task=Promise.allSettled(jobs).then(results=>{
    preloadDone=results.some(result=>result.status==="fulfilled");
    return preloadDone;
  }).finally(()=>{
    if(preloadPromise===task)preloadPromise=null;
  });
  preloadPromise=task;
  return task;
}
