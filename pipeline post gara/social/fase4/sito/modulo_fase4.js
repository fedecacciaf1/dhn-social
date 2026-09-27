/* ---- FASE 4 (27/09/2026): Programma, carosello, Coda ------------------------
   - «Programma» scrive una riga in_attesa (Edge Function social, azione
     pubblica + quando). La sveglia la mette il DATABASE (pg_cron, una per
     post): qui non gira niente in attesa, il browser si può chiudere.
   - Carosello: fino a 10 grafiche della stessa gara, nell'ordine scelto.
   - Coda: da qui a lunedì, per giorno (Lista) o a colonne (Settimana).
     Sposta/Annulla = rpc social_sposta / social_annulla (solo il proprio post,
     il superadmin tutti). Riconferma = post fermo perché le grafiche sono
     cambiate: si guardano quelle NUOVE e si rimette in coda.
   - Le ore si scrivono e si leggono sempre in ora di ROMA, qualunque sia il
     fuso del telefono di chi programma. */
const SOC_TZ="Europe/Rome";
function socialRomaParti(ms){
  const p={}; new Intl.DateTimeFormat("en-GB",{timeZone:SOC_TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",weekday:"short"})
    .formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value);
  return {y:+p.year,m:+p.month,d:+p.day,h:+p.hour,mi:+p.minute,s:+p.second,wd:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday)};
}
function socialRomaMs(y,m,d,h,mi){             // ora di Roma → istante vero (anche a cavallo dell'ora legale)
  const g=Date.UTC(y,m-1,d,h,mi);
  const off=ms=>{ const p=socialRomaParti(ms); return Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)-ms; };
  let t=g-off(g); t=g-off(t); return t;
}
const socialPad=n=>String(n).padStart(2,"0");
const socialGiornoInput=ms=>{ const p=socialRomaParti(ms); return `${p.y}-${socialPad(p.m)}-${socialPad(p.d)}`; };
const socialOraInput=ms=>{ const p=socialRomaParti(ms); return `${socialPad(p.h)}:${socialPad(p.mi)}`; };
const socialOra=iso=>new Date(iso).toLocaleTimeString("it-IT",{timeZone:SOC_TZ,hour:"2-digit",minute:"2-digit"});
const socialGiorno=iso=>new Date(iso).toLocaleDateString("it-IT",{timeZone:SOC_TZ,weekday:"long",day:"2-digit",month:"2-digit"});
const socialChiaveGiorno=iso=>socialGiornoInput(Date.parse(iso));
function socialFineLunedi(){
  const p=socialRomaParti(Date.now()); const gg=((1-p.wd+7)%7)||7;
  const x=new Date(Date.UTC(p.y,p.m-1,p.d+gg)); return socialRomaMs(x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate(),23,59)+59e3;
}
function socialLeggiQuando(dataId,oraId){
  const dv=document.getElementById(dataId)?.value, ov=document.getElementById(oraId)?.value;
  if(!dv||!ov) return {errore:"scegli giorno e ora"};
  const [y,m,d]=dv.split("-").map(Number), [h,mi]=ov.split(":").map(Number);
  const ms=socialRomaMs(y,m,d,h,mi);
  if(!Number.isFinite(ms)) return {errore:"giorno o ora non validi"};
  if(ms<Date.now()+2*60e3) return {errore:"l'ora deve essere almeno fra 2 minuti"};
  if(ms>Date.now()+60*86400e3) return {errore:"si programma al massimo a 60 giorni"};
  return {iso:new Date(ms).toISOString(),ms};
}
/* il blocco «Quando»: Adesso / Programma + scorciatoie. pref = prefisso degli id */
function socialQuandoHtml(pref){
  const base=Date.now()+60*60e3, tondo=Math.ceil(base/(15*60e3))*15*60e3;
  return `<div class="soc-quando">
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      <label class="soc-ck"><input type="radio" name="${pref}Q" value="ora" id="${pref}Ora" checked> Adesso</label>
      <label class="soc-ck"><input type="radio" name="${pref}Q" value="prog" id="${pref}Prog"> Programma</label></div>
    <div class="soc-qbox" id="${pref}Box" hidden>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="date" id="${pref}D" value="${socialGiornoInput(tondo)}" min="${socialGiornoInput(Date.now())}">
        <input type="time" id="${pref}H" value="${socialOraInput(tondo)}" step="60"></div>
      <div class="soc-scorc">${[["+1 ora",null],["Stasera 21:00",[0,21]],["Domani 13:00",[1,13]],["Domani 19:00",[1,19]]].map(([t,v],k)=>`<button type="button" class="soc-chip" data-sc="${k}" data-v="${v?v.join(","):""}">${t}</button>`).join("")}</div>
      <div class="soc-meta" id="${pref}Info">Ora di Roma. Esce da sola anche a pannello chiuso.</div></div></div>`;
}
function socialQuandoWire(pref,cambia){
  const $=id=>document.getElementById(id);
  const agg=()=>{ const prog=$(pref+"Prog").checked; $(pref+"Box").hidden=!prog;
    if(prog){ const q=socialLeggiQuando(pref+"D",pref+"H"); $(pref+"Info").innerHTML=q.errore?`<span style="color:var(--warn)">⚠ ${esc(q.errore)}</span>`:`Esce <b>${esc(socialGiorno(q.iso))} alle ${esc(socialOra(q.iso))}</b> (ora di Roma). Esce da sola anche a pannello chiuso.`; }
    cambia&&cambia(); };
  [pref+"Ora",pref+"Prog",pref+"D",pref+"H"].forEach(id=>{ $(id).onchange=agg; $(id).oninput=agg; });
  document.querySelectorAll(`#${pref}Box [data-sc]`).forEach(b=>b.onclick=()=>{
    let ms; if(!b.dataset.v){ ms=Math.ceil((Date.now()+60*60e3)/(5*60e3))*5*60e3; }
    else { const [dd,hh]=b.dataset.v.split(",").map(Number); const p=socialRomaParti(Date.now()); const x=new Date(Date.UTC(p.y,p.m-1,p.d+dd)); ms=socialRomaMs(x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate(),hh,0); }
    $(pref+"D").value=socialGiornoInput(ms); $(pref+"H").value=socialOraInput(ms); agg(); });
  agg();
  return ()=>$(pref+"Prog").checked?socialLeggiQuando(pref+"D",pref+"H"):{ora:true};
}
function socialEsitoHtml(r,q){
  const p=r.post||{};
  const link=[p.ig_permalink?`<a href="${esc(p.ig_permalink)}" target="_blank" rel="noopener">apri su Instagram</a>`:"",p.fb_permalink?`<a href="${esc(p.fb_permalink)}" target="_blank" rel="noopener">apri su Facebook</a>`:""].filter(Boolean).join(" · ");
  if(r.ripetuta&&p.stato==="in_attesa") return `Questa richiesta era già partita: è in coda per ${esc(socialGiorno(p.programmato_per))} ${esc(socialOra(p.programmato_per))}, nessun doppione.`;
  if(r.programmato) return `🗓 Programmata: esce <b>${esc(socialGiorno(p.programmato_per))} alle ${esc(socialOra(p.programmato_per))}</b>. La trovi in «Coda», dove si sposta o si annulla.`;
  return (r.ripetuta?"Questa richiesta era già partita: nessun post in più. ":"")+(p.stato==="pubblicato"?`✔ Pubblicata. ${link}`
    :p.stato==="parziale"?`◐ Uscita solo in parte. ${link}<br>${esc(p.errore||"")}`
    :p.stato==="incerto"?`? Meta non ha risposto in tempo: controlla sull'app prima di riprovare. ${esc(p.errore||"")}`
    :p.stato==="in_invio"?`… Già in invio da un altro clic: aspetta qualche secondo.`
    :`✗ Non pubblicata: ${esc(p.errore||"errore sconosciuto")}`);
}
function socialTestoConferma(q,dove,cosa,m,gia,minima,n=1){
  let t=q.ora?`Pubblicare ADESSO ${cosa} su ${dove}?\n\nNon si può annullare da qui: una volta uscito, il post si toglie solo dall'app.`
             :`Programmare ${cosa} su ${dove}\nper ${socialGiorno(q.iso)} alle ${socialOra(q.iso)} (ora di Roma)?\n\nFino a quell'ora si sposta o si annulla da «Coda».`;
  if(m.stato!=="ufficiale") t+=`\n\n⚠ Il risultato di questa gara è ancora PROVVISORIO.${q.ora?"":" Se le grafiche cambiano prima dell'uscita, il post si ferma e arriva un avviso."}`;
  if(gia.length) t+=`\n\n⚠ ${n>1?"Alcune di queste grafiche sono GIÀ uscite o già in coda":"Questa grafica è GIÀ uscita o già in coda"} (${gia.length} post). Così fai un post in più.`;
  if(minima) t+=`\n\n⚠ La didascalia è quella minima (solo titolo): non l'hai completata.`;
  return t;
}

