import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthenticatedUser, getAuthenticatedUser, saveAuthenticatedSession, clearAuthenticatedSession } from "../src/services/authSession.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test("conserva el token desde las cuatro ubicaciones compatibles", () => {
  const responses = [
    { authToken: "a", user: { email: "u@delta" } },
    { token: "b", user: { email: "u@delta" } },
    { user: { email: "u@delta", authToken: "c" } },
    { user: { email: "u@delta", token: "d" } },
  ];
  assert.deepEqual(responses.map(value => buildAuthenticatedUser(value).authToken), ["a", "b", "c", "d"]);
  assert.deepEqual(responses.map(value => buildAuthenticatedUser(value).token), ["a", "b", "c", "d"]);
});

test("restaura el usuario completo y elimina el token al cerrar sesión", () => {
  globalThis.sessionStorage = memoryStorage();
  saveAuthenticatedSession({ email:"user@delta", rol:"ADMIN", extra:"se conserva", authToken:"signed-token" });
  assert.deepEqual(getAuthenticatedUser(), {email:"user@delta",rol:"ADMIN",extra:"se conserva",authToken:"signed-token",token:"signed-token"});
  assert.equal(sessionStorage.getItem("dm_auth_token"), "signed-token");
  clearAuthenticatedSession();
  assert.equal(getAuthenticatedUser(), null);
  assert.equal(sessionStorage.getItem("dm_auth_token"), null);
});

test("Stock compartido usa Supabase y no Apps Script", async () => {
  const source=(await import("node:fs")).readFileSync("src/services/stockService.js","utf8");
  assert.match(source,/getStockSnapshot/);
  assert.match(source,/replaceStock/);
  assert.match(source,/clearStock/);
  assert.doesNotMatch(source,/fetch\(|APPS_SCRIPT_URL|base64/i);
});
