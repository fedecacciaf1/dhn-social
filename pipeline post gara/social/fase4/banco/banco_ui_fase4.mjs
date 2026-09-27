/* Banco UI FASE 3 — admin.html VERO + CSP VERA da _headers, Supabase e funzione `social` FINTI.
   node banco_ui_fase3.mjs  → prove + screenshot PC e telefono in ./shot/ */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const ADMIN = readFileSync(process.env.HEADERS || "/mnt/user-data/uploads/RJDHN/sito/_headers", "utf8");
const CSP = ADMIN.split("\n").find((l) => l.includes("Content-Security-Policy")).split("Content-Security-Policy:")[1].trim();
const HTML = readFileSync(process.env.ADMIN || "/mnt/user-data/uploads/RJDHN/sito/admin.html");
const BIG = readFileSync("big.jpg"), MIN = readFileSync("min.jpg");
mkdirSync("shot4", { recursive: true });

const GEN = "2026-09-27T10:49:35.997Z";
const voce = (codice, file, titolo, orig = "generata dai dati") => ({ codice, file, titolo, larghezza: 1080, altezza: 1350,
  didascalia: `${titolo} — GP Belgio · Round 2\nROOKIE\n\n#DHN #simracing`, didascalia_origine: orig,
  instagram: { ok: true, problemi: [] }, facebook: { ok: true, problemi: [] } });
const MAN = { generato: GEN, gara_id: 210, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, stato: "ufficiale", saltate: [],
  voci: [voce("01", "01-race-result.jpg", "RACE RESULT"), voce("02", "02-winner.jpg", "WINNER"), voce("03", "03-driver-standings.jpg", "DRIVER STANDINGS"), voce("04", "04-team-standings.jpg", "TEAM STANDINGS", "solo titolo (da completare)"), voce("05", "05-pole.jpg", "POLE")] };
const IND = { gare: [{ gara_id: 210, cartella: "gare/210/", stato: "ufficiale", stagione_id: 2, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, data_gara: "2026-09-24T22:06:00Z", immagini: 5 }] };

