#!/usr/bin/env node
/* ===========================================================================
   RESA DI UNA GARA — dalle grafiche HTML alle JPEG da pubblicare
   25/09/2026 · piano social, FASE 1 (`PIANO_SOCIAL_2026-09-25.md` §5)

   Cosa fa, in ordine:
     1. dalla GARA (storico_id) trova la sua QUALIFICA e, se c'e', la SPRINT:
        stessa stagione, stessa categoria, stesso round. ⚠ Non «l'ultima
        qualifica»: ÉLITE e ROOKIE corrono lo stesso GP a tre giorni di
        distanza, e la pole della ROOKIE non va sulla grafica della ÉLITE.
     2. lancia `posta.mjs` UNA volta, con un solo Chromium, per tutte le
        grafiche: qualifica (05-08), sprint (10), gara (tutte le altre).
        Supabase passa dalla cache di posta: ogni ritratto esce una volta, i
        byte si contano, oltre il tetto la resa si ferma (uscita 3).
     3. ogni PNG diventa JPEG q90 (Instagram vuole JPEG, misurato sulla doc
        Meta) + una miniatura da 360 px per la galleria degli admin.
     4. una grafica senza dati NON produce un file: posta la scarta quando la
        pagina dice ERRORE, e qui si scarta anche una tela PIATTA (tutta dello
        stesso colore) — la seconda rete, misurata sui pixel e non sul testo.
     5. scrive `manifesto.json`: file, misure, didascalia gia' scritta dai
        dati, verdetto delle regole Meta, bollo PROVVISORIO/UFFICIALE, byte
        scaricati da Supabase e l'impronta dei dati (per la FASE 4).
     6. (FASE 5, 27/09/2026) per ogni grafica anche la STORIA 1080x1920 a
        cornice (variante B1 scelta da Fede): il post intero dentro la zona
        che l'app non copre, sul fondo `storia/fondo.png`. File in
        `storie/<nome>.jpg` + miniatura `storie/min/`, voce `storia` nel
        manifesto. Senza fondo la resa NON si ferma: il manifesto lo dice
        (`storie_errore`) e il pannello non offre la storia.

   ⚠ NON pubblica niente e non tocca git: scrive in `--staging`. A mettere i
   file sul ramo `uscite` ci pensa `consegna.mjs` (Actions o il .bat).

   Uso:
     node social/resa_gara.mjs --gara 210 --staging /tmp/resa
                               [--qualifica 209] [--sprint N] [--tetto-mb 20]
                               [--base-url https://UTENTE.github.io/dhn-social]
                               [--forza]   (anche una sessione che NON vale)
   Uscita: 0 fatto · 1 errore · 3 tetto dei byte superato (niente scritto)
   =========================================================================== */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { componiDidascalie } from "./didascalie.mjs";
import { bandiera } from "./frasi.mjs";
import { misuraImmagine } from "./misure.mjs";
import { REGOLE, controllaImmagine, controllaDidascalia } from "./regole_meta.mjs";
import { FONDO, faiStoria } from "./storia/componi.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));             // .../social
const PIPE = resolve(QUI, "..");                                   // "pipeline post gara"

