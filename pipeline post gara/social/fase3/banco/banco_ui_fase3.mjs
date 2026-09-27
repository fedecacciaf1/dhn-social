/* Banco UI FASE 3 — admin.html VERO + CSP VERA da _headers, Supabase e funzione `social` FINTI.
   node banco_ui_fase3.mjs  → prove + screenshot PC e telefono in ./shot/ */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const ADMIN = readFileSync(process.env.HEADERS || "/mnt/user-data/uploads/RJDHN/sito/_headers", "utf8");
const CSP = ADMIN.split("\n").find((l) => l.includes("Content-Security-Policy")).split("Content-Security-Policy:")[1].trim();
const HTML = readFileSync(process.env.ADMIN || "/mnt/user-data/uploads/RJDHN/sito/admin.html");
const BIG = readFileSync("big.jpg"), MIN = readFileSync("min.jpg");
mkdirSync("shot", { recursive: true });

const GEN = "2026-09-27T10:49:35.997Z";
const voce = (codice, file, titolo, orig = "generata dai dati") => ({ codice, file, titolo, larghezza: 1080, altezza: 1350,
  didascalia: `${titolo} — GP Belgio · Round 2\nROOKIE\n\n#DHN #simracing`, didascalia_origine: orig,
  instagram: { ok: true, problemi: [] }, facebook: { ok: true, problemi: [] } });
const MAN = { generato: GEN, gara_id: 210, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, stato: "ufficiale", saltate: [],
  voci: [voce("01", "01-race-result.jpg", "RACE RESULT"), voce("02", "02-winner.jpg", "WINNER"), voce("04", "04-team-standings.jpg", "TEAM STANDINGS", "solo titolo (da completare)")] };
const IND = { gare: [{ gara_id: 210, cartella: "gare/210/", stato: "ufficiale", stagione_id: 2, categoria: "ROOKIE", gp_nome: "Belgio", round: 2, data_gara: "2026-09-24T22:06:00Z", immagini: 3 }] };

/* il finto supabase-js: stessa forma di quello vero per ciò che admin.html usa */
const FAKE_SB = `
const store=window.__store={post:[],chiamate:[],invoke:[],scen:{}};
class FunctionsHttpError extends Error{constructor(r){super("Edge Function returned a non-2xx status code");this.name="FunctionsHttpError";this.context=r;}}
class FunctionsFetchError extends Error{constructor(){super("Failed to send a request to the Edge Function");this.name="FunctionsFetchError";this.context=new TypeError("Failed to fetch");}}
function q(table){
  const st={table,filtri:[]};
  const res=()=>{
    store.chiamate.push(table);
    if(table==="admin_users") return {data:{user_id:"u1",email:"fede@dhn.it",ruolo:"superadmin",attivo:true},error:null};
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
    from:q, rpc:async()=>({data:null,error:null}), channel(){const c={on(){return c},subscribe(){return c}};return c}, removeChannel(){},
    storage:{from(){return {getPublicUrl:()=>({data:{publicUrl:""}}),upload:async()=>({})}}},
    functions:{async invoke(nome,{body}){
      store.invoke.push({nome,body:JSON.parse(JSON.stringify(body))});
      const s=store.scen;
      if(body.azione==="stato") return s.scollegato?{data:{collegato:false,motivo:"Meta non collegato: manca il segreto META_PAGE_TOKEN in Supabase"},error:null}
        :{data:{collegato:true,account:{pagina:"DHN Prova",pagina_id:"P1",ig_username:"dhn_prova",ig_id:"IG1"},limite:{usati:3,totale:100}},error:null};
      if(s.rete>0){ s.rete--; return {data:null,error:new FunctionsFetchError()}; }
      if(s.http409) return {data:null,error:new FunctionsHttpError(new Response(JSON.stringify({errore:"le grafiche di questa gara sono state rifatte dopo che le hai aperte"}),{status:409}))};
      const gia=store.post.find(p=>p.chiave===body.chiave);
      if(gia) return {data:{ripetuta:true,post:gia},error:null};
      const p={id:store.post.length+1,chiave:body.chiave,gara_id:body.gara_id,creato_il:new Date().toISOString(),creato_da_email:"fede@dhn.it",
        immagini:[{file:body.file}],piattaforme:body.piattaforme,stato:"pubblicato",ig_permalink:"https://www.instagram.com/p/ABC/",fb_permalink:"https://www.facebook.com/P1_9"};
      store.post.push(p); return {data:{post:p},error:null};
    }},
  };
}`;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let ok = 0, no = 0;
const prova = (nome, cond, info) => { if (cond) { ok++; console.log("  ok  " + nome); } else { no++; console.log("  NO  " + nome + (info !== undefined ? " → " + JSON.stringify(info) : "")); } };

