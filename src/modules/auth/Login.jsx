import React from "react";
import { buildAuthenticatedUser, saveAuthenticatedSession } from "../../services/authSession.js";
import { authenticateUser } from "../../services/appsScriptApi.js";

export default function Login({onLogin,C,APPS_SCRIPT_URL,IMG_LOGIN_FONDO,LOGO,dmNormalizeAssignedProject}){
  const[usuario,setUsuario]=React.useState("");
  const[pass,setPass]=React.useState("");
  const[error,setError]=React.useState("");
  const[shake,setShake]=React.useState(false);
  const[validando,setValidando]=React.useState(false);

  const showError=(msg)=>{
    setError(msg);
    setShake(true);
    setTimeout(()=>setShake(false),500);
    setTimeout(()=>setError(""),3000);
  };

  const normalizarMail=(v)=>String(v||"").trim().toLowerCase();
  const handleSubmit=async()=>{
    const mail=normalizarMail(usuario);
    if(!mail){
      showError("Ingresá tu usuario");
      return;
    }
    if(!pass){
      showError("Ingresá tu contraseña");
      return;
    }

    setValidando(true);
    try{
      const json=await authenticateUser(APPS_SCRIPT_URL,mail,pass);
      if(!json?.ok){
        showError(json?.error?.message||"Usuario o contraseña incorrectos");
        return;
      }
      const authenticatedUser=buildAuthenticatedUser(json,mail);
      saveAuthenticatedSession(authenticatedUser,{mustChangePassword:!!json.mustChangePassword,normalizeProject:dmNormalizeAssignedProject});
      onLogin(authenticatedUser);
    }catch(err){
      console.error("No se pudo validar el acceso mediante Apps Script",err);
      showError(err?.message||"No se pudo validar el acceso. Revisá la conexión.");
    }finally{
      setValidando(false);
    }
  };

  const backgroundImageUrl = IMG_LOGIN_FONDO || "/img/embedded/home-welcome-b80067ac.jpg";

  return(
    <div style={{
      position:"relative",
      minHeight:"100vh",
      overflow:"hidden",
      backgroundColor:C.bg
    }}>
      <div style={{
        position:"absolute",
        inset:0,
        backgroundImage:`url(${backgroundImageUrl})`,
        backgroundSize:"cover",
        backgroundPosition:"center",
        backgroundRepeat:"no-repeat",
        filter:"brightness(.78) saturate(.86)"
      }}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(3,12,20,.28) 0 12%,rgba(3,10,17,.22) 27%,rgba(3,10,17,.12) 64%,rgba(3,10,17,.42) 100%)"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(3,11,18,.94) 0%,rgba(3,11,18,.05) 42%,rgba(3,11,18,.18) 100%)"}}/>
      <div style={{
        position:"relative",
        zIndex:1,
        minHeight:"100vh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        flexDirection:"column",
        gap:24,
        paddingTop:70
      }}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <img src={LOGO} alt="Delta Mining" style={{height:80,objectFit:"contain",marginBottom:8}}/>
        <div style={{fontFamily:"Inter",fontWeight:800,fontSize:22,color:C.accent,letterSpacing:".1em"}}>DELTA MINING APP</div>
        <div style={{
          background:C.card,border:`1px solid ${error?C.red:C.border}`,borderRadius:14,
          padding:"32px 36px",display:"flex",flexDirection:"column",gap:16,
          width:320,boxShadow:`0 8px 32px rgba(0,0,0,.4)`,
          animation:shake?"shake .4s ease":"none"
        }}>
          <div style={{fontSize:13,color:C.textSub,textAlign:"center",fontWeight:500}}>Ingresá tu usuario y contraseña para continuar</div>
          <input
            type="email"
            value={usuario}
            onChange={e=>{setUsuario(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Usuario"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box"}}
            autoFocus
          />
          <input
            type="password"
            value={pass}
            onChange={e=>{setPass(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="Contraseña"
            style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,color:C.text,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"Inter",width:"100%",boxSizing:"border-box"}}
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
