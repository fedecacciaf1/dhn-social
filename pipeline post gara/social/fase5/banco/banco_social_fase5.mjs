/* Banco FASE 5 — tutto il banco FASE 4 (regressione) + le STORIE.
   La logica VERA (../funzione/logica.ts, v5) contro un Meta FINTO e un database FINTO.
   node --experimental-strip-types banco_social_fase5.mjs [--rompi | --contro-v4]
   --contro-v4: stesse prove sulla funzione v4 (quella SENZA storie): le prove
   delle storie DEVONO diventare rosse, il resto deve restare verde.
   --rompi rende NON atomica la prenotazione del database finto: la prova
   «due sveglie insieme» DEVE diventare rossa (se resta verde, il banco non vede). */
const L = process.argv.includes("--contro-v4") ? await import("../../fase4/funzione/logica.ts") : await import("../funzione/logica.ts");

const ROMPI = process.argv.includes("--rompi");
const T0 = Date.parse("2026-09-28T10:00:00.000Z");
const GEN = "2026-09-27T10:49:56.426Z", GEN2 = "2026-09-28T11:00:00.000Z";
const voce = (n, a = 1350) => { const f = `${String(n).padStart(2, "0")}-g.jpg`;
  return { codice: String(n).padStart(2, "0"), titolo: "T" + n, file: f, larghezza: 1080, altezza: a,
    ...(n <= 10 ? { storia: { file: `storie/${f}`, larghezza: 1080, altezza: 1920 } } : {}) }; };
const MAN = { generato: GEN, impronta_dati: "IMP1", gara_id: 208, voci: [...Array(12)].map((_, k) => voce(k + 1)).concat([voce(99, 1920)]) };
const utente = { id: "U-FEDE", email: "fede@x", ruolo: "superadmin" };
const admin2 = { id: "U-LUCA", email: "luca@x", ruolo: "admin" };
const uuid = () => crypto.randomUUID();

