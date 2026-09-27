/* ============================================================================
   Edge Function `social` — la logica, SENZA rete e senza Supabase dentro.
   FASE 3 (27/09/2026): «Pubblica ora». FASE 4 (27/09/2026): programmazione,
   carosello (fino a 10 immagini), sveglia pg_cron, ritentativi, avvisi.
   Piano: pipeline post gara/PIANO_SOCIAL_2026-09-25.md

   Tutto ciò che esce (Meta, GitHub Pages, database) passa da `deps`: il banco
   (fase4/banco/banco_social_fase4.mjs) prova QUESTO file con un Meta finto.

   Regole fatte codice (non promesse):
   - l'indirizzo delle immagini NON arriva dal browser: si costruisce qui da
     gara + file, e il file deve stare nel manifesto su GitHub Pages;
   - la versione che l'admin ha visto deve essere quella di adesso (409);
   - una `chiave` per clic, UNIQUE nel database: il secondo invio restituisce
     il primo, non fa un altro post;
   - un post PROGRAMMATO parte solo se il database lo «prenota» (un UPDATE
     atomico in_attesa → in_invio): due sveglie insieme = un post;
   - al momento di partire: grafiche rifatte con gli STESSI dati (stessa
     impronta) → parte con le immagini nuove; dati cambiati → NON parte,
     «da_ricontrollare» e avviso;
   - errore passeggero (rete, Meta giù, troppe richieste) → riprova fra 15
     minuti, al massimo 3 tentativi; errore vero (token 190, permessi, formato)
     → si ferma subito e avvisa. Esito INCERTO (la richiesta può essere
     arrivata) → mai ritentato da solo: potrebbe fare un doppione;
   - il contenitore Instagram (e quelli del carosello) si salva appena creato:
     un nuovo tentativo non ripubblica un contenitore già PUBLISHED.
   Doc Meta lette il 27/09/2026 (Graph API v25.0): IG solo JPEG da URL
   pubblico; carosello = figli con is_carousel_item, poi media_type CAROUSEL
   con children (max 10), poi media_publish; Pagina FB: una foto = /photos,
   più foto = /photos con published=false e poi /feed con attached_media.
   ========================================================================== */

export const GRAPH = "https://graph.facebook.com/v25.0";
export const BASE_PAGES = "https://fedecacciaf1.github.io/dhn-social";
export const PIATTAFORME = ["instagram", "facebook"];
export const MAX_IMMAGINI = 10;
export const MIN_ANTICIPO_MS = 2 * 60e3;       // si programma almeno fra 2 minuti
export const MAX_ANTICIPO_MS = 60 * 86400e3;   // e al massimo fra 60 giorni
export const RITENTA_MS = 15 * 60e3;
export const MAX_TENTATIVI = 3;

/* Il link al sito in fondo a ogni post (richiesta di Fede, 27/09).
   Su Facebook un indirizzo nel testo è CLICCABILE. Su Instagram NO: nessun
   link nella didascalia è cliccabile, l'unico link cliccabile è quello della
   bio. Quindi la stessa didascalia esce con due code diverse. */
