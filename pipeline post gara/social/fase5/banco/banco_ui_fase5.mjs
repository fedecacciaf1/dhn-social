/* Banco UI FASE 5 — admin.html VERO + CSP VERA, Supabase e funzione `social` FINTI.
   Prova: hashtag e firma (config + rpc social_impostazioni), storie (formato),
   «Proponi il piano», e che aprire la scheda legga config UNA volta.
   ADMIN=… HEADERS=… node banco_ui_fase5.mjs  → prove + schermate in ./shot5/ */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const ADMIN = readFileSync(process.env.HEADERS || "/mnt/user-data/uploads/RJDHN/sito/_headers", "utf8");
const CSP = ADMIN.split("\n").find((l) => l.includes("Content-Security-Policy")).split("Content-Security-Policy:")[1].trim();
const HTML = readFileSync(process.env.ADMIN || "/mnt/user-data/uploads/RJDHN/sito/admin.html");
const BIG = readFileSync("big.jpg"), MIN = readFileSync("min.jpg");
mkdirSync("shot5", { recursive: true });

const GEN = "2026-09-27T10:49:35.997Z";
const voce = (codice, file, titolo, orig = "generata dai dati", storia = true) => ({ codice, file, titolo, larghezza: 1080, altezza: 1350,
  didascalia: `${titolo} — GP Belgio · Round 2\nROOKIE\n\n#DHN #simracing`, didascalia_origine: orig,
  instagram: { ok: true, problemi: [] }, facebook: { ok: true, problemi: [] },
  ...(storia ? { storia: { file: `storie/${file}`, miniatura: `storie/min/${file}`, larghezza: 1080, altezza: 1920 } } : {}) });
/* la gara «fra qualche giorno»: tutte le uscite del piano cadono nel futuro */
const DATA_GARA = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10) + "T19:45:00Z";
const MAN = { generato: GEN, gara_id: 210, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, stato: "ufficiale", saltate: [], data_gara: DATA_GARA,
  voci: [voce("01", "01-race-result.jpg", "RACE RESULT"), voce("02", "02-winner.jpg", "WINNER"), voce("03", "03-driver-standings.jpg", "DRIVER STANDINGS"), voce("04", "04-team-standings.jpg", "TEAM STANDINGS", "solo titolo (da completare)"), voce("05", "05-pole.jpg", "POLE", "generata dai dati", false), voce("13", "13-giro-veloce.jpg", "GIRO VELOCE")] };
const IND = { gare: [{ gara_id: 210, cartella: "gare/210/", stato: "ufficiale", stagione_id: 2, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, data_gara: DATA_GARA, immagini: 6 }] };