function mondo(o = {}) {
  const M = { ora: T0, man: MAN, cont: {}, igPost: [], fbPost: [], fbNonPubbl: [], chiamate: [], n: 0, avvisi: [], guasti: {}, ...o };
  const risp = (corpo, status = 200, tipo = "application/json") => ({
    ok: status < 400, status, headers: { get: (k) => (k.toLowerCase() === "content-type" ? tipo : null) }, json: async () => corpo });
  const guasto = (k) => { const g = M.guasti[k]; if (g && g.volte > 0) { g.volte--; return g; } return null; };
  M.fetch = async (url, init = {}) => {
    const u = new URL(url); const metodo = init.method || "GET";
    const p = metodo === "POST" ? new URLSearchParams(init.body) : u.searchParams;
    M.chiamate.push({ metodo, path: u.pathname, p: Object.fromEntries(p) });
    if (u.host === "fedecacciaf1.github.io") {
      if (u.pathname.endsWith("/manifesto.json")) { if (guasto("pages")) return risp(null, 503); return u.pathname.includes("/gare/208/") ? risp(M.man) : risp({}, 404); }
      if (metodo === "HEAD") return risp(null, 200, "image/jpeg");
      return risp(null, 404);
    }
    const path = u.pathname.replace("/v25.0/", "");
    if (guasto("190")) return risp({ error: { code: 190, message: "Error validating access token" } }, 400);
    if (path === "me") { if (guasto("me500")) return risp({ error: { message: "down" } }, 500); return risp({ id: "PAG1", name: "DHN Multiverse" }); }
    if (path === "PAG1") return risp({ instagram_business_account: { id: "IG1", username: "dhnmultiverse" } });
    if (path === "IG1/content_publishing_limit") return risp({ data: [{ quota_usage: M.usati ?? 3, config: { quota_total: 100 } }] });
    if (path === "IG1/media" && metodo === "POST") {
      if (guasto("rate")) return risp({ error: { code: 4, message: "Application request limit reached" } }, 400);
      const id = "C" + ++M.n;
      if (p.get("media_type") === "CAROUSEL") {
        const figli = p.get("children").split(",");
        if (figli.length > 10 || figli.some((f) => !M.cont[f]?.figlio)) return risp({ error: { code: 100, message: "children non validi" } }, 400);
        M.cont[id] = { stato: "FINISHED", caption: p.get("caption"), figli, urls: figli.map((f) => M.cont[f].url) };
      } else {
        if (p.get("media_type") === "STORIES") {
          if (p.get("caption")) return risp({ error: { code: 100, message: "caption non ammessa sulle storie" } }, 400);
          M.cont[id] = { stato: "FINISHED", storia: true, url: p.get("image_url"), urls: [p.get("image_url")] }; return risp({ id });
        }
        const figlio = p.get("is_carousel_item") === "true";
        if (figlio && p.get("caption")) return risp({ error: { code: 100, message: "caption su un figlio" } }, 400);
        M.cont[id] = { stato: M.statoIG ?? "FINISHED", caption: p.get("caption"), figlio, url: p.get("image_url"), urls: [p.get("image_url")] };
      }
      return risp({ id });
    }
    if (path === "IG1/media_publish") {
      if (guasto("publishRete")) throw new Error("socket hang up");
      const c = M.cont[p.get("creation_id")];
      if (!c || c.stato !== "FINISHED" || c.figlio) return risp({ error: { code: 9007, message: "Media ID is not available" } }, 400);
      c.stato = "PUBLISHED"; const id = "M" + ++M.n;
      if (c.storia) { (M.igStorie ||= []).push({ id, urls: c.urls }); return risp({ id }); }
      M.igPost.push({ id, caption: c.caption, urls: c.urls }); return risp({ id });
    }
    if (M.cont[path]) return risp({ status_code: M.cont[path].stato, status: M.cont[path].stato === "ERROR" ? "2207026" : undefined });
    if (/^M\d+$/.test(path)) return risp({ permalink: `https://www.instagram.com/p/${path}/` });
    if (path === "PAG1/photos") {
      const id = "F" + ++M.n;
      if (p.get("published") === "false") { M.fbNonPubbl.push({ id, url: p.get("url") }); return risp({ id }); }
      M.fbPost.push({ id: `PAG1_${id}`, message: p.get("message"), urls: [p.get("url")] }); return risp({ id, post_id: `PAG1_${id}` });
    }
    if (path === "PAG1/feed" && metodo === "POST") {
      const att = [...p.keys()].filter((k) => /^attached_media\[\d+\]$/.test(k)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]).map((k) => JSON.parse(p.get(k)).media_fbid);
      if (att.some((f) => !M.fbNonPubbl.find((x) => x.id === f))) return risp({ error: { code: 100, message: "media_fbid sconosciuto" } }, 400);
      const id = "PAG1_P" + ++M.n; M.fbPost.push({ id, message: p.get("message"), urls: att.map((f) => M.fbNonPubbl.find((x) => x.id === f).url) }); return risp({ id });
    }
    if (path === "PAG1/photo_stories" && metodo === "POST") {
      const f = M.fbNonPubbl.find((x) => x.id === p.get("photo_id"));
      if (!f) return risp({ error: { code: 100, message: "photo_id sconosciuto" } }, 400);
      if (f.usata) return risp({ error: { code: 100, message: "foto già usata" } }, 400);
      f.usata = true; (M.fbStorie ||= []).push({ id: "S" + ++M.n, url: f.url }); return risp({ success: true, post_id: "S" + M.n });
    }
    if (/^PAG1_[FP]\d+$/.test(path)) return risp({ permalink_url: `https://www.facebook.com/${path}` });
    return risp({ error: { code: 100, message: "percorso sconosciuto " + path } }, 400);
  };
  const righe = []; let seq = 0;
  const pausa = () => new Promise((r) => setTimeout(r, 2));
  M.righe = righe;
  M.db = {
    async inserisci(r) { const dop = righe.some((x) => x.chiave === r.chiave); const riga = dop ? null : { id: ++seq, tentativi: 0, ...r }; if (riga) righe.push(riga); await pausa(); return dop ? { doppia: true } : { riga: { ...riga } }; },
    async perChiave(k) { const r = righe.find((x) => x.chiave === k); return r ? { ...r } : null; },
    async perId(id) { const r = righe.find((x) => x.id === id); return r ? { ...r } : null; },
    async aggiorna(id, c) { Object.assign(righe.find((x) => x.id === id), c); },
    async aggiornaSe(id, stati, c) { const r = righe.find((x) => x.id === id); if (!r || !stati.includes(r.stato)) return false; Object.assign(r, c); return true; },
    async prenota(id) {            // come social_prenota: UN update condizionato
      const r = righe.find((x) => x.id === id);
      const dovuto = (x) => x && x.stato === "in_attesa" && Date.parse(x.prossimo_tentativo || x.programmato_per) <= M.ora + 60e3;
      if (ROMPI) { const ok = dovuto(r); await pausa(); if (!ok) return { esito: "niente" }; r.stato = "in_invio"; r.tentativi++; return { esito: "prenotato", post: { ...r } }; }
      if (!dovuto(r)) { await pausa(); return { esito: "niente" }; }
      r.stato = "in_invio"; r.tentativi++; const copia = { ...r }; await pausa(); return { esito: "prenotato", post: copia };
    },
    async dovuti() { return righe.filter((x) => x.stato === "in_attesa" && Date.parse(x.prossimo_tentativo || x.programmato_per) <= M.ora + 60e3).map((x) => x.id); },
    async avvisa(id, t) { M.avvisi.push({ id, t }); },
  };
  M.d = { fetch: M.fetch, token: "TOKEN", db: M.db, attendi: async () => {}, ora: () => M.ora };
  M.postMeta = () => M.chiamate.filter((c) => c.metodo === "POST" && !c.path.includes("github"));
  return M;
}
const iso = (ms) => new Date(ms).toISOString();
const corpo = (o = {}) => ({ chiave: uuid(), gara_id: 208, files: ["01-g.jpg"], versione: GEN, didascalia: "Classifica #DHN", piattaforme: ["instagram", "facebook"], ...o });
async function programma(M, o = {}, chi = utente) { return L.pubblicaOra(M.d, corpo({ quando: iso(M.ora + 10 * 60e3 + 17e3), ...o }), chi); }