export const SITO = "https://dhn-multiverse.com";
export const CODA_LINK: Record<string, string> = {
  facebook: `🌐 Risultati e classifiche: ${SITO}`,
  instagram: "🔗 Risultati e classifiche: link in bio · dhn-multiverse.com",
};
export function conLink(testo: string, piattaforma: string, attivo = true): string {
  const coda = CODA_LINK[piattaforma];
  if (!attivo || !coda || /dhn-multiverse\.com/i.test(testo)) return testo;
  const righe = testo.replace(/\s+$/, "").split("\n");
  const k = righe.length - 1;
  // prima degli hashtag, se l'ultima riga è fatta solo di hashtag
  if (k > 0 && /^\s*(#[^\s#]+\s*)+$/.test(righe[k])) {
    const prima = righe.slice(0, k).join("\n").replace(/\s+$/, "");
    return `${prima}\n\n${coda}\n\n${righe[k]}`;
  }
  return `${righe.join("\n")}\n\n${coda}`;
}

export type Dipendenze = {
  fetch: (url: string, init?: any) => Promise<any>;
  token: string | null;                      // META_PAGE_TOKEN (segreto Supabase)
  db: {
    inserisci: (riga: any) => Promise<{ riga?: any; doppia?: boolean; errore?: string }>;
    perChiave: (chiave: string) => Promise<any>;
    aggiorna: (id: number, campi: any) => Promise<void>;
    aggiornaSe?: (id: number, stati: string[], campi: any) => Promise<boolean>;
    perId?: (id: number) => Promise<any>;
    prenota?: (id: number) => Promise<{ esito: string; post?: any }>;
    dovuti?: () => Promise<number[]>;
    avvisa?: (id: number, testo: string) => Promise<void>;
  };
  attendi?: (ms: number) => Promise<void>;
  ora?: () => number;
};
const adesso = (d: Dipendenze) => (d.ora ? d.ora() : Date.now());

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
  codice: number | null; sotto: number | null; incerto: boolean; http: number;
  constructor(msg: string, codice: number | null = null, sotto: number | null = null, incerto = false, http = 0) {
    super(msg); this.codice = codice; this.sotto = sotto; this.incerto = incerto; this.http = http;
  }
}
export function spiegaErrore(e: any): string {
  if (e?.codice === 190) return "token Meta scaduto o revocato (errore 190): va rifatto e rimesso nei segreti Supabase";
  if (e?.codice === 10 || e?.codice === 200) return `permesso mancante sul token (errore ${e.codice}): ${e.message}`;
  if (e?.codice === 9 || e?.codice === 4 || e?.codice === 32 || e?.codice === 613) return `troppe richieste a Meta (errore ${e.codice}): riprovare più tardi`;
  if (e?.codice === 36003) return "proporzione dell'immagine rifiutata da Instagram (36003)";
  return e?.codice ? `Meta errore ${e.codice}${e.sotto ? "/" + e.sotto : ""}: ${e.message}` : String(e?.message || e);
}
/* passeggero = ha senso riprovare fra 15 minuti senza toccare niente */
export function passeggero(e: any): boolean {
  if (e?.incerto) return false;
  if (e?.codice == null) return !(e instanceof ErroreMeta) || e.http === 0 || e.http >= 500;
  return [1, 2, 4, 9, 17, 32, 341, 613, -1].includes(e.codice) || (e.http >= 500);
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
    throw new ErroreMeta(er.message || `HTTP ${r.status}`, er.code ?? null, er.error_subcode ?? null, r.status >= 500 && metodo === "POST", r.status);
  }
  return j;
}

/* A chi punta il token: con un token di PAGINA, /me è la Pagina stessa. */
export async function leggiAccount(d: Dipendenze) {
  if (!d.token) return { collegato: false, motivo: "Meta non collegato: manca il segreto META_PAGE_TOKEN in Supabase" };
  try {
    const me = await graph(d, "GET", "me", { fields: "id,name" });
    const pg = await graph(d, "GET", me.id, { fields: "instagram_business_account{id,username,website}" });
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
      account: { pagina: me.name, pagina_id: me.id, ig_username: ig?.username || null, ig_id: ig?.id || null, ig_sito: ig?.website || null },
      limite,
      avviso: ig ? null : "la Pagina non ha un Instagram professionale collegato: si può pubblicare solo su Facebook",
    };
  } catch (e: any) {
    return { collegato: false, motivo: spiegaErrore(e), errore: e };
  }
}

/* ------------------------------------------------------------ Instagram */
async function aspettaContenitore(d: Dipendenze, id: string) {
  const attendi = d.attendi || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let stato = "IN_PROGRESS";
  for (let k = 0; k < 20 && stato === "IN_PROGRESS"; k++) {
    const s = await graph(d, "GET", id, { fields: "status_code,status" });
    stato = s.status_code;
    if (stato === "ERROR" || stato === "EXPIRED") throw new ErroreMeta(`contenitore Instagram ${stato}: ${s.status || "Meta non ha preso l'immagine"}`);
    if (stato === "IN_PROGRESS") await attendi(1500);
  }
  if (stato !== "FINISHED" && stato !== "PUBLISHED") throw new ErroreMeta(`contenitore Instagram ancora ${stato} dopo 30 s`, null, null, false, 503);
  return stato;
}
/* urls: 1 = foto singola, 2..10 = carosello. `salva` registra i contenitori
   appena nati: {contenitore} e, per il carosello, {figli}. */
