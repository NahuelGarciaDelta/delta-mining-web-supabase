const pendingRequests = new Map();
const debugEvents = [];
const debugCounters = new Map();
const MAX_DEBUG_EVENTS = 120;

const now = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());

function debugEnabled() {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("dm_data_load_debug") === "1") return true;
  } catch (_) {}
  try {
    return String(import.meta.env?.VITE_DATA_LOAD_DEBUG || "") === "1";
  } catch (_) {
    return false;
  }
}

function increment_(name) {
  debugCounters.set(name, Number(debugCounters.get(name) || 0) + 1);
}

export function debugDataLoad(event, meta = {}) {
  increment_(event);
  const entry = { event, at: new Date().toISOString(), ...meta };
  debugEvents.push(entry);
  if (debugEvents.length > MAX_DEBUG_EVENTS) debugEvents.splice(0, debugEvents.length - MAX_DEBUG_EVENTS);
  if (debugEnabled() && typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[dm:data]", event, meta);
  }
  return entry;
}

function stableValue_(value) {
  if (Array.isArray(value)) return value.map(stableValue_);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = stableValue_(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function buildRequestKey(scope, parts = {}) {
  return `${String(scope || "request")}:${JSON.stringify(stableValue_(parts))}`;
}

export function runDedupedRequest(key, factory, meta = {}) {
  const normalizedKey = String(key || "request");
  const existing = pendingRequests.get(normalizedKey);
  if (existing) {
    debugDataLoad("request-deduplicated", { key: normalizedKey, ...meta });
    return existing.promise;
  }

  const controller = new AbortController();
  const started = now();
  debugDataLoad("request-started", { key: normalizedKey, ...meta });

  const promise = Promise.resolve()
    .then(() => factory({ signal: controller.signal }))
    .then((value) => {
      const rows = Array.isArray(value?.data)
        ? value.data.length
        : Number.isFinite(Number(value?.rows))
          ? Number(value.rows)
          : undefined;
      debugDataLoad("request-finished", {
        key: normalizedKey,
        durationMs: Math.max(0, Math.round(now() - started)),
        ...(rows === undefined ? {} : { rows }),
        ...meta,
      });
      return value;
    })
    .catch((error) => {
      debugDataLoad(error?.name === "AbortError" ? "request-aborted" : "request-failed", {
        key: normalizedKey,
        durationMs: Math.max(0, Math.round(now() - started)),
        message: String(error?.message || error || "Unknown error"),
        ...meta,
      });
      throw error;
    })
    .finally(() => {
      if (pendingRequests.get(normalizedKey)?.promise === promise) pendingRequests.delete(normalizedKey);
    });

  pendingRequests.set(normalizedKey, { promise, controller, started });
  return promise;
}

export function cancelRequest(key) {
  const normalizedKey = String(key || "");
  const entry = pendingRequests.get(normalizedKey);
  if (!entry) return false;
  entry.controller.abort();
  return true;
}

export function cancelRequestsByPrefix(prefix) {
  const normalizedPrefix = String(prefix || "");
  let count = 0;
  for (const [key, entry] of pendingRequests.entries()) {
    if (key.startsWith(normalizedPrefix)) {
      entry.controller.abort();
      count += 1;
    }
  }
  return count;
}

export function markCacheHit(key, meta = {}) {
  return debugDataLoad("cache-hit", { key: String(key || ""), ...meta });
}

export function markCacheMiss(key, meta = {}) {
  return debugDataLoad("cache-miss", { key: String(key || ""), ...meta });
}

export function getRequestDebugSnapshot() {
  return {
    pendingKeys: [...pendingRequests.keys()],
    counters: Object.fromEntries(debugCounters),
    events: debugEvents.slice(),
  };
}

export function resetRequestCoordinatorForTests() {
  for (const entry of pendingRequests.values()) entry.controller.abort();
  pendingRequests.clear();
  debugEvents.length = 0;
  debugCounters.clear();
}
