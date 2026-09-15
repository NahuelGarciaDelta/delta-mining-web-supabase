import {buildRequestKey,runDedupedRequest} from "./requestCoordinator.js";

const registry = new Map();

export function registerRefreshTask(id, handler, { views = [], priority = 50 } = {}) {
  if (!id || typeof handler !== "function") return () => {};
  const record = { id, handler, views: new Set(views || []), priority: Number(priority) || 50 };
  registry.set(id, record);
  return () => {
    if (registry.get(id) === record) registry.delete(id);
  };
}

export function listRefreshTasks(view) {
  return [...registry.values()]
    .filter((task) => task.views.size === 0 || task.views.has(view) || task.views.has("*"))
    .sort((a, b) => a.priority - b.priority);
}

export async function runRefreshTasks(view, context = {}) {
  // Manual/auto refresh concurrente de la misma vista comparte un único ciclo.
  const key=buildRequestKey("refresh-view",{view:String(view||"")});
  return runDedupedRequest(key,async()=>{
    const tasks = listRefreshTasks(view);
    const results = [];
    for (const task of tasks) {
      try {
        const value = await task.handler({ view, ...context });
        results.push({ id: task.id, ok: true, value });
      } catch (error) {
        results.push({ id: task.id, ok: false, error });
      }
    }
    return results;
  },{dataset:`refresh:${String(view||"")}`});
}