export async function pubblicaInstagram(d: Dipendenze, igId: string, urls: string | string[], didascalia: string,
  salvaContenitore: (id: string, figli?: string[]) => Promise<void>, contenitore: string | null = null) {
  const lista = Array.isArray(urls) ? urls : [urls];
  if (contenitore) {
    const s = await graph(d, "GET", contenitore, { fields: "status_code" });
    if (s.status_code === "PUBLISHED") return { gia_pubblicato: true, contenitore };
    if (s.status_code !== "FINISHED" && s.status_code !== "IN_PROGRESS") contenitore = null;   // EXPIRED / ERROR → nuovo
  }
  if (!contenitore) {
    if (lista.length === 1) {
      const c = await graph(d, "POST", `${igId}/media`, { image_url: lista[0], caption: didascalia });
      contenitore = String(c.id);
      await salvaContenitore(contenitore);
    } else {
      const figli: string[] = [];
      for (const u of lista) {
        const c = await graph(d, "POST", `${igId}/media`, { image_url: u, is_carousel_item: "true" });
        figli.push(String(c.id));
      }
      for (const f of figli) await aspettaContenitore(d, f);
      const c = await graph(d, "POST", `${igId}/media`, { media_type: "CAROUSEL", children: figli.join(","), caption: didascalia });
      contenitore = String(c.id);
      await salvaContenitore(contenitore, figli);
    }
  }
  const stato = await aspettaContenitore(d, contenitore);
  if (stato === "PUBLISHED") return { gia_pubblicato: true, contenitore };
  const p = await graph(d, "POST", `${igId}/media_publish`, { creation_id: contenitore });
  let permalink: string | null = null;
  try { permalink = (await graph(d, "GET", String(p.id), { fields: "permalink" })).permalink || null; } catch { /* il post c'è: il link si recupera */ }
  return { contenitore, media_id: String(p.id), permalink };
}

/* ------------------------------------------------------------ Facebook */
export async function pubblicaFacebook(d: Dipendenze, paginaId: string, urls: string | string[], didascalia: string,
  salvaFoto: (ids: string[]) => Promise<void> = async () => {}) {
  const lista = Array.isArray(urls) ? urls : [urls];
  let postId: string; let fotoId: string | null = null;
  if (lista.length === 1) {
    const r = await graph(d, "POST", `${paginaId}/photos`, { url: lista[0], message: didascalia, published: "true" });
    postId = String(r.post_id || `${paginaId}_${r.id}`); fotoId = String(r.id);
  } else {
    const ids: string[] = [];
    for (const u of lista) ids.push(String((await graph(d, "POST", `${paginaId}/photos`, { url: u, published: "false" })).id));
    await salvaFoto(ids);
    const param: Record<string, string> = { message: didascalia };
    ids.forEach((id, k) => { param[`attached_media[${k}]`] = JSON.stringify({ media_fbid: id }); });
    const r = await graph(d, "POST", `${paginaId}/feed`, param);
    postId = String(r.id);
  }
  let permalink: string | null = null;
  try { permalink = (await graph(d, "GET", postId, { fields: "permalink_url" })).permalink_url || null; } catch { /* idem */ }
  return { post_id: postId, foto_id: fotoId, permalink };
}

/* ------------------------------------------------------------ grafiche */
async function leggiManifesto(d: Dipendenze, gara: number) {
  let r: any;
  try { r = await d.fetch(`${BASE_PAGES}/gare/${gara}/manifesto.json?t=${adesso(d)}`); }
  catch (e: any) { return { http: 502, errore: `GitHub Pages non risponde: ${e?.message || e}`, passeggero: true }; }
  if (!r.ok) return { http: r.status >= 500 ? 502 : 404, errore: `manifesto della gara ${gara} non trovato su GitHub Pages (HTTP ${r.status})`, passeggero: r.status >= 500 };
  try { return { man: await r.json() }; } catch { return { http: 502, errore: "manifesto illeggibile", passeggero: true }; }
}
const urlDi = (gara: number, file: string, versione: string) =>
  `${BASE_PAGES}/gare/${gara}/${encodeURIComponent(file)}?v=${encodeURIComponent(versione)}`;

