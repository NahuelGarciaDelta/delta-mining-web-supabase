import React from "react";
import { buildAuthenticatedUser, saveAuthenticatedSession } from "../../services/authSession.js";
import {applyAppearance,loadCentralAppearance,readLocalAppearance,writeLocalAppearance} from "../../services/userAppearance.js";
import { authenticateUser } from "../../services/appsScriptApi.js";

export default function Login({onLogin,C,APPS_SCRIPT_URL,IMG_LOGIN_FONDO,LOGO,dmNormalizeAssignedProject}){
  const AUTH_TIMEOUT_MS=20000;

  const[usuario,setUsuario]=React.useState("");
  const[pass,setPass]=React.useState("");
  const[error,setError]=React.useState("");
  const[shake,setShake]=React.useState(false);
  const[validando,setValidando]=React.useState(false);
  const submitInFlightRef=React.useRef(false);

  const showError=(msg)=>{
    setError(msg);
    setShake(true);
    setTimeout(()=>setShake(false),500);
    setTimeout(()=>setError(""),3000);
  };

  const normalizarMail=(v)=>String(v||"").trim().toLowerCase();
  const aplicarAparienciaUsuario=(mail,{central=true}={})=>{
    const email=normalizarMail(mail);
    if(!email)return;
    const local=readLocalAppearance(email);
    applyAppearance(local,C);
    if(central){
      loadCentralAppearance(APPS_SCRIPT_URL,email).then(prefs=>{
        writeLocalAppearance(email,prefs);
        applyAppearance(prefs,C);
      }).catch(()=>{});
    }
  };

  const handleSubmit=async()=>{
    if(submitInFlightRef.current)return;
    const mail=normalizarMail(usuario);
    if(!mail){showError("Ingresá tu usuario");return;}
    if(!pass){showError("Ingresá tu contraseña");return;}
    submitInFlightRef.current=true;setValidando(true);let timeoutId=null;
    try{
      const timeoutPromise=new Promise((_,reject)=>{timeoutId=window.setTimeout(()=>reject(Object.assign(new Error("La validación tardó demasiado. Intentá nuevamente."),{code:"AUTH_TIMEOUT"})),AUTH_TIMEOUT_MS);});
      const json=await Promise.race([authenticateUser(APPS_SCRIPT_URL,mail,pass),timeoutPromise]);
      if(!json?.ok){showError(json?.error?.message||"Usuario o contraseña incorrectos");return;}
      const authenticatedUser=buildAuthenticatedUser(json,mail);
      saveAuthenticatedSession(authenticatedUser,{mustChangePassword:!!json.mustChangePassword,normalizeProject:dmNormalizeAssignedProject});
      aplicarAparienciaUsuario(mail,{central:true});
      onLogin(authenticatedUser);
    }catch(err){console.error("No se pudo validar el acceso",err);showError(err?.code==="AUTH_TIMEOUT"?"La validación tardó demasiado. Intentá nuevamente.":(err?.message||"No se pudo validar el acceso. Revisá la conexión."));}
    finally{if(timeoutId!==null)window.clearTimeout(timeoutId);submitInFlightRef.current=false;setValidando(false);}
  };

  return(
    <div className="dm-login-screen" style={{
      position:"fixed",
      inset:0,
      minWidth:"100vw",
      minHeight:"100dvh",
      overflow:"hidden",
      backgroundColor:C.bg
    }}>
      <div style={{
        position:"absolute",
        inset:"calc(-1 * var(--dm-bg-blur,0px))",
        backgroundImage:"var(--dm-bg-image)",
        backgroundSize:"cover",
        backgroundPosition:"center",
        backgroundRepeat:"no-repeat",
        filter:"saturate(.92) blur(var(--dm-bg-blur,0px))",
        transform:"scale(1.02)"
      }}/>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at center,rgba(3,10,17,.02) 0%,rgba(3,10,17,.10) 58%,rgba(3,10,17,.28) 100%)"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.42) 0%,rgba(3,11,18,0) 40%,rgba(3,11,18,.08) 100%)"}}/>
      <div style={{
        position:"relative",
        zIndex:1,
        minHeight:"100dvh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        flexDirection:"column",
        gap:24,
        paddingTop:70,
        boxSizing:"border-box"
      }}>
        <style>{`html,body,#root{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <img src={LOGO} alt="Delta Mining" style={{height:80,objectFit:"contain",marginBottom:8}}/>
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:22,color:C.accent,letterSpacing:".1em"}}>DELTA MINING APP</div>
        <div style={{
          background:"rgba(20,20,20,.86)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:`1px solid ${error?C.red:"rgba(255,255,255,.12)"}`,borderRadius:14,
          padding:"32px 36px",display:"flex",flexDirection:"column",gap:16,
          width:320,boxShadow:"0 8px 32px rgba(0,0,0,.34)",
          animation:shake?"shake .4s ease":"none"
        }}>
          <div style={{fontSize:13,color:C.textSub,textAlign:"center",fontWeight:500}}>Ingresá tu usuario y contraseña para continuar</div>
          <input
            type="email"
            value={usuario}
            disabled={validando}
            onChange={e=>{
              const value=e.target.value;
              setUsuario(value);setError("");
              const mail=normalizarMail(value);
              if(mail.includes("@")&&mail.includes("."))aplicarAparienciaUsuario(mail,{central:false});
            }}
            onBlur={()=>{const mail=normalizarMail(usuario);if(mail.includes("@")&&mail.includes("."))aplicarAparienciaUsuario(mail,{central:true});}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Usuario"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
            autoFocus
          />
          <input
            type="password"
            value={pass}
            disabled={validando}
            onChange={e=>{setPass(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Contraseña"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box",opacity:validando?.7:1}}
          />
          {error&&<div style={{fontSize:12,color:C.red,textAlign:"center"}}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={validando}
            style={{background:C.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px",fontSize:14,fontWeight:700,fontFamily:"Inter",cursor:validando?"wait":"pointer",letterSpacing:".06em",opacity:validando?.75:1}}
          >
            {validando?"VALIDANDO...":"INGRESAR"}
          </button>
        </div>
        <div style={{fontSize:10,color:C.textMuted}}>Delta Mining OPS — Acceso restringido</div>
      </div>
    </div>
  );
}
