
/* ====================== MODULO SOCIAL — 27/09/2026 =========================
   Piano social, FASE 2 (pipeline post gara/PIANO_SOCIAL_2026-09-25.md).
   Layout B + dettaglio D, scelti da Fede sull'anteprima del 27/09
   (pipeline post gara/social/anteprima_fase2/).

   REGOLE, DA NON DIMENTICARE
   - Le immagini arrivano da GitHub Pages (ramo `uscite` di dhn-social), MAI
     da Supabase: aprire questa scheda non consuma egress. L'unica chiamata al
     database e' il tasto «Rifai grafiche» (rpc social_rendi, pochi byte).
   - La scheda NON disegna le grafiche: mostra le JPEG gia' fatte dalla resa.
   - `indice.json` e i manifesti si leggono con ?t= (niente cache): dopo una
     resa nuova devono vedersi subito. Le immagini con ?v=<generato>: stessa
     immagine = cache, resa nuova = indirizzo nuovo.
   - ⚠ Serve `https://fedecacciaf1.github.io` in img-src e connect-src di
     sito/_headers: una direttiva mancante NON e' permissiva (vedi 25/08).
   - Il bollo PROVVISORIO/UFFICIALE e' quello del momento della resa: quando
     Direzione Gara ufficializza, il trigger `trg_live_storico_social` rifa'
     le grafiche da solo (3 min di attesa + ~2 min di resa).
   ========================================================================== */
const SOCIAL_BASE="https://fedecacciaf1.github.io/dhn-social";
const SOCIAL={indice:null,man:{},gara:null,cat:"tutte",voce:-1,errore:null};
async function socialJson(path){
  const r=await fetch(`${SOCIAL_BASE}/${path}?t=${Date.now()}`,{cache:"no-store"});
  if(!r.ok) throw new Error(`${path}: GitHub risponde ${r.status}`);
  return r.json();
}
/* Una gara che finisce dopo mezzanotte (il rigiro della ROOKIE R2 alle 00:06)
   e' ancora la serata prima: la data si legge spostata indietro di 6 ore. */