/* file → voci del manifesto, misure, raggiungibilità. Niente Meta. */
async function preparaImmagini(d: Dipendenze, gara: number, files: string[], man: any) {
  const voci: any[] = [];
  for (const f of files) {
    const v = (man.voci || []).find((x: any) => x.file === f);
    if (!v) return { http: 404, errore: `${f} non è fra le grafiche della gara ${gara}` };
    const mis = controllaMisure(v.larghezza, v.altezza);
    if (mis.length) return { http: 400, errore: `${f}: ${mis.join(" · ")}` };
    voci.push(v);
  }
  const immagini = voci.map((v) => ({ file: v.file, url: urlDi(gara, v.file, man.generato), codice: v.codice, titolo: v.titolo }));
  for (const im of immagini) {
    try {
      const h = await d.fetch(im.url, { method: "HEAD" });
      const tipo = String(h.headers?.get?.("content-type") || "");
      if (!h.ok || !/image\/jpe?g/i.test(tipo)) return { http: 502, errore: `${im.file}: l'immagine non è raggiungibile come JPEG (HTTP ${h.status}, ${tipo || "tipo sconosciuto"})`, passeggero: !h.ok && h.status >= 500 };
    } catch (e: any) { return { http: 502, errore: `${im.file}: immagine non raggiungibile: ${e?.message || e}`, passeggero: true }; }
  }
  return { immagini };
}

function leggiRichiesta(corpo: any) {
  const chiave = String(corpo?.chiave || "");
  const gara = Number(corpo?.gara_id);
  const files: string[] = Array.isArray(corpo?.files) ? corpo.files.map(String) : corpo?.file != null ? [String(corpo.file)] : [];
  const versione = String(corpo?.versione || "");
  const didascalia = String(corpo?.didascalia ?? "");
  const piatt: string[] = Array.isArray(corpo?.piattaforme) ? [...new Set(corpo.piattaforme.map(String))] as string[] : [];
  const errori: string[] = [];
  if (!UUID.test(chiave)) errori.push("chiave mancante o non valida");
  if (!Number.isInteger(gara) || gara <= 0) errori.push("gara non valida");
  if (!files.length) errori.push("nessuna grafica scelta");
  if (files.length > MAX_IMMAGINI) errori.push(`al massimo ${MAX_IMMAGINI} grafiche in un carosello (sono ${files.length})`);
  if (files.some((f) => !FILE_OK.test(f))) errori.push("nome file non valido");
  if (new Set(files).size !== files.length) errori.push("la stessa grafica è scelta due volte");
  if (!versione) errori.push("versione delle grafiche mancante");
  if (!piatt.length || piatt.some((p) => !PIATTAFORME.includes(p))) errori.push("scegliere Instagram e/o Facebook");
  const linkSito = corpo?.link_sito !== false;
  errori.push(...controllaDidascalia(didascalia));
  if (!errori.some((e) => /didascalia/.test(e)))
    for (const p of piatt) errori.push(...controllaDidascalia(conLink(didascalia, p, linkSito)).map((e) => `${e} (con il link al sito, ${p})`));
  return { chiave, gara, files, versione, didascalia, piatt, errori, linkSito };
}

/* ------------------------------------------------------------ l'invio vero */
/* Manda UNA riga già prenotata (stato in_invio) sulle piattaforme che mancano.
   Restituisce i campi da scrivere, e come classificare un eventuale errore. */
async function invia(d: Dipendenze, riga: any, acc: any) {
  const urls = (riga.immagini || []).map((x: any) => x.url);
  const campi: any = {}; const problemi: string[] = []; let incerto = false; let riusciti = 0; let tuttiPasseggeri = true;
  const piatt: string[] = riga.piattaforme || [];
  if (piatt.includes("instagram")) {
    try {
      const ig: any = await pubblicaInstagram(d, acc.account.ig_id, urls, conLink(riga.didascalia, "instagram", riga.link_sito !== false),
        (c, figli) => d.db.aggiorna(riga.id, figli ? { ig_container: c, ig_figli: figli } : { ig_container: c }), riga.ig_container || null);
      Object.assign(campi, { ig_container: ig.contenitore, ig_media_id: ig.media_id || riga.ig_media_id || null, ig_permalink: ig.permalink || riga.ig_permalink || null });
      riusciti++;
    } catch (e: any) { problemi.push("Instagram: " + spiegaErrore(e)); if (e?.incerto) incerto = true; if (!passeggero(e)) tuttiPasseggeri = false; }
  }
  if (piatt.includes("facebook")) {
    try {
      const fb = await pubblicaFacebook(d, acc.account.pagina_id, urls, conLink(riga.didascalia, "facebook", riga.link_sito !== false), (ids) => d.db.aggiorna(riga.id, { fb_foto_ids: ids }));
      Object.assign(campi, { fb_post_id: fb.post_id, fb_permalink: fb.permalink });
      riusciti++;
    } catch (e: any) { problemi.push("Facebook: " + spiegaErrore(e)); if (e?.incerto) incerto = true; if (!passeggero(e)) tuttiPasseggeri = false; }
  }
  campi.stato = riusciti === piatt.length ? "pubblicato" : incerto ? "incerto" : riusciti ? "parziale" : "errore";
  campi.errore = problemi.length ? problemi.join(" · ") : null;
  campi.aggiornato_il = new Date(adesso(d)).toISOString();
  if (campi.stato === "pubblicato") campi.uscito_il = campi.aggiornato_il;
  return { campi, ritentabile: campi.stato === "errore" && tuttiPasseggeri };
}