async function pagina(viewport) {
  const ctx = await b.newContext({ viewport });
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

/* ---------------- PC ---------------- */
{
  const { ctx, pg, esterne, dialoghi } = await pagina({ width: 1400, height: 900 });
  prova("scheda aperta: post_social letto UNA volta per la gara, zero Supabase vero", (await S(pg)).chiamate.filter((t) => t === "post_social").length === 1 && !esterne.some((e) => e.includes("SUPABASE VERO")), await S(pg));
  await pg.click('.soc-th[data-i="1"]');
  await pg.waitForFunction(() => document.getElementById("socAcc")?.textContent.includes("dhn_prova"));
  prova("il dettaglio dice DOVE va: @dhn_prova e la Pagina", (await pg.textContent("#socAcc")).includes("@dhn_prova") && (await pg.textContent("#socAcc")).includes("DHN Prova"));
  prova("pulsante attivo con account collegato", !(await pg.isDisabled("#socPub")));
  await pg.screenshot({ path: "shot/PC_dettaglio_pronto.png" });
  await pg.fill("#socCap", "Vince Vincent SV a Spa. #DHN #ROOKIE");
  await pg.keyboard.press("ArrowLeft");   // dentro la didascalia non deve cambiare grafica
  prova("frecce dentro la didascalia non cambiano grafica", (await pg.textContent(".soc-det")).includes("WINNER"));
  await pg.keyboard.press("Escape");
  prova("Esc dentro la didascalia non chiude", await pg.isVisible("#socOv"));
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Pubblicata/.test(document.getElementById("socDetMsg").textContent));
  const st = await S(pg); const inv = st.invoke.filter((x) => x.body.azione === "pubblica");
  prova("conferma chiesta con i nomi degli account", dialoghi.length === 1 && dialoghi[0].includes("@dhn_prova") && dialoghi[0].includes("DHN Prova"), dialoghi);
  prova("alla funzione va: gara, file, versione vista, didascalia MODIFICATA, piattaforme, chiave uuid — niente url",
    inv.length === 1 && inv[0].body.gara_id === 210 && inv[0].body.file === "02-winner.jpg" && inv[0].body.versione === GEN
    && inv[0].body.didascalia === "Vince Vincent SV a Spa. #DHN #ROOKIE" && inv[0].body.piattaforme.join() === "instagram,facebook"
    && /^[0-9a-f-]{36}$/.test(inv[0].body.chiave) && !("url" in inv[0].body), inv);
  prova("dopo: link a Instagram e Facebook nel messaggio", (await pg.innerHTML("#socDetMsg")).includes("instagram.com/p/ABC") && (await pg.innerHTML("#socDetMsg")).includes("facebook.com"));
  prova("storia della grafica: «✔ uscita» con chi e quando", (await pg.textContent("#socStoria")).includes("✔ uscita") && (await pg.textContent("#socStoria")).includes("fede@dhn.it"));
  await pg.screenshot({ path: "shot/PC_dettaglio_pubblicata.png" });
  await pg.click("#socX");
  prova("miniatura segnata «✔ uscita»", await pg.isVisible('.soc-th[data-i="1"] .uscita'));
  prova("le altre miniature NO", !(await pg.isVisible('.soc-th[data-i="0"] .uscita')));
  await pg.screenshot({ path: "shot/PC_griglia_uscita.png" });

  /* seconda volta sulla stessa grafica: avviso nel conferma */
  await pg.click('.soc-th[data-i="1"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Pubblicata/.test(document.getElementById("socDetMsg").textContent));
  prova("ripubblicare avvisa «GIÀ uscita»", dialoghi[1]?.includes("GIÀ uscita"), dialoghi[1]);
  prova("ogni clic ha una chiave NUOVA (post voluto = post nuovo)", new Set((await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").map((x) => x.body.chiave)).size === 2);
  await pg.click("#socX");

  /* rete che cade: il secondo clic riusa la STESSA chiave */
  await pg.evaluate(() => { window.__store.scen.rete = 1; });
  await pg.click('.soc-th[data-i="0"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Rete interrotta/.test(document.getElementById("socDetMsg").textContent));
  await pg.click("#socPub");
  await pg.waitForFunction(() => /Pubblicata/.test(document.getElementById("socDetMsg").textContent));
  const ult = (await S(pg)).invoke.filter((x) => x.body.azione === "pubblica").slice(-2);
  prova("rete caduta → «premi di nuovo», e il nuovo clic manda la STESSA chiave", ult.length === 2 && ult[0].body.chiave === ult[1].body.chiave, ult.map((x) => x.body.chiave));
  await pg.click("#socX");

  /* 409 */
  await pg.evaluate(() => { window.__store.scen.http409 = true; });
  await pg.click('.soc-th[data-i="2"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.click("#socPub");
  await pg.waitForFunction(() => /rifatte/.test(document.getElementById("socDetMsg").textContent));
  prova("409 grafiche rifatte: detto in chiaro", (await pg.textContent("#socDetMsg")).includes("rifatte"));
  prova("il conferma sulla 04 avvisa della didascalia minima", dialoghi.at(-1).includes("didascalia è quella minima"), dialoghi.at(-1));
  /* didascalia troppo lunga */
  /* dal 27/09 (link al sito) il tetto si conta sulla versione CON il link:
     il 2200/2201 «nudo» si prova col link spento, come deciso in FASE 4 */
  await pg.uncheck("#socLink");
  await pg.fill("#socCap", "x".repeat(2201));
  prova("2201 caratteri: pulsante spento e contatore rosso", await pg.isDisabled("#socPub") && (await pg.textContent("#socConta")).includes("2201/2200"));
  await pg.fill("#socCap", "x".repeat(2200));
  prova("2200 caratteri: pulsante acceso", !(await pg.isDisabled("#socPub")));
  await pg.check("#socLink");
  prova("nessun errore di pagina né CSP", !esterne.length, esterne);
  await ctx.close();
}
/* ---------------- non collegato + telefono ---------------- */
{
  const { ctx, pg, esterne } = await pagina({ width: 390, height: 844 });
  await pg.evaluate(() => { window.__store.scen.scollegato = true; });
  await pg.click('.soc-th[data-i="1"]');
  await pg.waitForFunction(() => /META_PAGE_TOKEN/.test(document.getElementById("socAcc").textContent));
  prova("Meta non collegato: detto, e pulsante spento", await pg.isDisabled("#socPub"));
  await pg.evaluate(() => document.querySelector(".soc-pub").scrollIntoView());
  await pg.screenshot({ path: "shot/TEL_non_collegato.png" });
  await ctx.close();
}
{
  const { ctx, pg, esterne } = await pagina({ width: 390, height: 844 });
  await pg.click('.soc-th[data-i="1"]');
  await pg.waitForFunction(() => !document.getElementById("socPub").disabled);
  await pg.screenshot({ path: "shot/TEL_dettaglio_alto.png" });
  await pg.evaluate(() => document.querySelector(".soc-pub").scrollIntoView());
  const bb = await pg.locator("#socPub").boundingBox();
  prova("telefono: pulsante raggiungibile e largo", bb && bb.width > 300, bb);
  const larga = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  prova("telefono: niente scorrimento orizzontale", larga);
  await pg.screenshot({ path: "shot/TEL_pubblica.png" });
  prova("telefono: nessun errore", !esterne.length, esterne);
  await ctx.close();
}
await b.close();
console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO`);
process.exit(no ? 1 : 0);
