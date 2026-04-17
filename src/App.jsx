import { useState, useEffect, useRef, useCallback } from "react";
import { io as socketIO } from "socket.io-client";
import * as api from "./api.js";

const FONTS = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap";
const MAX_MKT_PER_DAY = 2;
const OPT_OUT_FOOTER = "\n\n─────────────\nReply STOP to unsubscribe";

/* ═══ BUILT-IN TEMPLATES ═══ */
const BUILTINS = [
  { id:"b1",name:"🛍️ New Arrivals Drop",category:"Promo",status:"ready",body:"Hey {{name}}! ✨\n\nFresh drops just landed at {{store_name}} 💅\n\n🆕 {{product_highlight}}\n💰 Starting at {{price}}\n\n🔗 Shop now → {{link}}",vars:["name","store_name","product_highlight","price","link"],gradient:"linear-gradient(135deg,#ff6b35,#f72585)",emoji:"🛍️",tip:"Best for weekly new stock",builtin:true },
  { id:"b2",name:"⚡ Flash Sale Alert",category:"Promo",status:"ready",body:"🚨 {{name}}, FLASH SALE is LIVE! 🚨\n\n{{store_name}} is going all out:\n\n🔥 {{discount}}% OFF on {{category}}\n🎟️ Code: {{code}}\n⏰ Valid till: {{expiry}}\n\n🛒 Shop → {{link}}",vars:["name","store_name","discount","category","code","expiry","link"],gradient:"linear-gradient(135deg,#ffbe0b,#fb5607,#ff006e)",emoji:"⚡",tip:"Max 1-2 per week",builtin:true },
  { id:"b3",name:"🎁 Loyalty Reward",category:"Loyalty",status:"ready",body:"{{name}}, you're a VIP! 🫶\n\n🎁 Special reward from {{store_name}}:\n\n✨ {{reward_details}}\n📅 Valid until: {{validity}}\n\nUse code: {{code}}\n\nThank you! 💜",vars:["name","store_name","reward_details","validity","code"],gradient:"linear-gradient(135deg,#c77dff,#7b2ff7,#240046)",emoji:"🎁",tip:"Customers love personal rewards",builtin:true },
  { id:"b4",name:"📦 Back in Stock",category:"Restock",status:"ready",body:"Good news, {{name}}! 🎉\n\nBack at {{store_name}}:\n\n📦 {{product_name}}\n💰 {{price}}\n\nGrab yours before it's gone!\n\n🛒 Get it → {{link}}",vars:["name","store_name","product_name","price","link"],gradient:"linear-gradient(135deg,#80ffdb,#48bfe3,#5390d9)",emoji:"📦",tip:"Very high conversion rate",builtin:true },
  { id:"b5",name:"🧾 Order Update",category:"Utility",status:"ready",body:"Hi {{name}}! 👋\n\nOrder from {{store_name}} updated:\n\n📋 Order #{{order_id}}\n📦 Status: {{status}}\n🚚 {{delivery_info}}\n\nTrack → {{tracking_link}}",vars:["name","store_name","order_id","status","delivery_info","tracking_link"],gradient:"linear-gradient(135deg,#06d6a0,#118ab2)",emoji:"🧾",tip:"No marketing limit",builtin:true },
  { id:"b6",name:"🌟 Festival Special",category:"Promo",status:"ready",body:"{{name}}, {{festival_name}} is here! 🎊\n\n{{store_name}} has something special:\n\n🎉 {{offer_details}}\n🛍️ Shop → {{link}}\n\nHappy {{festival_name}}! 🙏✨",vars:["name","festival_name","store_name","offer_details","link"],gradient:"linear-gradient(135deg,#ffc8dd,#ffafcc,#cdb4db)",emoji:"🌟",tip:"Perfect for Diwali, Eid, etc.",builtin:true },
  { id:"b7",name:"🛒 Cart Reminder",category:"Retarget",status:"ready",body:"Hey {{name}}! 👀\n\nYou left something at {{store_name}}:\n\n🛒 {{item_name}} — {{price}}\n\nHere's {{discount}}% off!\n🎟️ Code: {{code}}\n\n→ {{link}}",vars:["name","store_name","item_name","price","discount","code","link"],gradient:"linear-gradient(135deg,#ff9e00,#ff6d00,#e63946)",emoji:"🛒",tip:"Send 1-4h after abandonment",builtin:true },
  { id:"b8",name:"⭐ Review Request",category:"Utility",status:"ready",body:"Hi {{name}}! 😊\n\nLoving your purchase from {{store_name}}?\n\n⭐ Leave a review → {{link}}\n\nThank you! 🫶",vars:["name","store_name","link"],gradient:"linear-gradient(135deg,#ffd60a,#fca311,#e85d04)",emoji:"⭐",tip:"Send 3-5 days after delivery",builtin:true },
];
const CATS = ["All","Promo","Loyalty","Restock","Retarget","Utility"];

/* ═══ SMALL COMPONENTS ═══ */
const Badge = ({s}) => {
  const m = { ready:{bg:"rgba(37,211,102,0.12)",c:"#25d366",i:"✓"}, pending:{bg:"rgba(255,190,11,0.12)",c:"#ffbe0b",i:"⏳"}, draft:{bg:"rgba(136,136,136,0.12)",c:"#888",i:"📝"} };
  const x = m[s]||m.pending;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:x.bg,borderRadius:8,padding:"2px 8px",fontSize:10,color:x.c,fontFamily:"Outfit",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{x.i} {s}</span>;
};