const prove = [];
const prova = (nome, f) => prove.push([nome, f]);

prova("programma a +1 min: 400, nessuna riga", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ quando: iso(T0 + 60e3) }), utente);
  return r.http === 400 && /2 minuti/.test(r.esito.errore) && M.righe.length === 0;
});
prova("programma a +61 giorni: 400", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ quando: iso(T0 + 61 * 86400e3) }), utente);
  return r.http === 400 && /60 giorni/.test(r.esito.errore);
});
prova("programma a +10 min: riga in_attesa AL MINUTO, impronta salvata, ZERO chiamate POST a Meta", async () => {
  const M = mondo(); const r = await programma(M); const x = M.righe[0];
  return r.http === 200 && r.esito.programmato && x.stato === "in_attesa" && x.programmato_per === iso(T0 + 10 * 60e3)
    && x.impronta_dati === "IMP1" && x.tentativi === 0 && M.postMeta().length === 0;
});
prova("programma con token scaduto (190): 503, nessuna riga (non si programma su un token morto)", async () => {
  const M = mondo({ guasti: { "190": { volte: 9 } } }); const r = await programma(M);
  return r.http === 503 && M.righe.length === 0;
});
prova("carosello: 11 grafiche → 400; la stessa due volte → 400", async () => {
  const M = mondo();
  const a = await programma(M, { files: MAN.voci.slice(0, 11).map((v) => v.file) });
  const b = await programma(M, { files: ["01-g.jpg", "01-g.jpg"] });
  return a.http === 400 && /10/.test(a.esito.errore) && b.http === 400 && /due volte/.test(b.esito.errore) && M.righe.length === 0;
});
prova("carosello con una 1080x1920 dentro: 400", async () => {
  const M = mondo(); const r = await programma(M, { files: ["01-g.jpg", "99-g.jpg"] }); return r.http === 400;
});
prova("sveglia PRIMA dell'ora: niente parte", async () => {
  const M = mondo(); await programma(M); M.ora = T0 + 5 * 60e3;
  const r = await L.scatta(M.d, 1); return r.esiti[0].esito === "niente" && M.igPost.length === 0 && M.righe[0].stato === "in_attesa";
});
prova("sveglia all'ora: pubblicato, 1 post IG + 1 FB, uscito_il, account scritto", async () => {
  const M = mondo(); await programma(M); M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1); const x = M.righe[0];
  return r.esiti[0].esito === "pubblicato" && M.igPost.length === 1 && M.fbPost.length === 1 && x.uscito_il === iso(M.ora)
    && x.ig_permalink && x.fb_permalink && x.account?.ig_username === "dhnmultiverse" && x.tentativi === 1;
});
prova("DUE sveglie insieme sullo stesso post: UN post", async () => {
  const M = mondo(); await programma(M); M.ora = T0 + 10 * 60e3;
  await Promise.all([L.scatta(M.d, 1), L.scatta(M.d, 1), L.scatta(M.d, null)]);
  return M.igPost.length === 1 && M.fbPost.length === 1;
});
prova("sveglia su un post ANNULLATO: niente parte", async () => {
  const M = mondo(); await programma(M); M.righe[0].stato = "annullato"; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1); return r.esiti[0].esito === "niente" && M.postMeta().length === 0;
});
prova("carosello di 3: IG figli senza didascalia + CAROUSEL nell'ordine scelto; FB 3 foto non pubblicate + /feed; 1 post per parte", async () => {
  const M = mondo(); const files = ["05-g.jpg", "02-g.jpg", "09-g.jpg"];
  await programma(M, { files }); M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1);
  const ord = (urls) => urls.map((u) => decodeURIComponent(new URL(u).pathname.split("/").pop()));
  const ig = M.igPost[0], fb = M.fbPost[0];
  return M.igPost.length === 1 && M.fbPost.length === 1 && JSON.stringify(ord(ig.urls)) === JSON.stringify(files)
    && ig.caption === L.conLink("Classifica #DHN", "instagram") && JSON.stringify(ord(fb.urls)) === JSON.stringify(files) && fb.message === L.conLink("Classifica #DHN", "facebook")
    && M.righe[0].ig_figli?.length === 3 && M.righe[0].fb_foto_ids?.length === 3 && M.righe[0].stato === "pubblicato";
});
prova("carosello «Pubblica ora» (senza quando): esce subito", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ files: ["01-g.jpg", "02-g.jpg"] }), utente);
  return r.esito.post.stato === "pubblicato" && M.igPost[0].urls.length === 2 && M.fbPost[0].urls.length === 2;
});
prova("grafiche rifatte con gli STESSI dati: esce, con le immagini NUOVE (?v= nuova), nota scritta", async () => {
  const M = mondo(); await programma(M); M.man = { ...MAN, generato: GEN2 }; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "pubblicato" && M.igPost[0].urls[0].includes(encodeURIComponent(GEN2)) && /stessi dati/.test(M.righe[0].nota) && M.righe[0].versione_grafica === GEN2;
});
prova("grafiche rifatte con dati DIVERSI: NON esce, da_ricontrollare + avviso", async () => {
  const M = mondo(); await programma(M); M.man = { ...MAN, generato: GEN2, impronta_dati: "IMP2" }; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "da_ricontrollare" && M.postMeta().length === 0 && M.avvisi.length === 1;
});
prova("grafica sparita dal manifesto: NON esce, da_ricontrollare + avviso", async () => {
  const M = mondo(); await programma(M, { files: ["03-g.jpg"] }); M.man = { ...MAN, voci: MAN.voci.filter((v) => v.file !== "03-g.jpg") }; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1); return r.esiti[0].esito === "da_ricontrollare" && M.avvisi.length === 1 && M.postMeta().length === 0;
});
prova("Meta giù (500 sul GET): riprova fra 15 min, 3 tentativi, POI errore + UN avviso", async () => {
  const M = mondo(); await programma(M); M.guasti.me500 = { volte: 3 }; M.ora = T0 + 10 * 60e3;
  const a = await L.scatta(M.d, 1); const x = M.righe[0];
  const ok1 = a.esiti[0].esito === "in_attesa" && x.prossimo_tentativo === iso(M.ora + 15 * 60e3) && M.avvisi.length === 0;
  M.ora += 15 * 60e3; await L.scatta(M.d, 1); M.ora += 15 * 60e3; const c = await L.scatta(M.d, 1);
  return ok1 && c.esiti[0].esito === "errore" && x.tentativi === 3 && M.avvisi.length === 1 && M.postMeta().length === 0;
});
prova("GitHub Pages giù al momento di partire: riprova (non da_ricontrollare)", async () => {
  const M = mondo(); await programma(M); M.guasti.pages = { volte: 1 }; M.ora = T0 + 10 * 60e3;
  const a = await L.scatta(M.d, 1); M.ora += 15 * 60e3; const b = await L.scatta(M.d, 1);
  return a.esiti[0].esito === "in_attesa" && b.esiti[0].esito === "pubblicato" && M.igPost.length === 1;
});
prova("troppe richieste (codice 4) al primo tentativo, poi ok: UN post in tutto", async () => {
  const M = mondo(); await programma(M, { piattaforme: ["instagram"] }); M.guasti.rate = { volte: 1 }; M.ora = T0 + 10 * 60e3;
  const a = await L.scatta(M.d, 1); M.ora += 15 * 60e3; const b = await L.scatta(M.d, 1);
  return a.esiti[0].esito === "in_attesa" && b.esiti[0].esito === "pubblicato" && M.igPost.length === 1 && M.righe[0].tentativi === 2;
});
prova("token scaduto (190) all'ora: errore SUBITO, avviso, nessun ritentativo", async () => {
  const M = mondo(); await programma(M); M.guasti["190"] = { volte: 99 }; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "errore" && /190/.test(M.righe[0].errore) && !M.righe[0].prossimo_tentativo && M.avvisi.length === 1;
});
prova("rete che cade su media_publish: INCERTO, avviso, MAI ritentato da solo", async () => {
  const M = mondo(); await programma(M, { piattaforme: ["instagram"] }); M.guasti.publishRete = { volte: 1 }; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1); M.ora += 20 * 60e3; const r2 = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "incerto" && M.avvisi.length === 1 && r2.esiti[0].esito === "niente" && M.righe[0].ig_container;
});
prova("contenitore IG in ERROR + FB ok: PARZIALE, avviso, niente ritentativo (FB non si rifà)", async () => {
  const M = mondo({ statoIG: "ERROR" }); await programma(M); M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "parziale" && M.fbPost.length === 1 && M.avvisi.length === 1 && !M.righe[0].prossimo_tentativo;
});
prova("tetto Instagram 100/100 all'ora: riprova fra 15 min, niente post", async () => {
  const M = mondo({ usati: 100 }); await programma(M); M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1); return r.esiti[0].esito === "in_attesa" && M.postMeta().length === 0;
});
prova("post di PROVA: tutto il giro, ZERO POST a Meta, nota PROVA col token letto", async () => {
  const M = mondo(); await programma(M); M.righe[0].prova = true; M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, 1);
  return r.esiti[0].esito === "pubblicato" && M.postMeta().length === 0 && /PROVA/.test(M.righe[0].nota) && /dhnmultiverse/.test(M.righe[0].nota);
});
prova("sveglia senza id: parte SOLO ciò che è dovuto", async () => {
  const M = mondo(); await programma(M); await programma(M, { quando: iso(T0 + 60 * 60e3) }); M.ora = T0 + 10 * 60e3;
  const r = await L.scatta(M.d, null);
  return r.esiti.length === 1 && M.righe[0].stato === "pubblicato" && M.righe[1].stato === "in_attesa";
});
prova("riconferma: post fermo + versione nuova vista → in_attesa con immagini nuove", async () => {
  const M = mondo(); await programma(M); M.man = { ...MAN, generato: GEN2, impronta_dati: "IMP2" }; M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1);
  const r = await L.riconferma(M.d, { id: 1, versione: GEN2, quando: iso(M.ora + 30 * 60e3) }, utente); const x = M.righe[0];
  return r.http === 200 && x.stato === "in_attesa" && x.versione_grafica === GEN2 && x.impronta_dati === "IMP2" && x.tentativi === 0 && x.immagini[0].url.includes(encodeURIComponent(GEN2));
});
prova("riconferma con la versione VECCHIA: 409", async () => {
  const M = mondo(); await programma(M); M.man = { ...MAN, generato: GEN2, impronta_dati: "IMP2" }; M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1);
  const r = await L.riconferma(M.d, { id: 1, versione: GEN, quando: iso(M.ora + 30 * 60e3) }, utente); return r.http === 409 && M.righe[0].stato === "da_ricontrollare";
});
prova("riconferma di un post di UN ALTRO admin: 403 (il superadmin sì)", async () => {
  const M = mondo(); await programma(M, {}, admin2); M.man = { ...MAN, generato: GEN2, impronta_dati: "IMP2" }; M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1);
  const altro = { id: "U-X", email: "x@x", ruolo: "admin" };
  const a = await L.riconferma(M.d, { id: 1, versione: GEN2, quando: iso(M.ora + 30 * 60e3) }, altro);
  const b = await L.riconferma(M.d, { id: 1, versione: GEN2, quando: iso(M.ora + 30 * 60e3) }, utente);
  return a.http === 403 && b.http === 200;
});
prova("riconferma di un post ancora in_attesa: 409 (si sposta, non si riconferma)", async () => {
  const M = mondo(); await programma(M); const r = await L.riconferma(M.d, { id: 1, versione: GEN, quando: iso(T0 + 30 * 60e3) }, utente);
  return r.http === 409;
});
prova("stessa chiave di programmazione due volte: UNA riga", async () => {
  const M = mondo(); const k = uuid();
  await Promise.all([programma(M, { chiave: k }), programma(M, { chiave: k })]); return M.righe.length === 1;
});
prova("«Pubblica ora» singolo come in FASE 3 (file al posto di files): pubblicato", async () => {
  const M = mondo(); const c = corpo(); delete c.files; c.file = "01-g.jpg";
  const r = await L.pubblicaOra(M.d, c, utente); return r.esito.post.stato === "pubblicato" && M.igPost.length === 1;
});

