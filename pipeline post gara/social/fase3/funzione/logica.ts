/* ============================================================================
   Edge Function `social` — la logica, SENZA rete e senza Supabase dentro.
   Piano social FASE 3 (pipeline post gara/PIANO_SOCIAL_2026-09-25.md), 27/09/2026.

   Tutto ciò che esce (Meta, GitHub Pages, database) passa da `deps`: così il
   banco (banco_social_fase3.mjs) prova QUESTO file con un Meta finto, e
   index.ts si limita a collegarlo a fetch e a Supabase veri.

   Regole fatte codice (non promesse):
   - l'indirizzo dell'immagine NON arriva dal browser: si costruisce qui da
     gara + file, e il file deve stare nel manifesto su GitHub Pages;
   - la versione che l'admin ha visto deve essere quella di adesso: se le
     grafiche sono state rifatte nel frattempo, NON si pubblica (409);
   - una `chiave` per clic, UNIQUE nel database: il secondo invio restituisce
     il primo, non fa un altro post;
   - il contenitore Instagram si salva appena creato: se qualcosa si rompe dopo,
     un nuovo tentativo guarda quel contenitore e, se è già PUBLISHED, non
     ripubblica;
   - errore 190 = token scaduto o revocato: si dice così, non «errore Meta».
   Doc Meta lette il 27/09/2026 (Graph API v25.0): IG solo JPEG da URL pubblico,
   contenitore → media_publish, contenitore valido 24 h, 100 post / 24 h;
   Pagina FB: POST /{page}/photos con url + message.
   ========================================================================== */

export const GRAPH = "https://graph.facebook.com/v25.0";
export const BASE_PAGES = "https://fedecacciaf1.github.io/dhn-social";
export const PIATTAFORME = ["instagram", "facebook"];

export type Dipendenze = {
  fetch: (url: string, init?: any) => Promise<any>;
  token: string | null;                      // META_PAGE_TOKEN (segreto Supabase)
  db: {
    inserisci: (riga: any) => Promise<{ riga?: any; doppia?: boolean; errore?: string }>;
    perChiave: (chiave: string) => Promise<any>;
    aggiorna: (id: number, campi: any) => Promise<void>;
  };
  attendi?: (ms: number) => Promise<void>;
};

