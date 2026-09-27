/* BANCO della storia a cornice — sui PNG VERI di posta.mjs (post 1080x1350).
   Uso: node "pipeline post gara/social/storia/banco_storia.mjs" CARTELLA_PNG [--rompi]
   Chiede «scrive la cosa giusta?», non «si accende?»:
     - misure 1080x1920 lette dall'intestazione del JPEG;
     - il post c'è INTERO e non deformato: confronto pixel con il post scalato;
     - la zona coperta dall'app (0..269 e 1580..1919) è IDENTICA al fondo:
       nessun pezzo di grafica ci finisce sotto;
     - un PNG non 4:5 (la storia vecchia 1080x1920) viene RIFIUTATO;
     - senza fondo: errore che dice cosa manca.
   --rompi sposta il post di 70 px in su: deve diventare ROSSO sulla zona. */
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { faiStoria, FONDO } from "./componi.mjs";
import { STORIA } from "./geometria.mjs";
import { misuraImmagine } from "../misure.mjs";

const CART = process.argv[2]; const ROMPI = process.argv.includes("--rompi");
let ok = 0, no = 0;
const prova = (nome, esito, info = "") => { esito ? ok++ : no++; console.log(`${esito ? "ok " : "NO "} ${nome}${info ? " — " + info : ""}`); };
const raw = async (f, box) => sharp(f).extract(box).removeAlpha().raw().toBuffer();
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const P = STORIA.post;

const posts = readdirSync(CART).filter(f => /-post\.png$/.test(f)).slice(0, 6);
const dest = mkdtempSync(join(tmpdir(), "storia-"));
for (const f of posts) {
  const nome = f.replace(/\.png$/, ".jpg");
  let st;
  if (!ROMPI) st = await faiStoria(join(CART, f), dest, nome);
  else {   // la cornice «sbagliata»: stesso post, 70 px più in alto
    const post = await sharp(join(CART, f)).resize(P.larghezza, P.altezza, { fit: "fill" }).png().toBuffer();
    const { mkdirSync } = await import("node:fs"); mkdirSync(join(dest, "storie"), { recursive: true });
    await sharp(FONDO).composite([{ input: post, left: P.left, top: P.top - 70 }]).flatten().jpeg({ quality: 90 }).toFile(join(dest, "storie", nome));
    st = { file: `storie/${nome}` };
  }
  const out = join(dest, st.file);
  const m = misuraImmagine(out);
  prova(`${nome}: 1080x1920 dall'intestazione`, m.larghezza === 1080 && m.altezza === 1920, `${m.larghezza}x${m.altezza}`);
  const atteso = await sharp(join(CART, f)).flatten({ background: "#000" }).resize(P.larghezza, P.altezza, { fit: "fill" })
    .extract({ left: 40, top: 40, width: P.larghezza - 80, height: P.altezza - 80 }).removeAlpha().raw().toBuffer();
  const vero = await raw(out, { left: P.left + 40, top: P.top + 40, width: P.larghezza - 80, height: P.altezza - 80 });
  const d = diff(atteso, vero);
  prova(`${nome}: post intero e non deformato`, d < 4, `scarto medio ${d.toFixed(2)} (JPEG q90 sta sotto 4)`);
  const fondoAlto = await raw(FONDO, { left: 0, top: 0, width: 1080, height: STORIA.zona_alto });
  const outAlto = await raw(out, { left: 0, top: 0, width: 1080, height: STORIA.zona_alto });
  const fondoBasso = await raw(FONDO, { left: 0, top: 1920 - STORIA.zona_basso, width: 1080, height: STORIA.zona_basso });
  const outBasso = await raw(out, { left: 0, top: 1920 - STORIA.zona_basso, width: 1080, height: STORIA.zona_basso });
  const da = diff(fondoAlto, outAlto), db = diff(fondoBasso, outBasso);
  prova(`${nome}: niente grafica sotto la barra in ALTO`, da < 2, `scarto dal fondo ${da.toFixed(2)}`);
  prova(`${nome}: niente grafica sotto «Invia messaggio» in BASSO`, db < 2, `scarto dal fondo ${db.toFixed(2)}`);
}
if (!ROMPI) {
  const storiaVecchia = readdirSync(CART).find(f => /-storia\.png$/.test(f));
  if (storiaVecchia) {
    let rif = null; try { await faiStoria(join(CART, storiaVecchia), dest, "x.jpg"); } catch (e) { rif = e.message; }
    prova("un PNG 1080x1920 (non 4:5) viene rifiutato", !!rif && /4:5/.test(rif), rif || "ACCETTATO");
  }
  let senza = null; try { await faiStoria(join(CART, posts[0]), dest, "y.jpg", "/non/esiste.png"); } catch (e) { senza = e.message; }
  prova("senza fondo: errore che dice cosa manca", !!senza && /fondo/.test(senza), senza || "nessun errore");
}
console.log(`\n${ok} ok / ${no} NO · file in ${dest}`);
process.exit(no ? 1 : 0);
