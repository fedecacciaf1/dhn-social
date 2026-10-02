/* Banco UI Q1 (02/10/2026) — la cartella «solo qualifica» nel pannello Social.
   admin.html VERO + CSP VERA, Supabase e funzione `social` FINTI (stesso finto
   della FASE 5), immagini della qualifica VERE (resa 223 fatta in questa chat).
   Prova: la qualifica si distingue dalla gara nell'elenco, nella testata, in
   Coda e sul telefono; «Rifai grafiche» e «Pubblica» mandano l'id della
   QUALIFICA (223), che è il nome della sua cartella su GitHub Pages.
   ADMIN=… HEADERS=… Q223=cartella/gare/223 node banco_ui_q1.mjs → prove + ./shotq1/ */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const ADMIN = readFileSync(process.env.HEADERS || "/mnt/user-data/uploads/RJDHN/sito/_headers", "utf8");
const CSP = ADMIN.split("\n").find((l) => l.includes("Content-Security-Policy")).split("Content-Security-Policy:")[1].trim();
const HTML = readFileSync(process.env.ADMIN || "/mnt/user-data/uploads/RJDHN/sito/admin.html");
const Q223 = process.env.Q223 || "gare/223";
const BIG = readFileSync("big.jpg"), MIN = readFileSync("min.jpg");
mkdirSync("shotq1", { recursive: true });

const MANQ = JSON.parse(readFileSync(join(Q223, "manifesto.json"), "utf8"));
const GEN = "2026-10-01T21:40:00.000Z";
const voce = (codice, file, titolo) => ({ codice, file, titolo, larghezza: 1080, altezza: 1350,
  didascalia: `${titolo} — GP Austria · Round 3\nROOKIE\n\n#DHN #simracing`, didascalia_origine: "generata dai dati",
  instagram: { ok: true, problemi: [] }, facebook: { ok: true, problemi: [] },
  storia: { file: `storie/${file}`, miniatura: `storie/min/${file}`, larghezza: 1080, altezza: 1920 } });
const MAN = { generato: GEN, modo: "gara", gara_id: 224, qualifica_id: 223, categoria: "ROOKIE", gp_nome: "Austria", round: 3, stato: "provvisorio", saltate: [], data_gara: "2026-10-01T21:22:17Z",
  voci: [voce("01", "01-race-result.jpg", "RISULTATO"), voce("02", "02-winner.jpg", "VINCITORE"), voce("05", "05-pole.jpg", "POLE")] };
/* l'indice come lo scrive consegna.mjs: la gara (224) sopra, la qualifica (223) sotto */
const IND = { gare: [
  { modo: "gara", gara_id: 224, cartella: "gare/224/", stato: "provvisorio", stagione_id: 2, categoria: "ROOKIE", gp_nome: "Austria", round: 3, data_gara: MAN.data_gara, immagini: 3 },
  { modo: "qualifica", gara_id: 223, cartella: "gare/223/", stato: MANQ.stato, stagione_id: 2, categoria: MANQ.categoria, gp_nome: MANQ.gp_nome, round: MANQ.round, data_gara: MANQ.data_gara, immagini: MANQ.voci.length },
  { gara_id: 210, cartella: "gare/210/", stato: "ufficiale", stagione_id: 2, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, data_gara: "2026-09-24T21:00:00Z", immagini: 3 },
] };
var POST = [];

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
      if (u.pathname.endsWith("manifesto.json")) return r.fulfill({ json: u.pathname.includes("/gare/223/") ? MANQ : MAN, headers: h });
      if (u.pathname.endsWith(".jpg")) { const m = u.pathname.match(/\/gare\/223\/(.+\.jpg)$/); const vera = m && existsSync(join(Q223, decodeURIComponent(m[1]))) ? readFileSync(join(Q223, decodeURIComponent(m[1]))) : null;
        return r.fulfill({ body: vera || (u.pathname.includes("/min/") ? MIN : BIG), headers: { ...h, "content-type": "image/jpeg" } }); }
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
const b = globalThis.__b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
let ok = 0, no = 0;
const prova = (nome, cond, info) => { if (cond) { ok++; console.log("  ok  " + nome); } else { no++; console.log("  NO  " + nome + (info !== undefined ? " → " + JSON.stringify(info) : "")); } };