const PhonePreview = ({message,gradient,imageUrl}) => (
  <div style={{width:"100%",maxWidth:260,margin:"0 auto",background:"#0b141a",borderRadius:28,padding:"10px 7px",boxShadow:"0 16px 50px rgba(0,0,0,0.4)",border:"2px solid #1a2730"}}>
    <div style={{width:50,height:4,background:"#1a2730",borderRadius:3,margin:"0 auto 5px"}}/>
    <div style={{background:"#1f2c34",borderRadius:"14px 14px 0 0",padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:28,height:28,borderRadius:"50%",background:gradient||"#25d366",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🏪</div>
      <div><div style={{color:"#e9edef",fontSize:11,fontWeight:600}}>Your Store</div><div style={{color:"#8696a0",fontSize:9}}>Business ✓</div></div>
    </div>
    <div style={{background:"#0b141a",padding:"12px 8px",minHeight:200,maxHeight:240,overflowY:"auto",borderRadius:"0 0 14px 14px"}}>
      <div style={{background:"#005c4b",borderRadius:"10px 10px 10px 3px",padding:imageUrl?"0 0 8px 0":"8px 10px",maxWidth:"90%",color:"#e9edef",fontSize:10,lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"}}>
        {imageUrl&&<img src={imageUrl} alt="" style={{width:"100%",borderRadius:"10px 10px 0 0",maxHeight:100,objectFit:"cover",display:"block"}}/>}
        <div style={{padding:imageUrl?"6px 10px 2px":"0"}}>{message||"Select a template..."}</div>
        <div style={{textAlign:"right",fontSize:8,color:"#8696a0",marginTop:2,paddingRight:imageUrl?10:0}}>12:00 PM ✓✓</div>
      </div>
    </div>
  </div>
);

/* ═══ MAIN APP ═══ */
export default function App() {
  // State
  const [step,setStep]=useState(0);
  const [selTemplate,setSelTemplate]=useState(null);
  const [cat,setCat]=useState("All");
  const [contacts,setContacts]=useState([]);
  const [customTpls,setCustomTpls]=useState([]);
  const [newName,setNewName]=useState("");
  const [newPhone,setNewPhone]=useState("");
  const [vars,setVars]=useState({});
  const [schedType,setSchedType]=useState("now");
  const [schedDate,setSchedDate]=useState("");
  const [schedTime,setSchedTime]=useState("");
  const [sending,setSending]=useState(false);
  const [sentCount,setSentCount]=useState(0);
  const [showBulk,setShowBulk]=useState(false);
  const [bulkInput,setBulkInput]=useState("");
  const [tab,setTab]=useState("dashboard");
  const [selIds,setSelIds]=useState(new Set());
  const [campaigns,setCampaigns]=useState([]);
  const [toast,setToast]=useState(null);

  // WhatsApp connection state
  const [waState,setWaState]=useState("disconnected");
  const [waQR,setWaQR]=useState(null);
  const [waInfo,setWaInfo]=useState(null);
  const [serverUp,setServerUp]=useState(false);
  const [syncing,setSyncing]=useState(false);

  // NEW: Search, groups, confirmation, active campaign
  const [searchQ,setSearchQ]=useState("");
  const [groups,setGroups]=useState([]);
  const [selGroup,setSelGroup]=useState(null);
  const [showConfirm,setShowConfirm]=useState(false);
  const [activeCampaignId,setActiveCampaignId]=useState(null);
  const [mediaFile,setMediaFile]=useState(null);
  const [mediaPreview,setMediaPreview]=useState(null);
  const [mediaPath,setMediaPath]=useState(null);

  // Template creator
  const [showCreator,setShowCreator]=useState(false);
  const [tplName,setTplName]=useState("");
  const [tplCat,setTplCat]=useState("Promo");
  const [tplBody,setTplBody]=useState("");
  const [tplEmoji,setTplEmoji]=useState("📝");

  const socketRef = useRef(null);
  const progressRef = useRef(null);

  // Load fonts
  useEffect(()=>{const l=document.createElement("link");l.href=FONTS;l.rel="stylesheet";document.head.appendChild(l);},[]);

  // ─── SOCKET.IO CONNECTION (with auto-reconnection) ───
  useEffect(()=>{
    const s = socketIO("http://localhost:3001",{
      transports:["websocket","polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = s;

    s.on("connect",()=>{ setServerUp(true); loadAll(); });
    s.on("disconnect",()=>{ setServerUp(false); showMsg("Server disconnected — reconnecting...","warn"); });
    s.on("reconnect",()=>{ setServerUp(true); showMsg("Reconnected!"); loadAll(); });
    s.on("wa:status",(d)=>{ setWaState(d.state); setWaQR(d.qr); setWaInfo(d.info); });
    s.on("wa:qr",(d)=>{ setWaState("qr_ready"); setWaQR(d.qr); });
    s.on("wa:ready",(d)=>{ setWaState("ready"); setWaQR(null); setWaInfo(d); showMsg("WhatsApp connected! 🎉"); });
    s.on("wa:disconnected",(d)=>{ setWaState("disconnected"); setWaQR(null); setWaInfo(null); showMsg("WhatsApp disconnected"+(d?.reason?": "+d.reason:""),"warn"); });
    s.on("wa:auth",()=>setWaState("connecting"));
    s.on("campaign:progress",(d)=>{
      setSentCount(d.sent);
      if(d.paused) showMsg("Campaign paused","warn");
      if(d.done){ setSending(false); setStep(4); loadAll(); }
    });
    s.on("wa:optout",(d)=>{ loadContacts(); showMsg(`${d.phone} opted out`,"warn"); });
    s.on("wa:optin",(d)=>{ loadContacts(); showMsg(`${d.phone} re-subscribed`); });

    // Also check server via HTTP
    checkServer();
    const iv = setInterval(checkServer, 15000);
    return ()=>{ s.disconnect(); clearInterval(iv); };
  },[]);

  const checkServer = async()=>{
    try{ const h=await api.health(); setServerUp(true); setWaState(h.whatsapp); setWaInfo(h.whatsappInfo); }
    catch{ setServerUp(false); }
  };

  const loadAll=()=>{ loadContacts(); loadTemplates(); loadCampaigns(); loadGroups(); };
  const loadContacts=async(q,gid)=>{ try{setContacts(await api.contacts.list(q||searchQ||"",gid||selGroup||""));}catch{} };
  const loadTemplates=async()=>{ try{setCustomTpls(await api.templates.list());}catch{} };
  const loadCampaigns=async()=>{ try{setCampaigns(await api.campaigns.list());}catch{} };
  const loadGroups=async()=>{ try{setGroups(await api.contacts.groups());}catch{} };

  const showMsg=(m,t="success")=>{ setToast({m,t}); setTimeout(()=>setToast(null), t==="error"?6000:3000); };

  // All templates
  const allTpls=[...BUILTINS,...customTpls.map(t=>({...t,id:`c${t.id}`,dbId:t.id,builtin:false,gradient:t.gradient||"linear-gradient(135deg,#667eea,#764ba2)"}))];
  const filtTpls = cat==="All"?allTpls:allTpls.filter(t=>t.category===cat);
  const eligible = contacts.filter(c=>selIds.has(c.id)&&c.opted_in&&(c.msgs_today<MAX_MKT_PER_DAY||selTemplate?.category==="Utility"));

  // Handlers
  const connectWA = async()=>{ try{await api.wa.connect(); setWaState("connecting"); showMsg("Connecting... QR code loading");}catch(e){showMsg(e.message,"error");} };
  const logoutWA = async()=>{ try{await api.wa.logout(); setWaState("disconnected"); setWaQR(null); setWaInfo(null); showMsg("Logged out");}catch(e){showMsg(e.message,"error");} };

  const syncContacts = async()=>{
    setSyncing(true);
    try{ const r=await api.contacts.syncWhatsApp(); await loadContacts(); showMsg(`Synced ${r.synced} contacts from WhatsApp!`); }
    catch(e){ showMsg(e.message,"error"); }
    setSyncing(false);
  };

  const addContact = async()=>{
    if(!newName.trim()||!newPhone.trim())return;
    if(serverUp){ try{await api.contacts.add(newName.trim(),newPhone.trim()); await loadContacts(); showMsg("Added!");}catch(e){showMsg(e.message,"error");} }
    else{ setContacts(p=>[...p,{id:Date.now(),name:newName.trim(),phone:newPhone.trim(),opted_in:true,msgs_today:0}]); }
    setNewName("");setNewPhone("");
  };

  const parseBulk=async()=>{
    const parsed=bulkInput.trim().split("\n").filter(Boolean).map(l=>{const p=l.split(/[,\t]+/);return{name:(p[0]||"").trim(),phone:(p[1]||"").trim()};}).filter(c=>c.name&&c.phone);
    if(serverUp){try{const r=await api.contacts.bulkImport(parsed);await loadContacts();showMsg(`Imported ${r.imported}`);}catch(e){showMsg(e.message,"error");}}
    else{setContacts(p=>[...p,...parsed.map((c,i)=>({...c,id:Date.now()+i,opted_in:true,msgs_today:0}))]);}
    setBulkInput("");setShowBulk(false);
  };

  const toggleId=(id)=>setSelIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const selAll=()=>setSelIds(new Set(contacts.filter(c=>c.opted_in).map(c=>c.id)));
  const selNone=()=>setSelIds(new Set());

  const getPreview=()=>{
    if(!selTemplate)return"";
    let m=selTemplate.body;
    const previewVars={...vars, name: eligible[0]?.name || "Arjun"};
    (selTemplate.vars||[]).forEach(v=>{m=m.replaceAll(`{{${v}}}`,previewVars[v]||`{{${v}}}`);});
    return m+OPT_OUT_FOOTER;
  };

  const saveTemplate=async()=>{
    if(!tplName.trim()||!tplBody.trim())return;
    const v=(tplBody.match(/\{\{(\w+)\}\}/g)||[]).map(m=>m.replace(/[{}]/g,""));
    const unique=[...new Set(v)];
    if(serverUp){try{await api.templates.create({name:tplName.trim(),category:tplCat,body:tplBody.trim(),vars:unique,emoji:tplEmoji});await loadTemplates();showMsg("Template saved!");}catch(e){showMsg(e.message,"error");}}
    setTplName("");setTplBody("");setTplEmoji("📝");setShowCreator(false);
  };

  const executeSend=async()=>{
    setSending(true);setSentCount(0);
    const total=eligible.length;
    if(serverUp&&waState==="ready"){
      try{
        const r=await api.campaigns.send({
          templateId:selTemplate?.dbId||null,
          templateName:selTemplate?.name||"Unknown",
          templateBody:selTemplate?.body||"",
          templateCategory:selTemplate?.category||"Promo",
          mediaPath:mediaPath||null,
          varValues:vars,
          contactIds:eligible.map(c=>c.id),
          scheduleType:schedType,
          scheduledAt:schedType==="later"?`${schedDate}T${schedTime}`:null,
        });
        setActiveCampaignId(r.campaignId);
        if(r.status==="scheduled"){showMsg("Scheduled!");setSending(false);setStep(4);return;}
      }catch(e){showMsg("Failed: "+e.message,"error");setSending(false);}
    } else {
      let c=0;
      const iv=setInterval(()=>{c++;setSentCount(c);if(c>=total){clearInterval(iv);setTimeout(()=>{setSending(false);setStep(4);},500);}},300);
    }
  };

  const doTestSend=async()=>{
    if(!waInfo?.phone||!selTemplate)return;
    let text=selTemplate.body;
    const allVars={...vars,name:"Test User"};
    Object.entries(allVars).forEach(([k,v])=>{text=text.replaceAll(`{{${k}}}`,v||`{{${k}}}`);});
    text+=OPT_OUT_FOOTER;
    try{ await api.wa.testSend(waInfo.phone,text); showMsg("Test message sent to yourself!"); }
    catch(e){ showMsg("Test failed: "+e.message,"error"); }
  };

  const doPause=async()=>{ if(activeCampaignId){try{await api.campaigns.pause(activeCampaignId);showMsg("Paused");}catch{}} };
  const doResume=async()=>{ if(activeCampaignId){try{await api.campaigns.resume(activeCampaignId);showMsg("Resumed");}catch{}} };
  const doCancel=async()=>{ if(activeCampaignId){try{await api.campaigns.cancel(activeCampaignId);showMsg("Cancelled","warn");setSending(false);setStep(4);}catch{}} };

  const btn={border:"none",borderRadius:12,fontFamily:"Outfit",fontWeight:600,cursor:"pointer",fontSize:13,transition:"all 0.2s"};
  const stepLabels=["Templates","Contacts","Customize","Review & Send"];

  return (
    <div style={{minHeight:"100vh",background:"#08080d",fontFamily:"'Outfit',sans-serif",color:"#f0f0f0",position:"relative",overflow:"hidden"}}>
      {/* Ambient */}
      <div style={{position:"fixed",top:-200,right:-200,width:500,height:500,background:"radial-gradient(circle,rgba(114,9,183,0.12),transparent 70%)",borderRadius:"50%",filter:"blur(80px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:-150,left:-150,width:400,height:400,background:"radial-gradient(circle,rgba(37,211,102,0.08),transparent 70%)",borderRadius:"50%",filter:"blur(80px)",pointerEvents:"none"}}/>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.t==="error"?"rgba(255,107,107,0.95)":toast.t==="warn"?"rgba(255,190,11,0.95)":"rgba(37,211,102,0.95)",color:"#fff",padding:"10px 18px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>{toast.m}</div>}

      {/* Template Creator Modal */}
      {showCreator&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowCreator(false)}>
          <div style={{background:"#111118",borderRadius:20,padding:24,maxWidth:520,width:"100%",border:"1px solid rgba(255,255,255,0.08)",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:18,fontWeight:800,color:"#e0e0e0",margin:"0 0 16px"}}>✨ Create Template</h3>
            <input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Template name" style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,fontFamily:"Outfit",outline:"none",marginBottom:12}}/>
            <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
              {["Promo","Loyalty","Restock","Retarget","Utility"].map(c=>(
                <button key={c} onClick={()=>setTplCat(c)} style={{background:tplCat===c?"#25d366":"rgba(255,255,255,0.03)",border:tplCat===c?"none":"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"4px 12px",color:tplCat===c?"#000":"#888",fontSize:11,fontFamily:"Outfit",fontWeight:tplCat===c?700:400,cursor:"pointer"}}>{c}</button>
              ))}
            </div>
            <textarea value={tplBody} onChange={e=>setTplBody(e.target.value)} rows={8} placeholder={"Hey {{name}}! 🎉\n\n{{store_name}} has a deal:\n💰 {{offer}}\n🛒 {{link}}"} style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none",resize:"vertical",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowCreator(false)} style={{...btn,flex:1,padding:"11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#888"}}>Cancel</button>
              <button onClick={saveTemplate} style={{...btn,flex:2,padding:"11px",background:tplName&&tplBody?"linear-gradient(135deg,#25d366,#128c7e)":"rgba(255,255,255,0.03)",color:tplName&&tplBody?"#fff":"#444",fontWeight:700}}>💾 Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{position:"relative",zIndex:1,maxWidth:920,margin:"0 auto",padding:"16px 14px 40px"}}>

        {/* ── HEADER ── */}
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(37,211,102,0.08)",border:"1px solid rgba(37,211,102,0.18)",borderRadius:30,padding:"5px 16px 5px 10px",marginBottom:8}}>
            <span style={{fontSize:16}}>💬</span>
            <span style={{fontFamily:"'Space Mono'",fontSize:10,color:"#25d366",letterSpacing:2,textTransform:"uppercase"}}>WhatsApp Blast</span>
            <span style={{fontSize:9,background:"rgba(37,211,102,0.2)",color:"#25d366",padding:"2px 6px",borderRadius:6,fontWeight:700}}>FREE</span>
          </div>
          <h1 style={{fontSize:"clamp(24px,4.5vw,38px)",fontWeight:900,margin:0,background:"linear-gradient(135deg,#25d366,#80ffdb,#48bfe3)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1.15}}>Retail Promo Messenger</h1>
          <p style={{color:"#555",fontSize:12,marginTop:4}}>No API needed · uses your own WhatsApp · scan QR to connect</p>
        </div>

        {/* ── WA STATUS BAR ── */}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:14,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:20,fontSize:10,fontWeight:600,background:serverUp?"rgba(37,211,102,0.08)":"rgba(255,107,107,0.08)",border:serverUp?"1px solid rgba(37,211,102,0.2)":"1px solid rgba(255,107,107,0.2)",color:serverUp?"#25d366":"#ff6b6b"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:serverUp?"#25d366":"#ff6b6b"}}/> Server {serverUp?"Online":"Offline"}
          </span>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:20,fontSize:10,fontWeight:600,background:waState==="ready"?"rgba(37,211,102,0.08)":waState==="qr_ready"?"rgba(255,190,11,0.08)":"rgba(136,136,136,0.08)",border:"1px solid "+(waState==="ready"?"rgba(37,211,102,0.2)":waState==="qr_ready"?"rgba(255,190,11,0.2)":"rgba(136,136,136,0.2)"),color:waState==="ready"?"#25d366":waState==="qr_ready"?"#ffbe0b":"#888"}}>
            {waState==="ready"?"✅ WhatsApp Connected":waState==="qr_ready"?"📱 Scan QR Code":waState==="connecting"?"⏳ Connecting...":"❌ WhatsApp Disconnected"}
          </span>
          {waInfo&&<span style={{fontSize:10,color:"#888",display:"flex",alignItems:"center",gap:4}}>👤 {waInfo.pushname} ({waInfo.phone})</span>}
        </div>

        {/* ── NAV TABS ── */}
        <div style={{display:"flex",gap:4,marginBottom:20,justifyContent:"center",background:"rgba(255,255,255,0.02)",borderRadius:14,padding:4,border:"1px solid rgba(255,255,255,0.04)",maxWidth:520,margin:"0 auto 20px"}}>
          {[["dashboard","📊 Dashboard"],["campaign","📨 Campaign"],["history","📋 History"]].map(([k,l])=>(
            <button key={k} onClick={()=>{setTab(k);if(k==="campaign")setStep(0);}} style={{...btn,flex:1,padding:"8px 14px",background:tab===k?"rgba(37,211,102,0.12)":"transparent",color:tab===k?"#25d366":"#666",border:tab===k?"1px solid rgba(37,211,102,0.2)":"1px solid transparent"}}>{l}</button>
          ))}
        </div>

        {/* ══════════ DASHBOARD ══════════ */}
        {tab==="dashboard"&&(
          <div>
            {/* QR / Connect Panel */}
            {waState!=="ready"&&(
              <div style={{background:"rgba(37,211,102,0.04)",border:"1px solid rgba(37,211,102,0.12)",borderRadius:20,padding:24,marginBottom:20,textAlign:"center"}}>
                {waState==="qr_ready"&&waQR?(
                  <>
                    <h3 style={{fontSize:16,fontWeight:700,color:"#25d366",margin:"0 0 12px"}}>📱 Scan this QR with WhatsApp</h3>
                    <p style={{fontSize:11,color:"#888",marginBottom:14}}>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
                    <img src={waQR} alt="QR Code" style={{width:240,height:240,borderRadius:16,margin:"0 auto",display:"block",border:"3px solid #25d366"}}/>
                    <p style={{fontSize:10,color:"#555",marginTop:10}}>QR refreshes automatically if it expires</p>
                  </>
                ):waState==="connecting"?(
                  <>
                    <div style={{fontSize:32,marginBottom:8}}>⏳</div>
                    <h3 style={{fontSize:16,fontWeight:700,color:"#ffbe0b"}}>Connecting to WhatsApp...</h3>
                    <p style={{fontSize:12,color:"#888",marginTop:4}}>This may take 10-30 seconds on first run (downloading browser)</p>
                  </>
                ):(
                  <>
                    <div style={{fontSize:40,marginBottom:10}}>💬</div>
                    <h3 style={{fontSize:18,fontWeight:700,color:"#e0e0e0",margin:"0 0 8px"}}>Connect Your WhatsApp</h3>
                    <p style={{fontSize:12,color:"#888",margin:"0 0 16px",maxWidth:400,marginLeft:"auto",marginRight:"auto",lineHeight:1.6}}>
                      Link your personal or business WhatsApp to send messages directly. No API key, no Meta account, no cost.
                    </p>
                    <button onClick={connectWA} disabled={!serverUp} style={{...btn,padding:"12px 32px",background:serverUp?"linear-gradient(135deg,#25d366,#128c7e)":"rgba(255,255,255,0.03)",color:serverUp?"#fff":"#444",fontSize:15,fontWeight:700,borderRadius:14}}>
                      {serverUp?"🔗 Connect WhatsApp":"Server offline — start the server first"}
                    </button>
                    {!serverUp&&(
                      <div style={{marginTop:14,textAlign:"left",maxWidth:350,margin:"14px auto 0"}}>
                        <code style={{display:"block",background:"rgba(0,0,0,0.3)",borderRadius:8,padding:10,fontFamily:"'Space Mono'",fontSize:10,color:"#80ffdb",lineHeight:1.8}}>
                          npm install{"\n"}npm run dev
                        </code>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Connected info + sync */}
            {waState==="ready"&&(
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <button onClick={syncContacts} disabled={syncing} style={{...btn,padding:"10px 20px",background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#25d366",flex:1}}>
                  {syncing?"⏳ Syncing...":"📥 Sync Contacts from WhatsApp"}
                </button>
                <button onClick={logoutWA} style={{...btn,padding:"10px 20px",background:"rgba(255,107,107,0.08)",border:"1px solid rgba(255,107,107,0.15)",color:"#ff6b6b"}}>
                  Logout
                </button>
              </div>
            )}

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
              {[
                {label:"Contacts",value:contacts.length,icon:"👥",color:"#48bfe3"},
                {label:"Opted In",value:contacts.filter(c=>c.opted_in).length,icon:"✅",color:"#25d366"},
                {label:"Not Opted In",value:contacts.filter(c=>!c.opted_in).length,icon:"⛔",color:"#ff6b6b"},
                {label:"Templates",value:allTpls.length,icon:"📝",color:"#c77dff"},
                {label:"Campaigns",value:campaigns.length,icon:"📨",color:"#fca311"},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:22}}>{s.icon}</div>
                  <div style={{fontSize:24,fontWeight:900,color:s.color,marginTop:3}}>{s.value}</div>
                  <div style={{fontSize:10,color:"#666",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Group Management */}
            {contacts.length>0&&(
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,padding:16,marginBottom:16}}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#e0e0e0",margin:"0 0 10px"}}>🏷️ Contact Groups</h3>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                  {groups.map(g=>(
                    <span key={g.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"5px 12px"}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:g.color||"#48bfe3"}}/>
                      <span style={{fontSize:12,color:"#e0e0e0",fontWeight:500}}>{g.name}</span>
                      <span style={{fontSize:10,color:"#888"}}>({g.member_count})</span>
                      <button onClick={async()=>{if(confirm(`Delete group "${g.name}"?`)){try{await api.contacts.deleteGroup(g.id);await loadGroups();showMsg("Group deleted");}catch(e){showMsg(e.message,"error");}}}} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:12,padding:0,marginLeft:4}}>×</button>
                    </span>
                  ))}
                  <button onClick={async()=>{const name=prompt("Group name (e.g. VIP Customers, Diwali List):");if(name?.trim()){const colors=["#48bfe3","#c77dff","#ff6b6b","#ffbe0b","#25d366","#ff9e00","#ffc8dd"];const color=colors[groups.length%colors.length];try{await api.contacts.createGroup(name.trim(),color);await loadGroups();showMsg("Group created!");}catch(e){showMsg(e.message,"error");}}}} style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(72,191,227,0.08)",border:"1px dashed rgba(72,191,227,0.2)",borderRadius:10,padding:"5px 12px",color:"#48bfe3",fontSize:11,fontFamily:"Outfit",cursor:"pointer"}}>+ New Group</button>
                </div>
                {groups.length>0&&<p style={{fontSize:10,color:"#555",margin:0}}>Tip: Select contacts in a campaign, then assign them to groups for easy re-targeting later.</p>}
              </div>
            )}

            {/* Contact Table */}
            {contacts.length>0&&(
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,padding:16,marginBottom:16}}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#e0e0e0",margin:"0 0 12px"}}>👥 Contacts ({contacts.length})</h3>
                <div style={{overflowX:"auto",maxHeight:300,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                      {["Name","Phone","Opt-in","Msgs Today",""].map(h=><th key={h} style={{padding:"6px 10px",color:"#666",fontWeight:600,textAlign:"left",fontSize:10,fontFamily:"'Space Mono'",textTransform:"uppercase",letterSpacing:.5,position:"sticky",top:0,background:"#0d0d14"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{contacts.map(c=>(
                      <tr key={c.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        <td style={{padding:"6px 10px",color:"#e0e0e0",fontWeight:500}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:24,height:24,borderRadius:"50%",background:`hsl(${(c.name.charCodeAt(0)*37)%360},55%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700,flexShrink:0}}>{c.name[0]}</div>
                            {c.name} {c.synced_from_wa?<span style={{fontSize:8,color:"#25d366",background:"rgba(37,211,102,0.1)",padding:"1px 5px",borderRadius:4}}>WA</span>:""}
                          </div>
                        </td>
                        <td style={{padding:"6px 10px",color:"#888",fontFamily:"'Space Mono'",fontSize:11}}>{c.phone}</td>
                        <td style={{padding:"6px 10px"}}>
                          <button onClick={async()=>{if(serverUp){await api.contacts.toggleOpt(c.id);await loadContacts();}else{setContacts(p=>p.map(x=>x.id===c.id?{...x,opted_in:!x.opted_in}:x));}}} style={{...btn,padding:"2px 8px",fontSize:10,background:c.opted_in?"rgba(37,211,102,0.12)":"rgba(255,107,107,0.08)",color:c.opted_in?"#25d366":"#ff6b6b",border:c.opted_in?"1px solid rgba(37,211,102,0.25)":"1px solid rgba(255,107,107,0.2)"}}>
                            {c.opted_in?"✓ Yes":"✗ No"}
                          </button>
                        </td>
                        <td style={{padding:"6px 10px",fontSize:11,color:c.msgs_today>=MAX_MKT_PER_DAY?"#ffbe0b":"#888"}}>{c.msgs_today||0}/{MAX_MKT_PER_DAY}</td>
                        <td style={{padding:"6px 10px"}}><button onClick={async()=>{if(serverUp){await api.contacts.remove(c.id);await loadContacts();}else{setContacts(p=>p.filter(x=>x.id!==c.id));}}} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:14}}>×</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <button onClick={()=>{setTab("campaign");setStep(0);}} style={{...btn,width:"100%",padding:"14px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontSize:15,fontWeight:700,borderRadius:14}}>📨 Start New Campaign</button>
          </div>
        )}

        {/* ══════════ HISTORY ══════════ */}
        {tab==="history"&&(
          <div>
            <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 16px",color:"#e0e0e0"}}>📊 Analytics & History</h2>

            {/* Analytics Summary Cards */}
            {campaigns.length>0&&(()=>{
              const totalSent=campaigns.reduce((s,c)=>s+(c.total_sent||0),0);
              const totalFailed=campaigns.reduce((s,c)=>s+(c.total_failed||0),0);
              const totalSkipped=campaigns.reduce((s,c)=>s+(c.total_skipped||0),0);
              const totalContacts=campaigns.reduce((s,c)=>s+(c.total_contacts||0),0);
              const deliveryRate=totalContacts>0?((totalSent/totalContacts)*100).toFixed(1):0;
              const successRate=totalSent+totalFailed>0?((totalSent/(totalSent+totalFailed))*100).toFixed(1):0;
              return (
                <div style={{marginBottom:20}}>
                  {/* Big stats */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                    {[
                      {label:"Total Campaigns",value:campaigns.length,icon:"📨",color:"#48bfe3"},
                      {label:"Messages Sent",value:totalSent,icon:"✅",color:"#25d366"},
                      {label:"Failed",value:totalFailed,icon:"❌",color:"#ff6b6b"},
                      {label:"Skipped",value:totalSkipped,icon:"⏭",color:"#ffbe0b"},
                      {label:"Delivery Rate",value:deliveryRate+"%",icon:"📈",color:"#c77dff"},
                      {label:"Success Rate",value:successRate+"%",icon:"🎯",color:"#80ffdb"},
                    ].map((s,i)=>(
                      <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
                        <div style={{fontSize:18}}>{s.icon}</div>
                        <div style={{fontSize:22,fontWeight:900,color:s.color,marginTop:2}}>{s.value}</div>
                        <div style={{fontSize:9,color:"#666",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Visual bar chart of last 10 campaigns */}
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,padding:16,marginBottom:16}}>
                    <h3 style={{fontSize:13,fontWeight:700,color:"#e0e0e0",margin:"0 0 12px"}}>📊 Campaign Performance</h3>
                    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,padding:"0 4px"}}>
                      {campaigns.slice(0,10).reverse().map((c,i)=>{
                        const total=c.total_sent+c.total_failed+c.total_skipped||1;
                        const sentPct=(c.total_sent/total)*100;
                        const failPct=(c.total_failed/total)*100;
                        const maxH=100;
                        return (
                          <div key={c.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}} title={`${c.template_name}\nSent: ${c.total_sent} | Failed: ${c.total_failed} | Skipped: ${c.total_skipped}`}>
                            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:1}}>
                              <div style={{height:Math.max(2,sentPct/100*maxH),background:"#25d366",borderRadius:"4px 4px 0 0",transition:"height 0.3s"}}/>
                              {c.total_failed>0&&<div style={{height:Math.max(1,failPct/100*maxH),background:"#ff6b6b"}}/>}
                            </div>
                            <div style={{fontSize:8,color:"#555",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:60,textAlign:"center"}}>{c.template_name?.split(" ").slice(0,2).join(" ")}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:12,marginTop:8,justifyContent:"center"}}>
                      <span style={{fontSize:9,color:"#888",display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:2,background:"#25d366"}}/>Sent</span>
                      <span style={{fontSize:9,color:"#888",display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:2,background:"#ff6b6b"}}/>Failed</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Campaign List */}
            <h3 style={{fontSize:14,fontWeight:700,color:"#e0e0e0",margin:"0 0 10px"}}>📋 Campaign Log</h3>
            {campaigns.length===0?<div style={{textAlign:"center",padding:40,color:"#555"}}>📭 No campaigns yet</div>:
            campaigns.map(c=>(
              <div key={c.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"#e0e0e0"}}>{c.template_name}</div>
                    <div style={{fontSize:10,color:"#555",marginTop:2}}>{c.created_at} · {c.total_contacts} contacts{c.media_path?" · 🖼️ with image":""}</div>
                  </div>
                  <Badge s={c.status==="completed"?"ready":c.status==="failed"?"draft":"pending"}/>
                </div>
                {/* Mini progress bar */}
                <div style={{marginTop:8,display:"flex",gap:2,height:4,borderRadius:2,overflow:"hidden",background:"rgba(255,255,255,0.03)"}}>
                  {c.total_sent>0&&<div style={{flex:c.total_sent,background:"#25d366"}}/>}
                  {c.total_failed>0&&<div style={{flex:c.total_failed,background:"#ff6b6b"}}/>}
                  {c.total_skipped>0&&<div style={{flex:c.total_skipped,background:"#ffbe0b"}}/>}
                </div>
                <div style={{display:"flex",gap:14,marginTop:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:"#25d366"}}>✅ {c.total_sent} sent</span>
                  <span style={{fontSize:11,color:"#ff6b6b"}}>❌ {c.total_failed} failed</span>
                  <span style={{fontSize:11,color:"#ffbe0b"}}>⏭ {c.total_skipped} skipped</span>
                  {c.total_contacts>0&&<span style={{fontSize:11,color:"#888"}}>{((c.total_sent/(c.total_contacts))*100).toFixed(0)}% delivery</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════ CAMPAIGN FLOW ══════════ */}
        {tab==="campaign"&&(
          <>
            {step<4&&(
              <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:24,flexWrap:"wrap"}}>
                {stepLabels.map((l,i)=>(
                  <button key={i} onClick={()=>i<step?setStep(i):null} style={{display:"flex",alignItems:"center",gap:5,background:step===i?"rgba(37,211,102,0.12)":i<step?"rgba(37,211,102,0.05)":"rgba(255,255,255,0.02)",border:step===i?"1px solid rgba(37,211,102,0.3)":"1px solid rgba(255,255,255,0.04)",borderRadius:18,padding:"6px 14px",color:step===i?"#25d366":i<step?"#4ade80":"#444",fontSize:11,fontFamily:"Outfit",fontWeight:step===i?600:400,cursor:i<step?"pointer":"default"}}>
                    <span style={{width:18,height:18,borderRadius:"50%",background:i<step?"#25d366":step===i?"rgba(37,211,102,0.25)":"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:i<=step?"#fff":"#444",fontWeight:700}}>{i<step?"✓":i+1}</span>{l}
                  </button>
                ))}
              </div>
            )}

            {/* STEP 0: Templates */}
            {step===0&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",gap:5,overflowX:"auto"}}>{CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{background:cat===c?"#25d366":"rgba(255,255,255,0.03)",border:cat===c?"none":"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"5px 14px",color:cat===c?"#000":"#999",fontSize:11,fontFamily:"Outfit",fontWeight:cat===c?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>)}</div>
                  <button onClick={()=>setShowCreator(true)} style={{...btn,padding:"6px 14px",background:"rgba(199,125,255,0.12)",border:"1px solid rgba(199,125,255,0.25)",color:"#c77dff",fontSize:11}}>✨ Create Template</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
                  {filtTpls.map(t=>(
                    <button key={t.id} onClick={()=>{setSelTemplate(t);const d={};(t.vars||[]).forEach(v=>d[v]="");setVars(d);}} style={{background:selTemplate?.id===t.id?"rgba(37,211,102,0.06)":"rgba(255,255,255,0.015)",border:selTemplate?.id===t.id?"2px solid #25d366":"1px solid rgba(255,255,255,0.05)",borderRadius:18,padding:0,cursor:"pointer",textAlign:"left",overflow:"hidden",transition:"all 0.2s"}}>
                      <div style={{background:t.gradient,padding:"12px 14px 10px",position:"relative"}}>
                        <div style={{position:"absolute",top:8,right:10,display:"flex",gap:4}}><Badge s={t.status}/>{!t.builtin&&<span style={{fontSize:9,background:"rgba(0,0,0,0.3)",color:"#fff",padding:"2px 6px",borderRadius:6}}>Custom</span>}</div>
                        <div style={{fontSize:22}}>{t.emoji}</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginTop:2}}>{t.name}</div>
                      </div>
                      <div style={{padding:"8px 12px",color:"#777",fontSize:10,lineHeight:1.5,maxHeight:55,overflow:"hidden"}}>{t.body.slice(0,100)}...</div>
                      {!t.builtin&&t.dbId&&(
                        <div style={{padding:"4px 12px 8px",display:"flex",gap:4}}>
                          <button onClick={(e)=>{e.stopPropagation();setTplName(t.name);setTplCat(t.category);setTplBody(t.body);setTplEmoji(t.emoji||"📝");setShowCreator(true);}} style={{fontSize:9,background:"rgba(72,191,227,0.1)",border:"1px solid rgba(72,191,227,0.2)",borderRadius:6,padding:"2px 8px",color:"#48bfe3",cursor:"pointer",fontFamily:"Outfit"}}>✏️ Edit</button>
                          <button onClick={async(e)=>{e.stopPropagation();if(confirm("Delete this template?")){try{await api.templates.remove(t.dbId);await loadTemplates();if(selTemplate?.id===t.id)setSelTemplate(null);showMsg("Deleted");}catch(er){showMsg(er.message,"error");}}}} style={{fontSize:9,background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.2)",borderRadius:6,padding:"2px 8px",color:"#ff6b6b",cursor:"pointer",fontFamily:"Outfit"}}>🗑️ Delete</button>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {selTemplate&&(
                  <div style={{marginTop:18,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:20,padding:18,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#25d366"}}>📱 Preview</span>
                    <PhonePreview message={selTemplate.body+OPT_OUT_FOOTER} gradient={selTemplate.gradient}/>
                  </div>
                )}
                <button onClick={()=>selTemplate&&setStep(1)} disabled={!selTemplate} style={{...btn,width:"100%",marginTop:16,padding:"13px",background:selTemplate?"linear-gradient(135deg,#25d366,#128c7e)":"rgba(255,255,255,0.03)",color:selTemplate?"#fff":"#444",fontSize:14,fontWeight:700,borderRadius:14}}>{selTemplate?"Continue → Select Contacts":"Select a template"}</button>
              </div>
            )}

            {/* STEP 1: Contacts */}
            {step===1&&(
              <div>
                <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px",color:"#e0e0e0"}}>Select Recipients 👥</h2>
                <p style={{color:"#555",fontSize:12,margin:"0 0 14px"}}>Tap to select · only opted-in contacts eligible</p>

                {/* SEARCH BAR */}
                <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);if(serverUp)loadContacts(e.target.value,selGroup);}} placeholder="🔍 Search contacts by name or phone..." style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none",marginBottom:10}}/>

                {/* GROUP FILTER */}
                {groups.length>0&&(
                  <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto"}}>
                    <button onClick={()=>{setSelGroup(null);loadContacts(searchQ,"");}} style={{...btn,padding:"4px 12px",fontSize:10,background:!selGroup?"#25d366":"rgba(255,255,255,0.03)",color:!selGroup?"#000":"#888",border:!selGroup?"none":"1px solid rgba(255,255,255,0.06)"}}>All</button>
                    {groups.map(g=><button key={g.id} onClick={()=>{setSelGroup(g.id);loadContacts(searchQ,g.id);}} style={{...btn,padding:"4px 12px",fontSize:10,background:selGroup===g.id?g.color||"#48bfe3":"rgba(255,255,255,0.03)",color:selGroup===g.id?"#000":"#888",border:selGroup===g.id?"none":"1px solid rgba(255,255,255,0.06)",whiteSpace:"nowrap"}}>{g.name} ({g.member_count})</button>)}
                  </div>
                )}
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" onKeyDown={e=>e.key==="Enter"&&addContact()} style={{flex:"1 1 120px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none"}}/>
                  <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" onKeyDown={e=>e.key==="Enter"&&addContact()} style={{flex:"1 1 150px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none"}}/>
                  <button onClick={addContact} style={{...btn,background:"#25d366",padding:"8px 14px",color:"#000",fontWeight:700}}>+ Add</button>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  <button onClick={()=>setShowBulk(!showBulk)} style={{background:"none",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 14px",color:"#777",fontSize:11,cursor:"pointer"}}>📋 Bulk Import</button>
                  <label style={{...btn,padding:"6px 14px",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",color:"#777",fontSize:11,display:"inline-flex",alignItems:"center",gap:4}}>
                    📄 Upload CSV
                    <input type="file" accept=".csv,.txt,.tsv" style={{display:"none"}} onChange={async(e)=>{
                      const file=e.target.files?.[0]; if(!file)return;
                      const text=await file.text();
                      if(serverUp){try{const r=await api.contacts.bulkImportCSV(text);await loadContacts();showMsg(`Imported ${r.imported} from CSV`);}catch(err){showMsg(err.message,"error");}}
                      e.target.value="";
                    }}/>
                  </label>
                  {waState==="ready"&&<button onClick={syncContacts} disabled={syncing} style={{...btn,padding:"6px 14px",background:"rgba(37,211,102,0.08)",border:"1px solid rgba(37,211,102,0.15)",color:"#25d366",fontSize:11}}>{syncing?"Syncing...":"📥 Sync from WhatsApp"}</button>}
                  <button onClick={selAll} style={{...btn,padding:"6px 12px",background:"rgba(37,211,102,0.08)",border:"1px solid rgba(37,211,102,0.15)",color:"#25d366",fontSize:11}}>☑ All</button>
                  <button onClick={selNone} style={{...btn,padding:"6px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",color:"#888",fontSize:11}}>☐ None</button>
                  {selIds.size>0&&serverUp&&<button onClick={async()=>{const name=prompt(`Save ${selIds.size} selected contacts as group:`);if(name?.trim()){try{const g=await api.contacts.createGroup(name.trim());await api.contacts.addToGroup(g.id,[...selIds]);await loadGroups();showMsg(`Group "${name}" created with ${selIds.size} contacts`);}catch(e){showMsg(e.message,"error");}}}} style={{...btn,padding:"6px 12px",background:"rgba(72,191,227,0.08)",border:"1px solid rgba(72,191,227,0.15)",color:"#48bfe3",fontSize:11}}>💾 Save as Group</button>}
                  <span style={{fontSize:11,color:"#25d366",display:"flex",alignItems:"center",fontWeight:600}}>{selIds.size} selected</span>
                </div>
                {showBulk&&<div style={{marginBottom:12}}><textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} rows={3} placeholder={"Name, +91 XXXXX\nName2, +91 YYYYY"} style={{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:11,fontFamily:"'Space Mono'",outline:"none",resize:"vertical"}}/><button onClick={parseBulk} style={{...btn,marginTop:4,background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.25)",padding:"6px 14px",color:"#25d366",fontSize:11}}>Import</button></div>}
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:10,maxHeight:320,overflowY:"auto"}}>
                  {(searchQ&&!serverUp ? contacts.filter(c=>c.name.toLowerCase().includes(searchQ.toLowerCase())||c.phone.includes(searchQ)) : contacts).length === 0 ? (
                    <div style={{textAlign:"center",padding:20,color:"#555",fontSize:12}}>
                      {searchQ ? `No contacts matching "${searchQ}"` : "No contacts yet — add some above or sync from WhatsApp"}
                    </div>
                  ) : (searchQ&&!serverUp ? contacts.filter(c=>c.name.toLowerCase().includes(searchQ.toLowerCase())||c.phone.includes(searchQ)) : contacts).map(c=>{
                    const sel=selIds.has(c.id); const ok=c.opted_in&&(c.msgs_today<MAX_MKT_PER_DAY||selTemplate?.category==="Utility");
                    return(
                      <div key={c.id} onClick={()=>toggleId(c.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 8px",borderBottom:"1px solid rgba(255,255,255,0.03)",background:sel?"rgba(37,211,102,0.05)":"transparent",borderRadius:8,cursor:"pointer",opacity:ok?1:.45}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:20,height:20,borderRadius:6,border:sel?"2px solid #25d366":"2px solid rgba(255,255,255,0.15)",background:sel?"#25d366":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",fontWeight:700,flexShrink:0}}>{sel?"✓":""}</div>
                          <div style={{width:26,height:26,borderRadius:"50%",background:`hsl(${(c.name.charCodeAt(0)*37)%360},55%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>{c.name[0]}</div>
                          <div><div style={{fontSize:12,color:"#e0e0e0",fontWeight:500}}>{c.name}</div><div style={{fontSize:10,color:"#666"}}>{c.phone}</div></div>
                        </div>
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {!c.opted_in&&<span style={{fontSize:9,color:"#ff6b6b",background:"rgba(255,107,107,0.08)",padding:"2px 6px",borderRadius:4}}>No opt-in</span>}
                          {ok&&<span style={{fontSize:9,color:"#25d366"}}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8,marginTop:14}}>
                  <button onClick={()=>setStep(0)} style={{...btn,flex:1,padding:"11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#999"}}>← Back</button>
                  <button onClick={()=>eligible.length>0&&setStep(2)} disabled={eligible.length===0} style={{...btn,flex:2,padding:"11px",background:eligible.length>0?"linear-gradient(135deg,#25d366,#128c7e)":"rgba(255,255,255,0.03)",color:eligible.length>0?"#fff":"#444",fontWeight:700}}>Continue ({eligible.length} eligible)</button>
                </div>
              </div>
            )}

            {/* STEP 2: Customize */}
            {step===2&&selTemplate&&(
              <div>
                <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px",color:"#e0e0e0"}}>Customize ✏️</h2>
                <p style={{color:"#555",fontSize:12,margin:"0 0 14px"}}><span style={{color:"#25d366",fontFamily:"'Space Mono'"}}>{`{{name}}`}</span> auto-fills per contact</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:16,alignItems:"start"}}>
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:18,padding:16}}>
                    {(selTemplate.vars||[]).map(v=>(
                      <div key={v} style={{marginBottom:10}}>
                        <label style={{display:"block",fontSize:10,color:"#777",marginBottom:3,fontFamily:"'Space Mono'",textTransform:"uppercase"}}>{`{{${v}}}`}</label>
                        <input value={vars[v]||""} onChange={e=>setVars(p=>({...p,[v]:e.target.value}))} placeholder={v==="name"?"Auto-filled":`Enter ${v.replace(/_/g," ")}`} disabled={v==="name"}
                          style={{width:"100%",boxSizing:"border-box",background:v==="name"?"rgba(37,211,102,0.04)":"rgba(255,255,255,0.03)",border:v==="name"?"1px solid rgba(37,211,102,0.12)":"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:"8px 10px",color:v==="name"?"#25d366":"#fff",fontSize:12,fontFamily:"Outfit",outline:"none"}}/>
                      </div>
                    ))}

                    {/* IMAGE ATTACHMENT */}
                    <div style={{marginTop:4,padding:"10px 0",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                      <label style={{display:"block",fontSize:10,color:"#777",marginBottom:6,fontFamily:"'Space Mono'",textTransform:"uppercase"}}>📷 Attach Image (optional)</label>
                      {mediaPreview ? (
                        <div style={{position:"relative",display:"inline-block"}}>
                          <img src={mediaPreview} alt="Preview" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)"}}/>
                          <button onClick={()=>{setMediaFile(null);setMediaPreview(null);setMediaPath(null);}} style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                        </div>
                      ) : (
                        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"14px",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:10,cursor:"pointer",color:"#777",fontSize:11}}>
                          🖼️ Click to add product image
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={async(e)=>{
                            const file=e.target.files?.[0]; if(!file)return;
                            setMediaFile(file);
                            setMediaPreview(URL.createObjectURL(file));
                            if(serverUp){
                              try{ const r=await api.media.upload(file); setMediaPath(r.filepath); showMsg("Image uploaded!"); }
                              catch(err){ showMsg("Upload failed: "+err.message,"error"); }
                            }
                          }}/>
                        </label>
                      )}
                    </div>
                  </div>
                  <PhonePreview message={getPreview()} gradient={selTemplate.gradient} imageUrl={mediaPreview}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:14}}>
                  <button onClick={()=>setStep(1)} style={{...btn,flex:1,padding:"11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#999"}}>← Back</button>
                  <button onClick={()=>setStep(3)} style={{...btn,flex:2,padding:"11px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontWeight:700}}>Continue → Review</button>
                </div>
              </div>
            )}

            {/* STEP 3: Review & Send */}
            {step===3&&(
              <div>
                <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px",color:"#e0e0e0"}}>Review & Send 🚀</h2>
                <div style={{background:waState==="ready"?"rgba(37,211,102,0.06)":"rgba(255,190,11,0.06)",border:"1px solid "+(waState==="ready"?"rgba(37,211,102,0.15)":"rgba(255,190,11,0.15)"),borderRadius:10,padding:"10px 14px",marginBottom:14,textAlign:"center"}}>
                  <span style={{fontSize:11,color:waState==="ready"?"#25d366":"#ffbe0b"}}>{waState==="ready"?"✅ LIVE — messages will be sent via your WhatsApp":"⚠️ WhatsApp not connected — this will be a simulation"}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:14}}>
                  {[{l:"Sending To",v:eligible.length,c:"#25d366"},{l:"Template",v:selTemplate?.emoji,sub:selTemplate?.name,c:"#48bfe3"},{l:"Category",v:selTemplate?.category,c:"#c77dff"}].map((s,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"12px 10px",textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:"#888",marginTop:2}}>{s.l}</div>
                      {s.sub&&<div style={{fontSize:9,color:"#555"}}>{s.sub}</div>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {[{v:"now",l:"Send Now ⚡"},{v:"later",l:"Schedule 📅"}].map(o=>(
                    <button key={o.v} onClick={()=>setSchedType(o.v)} style={{...btn,flex:1,padding:"11px",background:schedType===o.v?"rgba(37,211,102,0.1)":"rgba(255,255,255,0.02)",border:schedType===o.v?"2px solid #25d366":"1px solid rgba(255,255,255,0.05)",color:schedType===o.v?"#25d366":"#888"}}>{o.l}</button>
                  ))}
                </div>
                {schedType==="later"&&<div style={{display:"flex",gap:8,marginBottom:14}}>
                  <input type="date" value={schedDate} onChange={e=>setSchedDate(e.target.value)} style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none",colorScheme:"dark"}}/>
                  <input type="time" value={schedTime} onChange={e=>setSchedTime(e.target.value)} style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:12,fontFamily:"Outfit",outline:"none",colorScheme:"dark"}}/>
                </div>}
                {sending&&<div style={{background:"rgba(37,211,102,0.05)",border:"1px solid rgba(37,211,102,0.12)",borderRadius:14,padding:14,marginBottom:12,textAlign:"center"}}>
                  <div style={{fontSize:13,color:"#25d366",fontWeight:600,marginBottom:6}}>Sending... {sentCount}/{eligible.length}</div>
                  <div style={{width:"100%",height:5,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${(sentCount/eligible.length)*100}%`,height:"100%",background:"linear-gradient(90deg,#25d366,#80ffdb)",borderRadius:3,transition:"width 0.3s"}}/></div>
                  <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"center"}}>
                    <button onClick={doPause} style={{...btn,padding:"6px 16px",background:"rgba(255,190,11,0.1)",border:"1px solid rgba(255,190,11,0.2)",color:"#ffbe0b",fontSize:11}}>⏸ Pause</button>
                    <button onClick={doResume} style={{...btn,padding:"6px 16px",background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#25d366",fontSize:11}}>▶ Resume</button>
                    <button onClick={doCancel} style={{...btn,padding:"6px 16px",background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.2)",color:"#ff6b6b",fontSize:11}}>⏹ Cancel</button>
                  </div>
                </div>}

                {/* Confirmation dialog */}
                {showConfirm&&(
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowConfirm(false)}>
                    <div style={{background:"#111118",borderRadius:20,padding:24,maxWidth:400,width:"100%",border:"1px solid rgba(255,255,255,0.08)",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                      <div style={{fontSize:40,marginBottom:10}}>⚠️</div>
                      <h3 style={{fontSize:18,fontWeight:700,color:"#e0e0e0",margin:"0 0 8px"}}>Confirm Send</h3>
                      <p style={{fontSize:13,color:"#888",margin:"0 0 6px"}}>You're about to send <b style={{color:"#25d366"}}>{eligible.length}</b> messages via WhatsApp.</p>
                      <p style={{fontSize:11,color:"#555",margin:"0 0 18px"}}>This action cannot be undone. Messages will be sent from your personal WhatsApp account.</p>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setShowConfirm(false)} style={{...btn,flex:1,padding:"11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#888"}}>Cancel</button>
                        <button onClick={()=>{setShowConfirm(false);executeSend();}} style={{...btn,flex:2,padding:"11px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontWeight:700}}>🚀 Yes, Send Now</button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setStep(2)} style={{...btn,flex:1,padding:"11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#999"}}>← Back</button>
                  {waState==="ready"&&!sending&&<button onClick={doTestSend} style={{...btn,padding:"11px 14px",background:"rgba(255,190,11,0.1)",border:"1px solid rgba(255,190,11,0.2)",color:"#ffbe0b",fontSize:11}}>🧪 Test</button>}
                  <button onClick={()=>{if(waState==="ready")setShowConfirm(true);else executeSend();}} disabled={sending||eligible.length===0} style={{...btn,flex:2,padding:"12px",background:sending?"rgba(255,255,255,0.03)":"linear-gradient(135deg,#25d366,#128c7e)",color:sending?"#444":"#fff",fontSize:14,fontWeight:800}}>
                    {sending?"Sending...":waState==="ready"?`🚀 Send to ${eligible.length}`:`🧪 Simulate ${eligible.length}`}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Done */}
            {step===4&&(
              <div style={{textAlign:"center",paddingTop:30}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#25d366,#80ffdb)",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,boxShadow:"0 0 50px rgba(37,211,102,0.25)"}}>✓</div>
                <h2 style={{fontSize:28,fontWeight:900,margin:"0 0 6px",background:"linear-gradient(135deg,#25d366,#80ffdb)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  {waState==="ready"?"Sent":"Simulated"}! 🎉
                </h2>
                <p style={{color:"#888",fontSize:14,margin:"0 0 24px"}}>{eligible.length} messages processed</p>
                <button onClick={()=>{setStep(0);setSelTemplate(null);setVars({});setSelIds(new Set());setMediaFile(null);setMediaPreview(null);setMediaPath(null);setTab("dashboard");}} style={{...btn,padding:"13px 36px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontSize:14,fontWeight:700,borderRadius:14}}>Back to Dashboard</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
