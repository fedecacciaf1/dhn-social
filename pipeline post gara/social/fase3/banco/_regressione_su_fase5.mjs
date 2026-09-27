/* Banco FASE 3 — la logica della Edge Function `social` contro un Meta FINTO.
   node --experimental-strip-types banco_social_fase3.mjs [--rompi]
   --rompi toglie la chiave UNIQUE al database finto: le prove sul doppio clic
   DEVONO diventare rosse (se restano verdi, il banco non vede i doppioni). */
import * as L from "../../fase5/funzione/logica.ts";

const ROMPI = process.argv.includes("--rompi");
const GEN = "2026-09-27T10:38:02.000Z";
const MAN = { generato: GEN, gara_id: 210, voci: [
  { codice: "02", titolo: "VINCITORE", file: "02_vincitore.jpg", larghezza: 1080, altezza: 1350 },
  { codice: "99", titolo: "STORIA", file: "99_storia.jpg", larghezza: 1080, altezza: 1920 },
] };

function mondo(o = {}) {
  const M = { contenitori: {}, igPost: [], fbPost: [], chiamate: [], n: 0, ...o };
  const risp = (corpo, status = 200, tipo = "application/json") => ({
    ok: status < 400, status, headers: { get: (k) => (k.toLowerCase() === "content-type" ? tipo : null) },
    json: async () => corpo,
  });
  M.fetch = async (url, init = {}) => {
    const u = new URL(url); const metodo = init.method || "GET";
    const p = metodo === "POST" ? new URLSearchParams(init.body) : u.searchParams;
    M.chiamate.push({ metodo, path: u.pathname, p: Object.fromEntries(p) });
    if (u.host === "fedecacciaf1.github.io") {
      if (u.pathname.endsWith("/manifesto.json")) return u.pathname.includes("/gare/210/") ? risp(M.man ?? MAN) : risp({}, 404);
      if (metodo === "HEAD") return M.immagine ?? risp(null, 200, "image/jpeg");
      return risp(null, 404);
    }
    const tok = p.get("access_token");
    if (M.token190 || tok !== "TOKEN-OK") return risp({ error: { code: 190, message: "Error validating access token" } }, 400);
    const path = u.pathname.replace("/v25.0/", "");
    if (path === "me") return risp({ id: "PAG1", name: "DHN Prova" });
    if (path === "PAG1") return risp(M.senzaIg ? {} : { instagram_business_account: { id: "IG1", username: "dhn_prova" } });
    if (path === "IG1/content_publishing_limit") return risp({ data: [{ quota_usage: M.usati ?? 3, config: { quota_total: 100 } }] });
    if (path === "IG1/media" && metodo === "POST") {
      if (!/^https:\/\/fedecacciaf1\.github\.io\/dhn-social\/gare\/210\/02_vincitore\.jpg\?v=/.test(p.get("image_url"))) return risp({ error: { code: 9004, message: "url strano" } }, 400);
      const id = "C" + ++M.n; M.contenitori[id] = { stato: M.statoIniziale ?? "FINISHED", attese: M.attese ?? 0 }; return risp({ id });
    }
    if (path === "IG1/media_publish") {
      if (M.publishRotto) throw new Error("socket hang up");
      const c = M.contenitori[p.get("creation_id")];
      if (!c || c.stato !== "FINISHED") return risp({ error: { code: 9007, message: "Media ID is not available" } }, 400);
      c.stato = "PUBLISHED"; const id = "M" + ++M.n; M.igPost.push({ id, caption: c }); return risp({ id });
    }
    if (M.contenitori[path]) {
      const c = M.contenitori[path];
      if (c.stato === "IN_PROGRESS" && c.attese-- <= 0) c.stato = "FINISHED";
      return risp({ status_code: c.stato, status: c.stato === "ERROR" ? "2207026: formato non supportato" : undefined });
    }
    if (/^M\d+$/.test(path)) return risp({ permalink: `https://www.instagram.com/p/${path}/` });
    if (path === "PAG1/photos") { const id = "F" + ++M.n; M.fbPost.push(id); return risp({ id, post_id: `PAG1_${id}` }); }
    if (/^PAG1_F\d+$/.test(path)) return risp({ permalink_url: `https://www.facebook.com/${path}` });
    return risp({ error: { code: 100, message: "percorso sconosciuto " + path } }, 400);
  };
  const righe = []; let seq = 0;
  M.db = {
    async inserisci(r) {
      // come un UNIQUE di Postgres: controllo e scrittura nello stesso passo, POI la latenza
      const doppia = !ROMPI && righe.some((x) => x.chiave === r.chiave);
      const riga = doppia ? null : { id: ++seq, ...r }; if (riga) righe.push(riga);
      await new Promise((ok) => setTimeout(ok, 5));
      return doppia ? { doppia: true } : { riga };
    },
    async perChiave(k) { return ROMPI ? null : righe.find((x) => x.chiave === k) || null; },
    async aggiorna(id, c) { Object.assign(righe.find((x) => x.id === id), c); },
  };
  M.righe = righe;
  M.dep = { fetch: M.fetch, token: M.senzaToken ? null : "TOKEN-OK", db: M.db, attendi: async () => { M.attesi = (M.attesi || 0) + 1; } };
  return M;
}
const U = { id: "u1", email: "fede@x" };
let chiaveN = 0;
const chiave = () => `00000000-0000-4000-8000-${String(++chiaveN).padStart(12, "0")}`;
const corpo = (x = {}) => ({ chiave: chiave(), gara_id: 210, file: "02_vincitore.jpg", versione: GEN,
  didascalia: "Vince Vincent SV a Spa. #DHN", piattaforme: ["instagram", "facebook"], ...x });