/* ---------------- 1. PC: elenco, testata, Rifai, Pubblica, Coda ---------------- */
{
  /* un post già programmato sulla cartella della qualifica: la Coda deve dire «Qualifica» */
  const domani = new Date(Date.now() + 86400e3).toISOString();
  const gia = [{ id: 50, gara_id: 223, stato: "in_attesa", formato: "post", programmato_per: domani, creato_da: "u1", creato_da_email: "fede@dhn.it",
    immagini: [{ file: "06-front-row.jpg", codice: "06" }], piattaforme: ["instagram"], versione_grafica: MANQ.generato, creato_il: domani, aggiornato_il: domani }];
  const { ctx, pg, esterne, dialoghi } = await pagina({ width: 1400, height: 900 }, { post: gia });
  const elenco = await pg.$$eval(".soc-gi", (xs) => xs.map((x) => ({ id: x.dataset.gara, t: x.textContent.replace(/\s+/g, " ").trim() })));
  prova("tre cartelle nell'elenco, nell'ordine dell'indice (224, 223, 210)", elenco.map((x) => x.id).join() === "224,223,210", elenco);
  prova("la 223 dice «Qualifica» e «POLE pronta · 4 grafiche»", /Austria · R3 · Qualifica/.test(elenco[1].t) && /POLE pronta · 4 grafiche/.test(elenco[1].t), elenco[1]);
  prova("la gara 224 e la vecchia 210 (senza «modo») NON dicono Qualifica", !/Qualifica|POLE pronta/.test(elenco[0].t) && !/Qualifica|POLE pronta/.test(elenco[2].t), [elenco[0], elenco[2]]);
  await pg.click('.soc-gi[data-gara="223"]');
  await pg.waitForFunction(() => document.querySelectorAll(".soc-th").length === 4, null, { timeout: 10000 });
  const testa = (await pg.textContent(".soc-head .soc-gt")).trim();
  prova("testata: «Austria · Round 3 · Qualifica»", testa === "Austria · Round 3 · Qualifica", testa);
  const codici = await pg.$$eval(".soc-th .lb b", (xs) => xs.map((x) => x.textContent));
  prova("le 4 grafiche della qualifica: 05 06 07 08", codici.join() === "05,06,07,08", codici);
  await pg.waitForFunction(() => [...document.querySelectorAll(".soc-th img")].every((i) => i.complete && i.naturalWidth > 0));
  await pg.screenshot({ path: "shotq1/PC_1_qualifica.png" });
  await pg.click("#socRifai");
  await pg.waitForFunction(() => window.__store.rpc.some((x) => x.nome === "social_rendi"), null, { timeout: 10000 }).catch(() => {});
  const rr = (await S(pg)).rpc.filter((x) => x.nome === "social_rendi");
  prova("«Rifai grafiche» sulla qualifica chiama social_rendi con 223", rr.length === 1 && rr[0].arg.p_gara === 223, { rr, dialoghi });
  if (await pg.$("#socX")) await pg.click("#socX").catch(() => {});
  await pg.click('.soc-th[data-i="0"]'); await pg.waitForSelector("#socCap");
  const cap = await pg.inputValue("#socCap");
  prova("la didascalia della POLE è quella della qualifica (tempo e distacco, niente frasi sulla gara)", /POLE — GP Austria/.test(cap) && /1:12\.665/.test(cap) && !/vittoria|servito/i.test(cap), cap);
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.screenshot({ path: "shotq1/PC_2_dettaglio_pole.png" });
  await pg.click("#socPub");
  await pg.waitForFunction(() => window.__store.invoke.some((x) => x.body.azione === "pubblica"), null, { timeout: 10000 });
  const inv = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").map((x) => x.body);
  prova("«Pubblica» manda gara_id 223 e 05-pole.jpg con la versione del manifesto", inv.length === 1 && inv[0].gara_id === 223 && inv[0].file === "05-pole.jpg" && inv[0].versione === MANQ.generato, inv);
  await pg.click("#socX");
  await pg.click('[data-vista="coda"]'); await pg.waitForSelector(".soc-card");
  const card = (await pg.$$eval(".soc-card .soc-ct", (xs) => xs.map((x) => x.textContent.replace(/\s+/g, " ")))).join(" | ");
  prova("in Coda il post programmato dice «ROOKIE · Austria R3 · Qualifica — 06»", /ROOKIE · Austria R3 · Qualifica — 06/.test(card), card);
  await pg.screenshot({ path: "shotq1/PC_3_coda.png" });
  prova("PC: nessun errore di pagina né CSP", esterne.length === 0, esterne);
  await ctx.close();
}

/* ---------------- 2. telefono ---------------- */
{
  const { ctx, pg, esterne } = await pagina({ width: 390, height: 844 });
  const chips = await pg.$$eval(".soc-chips-tel .soc-chip", (xs) => xs.map((x) => x.textContent.trim()));
  prova("telefono: il bottone della 223 dice «ROOKIE · Austria R3 · Qualifica»", chips.includes("ROOKIE · Austria R3 · Qualifica"), chips);
  await pg.click('.soc-chips-tel .soc-chip[data-gara="223"]');
  await pg.waitForFunction(() => document.querySelectorAll(".soc-th").length === 4, null, { timeout: 10000 });
  await pg.waitForFunction(() => [...document.querySelectorAll(".soc-th img")].every((i) => i.complete && i.naturalWidth > 0));
  prova("telefono: niente scorrimento orizzontale", await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await pg.screenshot({ path: "shotq1/TEL_1_qualifica.png", fullPage: true });
  prova("telefono: nessun errore", esterne.length === 0, esterne);
  await ctx.close();
}

await b.close();
console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO`);
process.exit(no ? 1 : 0);