/* ------------------------------------------------------------ controlli */
export function controllaDidascalia(t: string): string[] {
  const p: string[] = [];
  if (!t || !t.trim()) p.push("didascalia vuota");
  if ([...(t || "")].length > 2200) p.push(`didascalia di ${[...t].length} caratteri (massimo 2200)`);
  const hash = (t || "").match(/(^|\s)#[^\s#]+/g) || [];
  if (hash.length > 30) p.push(`${hash.length} hashtag (massimo 30)`);
  const menz = (t || "").match(/(^|\s)@[\w.]+/g) || [];
  if (menz.length > 20) p.push(`${menz.length} menzioni @ (massimo 20)`);
  return p;
}
export function controllaMisure(l: number, a: number): string[] {
  if (!l || !a) return ["misure dell'immagine sconosciute"];
  const r = l / a;
  return r < 0.8 - 1e-9 || r > 1.91 + 1e-9 ? [`proporzione ${l}x${a} = ${r.toFixed(3)} fuori da 0.800–1.910`] : [];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_OK = /^[\w.\-]+\.jpg$/i;

/* ------------------------------------------------------------ Graph */
export class ErroreMeta extends Error {
  codice: number | null; sotto: number | null; incerto: boolean;
  constructor(msg: string, codice: number | null = null, sotto: number | null = null, incerto = false) {
    super(msg); this.codice = codice; this.sotto = sotto; this.incerto = incerto;
  }
}
export function spiegaErrore(e: any): string {
  if (e?.codice === 190) return "token Meta scaduto o revocato (errore 190): va rifatto e rimesso nei segreti Supabase";
  if (e?.codice === 10 || e?.codice === 200) return `permesso mancante sul token (errore ${e.codice}): ${e.message}`;
  if (e?.codice === 9 || e?.codice === 4 || e?.codice === 32 || e?.codice === 613) return `troppe richieste a Meta (errore ${e.codice}): riprovare più tardi`;
  if (e?.codice === 36003) return "proporzione dell'immagine rifiutata da Instagram (36003)";
  return e?.codice ? `Meta errore ${e.codice}${e.sotto ? "/" + e.sotto : ""}: ${e.message}` : String(e?.message || e);
}
async function graph(d: Dipendenze, metodo: "GET" | "POST", percorso: string, param: Record<string, any> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(param)) if (v !== undefined && v !== null) q.set(k, String(v));
  q.set("access_token", d.token || "");
  let r: any;
  try {
    r = metodo === "GET"
      ? await d.fetch(`${GRAPH}/${percorso}?${q}`)
      : await d.fetch(`${GRAPH}/${percorso}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: q.toString() });
  } catch (e: any) {
    // la richiesta può essere arrivata a Meta anche se la risposta no
    throw new ErroreMeta(`rete verso Meta interrotta (${e?.message || e})`, null, null, metodo === "POST");
  }
  let j: any = null;
  try { j = await r.json(); } catch { /* corpo non JSON */ }
  if (!r.ok || j?.error) {
    const er = j?.error || {};
    throw new ErroreMeta(er.message || `HTTP ${r.status}`, er.code ?? null, er.error_subcode ?? null, r.status >= 500 && metodo === "POST");
  }
  return j;
}

/* A chi punta il token: con un token di PAGINA, /me è la Pagina stessa. Così
   nei segreti basta UN valore; id Pagina e id Instagram si leggono da qui. */
export async function leggiAccount(d: Dipendenze) {
  if (!d.token) return { collegato: false, motivo: "Meta non collegato: manca il segreto META_PAGE_TOKEN in Supabase" };
  try {
    const me = await graph(d, "GET", "me", { fields: "id,name" });
    const pg = await graph(d, "GET", me.id, { fields: "instagram_business_account{id,username}" });
    const ig = pg.instagram_business_account || null;
    let limite: any = null;
    if (ig?.id) {
      try {
        const l = await graph(d, "GET", `${ig.id}/content_publishing_limit`, { fields: "quota_usage,config" });
        const x = (l.data || [])[0] || {};
        limite = { usati: x.quota_usage ?? null, totale: x.config?.quota_total ?? 100 };
      } catch { limite = null; }
    }
    return {
      collegato: true,
      account: { pagina: me.name, pagina_id: me.id, ig_username: ig?.username || null, ig_id: ig?.id || null },
      limite,
      avviso: ig ? null : "la Pagina non ha un Instagram professionale collegato: si può pubblicare solo su Facebook",
    };
  } catch (e) {
    return { collegato: false, motivo: spiegaErrore(e) };
  }
}

/* ------------------------------------------------------------ Instagram */
export async function pubblicaInstagram(d: Dipendenze, igId: string, url: string, didascalia: string,
  salvaContenitore: (id: string) => Promise<void>, contenitore: string | null = null) {
  const attendi = d.attendi || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  if (contenitore) {
    const s = await graph(d, "GET", contenitore, { fields: "status_code" });
    if (s.status_code === "PUBLISHED") return { gia_pubblicato: true, contenitore };
    if (s.status_code !== "FINISHED" && s.status_code !== "IN_PROGRESS") contenitore = null;   // EXPIRED / ERROR → nuovo
  }
  if (!contenitore) {
    const c = await graph(d, "POST", `${igId}/media`, { image_url: url, caption: didascalia });
    contenitore = String(c.id);
    await salvaContenitore(contenitore);
  }
  let stato = "IN_PROGRESS";
  for (let k = 0; k < 20 && stato === "IN_PROGRESS"; k++) {
    const s = await graph(d, "GET", contenitore, { fields: "status_code,status" });
    stato = s.status_code;
    if (stato === "ERROR" || stato === "EXPIRED") throw new ErroreMeta(`contenitore Instagram ${stato}: ${s.status || "Meta non ha preso l'immagine"}`);
    if (stato === "PUBLISHED") return { gia_pubblicato: true, contenitore };
    if (stato === "IN_PROGRESS") await attendi(1500);
  }
  if (stato !== "FINISHED") throw new ErroreMeta(`contenitore Instagram ancora ${stato} dopo 30 s`);
  const p = await graph(d, "POST", `${igId}/media_publish`, { creation_id: contenitore });
  let permalink: string | null = null;
  try { permalink = (await graph(d, "GET", String(p.id), { fields: "permalink" })).permalink || null; } catch { /* il post c'è: il link si recupera */ }
  return { contenitore, media_id: String(p.id), permalink };
}

/* ------------------------------------------------------------ Facebook */
export async function pubblicaFacebook(d: Dipendenze, paginaId: string, url: string, didascalia: string) {
  const r = await graph(d, "POST", `${paginaId}/photos`, { url, message: didascalia, published: "true" });
  const postId = String(r.post_id || `${paginaId}_${r.id}`);
  let permalink: string | null = null;
  try { permalink = (await graph(d, "GET", postId, { fields: "permalink_url" })).permalink_url || null; } catch { /* idem */ }
  return { post_id: postId, foto_id: String(r.id), permalink };
}

/* ------------------------------------------------------------ «Pubblica ora» */
export async function pubblicaOra(d: Dipendenze, corpo: any, utente: { id: string; email: string }) {
  const chiave = String(corpo?.chiave || "");
  const gara = Number(corpo?.gara_id);
  const file = String(corpo?.file || "");
  const versione = String(corpo?.versione || "");
  const didascalia = String(corpo?.didascalia ?? "");
  const piatt: string[] = Array.isArray(corpo?.piattaforme) ? [...new Set(corpo.piattaforme.map(String))] as string[] : [];

  /* 1. richiesta ben fatta — niente parte prima di questo */
  const errori: string[] = [];
  if (!UUID.test(chiave)) errori.push("chiave mancante o non valida");
  if (!Number.isInteger(gara) || gara <= 0) errori.push("gara non valida");
  if (!FILE_OK.test(file)) errori.push("nome file non valido");
  if (!versione) errori.push("versione delle grafiche mancante");
  if (!piatt.length || piatt.some((p) => !PIATTAFORME.includes(p))) errori.push("scegliere Instagram e/o Facebook");
  errori.push(...controllaDidascalia(didascalia));
  if (errori.length) return { http: 400, esito: { errore: errori.join(" · ") } };

  /* 2. già fatta? (doppio clic, rete che ripete) → la stessa riga, nessun post */
  const prima = await d.db.perChiave(chiave);
  if (prima) return { http: 200, esito: { ripetuta: true, post: prima } };

  /* 3. la grafica esiste, è quella che l'admin ha visto, ed è raggiungibile */
  let man: any;
  try {
    const r = await d.fetch(`${BASE_PAGES}/gare/${gara}/manifesto.json?t=${Date.now()}`);
    if (!r.ok) return { http: 404, esito: { errore: `manifesto della gara ${gara} non trovato su GitHub Pages (HTTP ${r.status})` } };
    man = await r.json();
  } catch (e: any) { return { http: 502, esito: { errore: `GitHub Pages non risponde: ${e?.message || e}` } }; }
  const voce = (man.voci || []).find((v: any) => v.file === file);
  if (!voce) return { http: 404, esito: { errore: `${file} non è fra le grafiche della gara ${gara}` } };
  if (man.generato !== versione) return { http: 409, esito: { errore: "le grafiche di questa gara sono state rifatte dopo che le hai aperte: premi «Aggiorna elenco» e ricontrolla prima di pubblicare", versione_attuale: man.generato } };
  const mis = controllaMisure(voce.larghezza, voce.altezza);
  if (mis.length) return { http: 400, esito: { errore: mis.join(" · ") } };
  const url = `${BASE_PAGES}/gare/${gara}/${encodeURIComponent(file)}?v=${encodeURIComponent(man.generato)}`;
  try {
    const h = await d.fetch(url, { method: "HEAD" });
    const tipo = String(h.headers?.get?.("content-type") || "");
    if (!h.ok || !/image\/jpe?g/i.test(tipo)) return { http: 502, esito: { errore: `l'immagine non è raggiungibile come JPEG (HTTP ${h.status}, ${tipo || "tipo sconosciuto"})` } };
  } catch (e: any) { return { http: 502, esito: { errore: `immagine non raggiungibile: ${e?.message || e}` } }; }

  /* 4. l'account: se il token non va, ci si ferma PRIMA di scrivere la riga */
  const acc: any = await leggiAccount(d);
  if (!acc.collegato) return { http: 503, esito: { errore: acc.motivo } };
  if (piatt.includes("instagram") && !acc.account.ig_id) return { http: 400, esito: { errore: acc.avviso } };
  if (piatt.includes("instagram") && acc.limite && acc.limite.usati !== null && acc.limite.usati >= acc.limite.totale)
    return { http: 429, esito: { errore: `tetto Instagram raggiunto: ${acc.limite.usati}/${acc.limite.totale} post nelle ultime 24 ore` } };

  /* 5. la prenotazione: INSERT con chiave UNIQUE, atomico */
  const ins = await d.db.inserisci({
    chiave, creato_da: utente.id, creato_da_email: utente.email, gara_id: gara,
    immagini: [{ file, url, codice: voce.codice, titolo: voce.titolo }], versione_grafica: man.generato,
    didascalia, piattaforme: piatt, stato: "in_invio", account: acc.account, tentativi: 1,
  });
  if (ins.doppia) return { http: 200, esito: { ripetuta: true, post: await d.db.perChiave(chiave) } };
  if (!ins.riga) return { http: 500, esito: { errore: `riga non scritta: ${ins.errore}` } };
  const id = ins.riga.id;

  /* 6. una piattaforma alla volta; un errore su una non ferma l'altra */
  const campi: any = {}; const problemi: string[] = []; let incerto = false; let riusciti = 0;
  if (piatt.includes("instagram")) {
    try {
      const ig: any = await pubblicaInstagram(d, acc.account.ig_id, url, didascalia,
        (c) => d.db.aggiorna(id, { ig_container: c }));
      Object.assign(campi, { ig_container: ig.contenitore, ig_media_id: ig.media_id || null, ig_permalink: ig.permalink || null });
      riusciti++;
    } catch (e: any) { problemi.push("Instagram: " + spiegaErrore(e)); if (e?.incerto) incerto = true; }
  }
  if (piatt.includes("facebook")) {
    try {
      const fb = await pubblicaFacebook(d, acc.account.pagina_id, url, didascalia);
      Object.assign(campi, { fb_post_id: fb.post_id, fb_permalink: fb.permalink });
      riusciti++;
    } catch (e: any) { problemi.push("Facebook: " + spiegaErrore(e)); if (e?.incerto) incerto = true; }
  }
  campi.stato = riusciti === piatt.length ? "pubblicato" : incerto ? "incerto" : riusciti ? "parziale" : "errore";
  campi.errore = problemi.length ? problemi.join(" · ") : null;
  campi.aggiornato_il = new Date().toISOString();
  await d.db.aggiorna(id, campi);
  return { http: 200, esito: { post: { id, ...ins.riga, ...campi } } };
}
