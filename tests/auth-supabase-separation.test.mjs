import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("el login autentica exclusivamente mediante Supabase",async()=>{
  const [login,api,appConfig]=await Promise.all([
    read("src/modules/auth/Login.jsx"),read("src/services/appsScriptApi.js"),read("src/config/app.js")
  ]);
  assert.match(login,/authenticateUser\(APPS_SCRIPT_URL,mail,pass\)/);
  assert.match(api,/rpc\("app_authenticate_user"/);
  assert.match(api,/rpc\("app_update_user_profile"/);
  assert.match(appConfig,/VITE_APPS_SCRIPT_URL/);
  const loginForbidden=/rop02Repository|VITE_ROP02_SOURCE|VITE_SUPABASE_/;
  assert.doesNotMatch(login,loginForbidden);
  assert.doesNotMatch(appConfig,loginForbidden);

  const authStart=api.indexOf("export async function authenticateUser");
  const authEnd=api.indexOf("export async function updateUserProfile",authStart);
  const authBlock=api.slice(authStart,authEnd);
  assert.match(authBlock,/requireSupabase/);
  assert.doesNotMatch(authBlock,/fetch\(/);
  assert.doesNotMatch(api,/fallback Apps Script|fetchAppsScriptAction_/);
});

test("la autenticacion no contiene usuarios ni credenciales de respaldo",async()=>{
  const login=await read("src/modules/auth/Login.jsx");
  assert.doesNotMatch(login,/USUARIOS_FALLBACK|fallback local/i);
  assert.doesNotMatch(login,/@deltamining\.com\.ar/i);
});
