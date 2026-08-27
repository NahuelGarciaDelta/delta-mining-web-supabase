import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import {C} from "./components/ui/index.jsx";
import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";
import {applyAppearance,readLastAppearance} from "./services/userAppearance.js";
import {installAdministrativeTableExports} from "./services/administrativeTableExports.js";
import {preloadHistoricalDatasets} from "./services/globalPreload.js";
import {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";

installSupabaseReadBridge();
installLegacyRefreshIntervalPolicy();
if(typeof window!=="undefined"){
  applyAppearance(readLastAppearance(),C);
  window.addEventListener("dm-appearance-saved",event=>applyAppearance(event?.detail||readLastAppearance(),C));
  installAdministrativeTableExports();
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);

if(typeof window!=="undefined"){
  let lastHistoricalRefresh=Date.now();
  const refreshHistorical=()=>{if(document.hidden||navigator.onLine===false)return;lastHistoricalRefresh=Date.now();dispatchDataRefreshPolicyTick("auto");preloadHistoricalDatasets({force:true}).catch(()=>{});};
  const id=window.setInterval(refreshHistorical,DATA_REFRESH_INTERVAL_MS);
  const onVisible=()=>{if(!document.hidden&&Date.now()-lastHistoricalRefresh>=DATA_REFRESH_INTERVAL_MS)refreshHistorical();};
  const onOnline=()=>refreshHistorical();
  document.addEventListener("visibilitychange",onVisible);window.addEventListener("online",onOnline);
  window.addEventListener("beforeunload",()=>{window.clearInterval(id);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("online",onOnline);},{once:true});
}

if("serviceWorker" in navigator){window.addEventListener("load",async()=>{if(import.meta.env.DEV){try{const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(r=>r.unregister()));if("caches" in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("delta-mining-ops-")).map(k=>caches.delete(k)));}}catch(error){console.debug("No se pudo limpiar el Service Worker de desarrollo:",error);}return;}navigator.serviceWorker.register("/sw.js").catch(error=>console.error("No se pudo registrar el Service Worker:",error));});}

let deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dmInstallPWA=async()=>{if(!deferredInstallPrompt)return false;deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dispatchEvent(new Event("dm-pwa-install-unavailable"));return choice?.outcome==="accepted";};
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;window.dmPwaInstallAvailable=true;window.dispatchEvent(new Event("dm-pwa-install-available"));});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dispatchEvent(new Event("dm-pwa-install-unavailable"));});