/* il finto supabase-js: stessa forma di quello vero per ciò che admin.html usa */
const FAKE_SB = `
const store=window.__store={post:JSON.parse(JSON.stringify(globalThis.__POST||[])),chiamate:[],invoke:[],rpc:[],scen:{},
  cfg:[{chiave:"social_hashtag",valore:"#DHNChampionship #F125 #simracing"},{chiave:"social_firma",valore:"DHN Championship · Stagione 2"},{chiave:"social_piano",valore:globalThis.__PIANO??null}]};
class FunctionsHttpError extends Error{constructor(r){super("Edge Function returned a non-2xx status code");this.name="FunctionsHttpError";this.context=r;}}
class FunctionsFetchError extends Error{constructor(){super("Failed to send a request to the Edge Function");this.name="FunctionsFetchError";this.context=new TypeError("Failed to fetch");}}
function q(table){
  const st={table,filtri:[]};
  const res=()=>{
    store.chiamate.push(table+(st.dentro?":"+st.dentro.join(","):""));
    if(table==="admin_users") return {data:{user_id:"u1",email:"fede@dhn.it",ruolo:globalThis.__RUOLO||"superadmin",attivo:true},error:null};
    if(table==="stagione") return {data:[{id:2,nome:"Stagione 2",attiva:true,archiviata:false}],error:null};
    if(table==="config") return globalThis.__CFG_ERR?{data:null,error:{message:"permesso negato (finto)"}}:{data:store.cfg,error:null};
    if(table==="post_social") return {data:store.post.filter(p=>st.filtri.every(([k,v])=>p[k]===v)),error:null};
    return {data:[],error:null,count:0};
  };
  const o={select(){return o},eq(k,v){st.filtri.push([k,v]);return o},order(){return o},in(k,v){st.dentro=v;return o},neq(){return o},is(){return o},limit(){return o},gte(){return o},lte(){return o},not(){return o},or(){return o},
    maybeSingle(){const r=res();return Promise.resolve({data:Array.isArray(r.data)?r.data[0]??null:r.data,error:null})},
    single(){return o.maybeSingle()}, then(a,b){return Promise.resolve(res()).then(a,b)}};
  return o;
}
export function createClient(){
  return {
    auth:{getSession:async()=>({data:{session:{user:{id:"u1"},access_token:"x"}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({})},
    from:q, rpc:async(nome,arg)=>{ store.rpc.push({nome,arg});
      if(nome==="social_impostazioni"){ const h=String(arg.p_hashtag).trim().replace(/\s+/g," "); if(h.split(" ").some(t=>!/^#/.test(t))) return {data:null,error:{message:"hashtag non valido"}};
        store.cfg.find(x=>x.chiave==="social_hashtag").valore=h; store.cfg.find(x=>x.chiave==="social_firma").valore=String(arg.p_firma).trim(); return {data:{hashtag:h,firma:String(arg.p_firma).trim(),hashtag_n:h.split(" ").length},error:null}; } const p=store.post.find(x=>x.id===arg?.p_id); if(nome==="social_annulla"&&p){p.stato="annullato";p.annullato_da_email="fede@dhn.it";} if(nome==="social_sposta"&&p){p.programmato_per=arg.p_quando;} return {data:p||null,error:null}; }, channel(){const c={on(){return c},subscribe(){return c}};return c}, removeChannel(){},
    storage:{from(){return {getPublicUrl:()=>({data:{publicUrl:""}}),upload:async()=>({})}}},
    functions:{async invoke(nome,{body}){
      store.invoke.push({nome,body:JSON.parse(JSON.stringify(body))});
      const s=store.scen;
      if(body.azione==="stato") return s.scollegato?{data:{collegato:false,motivo:"Meta non collegato: manca il segreto META_PAGE_TOKEN in Supabase"},error:null}
        :{data:{collegato:true,account:{pagina:"DHN Prova",pagina_id:"P1",ig_username:"dhn_prova",ig_id:"IG1"},limite:{usati:3,totale:100}},error:null};
      if(s.rete>0){ s.rete--; return {data:null,error:new FunctionsFetchError()}; }
      if(s.http409) return {data:null,error:new FunctionsHttpError(new Response(JSON.stringify({errore:"le grafiche di questa gara sono state rifatte dopo che le hai aperte"}),{status:409}))};
      if(body.azione==="riconferma"){ const p=store.post.find(x=>x.id===body.id); p.stato="in_attesa"; p.programmato_per=body.quando; p.versione_grafica=body.versione; return {data:{post:p},error:null}; }
      const gia=store.post.find(p=>p.chiave===body.chiave);
      if(gia) return {data:{ripetuta:true,post:gia},error:null};
      const p={id:store.post.length+1,chiave:body.chiave,gara_id:body.gara_id,creato_il:new Date().toISOString(),creato_da_email:"fede@dhn.it",
        creato_da:"u1",formato:body.formato||"post",immagini:(body.files||[body.file]).map(f=>({file:f,codice:f.slice(0,2)})),piattaforme:body.piattaforme,versione_grafica:body.versione,
        stato:body.quando?"in_attesa":"pubblicato",programmato_per:body.quando||null,ig_permalink:body.quando?null:"https://www.instagram.com/p/ABC/",fb_permalink:body.quando?null:"https://www.facebook.com/P1_9"};
      store.post.push(p); return {data:body.quando?{programmato:true,post:p}:{post:p},error:null};
    }},
  };
}`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let ok = 0, no = 0;
const prova = (nome, cond, info) => { if (cond) { ok++; console.log("  ok  " + nome); } else { no++; console.log("  NO  " + nome + (info !== undefined ? " → " + JSON.stringify(info) : "")); } };