/* ------------------------------------------------------------ «Pubblica ora» / «Programma» */
export async function pubblicaOra(d: Dipendenze, corpo: any, utente: { id: string; email: string }) {
  const q = leggiRichiesta(corpo);
  const programma = corpo?.quando != null && corpo?.quando !== "";
  let quando: number | null = null;
  if (programma) {
    quando = Date.parse(String(corpo.quando));
    if (!Number.isFinite(quando)) q.errori.push("ora di uscita non valida");
    else {
      quando = Math.floor(quando / 60e3) * 60e3;       // al minuto: la sveglia suona al minuto
      if (quando < adesso(d) + MIN_ANTICIPO_MS) q.errori.push("l'ora di uscita deve essere almeno fra 2 minuti");
      if (quando > adesso(d) + MAX_ANTICIPO_MS) q.errori.push("si programma al massimo a 60 giorni");
    }
  }
  if (q.errori.length) return { http: 400, esito: { errore: q.errori.join(" · ") } };

  /* già fatta? (doppio clic, rete che ripete) → la stessa riga, nessun post */
  const prima = await d.db.perChiave(q.chiave);
  if (prima) return { http: 200, esito: { ripetuta: true, post: prima } };

  /* le grafiche esistono, sono quelle che l'admin ha visto, sono raggiungibili */
  const lm: any = await leggiManifesto(d, q.gara);
  if (!lm.man) return { http: lm.http, esito: { errore: lm.errore } };
  const man = lm.man;
  if (man.generato !== q.versione) return { http: 409, esito: { errore: "le grafiche di questa gara sono state rifatte dopo che le hai aperte: premi «Aggiorna elenco» e ricontrolla prima di pubblicare", versione_attuale: man.generato } };
  const pr: any = await preparaImmagini(d, q.gara, q.files, man);
  if (!pr.immagini) return { http: pr.http, esito: { errore: pr.errore } };

  /* l'account: se il token non va, ci si ferma PRIMA di scrivere la riga */
  const acc: any = await leggiAccount(d);
  if (!acc.collegato) return { http: 503, esito: { errore: acc.motivo } };
  if (q.piatt.includes("instagram") && !acc.account.ig_id) return { http: 400, esito: { errore: acc.avviso } };
  if (!programma && q.piatt.includes("instagram") && acc.limite && acc.limite.usati !== null && acc.limite.usati >= acc.limite.totale)
    return { http: 429, esito: { errore: `tetto Instagram raggiunto: ${acc.limite.usati}/${acc.limite.totale} post nelle ultime 24 ore` } };

  /* la prenotazione: INSERT con chiave UNIQUE, atomico */
  const ins = await d.db.inserisci({
    chiave: q.chiave, creato_da: utente.id, creato_da_email: utente.email, gara_id: q.gara,
    immagini: pr.immagini, versione_grafica: man.generato, impronta_dati: man.impronta_dati ?? null,
    didascalia: q.didascalia, link_sito: q.linkSito, piattaforme: q.piatt, account: acc.account,
    ...(programma
      ? { stato: "in_attesa", programmato_per: new Date(quando!).toISOString(), tentativi: 0 }
      : { stato: "in_invio", tentativi: 1 }),
  });
  if (ins.doppia) return { http: 200, esito: { ripetuta: true, post: await d.db.perChiave(q.chiave) } };
  if (!ins.riga) return { http: 500, esito: { errore: `riga non scritta: ${ins.errore}` } };
  if (programma) return { http: 200, esito: { programmato: true, post: ins.riga } };

  const { campi } = await invia(d, ins.riga, acc);
  await d.db.aggiorna(ins.riga.id, campi);
  return { http: 200, esito: { post: { ...ins.riga, ...campi } } };
}