let ok = 0, no = 0;
const prova = async (nome, f) => {
  try { const r = await f(); if (r === true) { ok++; console.log("  ok  " + nome); } else { no++; console.log("  NO  " + nome + " → " + JSON.stringify(r)); } }
  catch (e) { no++; console.log("  NO  " + nome + " → eccezione " + e.stack); }
};

await prova("senza token: «Meta non collegato», niente chiamate a Meta", async () => {
  const M = mondo({ senzaToken: true }); const a = await L.leggiAccount(M.dep);
  return !a.collegato && /META_PAGE_TOKEN/.test(a.motivo) && M.chiamate.length === 0 || a;
});
await prova("stato: Pagina, Instagram e tetto letti dal SOLO token", async () => {
  const a = await L.leggiAccount(mondo().dep);
  return a.collegato && a.account.pagina_id === "PAG1" && a.account.ig_id === "IG1" && a.account.ig_username === "dhn_prova" && a.limite.usati === 3 || a;
});
await prova("pubblica IG+FB: 1 post per parte, link salvati, stato pubblicato", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.dep, corpo(), U); const p = r.esito.post;
  return r.http === 200 && M.igPost.length === 1 && M.fbPost.length === 1 && p.stato === "pubblicato"
    && p.ig_permalink.includes("instagram.com/p/") && p.fb_permalink.includes("facebook.com") && M.righe[0].ig_container === "C1" || { r, M: M.righe };
});
await prova("il contenitore IG è salvato PRIMA di media_publish", async () => {
  const M = mondo(); const orig = M.db.aggiorna; let visto = null;
  M.dep.db.aggiorna = async (id, c) => { if (c.ig_container && visto === null) visto = M.igPost.length; return orig(id, c); };
  await L.pubblicaOra(M.dep, corpo({ piattaforme: ["instagram"] }), U); return visto === 0 || visto;
});
await prova("stessa chiave due volte: UN post, la seconda risponde «ripetuta»", async () => {
  const M = mondo(); const c = corpo();
  await L.pubblicaOra(M.dep, c, U); const r2 = await L.pubblicaOra(M.dep, c, U);
  return M.igPost.length === 1 && M.fbPost.length === 1 && r2.esito.ripetuta === true && M.righe.length === 1 || { ig: M.igPost.length, fb: M.fbPost.length, righe: M.righe.length };
});
await prova("doppio clic SIMULTANEO (stessa chiave, in parallelo): UN post", async () => {
  const M = mondo(); const c = corpo();
  const [a, b] = await Promise.all([L.pubblicaOra(M.dep, c, U), L.pubblicaOra(M.dep, c, U)]);
  return M.igPost.length === 1 && M.fbPost.length === 1 && M.righe.length === 1 && (a.esito.ripetuta || b.esito.ripetuta) || { ig: M.igPost.length, fb: M.fbPost.length, righe: M.righe.length };
});
await prova("grafiche rifatte dopo l'apertura: 409, nessun post, nessuna riga", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.dep, corpo({ versione: "2026-09-26T00:00:00.000Z" }), U);
  return r.http === 409 && M.igPost.length + M.fbPost.length + M.righe.length === 0 || r;
});
await prova("file che non è nel manifesto: 404", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.dep, corpo({ file: "03_podio.jpg" }), U); return r.http === 404 && M.righe.length === 0 || r;
});
await prova("nome file con percorso (../) rifiutato prima di ogni rete", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.dep, corpo({ file: "../../x.jpg" }), U); return r.http === 400 && M.chiamate.length === 0 || r;
});
await prova("un url mandato dal browser viene ignorato: a Meta va quello di GitHub Pages", async () => {
  const M = mondo(); await L.pubblicaOra(M.dep, corpo({ url: "https://cattivo.example/x.jpg", image_url: "https://cattivo.example/x.jpg" }), U);
  const c = M.chiamate.find((x) => x.path.endsWith("/IG1/media"));
  return c && c.p.image_url.startsWith("https://fedecacciaf1.github.io/dhn-social/gare/210/02_vincitore.jpg?v=") || c;
});
await prova("formato storia 1080x1920 rifiutato (fuori 4:5–1.91)", async () => {
  const M = mondo(); const r = await L.pubblicaOra(M.dep, corpo({ file: "99_storia.jpg" }), U); return r.http === 400 && /0\.563/.test(r.esito.errore) || r;
});
await prova("didascalia di 2201 caratteri: 400", async () => {
  const r = await L.pubblicaOra(mondo().dep, corpo({ didascalia: "x".repeat(2201) }), U); return r.http === 400 || r;
});
await prova("didascalia di 2200 caratteri SENZA link al sito: passa (27/09: il tetto conta anche il link)", async () => {
  const r = await L.pubblicaOra(mondo().dep, corpo({ didascalia: "x".repeat(2200), link_sito: false }), U); return r.http === 200 || r;
});
await prova("31 hashtag: 400 · 30 hashtag: passa", async () => {
  const h = (n) => Array.from({ length: n }, (_, i) => "#h" + i).join(" ");
  const a = await L.pubblicaOra(mondo().dep, corpo({ didascalia: h(31) }), U);
  const b = await L.pubblicaOra(mondo().dep, corpo({ didascalia: h(30) }), U);
  return a.http === 400 && b.http === 200 || { a: a.http, b: b.http };
});
await prova("didascalia vuota: 400", async () => { const r = await L.pubblicaOra(mondo().dep, corpo({ didascalia: "  " }), U); return r.http === 400 || r; });
await prova("piattaforma sconosciuta: 400", async () => { const r = await L.pubblicaOra(mondo().dep, corpo({ piattaforme: ["tiktok"] }), U); return r.http === 400 || r; });
await prova("token scaduto (190): 503 «scaduto o revocato», nessuna riga", async () => {
  const M = mondo({ token190: true }); const r = await L.pubblicaOra(M.dep, corpo(), U);
  return r.http === 503 && /scaduto o revocato/.test(r.esito.errore) && M.righe.length === 0 || r;
});
await prova("immagine che GitHub non dà come JPEG: 502, nessun post", async () => {
  const M = mondo({ immagine: { ok: false, status: 404, headers: { get: () => "text/html" } } });
  const r = await L.pubblicaOra(M.dep, corpo(), U); return r.http === 502 && M.igPost.length === 0 && M.righe.length === 0 || r;
});
await prova("tetto Instagram 100/100: 429, nessun post", async () => {
  const M = mondo({ usati: 100 }); const r = await L.pubblicaOra(M.dep, corpo(), U); return r.http === 429 && M.righe.length === 0 || r;
});
await prova("contenitore IN_PROGRESS due giri, poi FINISHED: aspetta e pubblica", async () => {
  const M = mondo({ statoIniziale: "IN_PROGRESS", attese: 2 }); const r = await L.pubblicaOra(M.dep, corpo({ piattaforme: ["instagram"] }), U);
  return r.esito.post.stato === "pubblicato" && M.attesi >= 2 && M.igPost.length === 1 || { r, attesi: M.attesi };
});
await prova("contenitore ERROR su IG, FB ok: stato «parziale» col motivo", async () => {
  const M = mondo({ statoIniziale: "ERROR" }); const r = await L.pubblicaOra(M.dep, corpo(), U); const p = r.esito.post;
  return p.stato === "parziale" && M.igPost.length === 0 && M.fbPost.length === 1 && /Instagram: contenitore Instagram ERROR/.test(p.errore) || p;
});
await prova("rete che cade su media_publish: stato «incerto», contenitore salvato", async () => {
  const M = mondo({ publishRotto: true }); const r = await L.pubblicaOra(M.dep, corpo({ piattaforme: ["instagram"] }), U); const p = r.esito.post;
  return p.stato === "incerto" && M.righe[0].ig_container === "C1" || p;
});
await prova("ritentare su un contenitore già PUBLISHED non ripubblica", async () => {
  const M = mondo(); M.contenitori.C7 = { stato: "PUBLISHED" };
  const r = await L.pubblicaInstagram(M.dep, "IG1", "u", "d", async () => {}, "C7");
  return r.gia_pubblicato === true && M.igPost.length === 0 && !M.chiamate.some((c) => c.path.endsWith("media_publish")) || r;
});
await prova("Pagina senza Instagram: IG rifiutato (400), solo Facebook passa", async () => {
  const M = mondo({ senzaIg: true });
  const a = await L.pubblicaOra(M.dep, corpo(), U); const b = await L.pubblicaOra(M.dep, corpo({ piattaforme: ["facebook"] }), U);
  return a.http === 400 && b.esito.post.stato === "pubblicato" && M.fbPost.length === 1 || { a, b };
});
await prova("il token non compare mai nella risposta all'admin", async () => {
  const r = await L.pubblicaOra(mondo().dep, corpo(), U); return !JSON.stringify(r).includes("TOKEN-OK") || "token nella risposta";
});

console.log(`\n${no ? "ROSSO" : "VERDE"} — ${ok} ok / ${no} NO${ROMPI ? "  (--rompi: chiave UNIQUE tolta)" : ""}`);
process.exit(no ? 1 : 0);