async function pagina(viewport, o = {}) {
  const ctx = await b.newContext({ viewport, timezoneId: o.tz || "Europe/Rome" });
  await ctx.addInitScript(({ post, ruolo, cfgErr, piano }) => { globalThis.__POST = post; globalThis.__RUOLO = ruolo; globalThis.__CFG_ERR = cfgErr; globalThis.__PIANO = piano; },
    { post: o.post || POST, ruolo: o.ruolo || "superadmin", cfgErr: !!o.cfgErr, piano: o.piano ?? null });
  const pg = await ctx.newPage();
  const esterne = [];
  pg.on("console", (m) => { if (m.type() === "error") esterne.push("console: " + m.text()); });
  pg.on("pageerror", (e) => esterne.push("pageerror: " + e.message));
  await ctx.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.host === "dhn.test" && u.pathname === "/admin.html") return r.fulfill({ body: HTML, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": CSP } });
    if (u.host === "cdn.jsdelivr.net" && u.pathname.includes("supabase-js")) return r.fulfill({ body: FAKE_SB, headers: { "content-type": "text/javascript", "access-control-allow-origin": "*" } });
    if (u.host === "fedecacciaf1.github.io") {
      const h = { "access-control-allow-origin": "*" };
      if (u.pathname.endsWith("indice.json")) return r.fulfill({ json: IND, headers: h });
      if (u.pathname.endsWith("manifesto.json")) return r.fulfill({ json: MAN, headers: h });
      if (u.pathname.endsWith(".jpg")) return r.fulfill({ body: u.pathname.includes("/min/") ? MIN : BIG, headers: { ...h, "content-type": "image/jpeg" } });
    }
    if (u.host.endsWith("supabase.co")) esterne.push("SUPABASE VERO: " + u.href);
    return r.fulfill({ status: 204, body: "" });
  });
  const dialoghi = [];
  pg.on("dialog", async (d) => { dialoghi.push(d.message()); await d.accept(); });
  await pg.goto("https://dhn.test/admin.html");
  await pg.waitForSelector('[data-mod="social"]', { timeout: 15000 });
  await pg.click('[data-mod="social"]');
  await pg.waitForSelector(".soc-th", { timeout: 10000 });
  return { ctx, pg, esterne, dialoghi };
}
const S = (pg) => pg.evaluate(() => window.__store);

function romaParti(ms){ const p={}; new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value); return {y:+p.year,m:+p.month,d:+p.day,h:+p.hour,mi:+p.minute,s:+p.second}; }
function romaMs(y,m,d,h,mi){ const g=Date.UTC(y,m-1,d,h,mi); const off=ms=>{const p=romaParti(ms);return Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)-ms;}; let t=g-off(g); t=g-off(t); return t; }
const I=(ms)=>new Date(ms).toISOString();
/* la sera della gara, come la calcola il pannello (data_gara − 6 h, ora di Roma) */
const sera = romaParti(Date.parse(DATA_GARA) - 6 * 3600e3);
const alle = (gg, h, mi = 0) => { const x = new Date(Date.UTC(sera.y, sera.m - 1, sera.d + gg)); return romaMs(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), h, mi); };
var POST = [];
const HASH = "#DHNChampionship #F125 #simracing", FIRMA = "DHN Championship · Stagione 2";

