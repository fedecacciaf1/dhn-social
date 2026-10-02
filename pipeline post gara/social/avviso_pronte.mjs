#!/usr/bin/env node
/* ===========================================================================
   AVVISO «GRAFICHE PRONTE» — FASE 5 (27/09/2026), piano social §5
   Legge i manifesti delle gare appena CONSEGNATE (la staging della resa) e
   scrive il messaggio per il canale staff di Discord (webhook). Non manda
   niente: stampa il JSON, lo manda `curl` nel workflow (rendi.yml).
     node social/avviso_pronte.mjs --da STAGING [--pannello URL] > avviso.json
   Uscita 0 con JSON su stdout · 2 = nessuna gara nella staging (niente da dire).
   Nessuna menzione (@everyone, ruoli) può partire: allowed_mentions vuoto.
   =========================================================================== */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const arg = (n, r = null) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : r; };
const DA = arg("da") ? resolve(arg("da")) : null;
const PANNELLO = arg("pannello", "https://dhn-multiverse.com/admin.html");

export function testoAvviso(manifesti, pannello = PANNELLO) {
  const righe = manifesti.sort((a, b) => a.gara_id - b.gara_id).map((m) => {
    const bollo = m.stato === "ufficiale" ? "✅ UFFICIALE" : m.stato === "provvisorio" ? "🟡 PROVVISORIO" : `⚪ ${String(m.stato || "?").toUpperCase()}`;
    const n = (m.voci || []).length, st = m.storie ?? (m.voci || []).filter((v) => v.storia).length;
    const salt = (m.saltate || []).length;
    const daFare = (m.voci || []).filter((v) => v.didascalia_origine && v.didascalia_origine !== "generata dai dati").length;
    /* Q1 (02/10/2026): la resa «solo qualifica» si annuncia come POLE pronta */
    const quali = m.modo === "qualifica";
    return `${quali ? "🅿️ " : ""}**${m.categoria} · GP ${m.gp_nome}${m.round != null ? ` · R${m.round}` : ""}${quali ? " · QUALIFICA" : ""}** — ${bollo}\n`
      + (quali ? "POLE pronta, prima della gara. " : "")
      + `${n} grafiche${st ? ` + ${st} storie` : ""}${salt ? ` · ${salt} non fatte (dati mancanti)` : ""}${daFare ? ` · ${daFare} didascalie da completare` : ""}`
      + (m.storie_errore ? `\n⚠ storie: ${String(m.storie_errore).slice(0, 200)}` : "");
  });
  const soloQuali = manifesti.length > 0 && manifesti.every((m) => m.modo === "qualifica");
  const testo = `${soloQuali ? "🅿️ **POLE pronta** — grafiche della qualifica" : "🖼️ **Grafiche social pronte**"}\n\n${righe.join("\n\n")}\n\nPannello → Social: ${pannello}\n*Niente è uscito: si pubblica o si programma dal pannello.*`;
  return { content: testo.slice(0, 1990), allowed_mentions: { parse: [] } };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("avviso_pronte.mjs")) {
  if (!DA) { console.error("uso: node social/avviso_pronte.mjs --da STAGING [--pannello URL]"); process.exit(1); }
  const cart = join(DA, "gare");
  const man = existsSync(cart) ? readdirSync(cart).map((id) => join(cart, id, "manifesto.json")).filter(existsSync)
    .map((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!man.length) { console.error("avviso_pronte: nessuna gara resa nella staging: niente avviso"); process.exit(2); }
  process.stdout.write(JSON.stringify(testoAvviso(man)));
}