prova("link al sito: FB cliccabile (https) e IG «link in bio», PRIMA degli hashtag", async () => {
  const t = "Classifica ROOKIE dopo Spa\n\n#DHNChampionship #F125 #simracing";
  const fb = L.conLink(t, "facebook"), ig = L.conLink(t, "instagram");
  return fb === "Classifica ROOKIE dopo Spa\n\n🌐 Risultati e classifiche: https://dhn-multiverse.com\n\n#DHNChampionship #F125 #simracing"
    && ig === "Classifica ROOKIE dopo Spa\n\n🔗 Risultati e classifiche: link in bio · dhn-multiverse.com\n\n#DHNChampionship #F125 #simracing";
});
prova("link al sito: se c'è già non si raddoppia; spento dall'admin non si mette", async () => {
  const t = "Vedi dhn-multiverse.com #DHN";
  return L.conLink(t, "facebook") === t && L.conLink("Ciao", "instagram", false) === "Ciao" && L.conLink("Ciao", "facebook") === "Ciao\n\n🌐 Risultati e classifiche: https://dhn-multiverse.com";
});
prova("link al sito: arriva DAVVERO a Meta (IG caption e FB message) e si salva link_sito", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ didascalia: "Podio\n\n#DHN" }), utente);
  return /link in bio/.test(M.igPost[0].caption) && /https:\/\/dhn-multiverse\.com/.test(M.fbPost[0].message) && M.righe[0].link_sito === true && M.righe[0].didascalia === "Podio\n\n#DHN";
});
prova("link al sito spento (link_sito:false): niente coda su IG né FB", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, corpo({ didascalia: "Podio", link_sito: false }), utente);
  return M.igPost[0].caption === "Podio" && M.fbPost[0].message === "Podio";
});
prova("didascalia da 2190 caratteri: rifiutata perché CON il link supera 2200", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ didascalia: "x".repeat(2190) }), utente);
  return r.http === 400 && /con il link/.test(r.esito.errore) && M.righe.length === 0;
});

