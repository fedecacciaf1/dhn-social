/* ---- FASE 3 (27/09/2026): «Pubblica ora» su Instagram / Facebook ----------
   - La pubblicazione la fa la Edge Function `social` (token Meta nei segreti
     Supabase, mai nel browser). Qui si manda SOLO: gara, nome file, versione
     delle grafiche vista, didascalia, piattaforme, e una CHIAVE per clic.
   - La chiave resta la stessa se la rete cade a metà: premere di nuovo non fa
     un secondo post (la funzione riconosce la chiave e restituisce il primo).
   - «A chi va» si legge dalla funzione (azione stato) una volta per sessione:
     la scheda dice sempre su quale Pagina / Instagram si sta pubblicando.
   - I post già fatti si leggono da post_social (poche righe, una volta per gara). */
async function socialFunzione(corpo){
  const {data,error}=await sb.functions.invoke("social",{body:corpo});
  if(error){
    let msg=error.message, ctx=null;
    try{ ctx=await error.context.json(); if(ctx&&ctx.errore) msg=ctx.errore; }catch(_){}
    const e=new Error(msg);
    // FunctionsHttpError = la funzione ha risposto (context è la Response); Fetch/Relay = non si sa se è arrivata
    e.rete=error.name==="FunctionsFetchError"||error.name==="FunctionsRelayError";
    e.http=e.rete?0:(error.context?.status??0); e.dati=ctx; throw e;
  }
  return data;
}
async function socialMeta(forza){
  if(SOCIAL.meta&&!forza) return SOCIAL.meta;
  try{ SOCIAL.meta=await socialFunzione({azione:"stato"}); }
  catch(e){ SOCIAL.meta={collegato:false,motivo:e.message}; }
  return SOCIAL.meta;
}
async function socialPost(gara,forza){
  SOCIAL.post=SOCIAL.post||{};
  if(SOCIAL.post[gara]&&!forza) return SOCIAL.post[gara];
  const {data,error}=await sb.from("post_social").select("id,creato_il,creato_da_email,immagini,piattaforme,stato,ig_permalink,fb_permalink,errore,versione_grafica").eq("gara_id",gara).order("creato_il",{ascending:false});
  SOCIAL.post[gara]=error?[]:(data||[]);
  return SOCIAL.post[gara];
}
const socialPostDi=(gara,file)=>(SOCIAL.post?.[gara]||[]).filter(p=>(p.immagini||[]).some(x=>x.file===file));
const socialQuando=iso=>new Date(iso).toLocaleString("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
function socialConta(t){
  const car=[...t].length, hash=(t.match(/(^|\s)#[^\s#]+/g)||[]).length;
  const ok=car<=2200&&hash<=30&&t.trim().length>0;
  return {ok,testo:`${car}/2200 caratteri · ${hash}/30 hashtag`};
}
function socialStoriaHtml(lista){
  if(!lista.length) return "";
  const et={pubblicato:"✔ uscita",parziale:"◐ uscita in parte",errore:"✗ non uscita",incerto:"? da verificare",in_invio:"… in invio"};
  return `<div class="soc-storia">${lista.map(p=>`<div><b>${et[p.stato]||esc(p.stato)}</b> ${socialQuando(p.creato_il)} · ${esc(p.creato_da_email||"")}
    ${p.ig_permalink?` · <a href="${esc(p.ig_permalink)}" target="_blank" rel="noopener">Instagram</a>`:""}${p.fb_permalink?` · <a href="${esc(p.fb_permalink)}" target="_blank" rel="noopener">Facebook</a>`:""}
    ${p.errore?`<div class="soc-err">${esc(p.errore)}</div>`:""}</div>`).join("")}</div>`;
}
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
      <div class="small" style="margin-top:4px">${v.didascalia_origine==="generata dai dati"?"Didascalia (scritta dai dati — puoi modificarla)":`<span style="color:var(--warn)">Didascalia da completare</span> — c'è solo titolo, GP e categoria`}</div>
      <textarea class="soc-cap" id="socCap" spellcheck="true">${esc(v.didascalia||"")}</textarea>
      <div class="soc-meta" id="socConta"></div>
      <div class="soc-btns"><button class="sec" style="flex:1" id="socDl">⬇ Scarica</button><button class="sec" style="flex:1" id="socCp">⧉ Copia didascalia</button></div>
      <div class="soc-pub">
        <div class="soc-pub-h">Pubblica ora</div>
        <div class="soc-acc" id="socAcc">Controllo il collegamento con Meta…</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 8px">
          <label class="soc-ck"><input type="checkbox" id="socIg" checked> Instagram</label>
          <label class="soc-ck"><input type="checkbox" id="socFb" checked> Facebook</label></div>
        <button id="socPub" style="width:100%" disabled>Pubblica ora</button>
        <div id="socStoria"></div>
      </div>
      <div class="small" id="socDetMsg">${i+1} di ${voci.length}</div>
    </div></div>`;
  document.body.appendChild(ov);
  const $=id=>document.getElementById(id);
  const chiudi=()=>{ ov.remove(); document.removeEventListener("keydown",tasti); };
  const vai=d=>{ document.removeEventListener("keydown",tasti); socialDettaglio(g,m,i+d); };
  const tasti=e=>{ if(e.target?.id==="socCap") return; if(e.key==="Escape")chiudi(); else if(e.key==="ArrowLeft")vai(-1); else if(e.key==="ArrowRight")vai(1); };
  document.addEventListener("keydown",tasti);
  ov.onclick=e=>{ if(e.target===ov) chiudi(); };
  $("socX").onclick=chiudi; $("socPrev").onclick=()=>vai(-1); $("socNext").onclick=()=>vai(1);
  const dm=t=>$("socDetMsg").textContent=t;
  const cap=$("socCap");
  const aggConta=()=>{ const c=socialConta(cap.value); $("socConta").innerHTML=c.ok?c.testo:`<span style="color:var(--bad,#ff5a5a)">⚠ ${c.testo}</span>`; return c.ok; };
  cap.oninput=aggConta; aggConta();
  $("socDl").onclick=async()=>{
    try{ socialSalva(await socialBlob(socialImg(g,m,v,false)),socialNomeFile(m,v)); dm("Scaricata: "+socialNomeFile(m,v)); }
    catch(e){ dm("⚠ Download non riuscito ("+e.message+"): tieni premuto sull'immagine e «Salva»."); }
  };
  $("socCp").onclick=async()=>{
    const t=cap.value;
    try{ await navigator.clipboard.writeText(t); dm("Didascalia copiata ("+[...t].length+" caratteri)."); }
    catch(e){ cap.select(); dm("Copia automatica bloccata dal browser: il testo è selezionato, premi Copia."); }
  };

  /* --- Pubblica ora --- */
  let chiave=null;             // una per tentativo; sopravvive a una rete che cade
  const storia=()=>{ if($("socStoria")) $("socStoria").innerHTML=socialStoriaHtml(socialPostDi(g.gara_id,v.file)); };
  const pronto=()=>{
    const meta=SOCIAL.meta; const b=$("socPub"); if(!b) return;
    const ig=$("socIg").checked, fb=$("socFb").checked;
    b.disabled=!(meta?.collegato&&(ig||fb)&&aggConta()&&(!ig||meta.account?.ig_id));
  };
  $("socIg").onchange=pronto; $("socFb").onchange=pronto; cap.addEventListener("input",pronto);
  socialPost(g.gara_id).then(storia);
  socialMeta().then(meta=>{
    const a=$("socAcc"); if(!a) return;
    if(!meta.collegato){ a.innerHTML=`<span style="color:var(--warn)">⚠ ${esc(meta.motivo||"Meta non collegato")}</span>`; }
    else{
      const x=meta.account;
      a.innerHTML=`Va su: <b>${x.ig_username?"@"+esc(x.ig_username):"—"}</b> (Instagram) · <b>${esc(x.pagina)}</b> (Pagina Facebook)`
        +(meta.limite?` · ${meta.limite.usati}/${meta.limite.totale} post IG nelle 24 h`:"")
        +(meta.avviso?`<div style="color:var(--warn)">⚠ ${esc(meta.avviso)}</div>`:"");
      if(!x.ig_id){ $("socIg").checked=false; $("socIg").disabled=true; }
    }
    pronto();
  });
  $("socPub").onclick=async()=>{
    const meta=SOCIAL.meta, x=meta?.account||{};
    const piattaforme=[...($("socIg").checked?["instagram"]:[]),...($("socFb").checked?["facebook"]:[])];
    const gia=socialPostDi(g.gara_id,v.file).filter(p=>["pubblicato","parziale","incerto","in_invio"].includes(p.stato));
    const dove=piattaforme.map(p=>p==="instagram"?`Instagram @${x.ig_username}`:`Facebook «${x.pagina}»`).join(" e ");
    let testo=`Pubblicare ADESSO «${v.codice} ${v.titolo||""}» su ${dove}?\n\nNon si può annullare da qui: una volta uscito, il post si toglie solo dall'app.`;
    if(m.stato!=="ufficiale") testo+=`\n\n⚠ Il risultato di questa gara è ancora PROVVISORIO.`;
    if(gia.length) testo+=`\n\n⚠ Questa grafica è GIÀ stata pubblicata ${gia.length} volta/e (l'ultima ${socialQuando(gia[0].creato_il)}). Ripubblicarla fa un post in più.`;
    if(v.didascalia_origine!=="generata dai dati"&&cap.value.trim()===String(v.didascalia||"").trim()) testo+=`\n\n⚠ La didascalia è quella minima (solo titolo): non l'hai completata.`;
    if(!confirm(testo)) return;
    const b=$("socPub"); b.disabled=true; b.textContent="Pubblico… (fino a 30 s)";
    chiave=chiave||crypto.randomUUID();
    try{
      const r=await socialFunzione({azione:"pubblica",chiave,gara_id:g.gara_id,file:v.file,versione:m.generato,didascalia:cap.value,piattaforme});
      chiave=null;
      const p=r.post||{};
      const link=[p.ig_permalink?`<a href="${esc(p.ig_permalink)}" target="_blank" rel="noopener">apri su Instagram</a>`:"",p.fb_permalink?`<a href="${esc(p.fb_permalink)}" target="_blank" rel="noopener">apri su Facebook</a>`:""].filter(Boolean).join(" · ");
      if(r.ripetuta) dm("Questa richiesta era già partita: nessun post in più.");
      $("socDetMsg").innerHTML=p.stato==="pubblicato"?`✔ Pubblicata. ${link}`
        :p.stato==="parziale"?`◐ Uscita solo in parte. ${link}<br>${esc(p.errore||"")}`
        :p.stato==="incerto"?`? Meta non ha risposto in tempo: controlla sull'app prima di riprovare. ${esc(p.errore||"")}`
        :p.stato==="in_invio"?`… Già in invio da un altro clic: aspetta qualche secondo.`
        :`✗ Non pubblicata: ${esc(p.errore||"errore sconosciuto")}`;
    }catch(e){
      if(e.rete) $("socDetMsg").textContent="⚠ Rete interrotta: non so se è uscita. Premi di nuovo «Pubblica ora»: la richiesta è la stessa, non farà un secondo post.";
      else { chiave=null; $("socDetMsg").textContent="✗ Non pubblicata: "+e.message; if(e.http===409) dm("✗ "+e.message); }
      if(e.http===503) socialMeta(true);
    }
    b.textContent="Pubblica ora";
    await socialPost(g.gara_id,true); storia(); socialSegnaUscite(g); pronto();
  };
}
/* sulle miniature: bollino «✔ uscita» per le grafiche già pubblicate */
function socialSegnaUscite(g){
  document.querySelectorAll("#socGara .soc-th").forEach(t=>{
    const m=SOCIAL.man[g.gara_id]; const v=m?.voci?.[+t.dataset.i]; if(!v) return;
    t.querySelector(".uscita")?.remove();
    if(socialPostDi(g.gara_id,v.file).some(p=>p.stato==="pubblicato"||p.stato==="parziale"))
      t.insertAdjacentHTML("beforeend",`<span class="uscita" title="Già pubblicata">✔ uscita</span>`);
  });
}