/* ---- carosello: scelta nella griglia ---- */
function socialSceltaAgg(g){
  const sc=SOCIAL.scelta; const bar=document.getElementById("socBar");
  document.querySelectorAll("#socGara .soc-th").forEach(t=>{
    t.querySelector(".ord")?.remove(); t.classList.toggle("sel",false);
    if(!sc) return;
    const v=SOCIAL.man[g.gara_id]?.voci?.[+t.dataset.i]; const k=v?sc.indexOf(v.file):-1;
    if(k>=0){ t.classList.add("sel"); t.insertAdjacentHTML("beforeend",`<span class="ord">${k+1}</span>`); }
  });
  if(!bar) return;
  if(!sc){ bar.hidden=true; return; }
  bar.hidden=false;
  bar.innerHTML=`<span><b>${sc.length}</b>/10 scelte${sc.length?" · nell'ordine in cui le tocchi":""}</span>
    <button id="socBarVai" ${sc.length?"":"disabled"}>${sc.length>1?"Prepara carosello":"Prepara post"} →</button>
    <button class="ghost" id="socBarEsci">Annulla scelta</button>`;
  document.getElementById("socBarEsci").onclick=()=>{ SOCIAL.scelta=null; socialSceltaAgg(g); const b=document.getElementById("socCar"); if(b) b.textContent="☐ Scegli più grafiche"; };
  document.getElementById("socBarVai").onclick=()=>socialComponi(g,SOCIAL.man[g.gara_id],[...sc]);
}
function socialComponi(g,m,files){
  const voci=files.map(f=>(m.voci||[]).find(v=>v.file===f)).filter(Boolean);
  if(!voci.length) return;
  document.getElementById("socOv")?.remove();
  const ov=document.createElement("div"); ov.className="soc-ov"; ov.id="socOv";
  const cap0=voci[0].didascalia||"";
  ov.innerHTML=`<div class="soc-det soc-comp">
    <div class="side" style="gap:12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="soc-cat ${socialCatK(m.categoria)}">${esc(m.categoria)}</span>
        <span class="soc-gt">${esc(m.gp_nome)} · R${m.round??"?"}</span>${socialBollo(m.stato)}<button class="soc-x" id="socX" title="Chiudi (Esc)">✕</button></div>
      <div style="font-family:var(--fd);font-weight:800;font-style:italic;font-size:22px">${voci.length>1?`Carosello di ${voci.length}`:"Un post"}</div>
      <div class="soc-strip" id="socStrip"></div>
      <div class="small">Didascalia (parte da quella della prima grafica — modificala)</div>
      <textarea class="soc-cap" id="socCap" spellcheck="true" style="min-height:150px">${esc(cap0)}</textarea>
      <div class="soc-meta" id="socConta"></div>
      <div class="soc-pub">
        <div class="soc-pub-h">Pubblica</div>
        <div class="soc-acc" id="socAcc">Controllo il collegamento con Meta…</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 8px">
          <label class="soc-ck"><input type="checkbox" id="socIg" checked> Instagram</label>
          <label class="soc-ck"><input type="checkbox" id="socFb" checked> Facebook</label></div>
        ${socialQuandoHtml("socK")}
        <button id="socPub" style="width:100%;margin-top:10px" disabled>Pubblica ora</button>
      </div>
      <div class="small" id="socDetMsg"></div>
    </div></div>`;
  document.body.appendChild(ov);
  const $=id=>document.getElementById(id);
  const disegna=()=>{
    $("socStrip").innerHTML=voci.map((v,k)=>`<div class="soc-sv"><img src="${socialImg(g,m,v,true)}" alt=""><span class="ord">${k+1}</span>
      <div class="soc-svb"><button data-mv="${k},-1" ${k?"":"disabled"} title="Prima">‹</button><button data-rm="${k}" title="Togli">✕</button><button data-mv="${k},1" ${k<voci.length-1?"":"disabled"} title="Dopo">›</button></div>
      <div class="lb"><b>${esc(v.codice)}</b>${esc(v.titolo||"")}</div></div>`).join("");
    $("socStrip").querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{ const [k,d]=b.dataset.mv.split(",").map(Number); [voci[k],voci[k+d]]=[voci[k+d],voci[k]]; disegna(); });
    $("socStrip").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ voci.splice(+b.dataset.rm,1); if(!voci.length) return chiudi(); disegna(); pronto(); });
  };
  const chiudi=()=>{ ov.remove(); document.removeEventListener("keydown",tasti); };
  const tasti=e=>{ if(e.key==="Escape"&&e.target?.tagName!=="TEXTAREA") chiudi(); };
  document.addEventListener("keydown",tasti); ov.onclick=e=>{ if(e.target===ov) chiudi(); }; $("socX").onclick=chiudi;
  const cap=$("socCap");
  const aggConta=()=>{ const c=socialConta(cap.value); $("socConta").innerHTML=c.ok?c.testo:`<span style="color:var(--bad,#ff5a5a)">⚠ ${c.testo}</span>`; return c.ok; };
  let chiave=null, quando=null;
  const pronto=()=>{ const meta=SOCIAL.meta, b=$("socPub"); if(!b) return; const ig=$("socIg").checked, fb=$("socFb").checked;
    const q=quando?quando():{ora:true};
    b.textContent=q.ora?"Pubblica ora":"Programma"; chiave=null;
    b.disabled=!(meta?.collegato&&(ig||fb)&&aggConta()&&(!ig||meta.account?.ig_id)&&!q.errore&&voci.length); };
  cap.oninput=pronto; $("socIg").onchange=pronto; $("socFb").onchange=pronto;
  quando=socialQuandoWire("socK",pronto); disegna(); aggConta();
  socialMeta().then(meta=>{ const a=$("socAcc"); if(!a) return;
    if(!meta.collegato) a.innerHTML=`<span style="color:var(--warn)">⚠ ${esc(meta.motivo||"Meta non collegato")}</span>`;
    else { const x=meta.account; a.innerHTML=`Va su: <b>${x.ig_username?"@"+esc(x.ig_username):"—"}</b> (Instagram) · <b>${esc(x.pagina)}</b> (Pagina Facebook)`; if(!x.ig_id){ $("socIg").checked=false; $("socIg").disabled=true; } }
    pronto(); });
  $("socPub").onclick=async()=>{
    const q=quando(); if(q.errore) return;
    const x=SOCIAL.meta?.account||{};
    const piattaforme=[...($("socIg").checked?["instagram"]:[]),...($("socFb").checked?["facebook"]:[])];
    const dove=piattaforme.map(p=>p==="instagram"?`Instagram @${x.ig_username}`:`Facebook «${x.pagina}»`).join(" e ");
    const gia=voci.flatMap(v=>socialPostDi(g.gara_id,v.file).filter(p=>["pubblicato","parziale","incerto","in_invio","in_attesa"].includes(p.stato)));
    if(!confirm(socialTestoConferma(q,dove,voci.length>1?`un CAROSELLO di ${voci.length} grafiche (${voci.map(v=>v.codice).join(", ")})`:`«${voci[0].codice} ${voci[0].titolo||""}»`,m,gia,false,voci.length))) return;
    const b=$("socPub"); b.disabled=true; b.textContent=q.ora?"Pubblico… (fino a un minuto)":"Programmo…";
    chiave=chiave||crypto.randomUUID();
    try{
      const r=await socialFunzione({azione:"pubblica",chiave,gara_id:g.gara_id,files:voci.map(v=>v.file),versione:m.generato,didascalia:cap.value,piattaforme,...(q.ora?{}:{quando:q.iso})});
      chiave=null; $("socDetMsg").innerHTML=socialEsitoHtml(r,q);
      if(r.post&&(r.programmato||r.post.stato==="pubblicato")){ SOCIAL.scelta=null; socialSceltaAgg(g); const c=$("socCar"); if(c) c.textContent="☐ Scegli più grafiche"; }
    }catch(e){
      if(e.rete) $("socDetMsg").textContent="⚠ Rete interrotta: non so se è partita. Premi di nuovo: la richiesta è la stessa, non farà un doppione.";
      else { chiave=null; $("socDetMsg").textContent="✗ "+e.message; }
      if(e.http===503) socialMeta(true);
    }
    b.textContent=q.ora?"Pubblica ora":"Programma"; b.disabled=false;
    await socialPost(g.gara_id,true); socialSegnaUscite(g);
  };
}

