import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import {C} from "./components/ui/index.jsx";
import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";
import {applyAppearance,readLastAppearance} from "./services/userAppearance.js";
import {installAdministrativeTableExports} from "./services/administrativeTableExports.js";
import {installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";

installSupabaseReadBridge();
installLegacyRefreshIntervalPolicy();
if(typeof window!=="undefined"){
  applyAppearance(readLastAppearance(),C);
  window.addEventListener("dm-appearance-saved",event=>applyAppearance(event?.detail||readLastAppearance(),C));
  installAdministrativeTableExports();
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);

// No existe una precarga histórica global desde main.jsx. Cada vista hidrata primero
// su caché local y revalida únicamente las fuentes que necesita mediante App.jsx.
// Esto evita lanzar ROP02/RMA15/Lista Maestra en paralelo cuando el usuario está
// trabajando, por ejemplo, sólo en Abastecimiento.

if("serviceWorker" in navigator){window.addEventListener("load",async()=>{if(import.meta.env.DEV){try{const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(r=>r.unregister()));if("caches" in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("delta-mining-ops-")).map(k=>caches.delete(k)));}}catch(error){console.debug("No se pudo limpiar el Service Worker de desarrollo:",error);}return;}navigator.serviceWorker.register("/sw.js").catch(error=>console.error("No se pudo registrar el Service Worker:",error));});}

let deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dmInstallPWA=async()=>{if(!deferredInstallPrompt)return false;deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dispatchEvent(new Event("dm-pwa-install-unavailable"));return choice?.outcome==="accepted";};
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;window.dmPwaInstallAvailable=true;window.dispatchEvent(new Event("dm-pwa-install-available"));});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;window.dmPwaInstallAvailable=false;window.dispatchEvent(new Event("dm-pwa-install-unavailable"));});
