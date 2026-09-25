#!/usr/bin/env node
/* ===========================================================================
   PREPARA — dalle immagini di una gara al PACCHETTO da pubblicare.
   12/09/2026

   Cosa fa
     1. guarda i file veri (misure e formato letti dall'INTESTAZIONE, non dal
        nome) e li passa alle REGOLE META verificate il 12/09;
     2. scrive `anteprima.html`: la pagina che Fede APRE E GUARDA prima che
        parta qualsiasi cosa — immagine, didascalia, dove va, e il verdetto;
     3. scrive `manifesto.json`, l'unica cosa che il pubblicatore legge.

   ⚠ NON pubblica niente. La pubblicazione e' un secondo comando, apposta:
   fra il «vedo» e il «va online» ci deve stare una decisione umana.

   Uso:
     node social/prepara.mjs <cartella-immagini> [--url https://.../social/174]

   `--url` e' la base pubblica da cui Meta andra' a prendere le immagini
   (Instagram NON accetta un caricamento: vuole un URL). Senza, il manifesto
   si scrive lo stesso e l'anteprima segnala che manca.
   =========================================================================== */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { misuraImmagine } from "./misure.mjs";
import { componiDidascalie } from "./didascalie.mjs";
import { REGOLE, controllaImmagine, controllaDidascalia } from "./regole_meta.mjs";

const args = process.argv.slice(2);
const cartella = args.find(a => !a.startsWith("--"));
const baseUrl = (args.find(a => a.startsWith("--url=")) || "").slice(6)
  || (args.includes("--url") ? args[args.indexOf("--url") + 1] : "");

if (!cartella) {
  console.error("uso: node social/prepara.mjs <cartella> [--url https://...]");
  process.exit(2);
}

/* ---------------------------------------------------------------------------
   DUE SORGENTI PER LA DIDASCALIA, e la mano di Fede vince.
     1. `sessione.json` nella cartella -> le didascalie si GENERANO dai dati
        (vedi didascalie.mjs). E' la via normale: zero scrittura a mano.
     2. `didascalie.json` -> correzioni, una per file. Quello che c'e' qui
        SOSTITUISCE il generato, solo per i file che nomina.
   Cosi' correggere una didascalia non fa perdere le altre otto, e rigenerare
   non cancella la correzione.
   L'aggancio fra didascalia e immagine e' il nome senza estensione:
   `01-risultato.jpg` <- chiave `01-risultato`.
   --------------------------------------------------------------------------- */
const fSess = join(cartella, "sessione.json");
const GEN = existsSync(fSess)
  ? componiDidascalie(JSON.parse(readFileSync(fSess, "utf8"))) : {};
const fDid = join(cartella, "didascalie.json");
const MANO = existsSync(fDid) ? JSON.parse(readFileSync(fDid, "utf8")) : {};

const senzaEst = f => f.replace(/\.[^.]+$/, "");
function didascaliaDi(nome) {
  if (MANO[nome] !== undefined) return { testo: MANO[nome], da: "corretta a mano" };
  const k = senzaEst(nome);
  if (MANO[k] !== undefined) return { testo: MANO[k], da: "corretta a mano" };
  if (GEN[k] !== undefined) return { testo: GEN[k], da: "generata dai dati" };
  return { testo: "", da: existsSync(fSess) ? "nessuna (dati insufficienti)"
                                            : "nessuna (manca sessione.json)" };
}

const IMG = readdirSync(cartella)
  .filter(f => /\.(jpe?g|png)$/i.test(f)).sort();

const voci = IMG.map(nome => {
  const m = misuraImmagine(join(cartella, nome));
  const { testo: did, da: origine } = didascaliaDi(nome);
  const ig = controllaImmagine({ nome, ...m }, "instagram");
  const fb = controllaImmagine({ nome, ...m }, "facebook");
  const dIg = controllaDidascalia(did, "instagram");
  return {
    nome, ...m, didascalia: did, origine,
    url: baseUrl ? `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(nome)}` : null,
    instagram: { ok: ig.ok && dIg.ok, problemi: [...ig.problemi, ...dIg.problemi] },
    facebook: { ok: fb.ok && !!did.trim(),
                problemi: [...fb.problemi, ...(did.trim() ? [] : ["didascalia vuota"])] },
  };
});

writeFileSync(join(cartella, "manifesto.json"),
  JSON.stringify({ generato: new Date().toISOString(), base_url: baseUrl || null,
                   regole_verificate_il: REGOLE.verificate_il, voci }, null, 2));

