import test from "node:test";
import assert from "node:assert/strict";
import {buildRequestKey,cancelRequest,getRequestDebugSnapshot,resetRequestCoordinatorForTests,runDedupedRequest} from "../src/services/requestCoordinator.js";

test("deduplica solicitudes concurrentes con la misma clave",async()=>{
  resetRequestCoordinatorForTests();
  let calls=0;
  const factory=async()=>{calls+=1;await new Promise(r=>setTimeout(r,15));return{ok:true,data:[1,2,3]};};
  const key=buildRequestKey("dataset",{b:2,a:1});
  const [a,b]=await Promise.all([runDedupedRequest(key,factory),runDedupedRequest(key,factory)]);
  assert.equal(calls,1);
  assert.equal(a,b);
  assert.equal(getRequestDebugSnapshot().counters["request-deduplicated"],1);
});

test("la clave es estable aunque cambie el orden de propiedades",()=>{
  assert.equal(buildRequestKey("x",{b:2,a:{d:4,c:3}}),buildRequestKey("x",{a:{c:3,d:4},b:2}));
});

test("cancelRequest aborta la consulta en vuelo",async()=>{
  resetRequestCoordinatorForTests();
  const key="cancel-me";
  const promise=runDedupedRequest(key,({signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"AbortError"})),{once:true});
    setTimeout(()=>resolve({ok:true}),100);
  }));
  assert.equal(cancelRequest(key),true);
  await assert.rejects(promise,{name:"AbortError"});
});