const argv = process.argv.slice(2);
const arg = (n, r = null) => {
  const i = argv.indexOf("--" + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : r;
};
const GARA = arg("gara");
const STAGING = arg("staging") ? resolve(arg("staging")) : null;
const TETTO_MB = Number(arg("tetto-mb", "20"));
const BASE = (arg("base-url", "") || "").replace(/\/$/, "");
const FORZA = argv.includes("--forza");
if (!/^\d+$/.test(GARA || "") || !STAGING) {
  console.error("uso: node social/resa_gara.mjs --gara 210 --staging CARTELLA [--tetto-mb 20] [--base-url URL]");
  process.exit(1);
}

/* stessa chiave pubblicabile di `grafiche/dhn-dati.js` e del sito: non e' un segreto */
const SB_URL = "https://afzgermmvjuukojxrhet.supabase.co";
const SB_KEY = "sb_publishable_sA_339mSUA_HI5bUAivhzw_dBv2WZ33";
const SPECCHIO = (process.env.POSTA_SUPABASE_SPECCHIO || "").replace(/\/$/, "");  // solo banco

/* le poche letture fatte QUI (fuori dal Chromium) si contano anche loro */
const MIO = { byte: 0, richieste: 0 };
async function sb(percorso) {
  const r = await fetch((SPECCHIO || SB_URL) + percorso,
    { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  const b = Buffer.from(await r.arrayBuffer());
  MIO.byte += Number(r.headers.get("content-length")) > 0 ? Number(r.headers.get("content-length")) : b.length;
  MIO.richieste++;
  if (!r.ok) throw new Error(`${percorso.split("?")[0]} -> HTTP ${r.status} ${b.toString().slice(0, 160)}`);
  return JSON.parse(b.toString("utf8"));
}

/* chi va disegnato su quale sessione — come `galleria.html` (TEMPLATE.chiede) */
const DI_QUALIFICA = ["05", "06", "07", "08"];
const DI_SPRINT = ["10"];
/* titolo per le grafiche che `didascalie.mjs` non copre: la didascalia minima
   e' titolo + GP + categoria, e il manifesto dice che va completata */
const TITOLI = {
  "01": "RISULTATO", "02": "VINCITORE", "03": "CLASSIFICA PILOTI", "04": "CLASSIFICA SCUDERIE",
  "05": "POLE", "06": "PRIMA FILA", "07": "LA GRIGLIA", "08": "SCHIERAMENTO", "09": "A PUNTI",
  "10": "SPRINT", "11": "TESTA A TESTA", "12": "POSIZIONI GUADAGNATE", "13": "GIRO VELOCE",
  "14": "STRATEGIA", "15": "LEADER DEL CAMPIONATO", "16": "I PRIMI TRE", "17": "RIEPILOGO GP",
  "18": "PASSO GARA", "19": "TENUTA", "20": "COSTANZA", "21": "DUELLO INTERNO",
};
/* chiave di `didascalie.mjs` per codice di grafica (quelle nomi vengono dal
   12/09, i file sono stati rinominati dopo: l'aggancio e' il NUMERO) */
const CHIAVE_DIDASCALIA = {
  "01": "01-risultato", "02": "02-vincitore", "03": "03-classifica-piloti", "05": "05-pole",
  "06": "06-prima-fila", "07": "07-la-griglia", "08": "08-schieramento", "09": "09-a-punti",
  "12": "12-posizioni-guadagnate", "13": "13-giro-veloce", "14": "14-strategia", "17": "17-riepilogo",
};
const CODA = "#DHNChampionship #F125 #simracing";
/* ⚠ TELA PIATTA — misurato il 25/09 sulla «09 A PUNTI» nera (quella che una
   qualifica produce: nessuno fuori dal podio ha punti): sull'immagine INTERA
   la deviazione e' 11,7, perche' la testata (filo arancio + scritta) c'e'
   sempre; e anche SOTTO la testata (da y=150) resta 11,7, per la grana
   del fondo. Le 13 grafiche vere della resa di banco (174/173), misurate
   sotto la testata, vanno da 51 (14 STRATEGIA, tutta tabella scura) a 107.
   Soglia a meta' strada: 25. Se una grafica vera un giorno cade qui sotto,
   il manifesto la elenca in `saltate` col numero: si guarda, non si abbassa
   la soglia a occhio. */
const PIATTA_SOTTO = 25;
const SOTTO_TESTATA = 150;

async function main() {
  const t0 = Date.now();
  /* ------------------------------------------------ 1. le sessioni del GP */
  const [g] = await sb(`/rest/v1/v_grafica_sessioni_valide?storico_id=eq.${GARA}&select=*`);
  if (!g) throw new Error(`sessione ${GARA}: non c'e' in v_grafica_sessioni_valide`);
  if (g.tipo !== "gara") throw new Error(`sessione ${GARA} e' una «${g.tipo}», non una gara: si rende partendo dalla GARA`);
  if (!g.vale_per_classifica && !FORZA)
    throw new Error(`sessione ${GARA} NON vale (${g.riconosciuti}/${g.piloti} piloti riconosciuti): `
      + "e' una lobby di prova. Con --forza si rende lo stesso, ma non va pubblicata.");
  const filtroGP = g.round != null ? `round=eq.${g.round}` : `gp_nome=eq.${encodeURIComponent(g.gp_nome)}`;
  const vicine = await sb(`/rest/v1/v_grafica_sessioni_valide?select=storico_id,tipo`
    + `&stagione_id=eq.${g.stagione_id}&categoria_id=eq.${g.categoria_id}&${filtroGP}`
    + `&storico_id=lt.${GARA}&vale_per_classifica=is.true&order=storico_id.desc`);
  const qid = arg("qualifica") || (vicine.find(s => s.tipo === "qualifica") || {}).storico_id || null;
  const sid = arg("sprint") || (vicine.find(s => s.tipo === "sprint") || {}).storico_id || null;
  let categoria = String(g.categoria_id);
  try { const [c] = await sb(`/rest/v1/categoria?id=eq.${g.categoria_id}&select=nome`); if (c) categoria = c.nome; }
  catch (e) { console.log(`  (nome categoria non letto: ${e.message} — resta l'id)`); }
  console.log(`GARA ${GARA} · ${categoria} · GP ${g.gp_nome} R${g.round ?? "?"} · qualifica ${qid ?? "—"} · sprint ${sid ?? "—"}`);

  /* ------------------------------------------- 2. un Chromium, tutte insieme */
  const codici = readdirSync(join(PIPE, "grafiche")).filter(f => /^\d\d-.*\.html$/.test(f)).map(f => f.slice(0, 2)).sort();
  const diGara = codici.filter(c => !DI_QUALIFICA.includes(c) && !DI_SPRINT.includes(c));
  const lavori = [`${GARA}:${diGara.join(",")}`];
  if (qid) lavori.unshift(`${qid}:${DI_QUALIFICA.filter(c => codici.includes(c)).join(",")}`);
  if (sid) lavori.push(`${sid}:${DI_SPRINT.filter(c => codici.includes(c)).join(",")}`);

  const lavoro = join(STAGING, "_lavoro", GARA);
  rmSync(lavoro, { recursive: true, force: true });
  mkdirSync(lavoro, { recursive: true });
  const png = join(lavoro, "png");
  const esitiFile = join(lavoro, "esiti.json");
  /* il tetto di posta e' quello che RESTA dopo le letture fatte qui */
  const tettoPosta = Math.max(0.01, TETTO_MB - MIO.byte / 1048576);
  const cmd = [join(PIPE, "posta.mjs"), "--lavori", lavori.join("/"), "--formato", "post",
    "--out", png, "--tetto-mb", tettoPosta.toFixed(3), "--esiti", esitiFile, "--dati-in", lavoro];
  if (qid) cmd.push("--q", `quali=${qid}`);
  if (arg("porta")) cmd.push("--porta", arg("porta"));
  console.log(`posta: ${lavori.join(" / ")}`);
  const p = spawnSync(process.execPath, cmd, { stdio: "inherit", env: process.env });
  if (p.status === 3) { const e = new Error("TETTO dei byte Supabase superato: resa fermata, niente pubblicato"); e.codice = 3; throw e; }
  if (!existsSync(esitiFile)) throw new Error(`posta e' uscita con ${p.status} senza scrivere gli esiti`);
  const E = JSON.parse(readFileSync(esitiFile, "utf8"));

  /* ---------------------------------------------- 3. dati per le didascalie */
  const dati = existsSync(join(lavoro, "dati_supabase.json"))
    ? JSON.parse(readFileSync(join(lavoro, "dati_supabase.json"), "utf8")) : [];
  const vista = (v, id) => (dati.find(d => d.vista === v && new RegExp(`(^|&)storico_id=eq\\.${id}(&|$)`).test(d.query)) || {}).json || null;
  const righe = vista("v_grafica_sessione", GARA) || [];
  const classifica = vista("v_grafica_classifica_piloti", GARA) || [];
  const r0 = righe[0] || {};
  const GEN = righe.length ? componiDidascalie({
    sessione: { storico_id: Number(GARA), gp_nome: r0.gp_nome ?? g.gp_nome, gp_cc: r0.gp_cc, round: r0.round ?? g.round },
    righe, classifica }) : {};
  const testaGP = () => {
    const b = bandiera(r0.gp_cc);
    return `GP ${g.gp_nome || ""}${b ? " " + b : ""}${g.round ? ` · Round ${g.round}` : ""}`;
  };
  const stato = !righe.length ? "sconosciuto"
    : righe.some(r => r.provvisorio === true) ? "provvisorio"
    : righe.some(r => r.sessione_pubblicata) ? "ufficiale" : "non pubblicata";

  /* ------------------------------------------------ 4. JPEG + miniature */
  const dest = join(STAGING, "gare", GARA);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(join(dest, "min"), { recursive: true });
  const voci = [], saltate = [];
  /* storia a cornice (storia/componi.mjs): senza fondo niente storie, ma la resa va avanti */
  const fondoOk = existsSync(FONDO);
  const erroriStorie = fondoOk ? [] : [`manca storia/fondo.png: niente storie in questa resa`];
  if (!fondoOk) console.log(`  ⚠ ${erroriStorie[0]}`);
  for (const e of E.esiti) {
    const codice = e.file.slice(0, 2);
    if (!e.ok) { saltate.push({ codice, file: e.file, sessione: e.storico, motivo: e.errore || e.avviso || "non riuscita" }); continue; }
    const sorg = join(png, e.nome);
    const mt = await sharp(sorg).metadata();
    const st = await sharp(sorg).extract({ left: 0, top: SOTTO_TESTATA, width: mt.width,
      height: Math.max(1, mt.height - SOTTO_TESTATA) }).stats();
    const dev = Math.max(...st.channels.slice(0, 3).map(c => c.stdev));
    if (dev < PIATTA_SOTTO) { saltate.push({ codice, file: e.file, sessione: e.storico, motivo: `tela piatta (deviazione ${dev.toFixed(1)}): niente da pubblicare` }); continue; }
    const nome = e.file.replace(/\.html$/, ".jpg");
    await sharp(sorg).flatten({ background: "#000000" })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(join(dest, nome));
    await sharp(sorg).flatten({ background: "#000000" }).resize({ width: 360 })
      .jpeg({ quality: 78, mozjpeg: true }).toFile(join(dest, "min", nome));
    const m = misuraImmagine(join(dest, nome));
    const mm = misuraImmagine(join(dest, "min", nome));
    let storia = null;
    if (fondoOk) {
      try {
        storia = await faiStoria(sorg, dest, nome);
        storia.url = BASE ? `${BASE}/gare/${GARA}/storie/${encodeURIComponent(nome)}` : null;
      }
      catch (err) { console.log(`  ⚠ storia di ${nome} NON fatta: ${err.message}`); storia = null; erroriStorie.push(`${nome}: ${err.message}`); }
    }
    let did = "", origine = "nessuna";
    const k = CHIAVE_DIDASCALIA[codice];
    if (k && GEN[k]) { did = GEN[k]; origine = "generata dai dati"; }
    else if (righe.length) {
      did = `${TITOLI[codice] || e.file.slice(3, -5).toUpperCase()} — ${testaGP()}\n${categoria}\n\n${CODA}`;
      origine = "solo titolo (da completare)";
    }
    const ig = controllaImmagine({ nome, ...m }, "instagram");
    const fb = controllaImmagine({ nome, ...m }, "facebook");
    const dIg = controllaDidascalia(did, "instagram");
    const url = BASE ? `${BASE}/gare/${GARA}/${encodeURIComponent(nome)}` : null;
    voci.push({
      codice, titolo: TITOLI[codice] || null, file: nome, miniatura: `min/${nome}`,
      url, url_miniatura: BASE ? `${BASE}/gare/${GARA}/min/${encodeURIComponent(nome)}` : null,
      sessione: Number(e.storico), larghezza: m.larghezza, altezza: m.altezza, byte: m.byte,
      miniatura_misure: `${mm.larghezza}x${mm.altezza}`, deviazione_pixel: Number(dev.toFixed(1)),
      immagini_mancanti: e.img_rotte, immagini_totali: e.img_tot, avviso_pagina: e.avviso || null,
      font: e.font, didascalia: did, didascalia_origine: origine,
      instagram: { ok: ig.ok && dIg.ok, problemi: [...ig.problemi, ...dIg.problemi] },
      facebook: { ok: fb.ok && !!did.trim(), problemi: [...fb.problemi, ...(did.trim() ? [] : ["didascalia vuota"])] },
      storia,
    });
  }
  voci.sort((a, b) => a.codice.localeCompare(b.codice));   // nell'ordine delle grafiche, non di resa
  if (!voci.length) throw new Error(`nessuna immagine riuscita (${saltate.length} scartate)`);

  const supabase = {
    byte: E.supabase.byte + MIO.byte, richieste: E.supabase.richieste + MIO.richieste,
    dalla_cache: E.supabase.dalla_cache, url_diversi: E.supabase.url_diversi,
    per_tipo: { ...E.supabase.per_tipo, rest: E.supabase.per_tipo.rest + MIO.byte },
    tetto_byte: Math.round(TETTO_MB * 1048576), metodo: E.supabase.metodo,
  };
  const manifesto = {
    schema: 1, generato: new Date().toISOString(), secondi: Math.round((Date.now() - t0) / 1000),
    gara_id: Number(GARA), qualifica_id: qid ? Number(qid) : null, sprint_id: sid ? Number(sid) : null,
    stagione_id: g.stagione_id, categoria_id: g.categoria_id, categoria, gp_nome: g.gp_nome,
    gp_cc: r0.gp_cc || null, round: g.round, data_gara: g.created_at, stato,
    impronta_dati: E.impronta_dati, font: E.font,
    base_url: BASE ? `${BASE}/gare/${GARA}/` : null,
    regole_meta_verificate_il: REGOLE.verificate_il,
    supabase, voci, saltate,
    storie: voci.filter(v => v.storia).length, storie_errore: erroriStorie.length ? erroriStorie.join(" · ") : null,
  };
  writeFileSync(join(dest, "manifesto.json"), JSON.stringify(manifesto, null, 1));
  rmSync(join(STAGING, "_lavoro"), { recursive: true, force: true });

  console.log(`\nGARA ${GARA} (${categoria}, ${stato.toUpperCase()}): ${voci.length} JPEG · ${saltate.length} scartate · `
    + `Supabase ${(supabase.byte / 1048576).toFixed(2)} MB in ${supabase.richieste} richieste `
    + `(${supabase.dalla_cache} riusate dalla cache) · ${manifesto.storie} storie · ${manifesto.secondi} s`);
  for (const s of saltate) console.log(`  ✗ ${s.codice} (sessione ${s.sessione}): ${s.motivo}`);
  const noIg = voci.filter(v => !v.instagram.ok);
  if (noIg.length) console.log(`  ⚠ non pronte per Instagram: ${noIg.map(v => v.codice + " " + v.instagram.problemi.join("; ")).join(" | ")}`);
}

main().catch(e => { console.error("\nRESA FALLITA: " + e.message); process.exit(e.codice || 1); });
