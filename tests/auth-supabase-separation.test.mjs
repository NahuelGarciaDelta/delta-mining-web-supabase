import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("el login autentica exclusivamente mediante Apps Script",async()=>{
  const [login,api,appConfig]=await Promise.all([
    read("src/modules/auth/Login.jsx"),read("src/services/appsScriptApi.js"),read("src/config/app.js")
  ]);
  assert.match(login,/authenticateUser\(APPS_SCRIPT_URL,mail,pass\)/);
  assert.match(api,/action:\s*"authenticate_user"/);
  assert.match(api,/application\/x-www-form-urlencoded/);
  assert.match(appConfig,/VITE_APPS_SCRIPT_URL/);
  const loginForbidden=/rop02Repository|supabaseClient|VITE_ROP02_SOURCE|VITE_SUPABASE_/;
  assert.doesNotMatch(login,loginForbidden);
  assert.doesNotMatch(appConfig,loginForbidden);

  const authStart=api.indexOf("export async function authenticateUser");
  const authEnd=api.indexOf("export async function runWithConcurrency_",authStart);
  const authBlock=api.slice(authStart,authEnd);
  assert.doesNotMatch(authBlock,/requireSupabase|supabaseClient|VITE_SUPABASE_/);
  assert.match(authBlock,/fetch\(endpoint/);
});

test("la autenticacion no contiene usuarios ni credenciales de respaldo",async()=>{
  const login=await read("src/modules/auth/Login.jsx");
  assert.doesNotMatch(login,/USUARIOS_FALLBACK|fallback local/i);
  assert.doesNotMatch(login,/@deltamining\.com\.ar/i);
});