/* ------------------------------------------------------------ FASE 5: storie */
const storia = (o = {}) => corpo({ formato: "storia", files: ["02-g.jpg"], didascalia: "questa NON deve arrivare a Meta", ...o });
prova("STORIA ora: 1 storia IG (media_type STORIES, SENZA caption) + 1 storia FB, zero post nel feed", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, storia(), utente);
  const c = M.chiamate.find((x) => x.path.endsWith("IG1/media") && x.metodo === "POST");
  return r.esito.post?.stato === "pubblicato" && (M.igStorie || []).length === 1 && (M.fbStorie || []).length === 1
    && M.igPost.length === 0 && M.fbPost.length === 0 && c.p.media_type === "STORIES" && !("caption" in c.p);
});
prova("STORIA: l'immagine mandata è la 1080x1920 in storie/ (non il post), con la / non codificata", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, storia(), utente);
  const u = (M.igStorie || [])[0]?.urls[0] || ""; const f = (M.fbStorie || [])[0]?.url || "";
  return /\/gare\/208\/storie\/02-g\.jpg\?v=/.test(u) && u === f && M.righe[0].immagini[0].file === "02-g.jpg";
});
prova("STORIA: riga con formato «storia», didascalia vuota, link_sito false", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, storia(), utente); const x = M.righe[0];
  return x.formato === "storia" && x.didascalia === "" && x.link_sito === false;
});
prova("STORIA di due grafiche: 400 (niente carosello), nessuna riga", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, storia({ files: ["01-g.jpg", "02-g.jpg"] }), utente);
  return r.http === 400 && /carosello/.test(r.esito.errore) && M.righe.length === 0;
});
prova("STORIA di una grafica senza storia nel manifesto (resa vecchia): 404 che dice «Rifai grafiche»", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, storia({ files: ["11-g.jpg"] }), utente);
  return r.http === 404 && /Rifai grafiche/.test(r.esito.errore) && M.righe.length === 0;
});
prova("STORIA con la storia del manifesto NON 9:16: 400", async () => {
  const M = mondo({ man: { ...MAN, voci: MAN.voci.map((v) => v.file === "02-g.jpg" ? { ...v, storia: { ...v.storia, altezza: 1350 } } : v) } });
  const r = await L.pubblicaOra(M.d, storia(), utente); return r.http === 400 && /9:16/.test(r.esito.errore);
});
prova("formato sconosciuto: 400", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.d, corpo({ formato: "reel" }), utente); return r.http === 400 && /formato/.test(r.esito.errore);
});
prova("POST senza formato: come prima (feed, con didascalia)", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, corpo(), utente);
  return M.igPost.length === 1 && !(M.igStorie || []).length && (M.righe[0].formato ?? "post") === "post";
});
prova("STORIA programmata: esce all'ora come storia, una volta sola anche con due sveglie", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, storia({ quando: iso(M.ora + 10 * 60e3) }), utente); M.ora = T0 + 10 * 60e3;
  await Promise.all([L.scatta(M.d, 1), L.scatta(M.d, 1)]);
  return M.righe[0].stato === "pubblicato" && (M.igStorie || []).length === 1 && (M.fbStorie || []).length === 1 && M.igPost.length === 0;
});
prova("STORIA programmata, grafiche rifatte con gli STESSI dati: esce con la storia NUOVA", async () => {
  const M = mondo(); await L.pubblicaOra(M.d, storia({ quando: iso(M.ora + 10 * 60e3) }), utente);
  M.man = { ...MAN, generato: GEN2 }; M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1);
  return M.righe[0].stato === "pubblicato" && (M.igStorie || [])[0]?.urls[0].includes(encodeURIComponent(GEN2)) && /storie\//.test(M.igStorie[0].urls[0]);
});
prova("STORIA: Meta giù sul publish (rete) → incerto, mai ritentata da sola", async () => {
  const M = mondo({ guasti: { publishRete: { volte: 1 } } }); await L.pubblicaOra(M.d, storia({ quando: iso(M.ora + 10 * 60e3), piattaforme: ["instagram"] }), utente);
  M.ora = T0 + 10 * 60e3; await L.scatta(M.d, 1); M.ora += 20 * 60e3; await L.scatta(M.d, 1);
  return M.righe[0].stato === "incerto" && (M.igStorie || []).length === 0 && M.avvisi.length === 1;
});

let ok = 0, no = 0;
for (const [nome, f] of prove) {
  let v = false, err = "";
  try { v = await f(); } catch (e) { err = " — " + (e?.stack || e); }
  if (v) ok++; else no++;
  console.log(`${v ? "  ok" : "  NO"}  ${nome}${err}`);
}
console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO${ROMPI ? "   (--rompi: prenotazione NON atomica)" : ""}`);
process.exit(no ? 1 : 0);