/* ---------------- 1. config letta una volta, didascalia coi fissi ---------------- */
{
  const { ctx, pg, esterne } = await pagina({ width: 1400, height: 900 });
  await pg.click('.soc-th[data-i="2"]');
  await pg.waitForSelector("#socCap");
  const cap = await pg.inputValue("#socCap");
  prova("didascalia = testo della resa + firma + hashtag di config (quelli vecchi della resa tolti)",
    cap === `DRIVER STANDINGS — GP Belgio · Round 2\nROOKIE\n\n${FIRMA}\n\n${HASH}`, cap);
  await pg.click("#socX"); await pg.click('.soc-th[data-i="0"]'); await pg.waitForSelector("#socCap"); await pg.click("#socX");
  await pg.click('[data-vista="coda"]'); await pg.waitForSelector("#socCoda"); await pg.click('[data-vista="grafiche"]'); await pg.waitForSelector(".soc-th");
  const st = await S(pg);
  prova("aprire la scheda, due dettagli, Coda e ritorno: config social letta UNA volta (l'altra lettura di config è quella del login, di prima)",
    st.chiamate.filter((t) => /^config:.*social_hashtag/.test(t)).length === 1, st.chiamate);

  /* ---------------- 2. storia dal dettaglio ---------------- */
  await pg.click('.soc-th[data-i="1"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  prova("la 02 ha la storia: «Storia 9:16» si può scegliere", !(await pg.isDisabled('input[name="socFmt"][value="storia"]')));
  await pg.check('input[name="socFmt"][value="storia"]');
  const src = await pg.getAttribute("#socImg", "src");
  prova("scelta la storia: l'immagine grande diventa storie/02-winner.jpg", /\/gare\/210\/storie\/02-winner\.jpg\?v=/.test(src), src);
  prova("storia: didascalia e link nascosti, nota «senza testo · 24 ore» visibile",
    await pg.isHidden("#socCap") && await pg.isHidden("#socLink") && await pg.isVisible("#socStoriaNota") && /24 ore/.test(await pg.textContent("#socStoriaNota")));
  prova("le misure dicono 1080×1920", /1080×1920/.test(await pg.textContent("#socMisure")));
  prova("il pulsante dice «Pubblica la storia ora»", (await pg.textContent("#socPub")) === "Pubblica la storia ora", await pg.textContent("#socPub"));
  await pg.screenshot({ path: "shot5/PC_1_dettaglio_storia.png" });
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Pubblicata|✔/.test(document.getElementById("socDetMsg").textContent));
  let inv = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica");
  prova("alla funzione va formato «storia», il file del post, didascalia vuota e link spento",
    inv.length === 1 && inv[0].body.formato === "storia" && inv[0].body.file === "02-winner.jpg" && inv[0].body.didascalia === "" && inv[0].body.link_sito === false, inv.map((x) => x.body));
  await pg.check('input[name="socFmt"][value="post"]');
  prova("tornato a Post: didascalia di nuovo visibile, immagine del post", await pg.isVisible("#socCap") && !/storie\//.test(await pg.getAttribute("#socImg", "src")));
  prova("la storia NON segna la miniatura come «✔ uscita» (è un'altra cosa dal post)", !(await pg.isVisible('.soc-th[data-i="1"] .uscita')));
  await pg.click("#socX");
  await pg.click('.soc-th[data-i="4"]'); await pg.waitForSelector("#socCap");
  prova("la 05 non ha la storia (resa vecchia): scelta spenta e il perché scritto", await pg.isDisabled('input[name="socFmt"][value="storia"]') && /Rifai grafiche/.test(await pg.textContent(".soc-fmt")));
  await pg.click("#socX");

  /* ---------------- 3. ⚙ Hashtag e firma ---------------- */
  await pg.click("#socImp"); await pg.waitForSelector("#socImpH");
  prova("impostazioni: mostra hashtag e firma di adesso", (await pg.inputValue("#socImpH")) === HASH && (await pg.inputValue("#socImpF")) === FIRMA);
  await pg.fill("#socImpH", "#DHN F125");
  prova("una parola senza # spegne «Salva» e lo dice", await pg.isDisabled("#socImpOk") && /F125/.test(await pg.textContent("#socImpMsg")));
  await pg.fill("#socImpH", "#DHN #SimRacingItalia"); await pg.fill("#socImpF", "Seguici: dhn-multiverse.com");
  await pg.screenshot({ path: "shot5/PC_2_hashtag_firma.png" });
  await pg.click("#socImpOk"); await pg.waitForFunction(() => /Salvato/.test(document.getElementById("socImpMsg").textContent));
  const r = (await S(pg)).rpc.find((x) => x.nome === "social_impostazioni");
  prova("Salva chiama social_impostazioni con i valori scritti", r && r.arg.p_hashtag === "#DHN #SimRacingItalia" && r.arg.p_firma === "Seguici: dhn-multiverse.com", r);
  await pg.click("#socX");
  await pg.click('.soc-th[data-i="2"]'); await pg.waitForSelector("#socCap");
  const cap2 = await pg.inputValue("#socCap");
  prova("dopo il salvataggio la didascalia che si apre usa i fissi NUOVI", cap2.endsWith("Seguici: dhn-multiverse.com\n\n#DHN #SimRacingItalia") && !cap2.includes("#simracing"), cap2);
  await pg.click("#socX");
  prova("PC: nessun errore di pagina né CSP", esterne.length === 0, esterne);
  await ctx.close();
}

/* ---------------- 4. 🗓 Proponi il piano ---------------- */
{
  const gia = [{ id: 40, gara_id: 210, stato: "in_attesa", formato: "post", programmato_per: I(alle(1, 13)), creato_da: "u1", creato_da_email: "fede@dhn.it",
    immagini: [{ file: "03-driver-standings.jpg", codice: "03" }], piattaforme: ["instagram"], versione_grafica: GEN, creato_il: I(Date.now()), aggiornato_il: I(Date.now()) }];
  const { ctx, pg, esterne, dialoghi } = await pagina({ width: 1400, height: 900 }, { post: gia });
  await pg.click("#socPiano"); await pg.waitForSelector("#socPl .soc-pl");
  await pg.waitForFunction(() => !/Controllo/.test(document.getElementById("socAcc").textContent));
  const righe = await pg.$$eval("#socPl .soc-pl", (xs) => xs.map((x) => ({ on: x.querySelector("input[type=checkbox]").checked, dis: x.querySelector("input[type=checkbox]").disabled, t: x.textContent })));
  prova("6 uscite nel piano di serie", righe.length === 6, righe.length);
  prova("«Classifiche» (03 già in coda) proposta SPENTA con il perché", !righe[2].on && /già uscita o già in coda/.test(righe[2].t), righe[2]);
  prova("«I numeri della gara» (14,18,19,20 non ci sono) spenta e non sceglibile", !righe[5].on && righe[5].dis && /nessuna di queste/.test(righe[5].t), righe[5]);
  prova("«Qualifica e giro veloce»: accesa, dice quali mancano (12)", righe[4].on && /non ci sono: 12/.test(righe[4].t), righe[4]);
  prova("la storia della classifica c'è (la 03 ha la storia) ed è accesa", righe[3].on && /STORIA/.test(righe[3].t), righe[3]);
  prova("orari: Risultato = sera della gara 23:30, Classifiche = giorno dopo 13:00",
    (await pg.inputValue("#socPlH0")) === "23:30" && (await pg.inputValue("#socPlD2")) === `${romaParti(alle(1,13)).y}-${String(romaParti(alle(1,13)).m).padStart(2,"0")}-${String(romaParti(alle(1,13)).d).padStart(2,"0")}`);
  const t0 = await pg.inputValue("#socPlT0");
  prova("didascalia del Risultato = quella della 02 + firma + hashtag", t0 === `WINNER — GP Belgio · Round 2\nROOKIE\n\n${FIRMA}\n\n${HASH}`, t0);
  prova("il pulsante conta le uscite accese (4)", /Programma 4 uscite/.test(await pg.textContent("#socPlOk")), await pg.textContent("#socPlOk"));
  await pg.fill("#socPlH4", "19:30"); await pg.dispatchEvent("#socPlH4", "input");
  await pg.screenshot({ path: "shot5/PC_3_piano.png", fullPage: false });
  await pg.click("#socPlOk");
  await pg.waitForFunction(() => /in coda/.test(document.getElementById("socDetMsg").textContent), null, { timeout: 15000 });
  const inv = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").map((x) => x.body);
  prova("partono 4 richieste, una per uscita accesa", inv.length === 4, inv.length);
  prova("ognuna con la SUA chiave", new Set(inv.map((x) => x.chiave)).size === 4);
  const ris = inv.find((x) => x.files.join() === "02-winner.jpg,01-race-result.jpg");
  prova("Risultato = carosello 02+01 alle 23:30 di Roma, post con didascalia", ris && ris.quando === I(alle(0, 23, 30)) && !ris.formato && /#DHNChampionship/.test(ris.didascalia), ris);
  const sv = inv.find((x) => x.formato === "storia" && x.files[0] === "02-winner.jpg");
  prova("Storia del vincitore = 1 file, formato storia, 23:35, senza testo", sv && sv.files.length === 1 && sv.quando === I(alle(0, 23, 35)) && sv.didascalia === "", sv);
  const qg = inv.find((x) => x.files.includes("13-giro-veloce.jpg"));
  prova("l'ora cambiata a mano (19:30) è quella mandata", qg && qg.quando === I(alle(1, 19, 30)) && qg.files.join() === "05-pole.jpg,13-giro-veloce.jpg", qg);
  prova("il conferma elenca le uscite con giorno e ora", /23:30 — Risultato/.test(dialoghi.at(-1)) && /storia/.test(dialoghi.at(-1)), dialoghi.at(-1));
  const nPrima = inv.length;
  prova("dopo: righe fatte spente, pulsante «Niente da programmare»", /Niente da programmare/.test(await pg.textContent("#socPlOk")) && await pg.isDisabled("#socPlOk"));
  await pg.screenshot({ path: "shot5/PC_4_piano_fatto.png" });
  prova("nessuna richiesta in più dopo la fine", (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").length === nPrima);
  await pg.click("#socX");
  await pg.click('[data-vista="coda"]'); await pg.waitForSelector(".soc-card");
  prova("in Coda la storia ha il bollino «STORIA · 24 h» e la miniatura da storie/min/", await pg.isVisible(".soc-storia-chip") && (await pg.$$eval(".soc-cimg img.st", (xs) => xs.map((x) => x.getAttribute("src")))).some((s) => /\/storie\/min\/02-winner\.jpg/.test(s)));
  await pg.screenshot({ path: "shot5/PC_5_coda_storie.png" });
  prova("piano: nessun errore di pagina né CSP", esterne.length === 0, esterne);
  await ctx.close();
}

/* ---------------- 5. rete che cade a metà piano: nessun doppione ---------------- */
{
  const { ctx, pg } = await pagina({ width: 1400, height: 900 });
  await pg.evaluate(() => { window.__store.scen.rete = 1; });
  await pg.click("#socPiano"); await pg.waitForSelector("#socPl .soc-pl");
  await pg.waitForFunction(() => !document.getElementById("socPlOk").disabled);
  await pg.click("#socPlOk");
  await pg.waitForFunction(() => /Rete interrotta/.test(document.getElementById("socPl").textContent), null, { timeout: 15000 });
  const a = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").map((x) => x.body.chiave);
  await pg.waitForFunction(() => !document.getElementById("socPlOk").disabled);
  await pg.click("#socPlOk");
  await pg.waitForFunction(() => /Niente da programmare/.test(document.getElementById("socPlOk").textContent), null, { timeout: 15000 });
  const b2 = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").map((x) => x.body.chiave);
  const st = await S(pg);
  prova("rete caduta sulla prima: ripremendo si riusa la STESSA chiave e non esce niente due volte",
    b2.length === a.length + 1 && b2.at(-1) === a[0] && st.post.length === 5, { a, b2, post: st.post.length });
  await ctx.close();
}

/* ---------------- 6. config illeggibile: la scheda funziona, didascalie come la resa ---------------- */
{
  const { ctx, pg, esterne } = await pagina({ width: 1400, height: 900 }, { cfgErr: true });
  await pg.click('.soc-th[data-i="2"]'); await pg.waitForSelector("#socCap");
  prova("config non letta: didascalia uguale a quella della resa, niente rotture", (await pg.inputValue("#socCap")) === "DRIVER STANDINGS — GP Belgio · Round 2\nROOKIE\n\n#DHN #simracing");
  await pg.click("#socX"); await pg.click("#socImp"); await pg.waitForSelector("#socImpH");
  prova("e ⚙ lo DICE (non tace)", /non lette/.test(await pg.textContent("#socOv")));
  prova("solo l'avviso atteso in console", esterne.every((e) => /config non letta/.test(e)), esterne);
  await ctx.close();
}

/* ---------------- 7. telefono ---------------- */
{
  const { ctx, pg, esterne } = await pagina({ width: 390, height: 844 });
  await pg.click("#socPiano"); await pg.waitForSelector("#socPl .soc-pl");
  prova("telefono: piano senza scorrimento orizzontale", await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await pg.screenshot({ path: "shot5/TEL_1_piano.png", fullPage: true });
  await pg.click("#socX");
  await pg.click('.soc-th[data-i="1"]'); await pg.waitForSelector("#socCap");
  await pg.check('input[name="socFmt"][value="storia"]');
  prova("telefono: dettaglio storia senza scorrimento orizzontale", await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await pg.screenshot({ path: "shot5/TEL_2_storia.png" });
  prova("telefono: nessun errore", esterne.length === 0, esterne);
  await ctx.close();
}

await b.close();
console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO`);
process.exit(no ? 1 : 0);