/* ---- la Coda ---- */
const SOC_ET={in_attesa:"🗓 in coda",in_invio:"… in invio",pubblicato:"✔ uscita",parziale:"◐ in parte",errore:"✗ non uscita",incerto:"? da verificare",annullato:"annullata",da_ricontrollare:"⚠ ferma"};
const socialPuo=p=>me&&(me.ruolo==="superadmin"||p.creato_da===me.user_id);
const socialChi=e=>esc(String(e||"?").split("@")[0]);
function socialGaraDi(id){ return (SOCIAL.indice?.gare||[]).find(x=>x.gara_id===id); }
function socialMin(p,f,ver){ return `${SOCIAL_BASE}/gare/${p.gara_id}/min/${encodeURIComponent(f)}?v=${encodeURIComponent(ver||p.versione_grafica||"")}`; }
async function socialCoda(){
  const box=document.getElementById("socCoda"); if(!box) return;
  box.innerHTML=`<div class="muted">Leggo la coda…</div>`;
  const da7=new Date(Date.now()-7*86400e3).toISOString();
  const {data,error}=await sb.from("post_social")
    .select("id,creato_il,aggiornato_il,creato_da,creato_da_email,gara_id,immagini,piattaforme,stato,programmato_per,prossimo_tentativo,uscito_il,ig_permalink,fb_permalink,errore,nota,prova,tentativi,versione_grafica,annullato_da_email,spostato_da_email")
    .or(`stato.in.(in_attesa,in_invio,da_ricontrollare),aggiornato_il.gte.${da7}`)
    .order("id",{ascending:false}).limit(300);
  if(error){ box.innerHTML=`<div class="msg e">⚠ Coda non letta: ${esc(error.message)}</div>`; return; }
  SOCIAL.coda=data||[]; socialCodaDisegna();
}
function socialCodaDisegna(){
  const box=document.getElementById("socCoda"); if(!box) return;
  const tutti=SOCIAL.coda||[], ora=Date.now(), fine=socialFineLunedi();
  const quando=p=>Date.parse(p.prossimo_tentativo||p.programmato_per||p.creato_il);
  const guardare=tutti.filter(p=>["da_ricontrollare","errore","incerto","parziale"].includes(p.stato)).sort((a,b)=>Date.parse(b.aggiornato_il)-Date.parse(a.aggiornato_il));
  const coda=tutti.filter(p=>p.stato==="in_attesa"||p.stato==="in_invio").sort((a,b)=>quando(a)-quando(b));
  const entro=coda.filter(p=>quando(p)<=fine), dopo=coda.filter(p=>quando(p)>fine);
  const uscite=tutti.filter(p=>p.stato==="pubblicato"&&Date.parse(p.uscito_il||p.aggiornato_il)>=ora-48*3600e3).sort((a,b)=>Date.parse(b.uscito_il||b.aggiornato_il)-Date.parse(a.uscito_il||a.aggiornato_il));
  const annullati=tutti.filter(p=>p.stato==="annullato"&&Date.parse(p.aggiornato_il)>=ora-48*3600e3);
  const modo=SOCIAL.codaModo||"lista";
  let corpo;
  if(modo==="settimana"){
    const giorni=[...Array(7)].map((_,k)=>socialGiornoInput(ora+k*86400e3));
    corpo=`<div class="soc-week">${giorni.map(gk=>{ const lista=coda.filter(p=>socialChiaveGiorno(new Date(quando(p)).toISOString())===gk);
      const t=Date.parse(gk+"T12:00:00Z");
      return `<div class="soc-wcol"><div class="soc-wh">${esc(new Date(t).toLocaleDateString("it-IT",{timeZone:"UTC",weekday:"short",day:"2-digit",month:"2-digit"}))}</div>
        ${lista.length?lista.map(p=>socialCard(p,true)).join(""):`<div class="soc-wvuoto">—</div>`}</div>`; }).join("")}</div>
      ${coda.filter(p=>quando(p)>ora+7*86400e3).length?`<div class="soc-sez">Oltre i 7 giorni</div>${coda.filter(p=>quando(p)>ora+7*86400e3).map(p=>socialCard(p)).join("")}`:""}`;
  } else {
    const perGiorno=l=>{ const gr={}; l.forEach(p=>{ const k=socialChiaveGiorno(new Date(quando(p)).toISOString()); (gr[k]=gr[k]||[]).push(p); });
      return Object.keys(gr).sort().map(k=>`<div class="soc-dh">${esc(socialGiorno(new Date(quando(gr[k][0])).toISOString()))}</div>${gr[k].map(p=>socialCard(p)).join("")}`).join(""); };
    corpo=`<div class="soc-sez">Da qui a lunedì ${esc(new Date(fine-60e3).toLocaleDateString("it-IT",{timeZone:SOC_TZ,day:"2-digit",month:"2-digit"}))} · ${entro.length} ${entro.length===1?"post":"post"}</div>
      ${entro.length?perGiorno(entro):`<div class="muted" style="margin:6px 0 14px">Niente in programma. Si programma dalla scheda di una grafica («Programma») o scegliendone più d'una (carosello).</div>`}
      ${dopo.length?`<div class="soc-sez">Più avanti</div>${perGiorno(dopo)}`:""}`;
  }
  box.innerHTML=`${guardare.length?`<div class="soc-sez warn">⚠ Da guardare (${guardare.length})</div>${guardare.map(p=>socialCard(p)).join("")}`:""}
    ${corpo}
    ${uscite.length?`<div class="soc-sez">Uscite nelle ultime 48 ore</div>${uscite.map(p=>socialCard(p)).join("")}`:""}
    ${annullati.length?`<details class="soc-ann"><summary>Annullate nelle ultime 48 ore (${annullati.length})</summary>${annullati.map(p=>socialCard(p)).join("")}</details>`:""}`;
  box.querySelectorAll("[data-azione]").forEach(b=>b.onclick=()=>socialAzione(b.dataset.azione,+b.dataset.id,b));
}
function socialCard(p,stretta){
  const gi=socialGaraDi(p.gara_id); const q=p.prossimo_tentativo||p.programmato_per;
  const imm=p.immagini||[]; const vis=imm.slice(0,stretta?3:5);
  const ora=q&&["in_attesa","in_invio"].includes(p.stato)?socialOra(q):p.uscito_il?socialOra(p.uscito_il):"";
  const puo=socialPuo(p);
  const bott=[];
  if(puo&&p.stato==="in_attesa") bott.push(`<button class="sec" data-azione="sposta" data-id="${p.id}">Sposta</button>`,`<button class="ghost" data-azione="annulla" data-id="${p.id}">Annulla</button>`);
  if(puo&&["da_ricontrollare","errore"].includes(p.stato)) bott.push(`<button data-azione="riconferma" data-id="${p.id}">Riconferma…</button>`,`<button class="ghost" data-azione="annulla" data-id="${p.id}">Annulla</button>`);
  const link=[p.ig_permalink?`<a href="${esc(p.ig_permalink)}" target="_blank" rel="noopener">Instagram</a>`:"",p.fb_permalink?`<a href="${esc(p.fb_permalink)}" target="_blank" rel="noopener">Facebook</a>`:""].filter(Boolean).join(" · ");
  return `<div class="soc-card ${stretta?"stretta":""} st-${esc(p.stato)}" id="socCard${p.id}">
    <div class="soc-cora">${esc(ora)}</div>
    <div class="soc-cimg">${vis.map(x=>`<img loading="lazy" src="${socialMin(p,x.file)}" alt="">`).join("")}${imm.length>vis.length?`<span class="piu">+${imm.length-vis.length}</span>`:""}</div>
    <div class="soc-cinfo">
      <div class="soc-crow"><span class="soc-st">${esc(SOC_ET[p.stato]||p.stato)}</span>${p.prova?`<span class="soc-prova">PROVA</span>`:""}${imm.length>1?`<span class="soc-meta">carosello ${imm.length}</span>`:""}</div>
      <div class="soc-ct">${gi?`${esc(gi.categoria)} · ${esc(gi.gp_nome)} R${gi.round??"?"}`:`gara ${p.gara_id}`} — ${esc(imm.map(x=>x.codice||x.file).join(", "))}</div>
      <div class="soc-meta">${(p.piattaforme||[]).map(x=>x==="instagram"?"IG":"FB").join(" + ")} · messo da ${socialChi(p.creato_da_email)}${p.spostato_da_email?` · spostato da ${socialChi(p.spostato_da_email)}`:""}${p.annullato_da_email?` · annullato da ${socialChi(p.annullato_da_email)}`:""}${link?` · ${link}`:""}</div>
      ${p.errore?`<div class="soc-err">${esc(p.errore)}</div>`:""}${p.nota&&(p.prova||/rifatte|riconfermato/.test(p.nota))?`<div class="soc-meta">${esc(p.nota)}</div>`:""}
      ${bott.length?`<div class="soc-cbtn">${bott.join("")}</div>`:""}<div class="soc-cedit" id="socEd${p.id}"></div>
    </div></div>`;
}
async function socialAzione(az,id,btn){
  const p=(SOCIAL.coda||[]).find(x=>x.id===id); if(!p) return;
  const ed=document.getElementById("socEd"+id); const msg=t=>{ if(ed) ed.innerHTML=t; };
  if(az==="annulla"){
    if(!confirm(`Annullare il post n. ${id} (${(p.immagini||[]).map(x=>x.codice).join(", ")})?\nNon uscirà.`)) return;
    btn.disabled=true;
    const {error}=await sb.rpc("social_annulla",{p_id:id});
    if(error){ btn.disabled=false; return msg(`<span class="soc-err">✗ ${esc(error.message)}</span>`); }
    return socialCoda();
  }
  if(az==="sposta"){
    const q=Date.parse(p.programmato_per);
    ed.innerHTML=`<div class="soc-qbox">${""}<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="date" id="socSD${id}" value="${socialGiornoInput(q)}" min="${socialGiornoInput(Date.now())}"><input type="time" id="socSH${id}" value="${socialOraInput(q)}" step="60">
      <button id="socSOk${id}">Salva</button><button class="ghost" id="socSNo${id}">Lascia</button></div><div class="soc-meta" id="socSI${id}">Ora di Roma.</div></div>`;
    document.getElementById("socSNo"+id).onclick=()=>{ ed.innerHTML=""; };
    document.getElementById("socSOk"+id).onclick=async()=>{
      const x=socialLeggiQuando("socSD"+id,"socSH"+id); if(x.errore) return document.getElementById("socSI"+id).innerHTML=`<span class="soc-err">⚠ ${esc(x.errore)}</span>`;
      const {error}=await sb.rpc("social_sposta",{p_id:id,p_quando:x.iso});
      if(error) return document.getElementById("socSI"+id).innerHTML=`<span class="soc-err">✗ ${esc(error.message)}</span>`;
      socialCoda();
    };
    return;
  }
  if(az==="riconferma"){
    msg(`<div class="muted">Carico le grafiche di adesso…</div>`);
    let m; try{ m=await socialJson(`gare/${p.gara_id}/manifesto.json`); }catch(e){ return msg(`<span class="soc-err">✗ Manifesto non caricato: ${esc(e.message)}</span>`); }
    const mancano=(p.immagini||[]).filter(x=>!(m.voci||[]).some(v=>v.file===x.file));
    if(mancano.length) return msg(`<span class="soc-err">✗ Nelle grafiche di adesso non ci sono più: ${esc(mancano.map(x=>x.file).join(", "))}. Annulla questo post e rifallo dalla galleria.</span>`);
    const pref="socR"+id;
    ed.innerHTML=`<div class="soc-qbox"><div class="small">Le grafiche <b>di adesso</b> (del ${esc(socialQuando(m.generato))}${m.stato==="ufficiale"?", ufficiali":", provvisorie"}): guardale prima di riconfermare.</div>
      <div class="soc-cimg" style="margin:6px 0">${(p.immagini||[]).map(x=>`<a href="${SOCIAL_BASE}/gare/${p.gara_id}/${encodeURIComponent(x.file)}?v=${encodeURIComponent(m.generato)}" target="_blank" rel="noopener"><img src="${socialMin(p,x.file,m.generato)}" alt=""></a>`).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="date" id="${pref}D" value="${socialGiornoInput(Math.max(Date.now()+30*60e3,Date.parse(p.programmato_per||0)))}"><input type="time" id="${pref}H" value="${socialOraInput(Math.ceil((Date.now()+30*60e3)/(5*60e3))*5*60e3)}" step="60">
        <button id="${pref}Ok">Rimetti in coda</button><button class="ghost" id="${pref}No">Lascia</button></div><div class="soc-meta" id="${pref}I">Ora di Roma.</div></div>`;
    document.getElementById(pref+"No").onclick=()=>{ ed.innerHTML=""; };
    document.getElementById(pref+"Ok").onclick=async()=>{
      const x=socialLeggiQuando(pref+"D",pref+"H"); if(x.errore) return document.getElementById(pref+"I").innerHTML=`<span class="soc-err">⚠ ${esc(x.errore)}</span>`;
      try{ await socialFunzione({azione:"riconferma",id,versione:m.generato,quando:x.iso}); socialCoda(); }
      catch(e){ document.getElementById(pref+"I").innerHTML=`<span class="soc-err">✗ ${esc(e.message)}</span>`; }
    };
  }
}