/* ------------------------------------------------------------ la sveglia */
/* Chiamata dal database (pg_cron) per UN post, o senza id per «tutti i dovuti».
   Niente parte senza la prenotazione atomica del database. */
export async function scatta(d: Dipendenze, id: number | null) {
  const ids = id ? [id] : (d.db.dovuti ? await d.db.dovuti() : []);
  const esiti: any[] = [];
  for (const x of ids) esiti.push(await scattaUno(d, x));
  return { esiti };
}

async function scattaUno(d: Dipendenze, id: number) {
  const pren = await d.db.prenota!(id);
  if (pren.esito !== "prenotato") return { id, esito: pren.esito };   // già partito, annullato, troppo tardi, non ancora ora
  let riga = pren.post;
  const chiudi = async (campi: any, avviso: string | null) => {
    campi.aggiornato_il = new Date(adesso(d)).toISOString();
    await d.db.aggiorna(id, campi);
    if (avviso && d.db.avvisa) await d.db.avvisa(id, avviso);
    return { id, esito: campi.stato, errore: campi.errore ?? null };
  };
  const riprova = async (errore: string) => {
    if (riga.tentativi >= MAX_TENTATIVI)
      return chiudi({ stato: "errore", errore: `${errore} (tentativo ${riga.tentativi} di ${MAX_TENTATIVI}: non riprovo più)` }, `Il post programmato NON è uscito dopo ${riga.tentativi} tentativi: ${errore}`);
    return chiudi({ stato: "in_attesa", errore: `${errore} (tentativo ${riga.tentativi} di ${MAX_TENTATIVI}, riprovo fra 15 minuti)`,
                    prossimo_tentativo: new Date(adesso(d) + RITENTA_MS).toISOString() }, null);
  };

  /* 1. le grafiche: stessa versione, o rifatte con gli stessi dati */
  const lm: any = await leggiManifesto(d, riga.gara_id);
  if (!lm.man) return lm.passeggero ? riprova(lm.errore) : chiudi({ stato: "errore", errore: lm.errore }, `Il post programmato NON è uscito: ${lm.errore}`);
  const man = lm.man;
  const files = (riga.immagini || []).map((x: any) => x.file);
  let nota: string | null = null;
  if (man.generato !== riga.versione_grafica) {
    const stessiDati = riga.impronta_dati && man.impronta_dati && riga.impronta_dati === man.impronta_dati;
    if (!stessiDati)
      return chiudi({ stato: "da_ricontrollare", errore: "le grafiche di questa gara sono state rifatte con dati DIVERSI dopo la programmazione (risultato cambiato?): il post non è uscito" },
        "Il post programmato è FERMO: le grafiche sono state rifatte con dati diversi (reclamo, penalità, ufficializzazione). Guardale e riconferma il post, o annullalo.");
    nota = `grafiche rifatte ${man.generato} con gli stessi dati: uscito con le immagini nuove`;
  }
  const pr: any = await preparaImmagini(d, riga.gara_id, files, man);
  if (!pr.immagini) return pr.passeggero ? riprova(pr.errore)
    : chiudi({ stato: "da_ricontrollare", errore: pr.errore }, `Il post programmato è FERMO: ${pr.errore}`);
  if (nota) {
    riga = { ...riga, immagini: pr.immagini, versione_grafica: man.generato };
    await d.db.aggiorna(id, { immagini: pr.immagini, versione_grafica: man.generato, nota });
  }

  /* 2. la prova: tutto vero tranne Meta */
  if (riga.prova) {
    const acc: any = await leggiAccount(d);
    return chiudi({ stato: "pubblicato", uscito_il: new Date(adesso(d)).toISOString(), errore: null,
                    nota: [nota, `PROVA: nessun post mandato a Meta · token ${acc.collegato ? "ok su " + (acc.account.ig_username ? "@" + acc.account.ig_username : acc.account.pagina) : "NON ok: " + acc.motivo}`].filter(Boolean).join(" · ") }, null);
  }

  /* 3. l'account */
  const acc: any = await leggiAccount(d);
  if (!acc.collegato) return acc.errore && passeggero(acc.errore) ? riprova(acc.motivo)
    : chiudi({ stato: "errore", errore: acc.motivo }, `Il post programmato NON è uscito: ${acc.motivo}`);
  if (riga.piattaforme.includes("instagram") && !acc.account.ig_id)
    return chiudi({ stato: "errore", errore: acc.avviso }, `Il post programmato NON è uscito: ${acc.avviso}`);
  if (riga.piattaforme.includes("instagram") && acc.limite && acc.limite.usati !== null && acc.limite.usati >= acc.limite.totale)
    return riprova(`tetto Instagram raggiunto: ${acc.limite.usati}/${acc.limite.totale} post nelle ultime 24 ore`);

  /* 4. l'invio */
  const { campi, ritentabile } = await invia(d, riga, acc);
  campi.account = acc.account;
  if (campi.stato === "pubblicato") return chiudi(campi, null);
  if (ritentabile) return riprova(campi.errore);
  return chiudi(campi, campi.stato === "incerto"
    ? `Post programmato INCERTO — Meta non ha risposto in tempo: controlla sull'app se è uscito PRIMA di riprovare. ${campi.errore}`
    : campi.stato === "parziale" ? `Post programmato uscito SOLO IN PARTE: ${campi.errore}`
    : `Il post programmato NON è uscito: ${campi.errore}`);
}

