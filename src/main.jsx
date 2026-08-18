import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";
import {preloadHistoricalDatasets} from "./services/globalPreload.js";
import {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";

// La versión Supabase conserva su puente de compatibilidad, pero toda la política
// de actualización visual se mantiene alineada con la app original.
installSupabaseReadBridge();
installLegacyRefreshIntervalPolicy();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Mantiene calientes ROP02/ROP05/RMA15 desde Supabase sin bloquear las vistas.
if(typeof window!=="undefined"){
  let lastHistoricalRefresh=Date.now();
  const refreshHistorical=()=>{
    if(document.hidden||navigator.onLine===false)return;
    lastHistoricalRefresh=Date.now();
    dispatchDataRefreshPolicyTick("auto");
    preloadHistoricalDatasets({force:true}).catch(()=>{});
  };
  const id=window.setInterval(refreshHistorical,DATA_REFRESH_INTERVAL_MS);
  const onVisible=()=>{
    if(document.hidden)return;
    if(Date.now()-lastHistoricalRefresh>=DATA_REFRESH_INTERVAL_MS)refreshHistorical();
  };
  const onOnline=()=>refreshHistorical();
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("online",onOnline);
  window.addEventListener("beforeunload",()=>{
    window.clearInterval(id);
    document.removeEventListener("visibilitychange",onVisible);
    window.removeEventListener("online",onOnline);
  },{once:true});
}

// Registro PWA e instalación en el escritorio.
// En desarrollo el Service Worker puede servir módulos /src obsoletos y provocar
// errores de imports/HMR. Por eso se desactiva y se limpian sus cachés locales.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (import.meta.env.DEV) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("delta-mining-ops-")).map((key) => caches.delete(key)));
        }
      } catch (error) {
        console.debug("No se pudo limpiar el Service Worker de desarrollo:", error);
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el Service Worker:", error);
    });
  });
}

let deferredInstallPrompt = null;
window.dmPwaInstallAvailable = false;
window.dmInstallPWA = async () => {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  window.dmPwaInstallAvailable = false;
  window.dispatchEvent(new Event("dm-pwa-install-unavailable"));
  return choice?.outcome === "accepted";
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  window.dmPwaInstallAvailable = true;
  window.dispatchEvent(new Event("dm-pwa-install-available"));
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  window.dmPwaInstallAvailable = false;
  window.dispatchEvent(new Event("dm-pwa-install-unavailable"));
});
