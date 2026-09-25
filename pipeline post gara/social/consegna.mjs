#!/usr/bin/env node
/* ===========================================================================
   CONSEGNA — mette la resa di una o piu' gare dentro la copia del ramo
   `uscite` e rifa' l'indice.            25/09/2026 · piano social, FASE 1

   ⚠ Non usa git: copia file. Il commit/push lo fanno `rendi.yml` (Actions) o
   `PUBBLICA_GRAFICHE.bat --uscite` (ripiego dal PC). Cosi' la stessa logica
   vale per le due strade e la galleria non vede differenze.

   ⚠ L'INDICE SI RICOSTRUISCE DAI MANIFESTI, non si modifica. Due gare rese
   insieme (ÉLITE e ROOKIE) scrivono sullo stesso ramo: se l'indice fosse un
   file da ritoccare, il secondo push rovinerebbe il primo. Ricostruito dai
   `gare/<id>/manifesto.json`, dopo un `reset` sul ramo aggiornato torna giusto
   da solo.

   Uso:  node social/consegna.mjs --da STAGING --in CARTELLA_USCITE
         node social/consegna.mjs --in CARTELLA_USCITE          (solo indice)
   =========================================================================== */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : null; };
const DA = arg("da") ? resolve(arg("da")) : null;
const IN = arg("in") ? resolve(arg("in")) : null;
if (!IN) { console.error("uso: node social/consegna.mjs [--da STAGING] --in USCITE"); process.exit(1); }

let copiate = 0;
if (DA && existsSync(join(DA, "gare"))) {
  for (const id of readdirSync(join(DA, "gare"))) {
    if (!existsSync(join(DA, "gare", id, "manifesto.json"))) continue;   // resa a meta': non si consegna
    const d = join(IN, "gare", id);
    /* la cartella della gara si SOSTITUISCE intera: una grafica che la resa
       nuova non ha prodotto (dati cambiati dopo un reclamo) deve sparire */
    rmSync(d, { recursive: true, force: true });
    cpSync(join(DA, "gare", id), d, { recursive: true });
    copiate++;
  }
}

const gare = existsSync(join(IN, "gare")) ? readdirSync(join(IN, "gare")) : [];
const indice = [];
for (const id of gare) {
  const f = join(IN, "gare", id, "manifesto.json");
  if (!existsSync(f)) continue;
  const m = JSON.parse(readFileSync(f, "utf8"));
  indice.push({
    gara_id: m.gara_id, qualifica_id: m.qualifica_id, sprint_id: m.sprint_id,
    stagione_id: m.stagione_id, categoria: m.categoria, gp_nome: m.gp_nome, gp_cc: m.gp_cc,
    round: m.round, data_gara: m.data_gara, stato: m.stato, generato: m.generato,
    impronta_dati: m.impronta_dati, immagini: m.voci.length, scartate: m.saltate.length,
    supabase_byte: m.supabase.byte, cartella: `gare/${id}/`,
  });
}
indice.sort((a, b) => b.gara_id - a.gara_id);
writeFileSync(join(IN, "indice.json"), JSON.stringify({ schema: 1, aggiornato: new Date().toISOString(), gare: indice }, null, 1));
writeFileSync(join(IN, ".nojekyll"), "");
copyFileSync(join(QUI, "uscite_index.html"), join(IN, "index.html"));
console.log(`consegna: ${copiate} gare copiate · indice con ${indice.length} gare`);