/* ------------------------------------------------------------ «Riconferma» */
/* Un post fermo (da_ricontrollare / errore): l'admin ha guardato le grafiche
   NUOVE e lo rimette in coda, con la versione che ha visto. */
export async function riconferma(d: Dipendenze, corpo: any, utente: { id: string; email: string; ruolo: string }) {
  const id = Number(corpo?.id); const versione = String(corpo?.versione || "");
  const quando = Math.floor(Date.parse(String(corpo?.quando || "")) / 60e3) * 60e3;
  if (!Number.isInteger(id) || id <= 0) return { http: 400, esito: { errore: "post non valido" } };
  if (!Number.isFinite(quando) || quando < adesso(d) + MIN_ANTICIPO_MS) return { http: 400, esito: { errore: "l'ora di uscita deve essere almeno fra 2 minuti" } };
  if (quando > adesso(d) + MAX_ANTICIPO_MS) return { http: 400, esito: { errore: "si programma al massimo a 60 giorni" } };
  const riga = await d.db.perId!(id);
  if (!riga) return { http: 404, esito: { errore: "post non trovato" } };
  if (utente.ruolo !== "superadmin" && riga.creato_da !== utente.id) return { http: 403, esito: { errore: "questo post l'ha messo un altro admin: può riconfermarlo lui o il superadmin" } };
  if (!["da_ricontrollare", "errore"].includes(riga.stato)) return { http: 409, esito: { errore: `il post è «${riga.stato}»: si riconferma solo un post fermo o in errore` } };
  const lm: any = await leggiManifesto(d, riga.gara_id);
  if (!lm.man) return { http: lm.http, esito: { errore: lm.errore } };
  if (lm.man.generato !== versione) return { http: 409, esito: { errore: "le grafiche sono cambiate ancora mentre le guardavi: ricarica la Coda", versione_attuale: lm.man.generato } };
  const pr: any = await preparaImmagini(d, riga.gara_id, (riga.immagini || []).map((x: any) => x.file), lm.man);
  if (!pr.immagini) return { http: pr.http, esito: { errore: pr.errore } };
  const campi = {
    stato: "in_attesa", programmato_per: new Date(quando).toISOString(), prossimo_tentativo: null, tentativi: 0,
    immagini: pr.immagini, versione_grafica: lm.man.generato, impronta_dati: lm.man.impronta_dati ?? null,
    ig_container: null, ig_figli: null, fb_foto_ids: null, errore: null,
    nota: `riconfermato da ${utente.email} sulle grafiche del ${lm.man.generato}`, aggiornato_il: new Date(adesso(d)).toISOString(),
  };
  if (!(await d.db.aggiornaSe!(id, ["da_ricontrollare", "errore"], campi)))
    return { http: 409, esito: { errore: "il post è cambiato mentre lo riconfermavi (annullato da un altro admin?): ricarica la Coda" } };
  return { http: 200, esito: { post: { ...riga, ...campi } } };
}