/* ---------------------------------------------------------------- anteprima */
const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const riga = v => `
<article class="c ${v.instagram.ok && v.facebook.ok ? "" : "ko"}">
  <img src="${esc(v.nome)}" alt="">
  <div class="d">
    <h2>${esc(v.nome)}</h2>
    <p class="m">${v.larghezza}×${v.altezza} · .${v.ext} · ${(v.byte/1024).toFixed(0)} KB
       · proporzione ${(v.larghezza / v.altezza).toFixed(3)}
       · didascalia <b>${esc(v.origine)}</b></p>
    <pre class="t">${esc(v.didascalia) || '<span class="vuota">— nessuna didascalia —</span>'}</pre>
    ${["instagram", "facebook"].map(d => `
      <div class="e ${v[d].ok ? "si" : "no"}">
        <b>${d}</b> ${v[d].ok ? "pronto" : "BLOCCATO"}
        ${v[d].problemi.length ? "<ul>" + v[d].problemi.map(p => `<li>${esc(p)}</li>`).join("") + "</ul>" : ""}
      </div>`).join("")}
    ${v.url ? `<p class="u">${esc(v.url)}</p>`
            : `<p class="u no">⚠ manca --url: Instagram non puo' andare a prenderla</p>`}
  </div>
</article>`;

const nIg = voci.filter(v => v.instagram.ok).length;
const nFb = voci.filter(v => v.facebook.ok).length;

writeFileSync(join(cartella, "anteprima.html"), `<!doctype html>
<meta charset="utf-8"><title>Anteprima post — ${esc(basename(cartella))}</title>
<style>
 :root{--f:#0f1115;--c:#171a21;--b:#272c37;--t:#e8eaf0;--g:#8b93a7;
       --si:#2ecc71;--no:#ff5b5b}
 *{box-sizing:border-box} body{margin:0;padding:24px;background:var(--f);
   color:var(--t);font:14px/1.5 system-ui,Segoe UI,sans-serif}
 h1{font-size:20px;margin:0 0 4px} .sot{color:var(--g);margin:0 0 20px}
 .c{display:flex;gap:18px;background:var(--c);border:1px solid var(--b);
    border-radius:12px;padding:14px;margin-bottom:14px}
 .c.ko{border-color:#5a2330}
 .c img{width:200px;height:auto;border-radius:8px;background:#000;flex:0 0 auto}
 .d{min-width:0;flex:1} h2{font-size:15px;margin:0 0 2px}
 .m{color:var(--g);margin:0 0 10px;font-size:12px}
 .t{white-space:pre-wrap;background:#0c0e13;border:1px solid var(--b);
    border-radius:8px;padding:10px;margin:0 0 10px;font:13px/1.5 inherit}
 .vuota{color:var(--g)}
 .e{margin:0 0 6px;font-size:13px} .e.si b{color:var(--si)} .e.no b{color:var(--no)}
 .e ul{margin:4px 0 0 18px;color:var(--no)}
 .u{color:var(--g);font-size:12px;word-break:break-all;margin:8px 0 0}
 .u.no{color:var(--no)}
 @media(max-width:700px){.c{flex-direction:column}.c img{width:100%}}
</style>
<h1>Anteprima post — ${esc(basename(cartella))}</h1>
<p class="sot">${voci.length} immagini · Instagram pronte <b>${nIg}</b>/${voci.length}
 · Facebook pronte <b>${nFb}</b>/${voci.length}
 · regole Meta verificate il ${REGOLE.verificate_il}</p>
${voci.map(riga).join("")}
<p class="sot">Per correggere una didascalia: scrivila in
 <code>didascalie.json</code> con la chiave del file (es.
 <code>"02-vincitore"</code>) e rilancia <code>prepara</code>. Le altre
 restano quelle generate.</p>
<p class="sot">Niente e' stato pubblicato. Per farlo:
 <code>node social/pubblica.mjs ${esc(cartella)} --pubblica</code></p>
`);

console.log(`${voci.length} immagini · IG pronte ${nIg} · FB pronte ${nFb}`);
for (const v of voci) {
  const p = [...new Set([...v.instagram.problemi, ...v.facebook.problemi])];
  if (p.length) console.log(`  ✗ ${v.nome}\n      ` + p.join("\n      "));
}
console.log(`\nanteprima: ${join(cartella, "anteprima.html")}`);
console.log(`manifesto: ${join(cartella, "manifesto.json")}`);
process.exit(nIg === voci.length ? 0 : 1);