/* il finto supabase-js: stessa forma di quello vero per ciò che admin.html usa */
const FAKE_SB = `
const store=window.__store={post:JSON.parse(JSON.stringify(globalThis.__POST||[])),chiamate:[],invoke:[],rpc:[],scen:{}};
class FunctionsHttpError extends Error{constructor(r){super("Edge Function returned a non-2xx status code");this.name="FunctionsHttpError";this.context=r;}}
class FunctionsFetchError extends Error{constructor(){super("Failed to send a request to the Edge Function");this.name="FunctionsFetchError";this.context=new TypeError("Failed to fetch");}}
function q(table){
  const st={table,filtri:[]};
  const res=()=>{
    store.chiamate.push(table);
    if(table==="admin_users") return {data:{user_id:"u1",email:"fede@dhn.it",ruolo:globalThis.__RUOLO||"superadmin",attivo:true},error:null};
    if(table==="stagione") return {data:[{id:2,nome:"Stagione 2",attiva:true,archiviata:false}],error:null};
    if(table==="post_social") return {data:store.post.filter(p=>st.filtri.every(([k,v])=>p[k]===v)),error:null};
    return {data:[],error:null,count:0};
  };
  const o={select(){return o},eq(k,v){st.filtri.push([k,v]);return o},order(){return o},in(){return o},neq(){return o},is(){return o},limit(){return o},gte(){return o},lte(){return o},not(){return o},or(){return o},
    maybeSingle(){const r=res();return Promise.resolve({data:Array.isArray(r.data)?r.data[0]??null:r.data,error:null})},
    single(){return o.maybeSingle()}, then(a,b){return Promise.resolve(res()).then(a,b)}};
  return o;
}
export function createClient(){
  return {
    auth:{getSession:async()=>({data:{session:{user:{id:"u1"},access_token:"x"}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({})},
    from:q, rpc:async(nome,arg)=>{ store.rpc.push({nome,arg}); const p=store.post.find(x=>x.id===arg?.p_id); if(nome==="social_annulla"&&p){p.stato="annullato";p.annullato_da_email="fede@dhn.it";} if(nome==="social_sposta"&&p){p.programmato_per=arg.p_quando;} return {data:p||null,error:null}; }, channel(){const c={on(){return c},subscribe(){return c}};return c}, removeChannel(){},
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
        creato_da:"u1",immagini:(body.files||[body.file]).map(f=>({file:f,codice:f.slice(0,2)})),piattaforme:body.piattaforme,versione_grafica:body.versione,
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
  await ctx.addInitScript(({ post, ruolo }) => { globalThis.__POST = post; globalThis.__RUOLO = ruolo; }, { post: o.post || POST, ruolo: o.ruolo || "superadmin" });
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

/* ================= FASE 4 ================= */
function romaParti(ms){ const p={}; new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value); return {y:+p.year,m:+p.month,d:+p.day,h:+p.hour,mi:+p.minute,s:+p.second}; }
function romaMs(y,m,d,h,mi){ const g=Date.UTC(y,m-1,d,h,mi); const off=ms=>{const p=romaParti(ms);return Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)-ms;}; let t=g-off(g); t=g-off(t); return t; }
const oggi=romaParti(Date.now());
const tra=(gg,h,mi=0)=>{ const x=new Date(Date.UTC(oggi.y,oggi.m-1,oggi.d+gg)); return romaMs(x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate(),h,mi); };
const I=(ms)=>new Date(ms).toISOString();
const im=(...c)=>c.map(k=>({file:`${k}-x.jpg`.replace("01-x","01-race-result").replace("02-x","02-winner").replace("03-x","03-driver-standings").replace("04-x","04-team-standings").replace("05-x","05-pole"),codice:k}));
var POST = [
  {id:11,gara_id:210,stato:"in_attesa",programmato_per:I(tra(1,21)),creato_da:"u1",creato_da_email:"fede@dhn.it",immagini:im("01"),piattaforme:["instagram","facebook"],versione_grafica:GEN,creato_il:I(Date.now()-3600e3),aggiornato_il:I(Date.now()-3600e3)},
  {id:12,gara_id:210,stato:"in_attesa",programmato_per:I(tra(2,13)),creato_da:"u2",creato_da_email:"luca@dhn.it",immagini:im("01","02","03"),piattaforme:["instagram"],versione_grafica:GEN,creato_il:I(Date.now()-3600e3),aggiornato_il:I(Date.now()-3600e3)},
  {id:13,gara_id:210,stato:"da_ricontrollare",programmato_per:I(Date.now()-600e3),creato_da:"u1",creato_da_email:"fede@dhn.it",immagini:im("02"),piattaforme:["instagram","facebook"],versione_grafica:"2026-09-26T00:00:00.000Z",errore:"le grafiche di questa gara sono state rifatte con dati DIVERSI dopo la programmazione (risultato cambiato?): il post non è uscito",creato_il:I(Date.now()-86400e3),aggiornato_il:I(Date.now()-600e3)},
  {id:14,gara_id:210,stato:"pubblicato",programmato_per:I(Date.now()-7200e3),uscito_il:I(Date.now()-7200e3),creato_da:"u2",creato_da_email:"luca@dhn.it",immagini:im("04"),piattaforme:["instagram","facebook"],versione_grafica:GEN,prova:true,nota:"PROVA: nessun post mandato a Meta · token ok su @dhn_prova",creato_il:I(Date.now()-86400e3),aggiornato_il:I(Date.now()-7200e3)},
  {id:15,gara_id:210,stato:"annullato",programmato_per:I(tra(1,9)),creato_da:"u1",creato_da_email:"fede@dhn.it",annullato_da_email:"fede@dhn.it",immagini:im("05"),piattaforme:["facebook"],versione_grafica:GEN,creato_il:I(Date.now()-86400e3),aggiornato_il:I(Date.now()-3600e3)},
];
const vai = (pg, sel) => pg.click(sel);

/* ---- PC: programma dal dettaglio ---- */
{
  const { ctx, pg, esterne, dialoghi } = await pagina({ width: 1400, height: 900 });
  prova("le due linguette Grafiche / Coda ci sono", await pg.isVisible('[data-vista="coda"]') && await pg.isVisible('[data-vista="grafiche"]'));
  prova("miniatura 01 segnata «🗓 in coda», la 04 (solo PROVA) NO", await pg.isVisible('.soc-th[data-i="0"] .coda') && !(await pg.isVisible('.soc-th[data-i="3"] .uscita')));
  await pg.click('.soc-th[data-i="2"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  prova("di serie «Adesso» e pulsante «Pubblica ora»", (await pg.textContent("#socPub")) === "Pubblica ora" && await pg.isHidden("#socQBox"));
  await pg.check("#socQProg");
  prova("scelto «Programma»: si apre giorno/ora e il pulsante dice «Programma»", await pg.isVisible("#socQBox") && (await pg.textContent("#socPub")) === "Programma");
  await pg.click('#socQBox [data-sc="3"]');   // Domani 19:00
  prova("scorciatoia «Domani 19:00» scrive la data giusta", (await pg.inputValue("#socQH")) === "19:00", await pg.inputValue("#socQH"));
  prova("la frase dice quando esce", /alle 19:00/.test(await pg.textContent("#socQInfo")), await pg.textContent("#socQInfo"));
  await pg.screenshot({ path: "shot4/PC_1_dettaglio_programma.png" });
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Programmata/.test(document.getElementById("socDetMsg").textContent));
  let inv = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica");
  prova("alla funzione va «quando» = domani 19:00 di Roma, e il file giusto", inv.length === 1 && inv[0].body.quando === I(tra(1, 19)) && inv[0].body.file === "03-driver-standings.jpg", inv.map(x=>x.body));
  prova("il conferma dice «Programmare» e l'ora di Roma", /Programmare/.test(dialoghi.at(-1)) && /19:00/.test(dialoghi.at(-1)) && /ora di Roma/.test(dialoghi.at(-1)), dialoghi.at(-1));
  prova("messaggio «🗓 Programmata … la trovi in Coda»", /Coda/.test(await pg.textContent("#socDetMsg")));
  await pg.screenshot({ path: "shot4/PC_2_programmata.png" });
  /* troppo presto */
  const ora = romaParti(Date.now() + 60e3);
  await pg.fill("#socQD", `${ora.y}-${String(ora.m).padStart(2,"0")}-${String(ora.d).padStart(2,"0")}`);
  await pg.fill("#socQH", `${String(ora.h).padStart(2,"0")}:${String(ora.mi).padStart(2,"0")}`);
  await pg.dispatchEvent("#socQH", "input");
  prova("ora fra 1 minuto: pulsante spento e avviso", await pg.isDisabled("#socPub") && /2 minuti/.test(await pg.textContent("#socQInfo")));
  await pg.click("#socX");

  /* ---- carosello ---- */
  await pg.click("#socCar");
  await pg.click('.soc-th[data-i="1"]'); await pg.click('.soc-th[data-i="0"]'); await pg.click('.soc-th[data-i="4"]');
  prova("scelta: numeri 1-2-3 nell'ordine dei tocchi, niente dettaglio aperto",
    (await pg.textContent('.soc-th[data-i="1"] .ord')) === "1" && (await pg.textContent('.soc-th[data-i="0"] .ord')) === "2" && (await pg.textContent('.soc-th[data-i="4"] .ord')) === "3" && !(await pg.isVisible("#socOv")));
  await pg.click('.soc-th[data-i="0"]');
  prova("ritoccare una scelta la toglie (e rinumera)", !(await pg.isVisible('.soc-th[data-i="0"] .ord')) && (await pg.textContent('.soc-th[data-i="4"] .ord')) === "2");
  await pg.click('.soc-th[data-i="0"]');
  prova("la barra dice 3/10", /3\/10/.test(await pg.textContent("#socBar")));
  await pg.screenshot({ path: "shot4/PC_3_scelta_carosello.png" });
  await pg.click("#socBarVai");
  await pg.waitForSelector("#socStrip .soc-sv");
  prova("il carosello mostra 3 grafiche nell'ordine 02, 05, 01", (await pg.$$eval("#socStrip .lb b", (e) => e.map((x) => x.textContent))).join() === "02,05,01");
  await pg.click('#socStrip [data-mv="2,-1"]');
  prova("sposto la terza a sinistra: 02, 01, 05", (await pg.$$eval("#socStrip .lb b", (e) => e.map((x) => x.textContent))).join() === "02,01,05");
  prova("didascalia di partenza = quella della prima grafica", (await pg.inputValue("#socCap")).startsWith("WINNER"));
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.screenshot({ path: "shot4/PC_4_carosello.png" });
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Pubblicata/.test(document.getElementById("socDetMsg").textContent));
  inv = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica");
  prova("alla funzione vanno files nell'ordine scelto, senza «quando»", inv.at(-1).body.files.join() === "02-winner.jpg,01-race-result.jpg,05-pole.jpg" && !("quando" in inv.at(-1).body) && !("file" in inv.at(-1).body), inv.at(-1).body);
  prova("il conferma parla di CAROSELLO di 3 e avvisa che la 01 è già in coda", /CAROSELLO di 3/.test(dialoghi.at(-1)) && /già in coda/.test(dialoghi.at(-1)), dialoghi.at(-1));
  await pg.click("#socX");
  prova("dopo l'uscita la scelta si chiude", await pg.isHidden("#socBar"));

  /* ---- Coda ---- */
  await pg.click('[data-vista="coda"]');
  await pg.waitForSelector("#socCard11");
  const testo = await pg.textContent("#socCoda");
  prova("Coda: sezione «Da guardare» col post fermo (13) in testa", /Da guardare \(1\)/.test(testo) && (await pg.$$eval(".soc-card", (e) => e.map((x) => x.id)))[0] === "socCard13");
  prova("Coda: «Da qui a lunedì» con i post in attesa", /Da qui a lunedì/.test(testo));
  prova("Coda: il post 12 di un altro admin mostra chi l'ha messo", /luca/.test(await pg.textContent("#socCard12")));
  prova("Coda: la PROVA uscita è marcata PROVA", /PROVA/.test(await pg.textContent("#socCard14")));
  prova("Coda: 21:00 sul post 11", /21:00/.test(await pg.textContent("#socCard11 .soc-cora")));
  await pg.screenshot({ path: "shot4/PC_5_coda_lista.png", fullPage: true });
  await pg.click('[data-modo="settimana"]');
  prova("Settimana: 7 colonne", (await pg.$$(".soc-wcol")).length === 7);
  await pg.screenshot({ path: "shot4/PC_6_coda_settimana.png", fullPage: true });
  await pg.click('[data-modo="lista"]');
  /* sposta */
  await pg.click('#socCard11 [data-azione="sposta"]');
  await pg.fill("#socSH11", "22:30"); await pg.click("#socSOk11");
  await pg.waitForFunction(() => window.__store.rpc.some((r) => r.nome === "social_sposta"));
  const rs = (await S(pg)).rpc.find((r) => r.nome === "social_sposta");
  prova("Sposta 21:00 → 22:30: rpc social_sposta con l'ora di Roma giusta", rs.arg.p_id === 11 && rs.arg.p_quando === I(tra(1, 22, 30)), rs);
  /* annulla */
  await pg.waitForSelector('#socCard12 [data-azione="annulla"]');
  await pg.click('#socCard12 [data-azione="annulla"]');
  await pg.waitForFunction(() => window.__store.rpc.some((r) => r.nome === "social_annulla"));
  prova("Annulla chiede conferma e chiama social_annulla(12)", /Annullare il post n. 12/.test(dialoghi.at(-1)) && (await S(pg)).rpc.find((r) => r.nome === "social_annulla").arg.p_id === 12);
  /* riconferma */
  await pg.waitForSelector('#socCard13 [data-azione="riconferma"]');
  await pg.click('#socCard13 [data-azione="riconferma"]');
  await pg.waitForSelector("#socR13Ok");
  prova("Riconferma mostra le grafiche DI ADESSO (versione nuova nell'indirizzo)", (await pg.$$eval("#socEd13 img", (e) => e.map((x) => x.src))).every((s) => s.includes(encodeURIComponent(GEN))));
  await pg.screenshot({ path: "shot4/PC_7_riconferma.png" });
  await pg.click("#socR13Ok");
  await pg.waitForFunction(() => window.__store.invoke.some((x) => x.body.azione === "riconferma"));
  const rc = (await S(pg)).invoke.find((x) => x.body.azione === "riconferma").body;
  prova("riconferma manda id 13 + la versione VISTA", rc.id === 13 && rc.versione === GEN && !!rc.quando, rc);
  prova("PC: nessun errore di pagina né CSP", !esterne.length, esterne);
  await ctx.close();
}
/* ---- admin (non super): i post degli altri senza pulsanti ---- */
{
  const { ctx, pg, esterne } = await pagina({ width: 1400, height: 900 }, { ruolo: "admin" });
  await pg.click('[data-vista="coda"]'); await pg.waitForSelector("#socCard12");
  prova("admin: sul post di Luca niente Sposta/Annulla, sul suo sì", !(await pg.$('#socCard12 [data-azione]')) && !!(await pg.$('#socCard11 [data-azione="sposta"]')));
  await ctx.close();
}
/* ---- telefono a New York: l'ora resta quella di Roma ---- */
{
  const { ctx, pg, esterne, dialoghi } = await pagina({ width: 390, height: 844 }, { tz: "America/New_York" });
  await pg.click('.soc-th[data-i="2"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.check("#socQProg"); await pg.click('#socQBox [data-sc="3"]');
  await pg.evaluate(() => document.querySelector(".soc-pub").scrollIntoView());
  await pg.screenshot({ path: "shot4/TEL_1_programma.png" });
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Programmata/.test(document.getElementById("socDetMsg").textContent));
  const q = (await S(pg)).invoke.find((x) => x.body.azione === "pubblica").body.quando;
  prova("telefono con fuso di New York: «Domani 19:00» è comunque le 19:00 di ROMA", q === I(tra(1, 19)), q);
  await pg.click("#socX");
  await pg.click('[data-vista="coda"]'); await pg.waitForSelector("#socCard11");
  prova("telefono: Coda senza scorrimento orizzontale", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  prova("telefono: la Coda mostra le ore di Roma (21:00)", /21:00/.test(await pg.textContent("#socCard11 .soc-cora")));
  await pg.screenshot({ path: "shot4/TEL_2_coda.png", fullPage: true });
  await pg.click('[data-modo="settimana"]');
  prova("telefono: Settimana diventa una colonna sola, senza scorrimento", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await pg.screenshot({ path: "shot4/TEL_3_settimana.png", fullPage: true });
  await pg.click('[data-vista="grafiche"]'); await pg.waitForSelector(".soc-th");
  await pg.click("#socCar"); await pg.click('.soc-th[data-i="1"]'); await pg.click('.soc-th[data-i="2"]');
  await pg.click("#socBarVai"); await pg.waitForSelector("#socStrip .soc-sv");
  prova("telefono: composizione carosello senza scorrimento orizzontale", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await pg.screenshot({ path: "shot4/TEL_4_carosello.png" });
  prova("telefono: nessun errore", !esterne.length, esterne);
  await ctx.close();
}
await b.close();
console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO`);
process.exit(no ? 1 : 0);