const socialData=iso=>iso?new Date(Date.parse(iso)-6*3600e3).toLocaleDateString("it-IT",{timeZone:"Europe/Rome",weekday:"short",day:"2-digit",month:"2-digit"}):"";
const socialCatK=c=>/^[ÉE]/i.test(c||"")?"E":"R";
const socialBollo=s=>s==="ufficiale"?`<span class="soc-bollo u">✔ Ufficiale</span>`:`<span class="soc-bollo p">● Provvisorio</span>`;
const socialImg=(g,m,v,min)=>`${SOCIAL_BASE}/${g.cartella}${min?"min/":""}${encodeURIComponent(v.file)}?v=${encodeURIComponent(m.generato||"")}`;
function socialCss(){
  if(document.getElementById("socCss")) return;
  const s=document.createElement("style"); s.id="socCss";
  s.textContent=`
  .soc-h{font-family:var(--fd);font-weight:800;font-style:italic;font-size:26px;letter-spacing:.3px;margin:0}
  .soc-bollo{font-family:var(--ft);font-size:10px;font-weight:700;letter-spacing:1.4px;padding:4px 9px;border-radius:6px;text-transform:uppercase;white-space:nowrap}
  .soc-bollo.p{color:var(--warn);border:1px solid #5a4a14;background:#f4c43014}
  .soc-bollo.u{color:var(--ok);border:1px solid #0f5a37;background:#17d97a12}
  .soc-cat{font-family:var(--ft);font-size:10px;font-weight:700;letter-spacing:1.6px;padding:4px 9px;border-radius:6px;background:#ffffff0a;border:1px solid var(--line2);text-transform:uppercase}
  .soc-cat.E{color:#ff8f33}.soc-cat.R{color:#6cc6ff}
  .soc-chip{font-family:var(--ft);font-size:10px;padding:5px 11px;border-radius:999px;border:1px solid var(--line2);color:var(--mut2);letter-spacing:.6px;font-weight:600;text-transform:uppercase;background:transparent;cursor:pointer;white-space:nowrap}
  .soc-chip.on{color:#fff;border-color:var(--acc);background:var(--acc-soft)}
  .soc-split{display:grid;grid-template-columns:270px 1fr;gap:16px;align-items:start}
  .soc-list{background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:var(--r);padding:8px;position:sticky;top:78px}
  .soc-gi{padding:11px 12px;border-radius:10px;border:1px solid transparent;margin-bottom:4px;cursor:pointer}
  .soc-gi:hover{background:#ffffff06}
  .soc-gi.on{background:var(--acc-soft);border-color:var(--acc-mid)}
  .soc-gt{font-family:var(--fd);font-weight:800;font-style:italic;font-size:18px}
  .soc-meta{font-family:var(--ft);font-size:11px;color:var(--mut);letter-spacing:.3px}
  .soc-chips-tel{display:none;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px}
  .soc-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
  .soc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
  .soc-th{position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--line);background:var(--bg3);cursor:pointer;transition:border-color .12s,transform .12s}
  .soc-th:hover{border-color:var(--acc-mid);transform:translateY(-1px)}
  .soc-th img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:var(--bg3)}
  .soc-th .lb{font-family:var(--ft);font-size:9.5px;font-weight:700;letter-spacing:.8px;color:var(--mut2);padding:6px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid var(--line)}
  .soc-th .lb b{color:var(--acc2);margin-right:4px}
  .soc-th .warn{position:absolute;top:6px;right:6px;font-family:var(--ft);font-size:9px;font-weight:700;background:#000c;color:var(--warn);padding:2px 6px;border-radius:5px;border:1px solid #5a4a14}
  .soc-ov{position:fixed;inset:0;background:#000d;display:flex;align-items:center;justify-content:center;padding:28px;z-index:400}
  .soc-det{display:grid;grid-template-columns:auto 380px;max-width:1040px;width:100%;max-height:calc(100vh - 56px);overflow:hidden;background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--line2);border-radius:var(--r)}
  .soc-det .img{background:#000;display:flex;align-items:center;justify-content:center;padding:18px;position:relative}
  .soc-det .img img{max-height:calc(100vh - 92px);max-width:100%;border-radius:6px}
  .soc-det .side{padding:20px;display:flex;flex-direction:column;gap:12px;overflow:auto}
  .soc-cap{white-space:pre-wrap;font-size:13.5px;line-height:1.45;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:12px;color:var(--txt);flex:1;min-height:120px;overflow:auto}
  .soc-arr{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#0009;border:1px solid var(--line2);color:#fff;font-size:22px;padding:0;display:flex;align-items:center;justify-content:center}
  .soc-x{background:transparent;border:0;color:var(--mut);font-size:24px;padding:0 4px;margin-left:auto}
  .soc-btns{display:flex;gap:8px}
  @media (max-width:980px){.soc-grid{grid-template-columns:repeat(4,1fr)}}
  @media (max-width:760px){
    .soc-split{grid-template-columns:1fr}.soc-list{display:none}.soc-chips-tel{display:flex}
    .soc-grid{grid-template-columns:repeat(3,1fr);gap:8px}
    .soc-ov{padding:0;align-items:stretch}
    .soc-det{display:flex;flex-direction:column;border-radius:0;max-width:none;max-height:none;height:100%;overflow:auto}
    .soc-det .img{padding:10px}.soc-det .img img{max-height:none;width:100%}
    .soc-det .side{overflow:visible}
    .soc-cap{flex:none}
    .soc-btns{position:sticky;bottom:0;background:var(--card);padding:10px 0}
  }`;
  document.head.appendChild(s);
}
async function renderSocial(ricarica){
  socialCss();
  const c=document.getElementById("content");
  if(ricarica||!SOCIAL.indice){
    c.innerHTML=`<div class="muted">Caricamento grafiche da GitHub…</div>`;
    try{ SOCIAL.indice=await socialJson("indice.json"); SOCIAL.man={}; SOCIAL.errore=null; }
    catch(e){ SOCIAL.indice=null; SOCIAL.errore=e.message; }
  }
  if(!SOCIAL.indice){
    c.innerHTML=`<div class="soc-h">Social</div><div class="msg e">⚠ Grafiche non caricate da GitHub Pages: ${esc(SOCIAL.errore)}.
      <br>Se dice «Failed to fetch», il sito non ammette ancora fedecacciaf1.github.io (sito/_headers).</div>
      <button class="sec" id="socRetry">Riprova</button>`;
    document.getElementById("socRetry").onclick=()=>renderSocial(true); return;
  }
  const tutte=(SOCIAL.indice.gare||[]).filter(g=>g.stagione_id===season);
  const cats=[...new Set(tutte.map(g=>g.categoria))];
  if(SOCIAL.cat!=="tutte"&&!cats.includes(SOCIAL.cat)) SOCIAL.cat="tutte";
  const gare=tutte.filter(g=>SOCIAL.cat==="tutte"||g.categoria===SOCIAL.cat);
  if(!gare.find(g=>g.gara_id===SOCIAL.gara)) SOCIAL.gara=gare[0]?.gara_id??null;
  const g=gare.find(x=>x.gara_id===SOCIAL.gara);
  c.innerHTML=`<div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
      <div><div class="soc-h">Social</div>
      <div class="small">Grafiche pronte per ogni gara pubblicata. Tocca un'immagine per aprirla, scaricarla o copiare la didascalia.</div></div>
      <button class="ghost" id="socRic" style="margin-left:auto" title="Rilegge l'elenco da GitHub">↻ Aggiorna elenco</button></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 16px">
      ${["tutte",...cats].map(k=>`<button class="soc-chip ${SOCIAL.cat===k?"on":""}" data-cat="${esc(k)}">${k==="tutte"?"Tutte":esc(k)}</button>`).join("")}
      <span style="margin-left:auto" class="small">Le immagini arrivano da GitHub, non dal database.</span></div>
    ${!gare.length?`<div class="muted">Nessuna gara con grafiche per questa stagione${SOCIAL.cat!=="tutte"?" e categoria":""}. Le grafiche si fanno da sole quando Direzione Gara pubblica.</div>`:`
    <div class="soc-chips-tel">${gare.map(x=>`<button class="soc-chip ${x.gara_id===SOCIAL.gara?"on":""}" data-gara="${x.gara_id}">${esc(x.categoria)} · ${esc(x.gp_nome)} R${x.round??"?"}</button>`).join("")}</div>
    <div class="soc-split">
      <div class="soc-list">${gare.map(x=>`<div class="soc-gi ${x.gara_id===SOCIAL.gara?"on":""}" data-gara="${x.gara_id}">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><span class="soc-cat ${socialCatK(x.categoria)}">${esc(x.categoria)}</span>${socialBollo(x.stato)}</div>
        <div class="soc-gt">${esc(x.gp_nome)} · R${x.round??"?"}</div><div class="soc-meta">${socialData(x.data_gara)} · ${x.immagini} grafiche</div></div>`).join("")}</div>
      <div id="socGara"><div class="muted">Caricamento…</div></div>
    </div>`}`;
  document.getElementById("socRic").onclick=()=>renderSocial(true);
  c.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{SOCIAL.cat=b.dataset.cat;renderSocial();});
  c.querySelectorAll("[data-gara]").forEach(b=>b.onclick=()=>{SOCIAL.gara=+b.dataset.gara;renderSocial();});
  if(g) socialGara(g);
}
async function socialGara(g){
  const box=document.getElementById("socGara"); if(!box) return;
  let m=SOCIAL.man[g.gara_id];
  if(!m){
    try{ m=SOCIAL.man[g.gara_id]=await socialJson(`${g.cartella}manifesto.json`); }
    catch(e){ box.innerHTML=`<div class="msg e">⚠ Manifesto della gara ${g.gara_id} non caricato: ${esc(e.message)}</div>`; return; }
  }
  if(SOCIAL.gara!==g.gara_id) return;   // nel frattempo si e' cliccato un'altra gara
  const voci=m.voci||[];
  box.innerHTML=`<div class="soc-head"><span class="soc-cat ${socialCatK(m.categoria)}">${esc(m.categoria)}</span>
      <span class="soc-gt" style="font-size:22px">${esc(m.gp_nome)} · Round ${m.round??"?"}</span>${socialBollo(m.stato)}
      <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="sec" id="socZip" style="padding:7px 11px;font-size:12px">⬇ Scarica tutte</button>
        <button class="ghost" id="socRifai" style="padding:7px 11px;font-size:12px" title="Rifà le grafiche di questa gara dai dati di adesso">↻ Rifai grafiche</button></span></div>
    <div class="soc-meta" style="margin:-4px 0 12px">Grafiche del ${new Date(m.generato).toLocaleString("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}${(m.saltate||[]).length?` · ${m.saltate.length} non fatte (dati mancanti)`:""}</div>
    <div id="socMsg" class="msg" style="margin:0 0 10px;min-height:0"></div>
    ${voci.length?`<div class="soc-grid">${voci.map((v,i)=>`<div class="soc-th" data-i="${i}">
      <img loading="lazy" src="${socialImg(g,m,v,true)}" alt="${esc(v.titolo||v.codice)}">
      ${v.didascalia_origine!=="generata dai dati"?`<span class="warn" title="Didascalia da completare">✎ testo</span>`:""}
      <div class="lb"><b>${esc(v.codice)}</b>${esc(v.titolo||"")}</div></div>`).join("")}</div>`
      :`<div class="muted">Nessuna grafica prodotta per questa gara.</div>`}`;
  box.querySelectorAll(".soc-th").forEach(t=>t.onclick=()=>socialDettaglio(g,m,+t.dataset.i));
  document.getElementById("socZip").onclick=()=>socialZip(g,m);
  document.getElementById("socRifai").onclick=()=>socialRifai(g);
}
function socialMsg(t,ok){ const e=document.getElementById("socMsg"); if(!e) return; e.innerHTML=t; e.className="msg "+(ok===true?"o":ok===false?"e":""); e.style.minHeight=t?"18px":"0"; }
function socialNomeFile(m,v){ return `DHN_${m.categoria}_${m.gp_nome}_R${m.round??""}_${v.file}`.replace(/[^\w.\-À-ÿ]+/g,"_"); }
async function socialBlob(url){ const r=await fetch(url); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); }
function socialSalva(blob,nome){ const u=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=u; a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); }
function socialDettaglio(g,m,i){
  const voci=m.voci||[]; if(!voci.length) return;
  i=(i+voci.length)%voci.length; SOCIAL.voce=i;
  const v=voci[i];
  document.getElementById("socOv")?.remove();
  const ov=document.createElement("div"); ov.className="soc-ov"; ov.id="socOv";
  const igok=v.instagram?.ok&&v.facebook?.ok;
  const probl=[...new Set([...(v.instagram?.problemi||[]),...(v.facebook?.problemi||[])])];
  ov.innerHTML=`<div class="soc-det">
    <div class="img"><img src="${socialImg(g,m,v,false)}" alt="${esc(v.titolo||v.codice)}">
      <button class="soc-arr" id="socPrev" style="left:18px" title="Precedente (←)">‹</button><button class="soc-arr" id="socNext" style="right:18px" title="Successiva (→)">›</button></div>
    <div class="side">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="soc-cat ${socialCatK(m.categoria)}">${esc(m.categoria)}</span>
        <span class="soc-gt">${esc(m.gp_nome)} · R${m.round??"?"}</span>${socialBollo(m.stato)}<button class="soc-x" id="socX" title="Chiudi (Esc)">✕</button></div>
      <div style="font-family:var(--fd);font-weight:800;font-style:italic;font-size:22px"><span style="color:var(--acc2)">${esc(v.codice)}</span> ${esc(v.titolo||"")}</div>
      <div class="soc-meta">${v.larghezza}×${v.altezza} · JPEG · ${igok?`<span style="color:var(--ok)">✔ pronta per Instagram e Facebook</span>`:`<span style="color:var(--warn)">⚠ ${esc(probl.join(", ")||"da controllare")}</span>`}</div>
      <div class="small" style="margin-top:4px">${v.didascalia_origine==="generata dai dati"?"Didascalia (scritta dai dati)":`<span style="color:var(--warn)">Didascalia da completare</span> — c'è solo titolo, GP e categoria`}</div>
      <div class="soc-cap" id="socCap">${esc(v.didascalia||"")}</div>
      <div class="soc-btns"><button style="flex:1" id="socDl">⬇ Scarica</button><button class="sec" style="flex:1" id="socCp">⧉ Copia didascalia</button></div>
      <div class="small" id="socDetMsg">${i+1} di ${voci.length} · Pubblica / Programma arrivano con la fase 3.</div>
    </div></div>`;
  document.body.appendChild(ov);
  const chiudi=()=>{ ov.remove(); document.removeEventListener("keydown",tasti); };
  const vai=d=>{ document.removeEventListener("keydown",tasti); socialDettaglio(g,m,i+d); };
  const tasti=e=>{ if(e.key==="Escape")chiudi(); else if(e.key==="ArrowLeft")vai(-1); else if(e.key==="ArrowRight")vai(1); };
  document.addEventListener("keydown",tasti);
  ov.onclick=e=>{ if(e.target===ov) chiudi(); };
  document.getElementById("socX").onclick=chiudi;
  document.getElementById("socPrev").onclick=()=>vai(-1);
  document.getElementById("socNext").onclick=()=>vai(1);
  const dm=t=>document.getElementById("socDetMsg").textContent=t;
  document.getElementById("socDl").onclick=async()=>{
    try{ socialSalva(await socialBlob(socialImg(g,m,v,false)),socialNomeFile(m,v)); dm("Scaricata: "+socialNomeFile(m,v)); }
    catch(e){ dm("⚠ Download non riuscito ("+e.message+"): tieni premuto sull'immagine e «Salva»."); }
  };
  document.getElementById("socCp").onclick=async()=>{
    const t=v.didascalia||"";
    try{ await navigator.clipboard.writeText(t); dm("Didascalia copiata ("+t.length+" caratteri)."); }
    catch(e){ const r=document.createRange(); r.selectNodeContents(document.getElementById("socCap"));
      const s=getSelection(); s.removeAllRanges(); s.addRange(r); dm("Copia automatica bloccata dal browser: il testo è selezionato, premi Copia."); }
  };
}
async function socialZip(g,m){
  const voci=m.voci||[]; if(!voci.length) return;
  socialMsg(`Preparo lo zip: 0/${voci.length}…`);
  try{
    const {default:JSZip}=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip=new JSZip(); let n=0;
    for(const v of voci){ zip.file(socialNomeFile(m,v),await socialBlob(socialImg(g,m,v,false))); socialMsg(`Preparo lo zip: ${++n}/${voci.length}…`); }
    const didasc=voci.map(v=>`===== ${v.codice} ${v.titolo||""} =====\n${v.didascalia||""}\n`).join("\n");
    zip.file("didascalie.txt",didasc);
    socialSalva(await zip.generateAsync({type:"blob"}),`DHN_${m.categoria}_${m.gp_nome}_R${m.round??""}_grafiche.zip`.replace(/[^\w.\-À-ÿ]+/g,"_"));
    socialMsg(`✔ Zip scaricato: ${voci.length} grafiche + didascalie.txt`,true);
  }catch(e){ socialMsg("⚠ Zip non riuscito: "+esc(e.message),false); }
}
async function socialRifai(g){
  if(!confirm(`Rifare le grafiche di ${g.categoria} · ${g.gp_nome} R${g.round??"?"} con i dati di adesso?\nCi vogliono circa 2 minuti; le grafiche attuali restano finché le nuove non sono pronte.`)) return;
  const b=document.getElementById("socRifai"); if(b) b.disabled=true;
  socialMsg("Invio la richiesta a GitHub…");
  const {data,error}=await sb.rpc("social_rendi",{p_gara:g.gara_id});
  if(error){ if(b) b.disabled=false; return socialMsg("⚠ Richiesta non partita (database): "+esc(error.message),false); }
  if(data==="manca_token"){ if(b) b.disabled=false; return socialMsg("⚠ Manca il token GitHub di dhn-social nel Vault di Supabase (github_pat_social): la richiesta NON è partita.",false); }
  if(data==="manca_repo"){ if(b) b.disabled=false; return socialMsg("⚠ Manca config.social_repo nel database: la richiesta NON è partita.",false); }
  if(data==="non_valida"){ if(b) b.disabled=false; return socialMsg("⚠ Questa sessione non risulta una gara valida: niente da rifare.",false); }
  const req=+String(data).split(":")[1];
  for(let k=0;k<8;k++){
    await new Promise(r=>setTimeout(r,1500));
    const es=await sb.rpc("social_esito",{p_richiesta:req});
    if(es.error){ socialMsg("⚠ Richiesta partita, esito non leggibile: "+esc(es.error.message),false); break; }
    const x=es.data||{};
    if(x.stato!=="risposta") continue;
    if(x.codice===204){ socialMsg("✔ GitHub ha preso la richiesta. Le grafiche nuove saranno qui fra circa 2 minuti: poi premi «Aggiorna elenco».",true); break; }
    socialMsg(`⚠ GitHub ha rifiutato (${esc(x.codice??"nessuna risposta")}): ${esc(x.errore||x.corpo||"")}. Con 401/403/404 il token è scaduto o non ha «Contents: Read and write» su dhn-social.`,false); break;
  }
  if(b) b.disabled=false;
}
