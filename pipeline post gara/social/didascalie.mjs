/* ===========================================================================
   DIDASCALIE — il testo dei post, ricavato dai dati della sessione.
   12/09/2026 · seconda versione: frasi variabili invece del tabellino.

   Perche' esiste
     Scrivere 17 didascalie a mano dopo mezzanotte e' il punto in cui la
     pubblicazione salta. Qui si generano dai dati che il motore ha gia'
     salvato, e Fede le CORREGGE nell'anteprima invece di scriverle.

   ⚠ Prima versione (mattina del 12/09): elenchi puntati. Verdetto di Fede:
     «devono essere piu' descrittive di quello che e' la gara». Adesso le
     frasi vengono da `frasi.mjs` e cambiano da gara a gara — ma il caso e'
     SEMINATO su `storico_id`, quindi rigenerando esce sempre lo stesso testo.
     Se cambiasse, l'anteprima non varrebbe niente.

   ⚠ Si dice solo quello che i dati sanno: posizioni, distacchi, ritiri,
     soste, pole, giro veloce, posizioni guadagnate. Un contatto al via il
     database non lo sa, e nessuna frase deve far finta di saperlo.

   ⚠ `componiDidascalie` e' PURA: dati dentro, testo fuori, niente rete.
   =========================================================================== */
import { frase, bandiera, EMOJI } from "./frasi.mjs";

/* Nomi che il gioco mette al posto di chi non ha il nome pubblico.
   Stessa lista di `v_grafica_classifica_piloti`. */
const SEGNAPOSTO = new Set([
  "utente", "player", "giocatore", "anonymous", "anonimo",
  "driver", "spieler", "joueur", "jugador",
]);
export const eSegnaposto = n =>
  SEGNAPOSTO.has(String(n || "").trim().toLowerCase());

const CODA = "#DHNChampionship #F125 #simracing";

const nome = r => r.nome_da_stampare;
/* ⚠ Nelle LISTE un segnaposto diventa un trattino, non fa sparire tutto:
   la griglia del GP Messico ha due «Utente» e la prima versione cancellava
   l'intera didascalia — una griglia senza griglia. Dove invece il segnaposto
   e' il SOGGETTO (vincitore, pole) la didascalia deve sparire davvero. */
const nomeLista = r => (eSegnaposto(nome(r)) ? "—" : nome(r));
const conTeam = r => (eSegnaposto(nome(r)) ? "—"
  : r.scuderia_da_stampare ? `${nome(r)} (${r.scuderia_da_stampare})` : nome(r));

/* «🏁 GP Messico 🇲🇽» oppure «🏁 GP Messico 🇲🇽 · Round 3».
   ⚠ round nullo si OMETTE: «Round null» e' il difetto piu' facile da fare. */
function testa(s, emoji) {
  const b = bandiera(s.gp_cc);
  const gp = `${emoji ? emoji + " " : ""}GP ${s.gp_nome || ""}`.trim()
    + (b ? ` ${b}` : "");
  return s.round ? `${gp} · Round ${s.round}` : gp;
}

export function componiDidascalie(dati) {
  const s = dati.sessione || {};
  const seme = s.storico_id ?? s.session_uid ?? "0";
  const righe = [...(dati.righe || [])].sort((a, b) => (a.pos || 99) - (b.pos || 99));
  const cls = dati.classifica || [];
  const out = {};
  const met = (k, corpo) => { if (corpo) out[k] = `${corpo}\n\n${CODA}`; };
  /* ⚠ il seme porta anche la CHIAVE DELLA GRAFICA: senza, il riepilogo
     pescava la stessa identica frase del risultato e due post della stessa
     gara dicevano la stessa cosa. Con lo slot restano deterministici ma
     diversi fra loro. */
  const F = (k, v, slot = "") => frase(`${seme}${slot ? "#" + slot : ""}`, k, v);

  const arrivati = righe.filter(r => !r.ritiro);
  const ritirati = righe.filter(r => r.ritiro);
  const podio = arrivati.slice(0, 3);
  const v = arrivati[0];
  const pole = righe.find(r => r.griglia === 1);
  const gv = righe.find(r => r.giro_veloce);

  /* come ha vinto — una frase, scelta dalla situazione */
  const comeHaVinto = (slot = "") => {
    if (!v || eSegnaposto(nome(v))) return "";
    if (v.griglia === 1) return F("vittoria_dalla_pole", { v: nome(v) }, slot);
    if (v.griglia > 3) return F("vittoria_rimonta", { v: nome(v), g: v.griglia }, slot);
    return F("vittoria_normale", { v: nome(v) }, slot);
  };
  /* quanti sono arrivati */
  const comeSonoFinite = (slot = "") => {
    if (!righe.length) return "";
    if (!ritirati.length) return F("ritiri_zero", {}, slot);
    return ritirati.length / righe.length >= 0.4
      ? F("ritiri_tanti", { q: arrivati.length }, slot)
      : F("ritiri_pochi", { q: ritirati.length }, slot);
  };
  /* che fine ha fatto la pole */
  const finePole = (slot = "") => {
    if (!pole || eSegnaposto(nome(pole))) return "";
    if (pole.ritiro) return F("pole_ritiro", {}, slot);
    if (v && pole === v) return F("pole_vince", {}, slot);
    return F("pole_niente", { p: nome(pole), q: pole.pos }, slot);
  };

  /* 01 · risultato ------------------------------------------------------- */
  if (podio.length) {
    const riga = podio.map((r, i) =>
      `${i + 1}. ${nomeLista(r)}${r.gap_testo && i ? ` (${r.gap_testo})` : ""}`).join(" · ");
    met("01-risultato", [
      `${testa(s, EMOJI.gara)}`, "",
      [comeHaVinto("01"), comeSonoFinite("01")].filter(Boolean).join(" "),
      "", riga,
    ].filter(x => x !== undefined).join("\n"));
  }

  /* 02 · vincitore -------------------------------------------------------- */
  if (v && !eSegnaposto(nome(v))) {
    const gvSua = gv && gv === v ? " " + F("gv_del_vincitore", {}, "02") : "";
    met("02-vincitore", `${EMOJI.vittoria} ${testa(s)}\n`
      + `${comeHaVinto("02")}${gvSua}`);
  }

  /* 03 · classifica piloti ------------------------------------------------ */
  if (cls.length) {
    const capo = cls[0];
    met("03-classifica-piloti", [
      `${EMOJI.classifica} CLASSIFICA PILOTI — dopo il ${testa(s).replace(/^🏁 /, "")}`,
      "",
      capo ? `In testa ${capo.nome_da_stampare} con ${capo.punti_tot} punti.` : "",
      "",
      ...cls.slice(0, 5).map(r => `${r.pos}. ${r.nome_da_stampare} — ${r.punti_tot}`),
    ].filter(Boolean).join("\n"));
  }

  /* 05 · pole ------------------------------------------------------------- */
  if (pole && !eSegnaposto(nome(pole))) {
    met("05-pole", `${EMOJI.pole} POLE — ${testa(s)}\n`
      + `${conTeam(pole)}. ${finePole("05")}`.trim());
  }

  /* 06 · prima fila -------------------------------------------------------- */
  const fila = righe.filter(r => r.griglia === 1 || r.griglia === 2)
    .sort((a, b) => a.griglia - b.griglia);
  if (fila.length === 2 && fila.every(r => !eSegnaposto(nome(r)))) {
    met("06-prima-fila", `${EMOJI.griglia} PRIMA FILA — ${testa(s)}\n`
      + `${nome(fila[0])} e ${nome(fila[1])} davanti a tutti.`);
  }

  /* 07 · la griglia (e 08 schieramento) ------------------------------------ */
  const griglia = righe.filter(r => r.griglia).sort((a, b) => a.griglia - b.griglia);
  if (griglia.length >= 2) {
    const t = [`${EMOJI.griglia} LA GRIGLIA — ${testa(s)}`, "",
      ...griglia.map(r => `${r.griglia}. ${nomeLista(r)}`)].join("\n");
    met("07-la-griglia", t);
    met("08-schieramento", t);
  }

  /* 09 · a punti ----------------------------------------------------------- */
  const punti = righe.filter(r => (r.punti || 0) > 0);
  if (punti.length) {
    met("09-a-punti", [`${EMOJI.punti} A PUNTI — ${testa(s)}`, "",
      ...punti.map(r => `${r.pos}. ${nomeLista(r)} — ${r.punti}`)].join("\n"));
  }

  /* 12 · posizioni guadagnate ---------------------------------------------- */
  const su = righe.filter(r => (r.posizioni_guadagnate || 0) > 0
                            && !eSegnaposto(nome(r)))
    .sort((a, b) => b.posizioni_guadagnate - a.posizioni_guadagnate)[0];
  if (su) {
    met("12-posizioni-guadagnate", `${EMOJI.rimonta} POSIZIONI GUADAGNATE — ${testa(s)}\n`
      + F("rimonta", { p: nome(su), q: su.posizioni_guadagnate,
                       g: su.griglia, n: su.pos }));
  }

  /* 13 · giro veloce -------------------------------------------------------- */
  if (gv && !eSegnaposto(nome(gv))) {
    met("13-giro-veloce", `${EMOJI.giro_veloce} GIRO VELOCE — ${testa(s)}\n`
      + F("gv_scheda", { p: conTeam(gv), t: gv.best_str || "" })
        .replace(" in .", ".").replace(": ,", ",").replace("firma .", "."));
  }

  /* 14 · strategia ---------------------------------------------------------- */
  const conSoste = arrivati.filter(r => (r.soste || 0) > 0);
  if (conSoste.length) {
    met("14-strategia", [`${EMOJI.strategia} STRATEGIA — ${testa(s)}`, "",
      ...conSoste.slice(0, 5).map(r =>
        `${nomeLista(r)}: ${r.soste} ${r.soste > 1 ? "soste" : "sosta"}`)].join("\n"));
  }

  /* 17 · riepilogo ---------------------------------------------------------- */
  if (podio.length) {
    const f = [comeHaVinto("17"), finePole("17"), comeSonoFinite("17")].filter(Boolean);
    if (gv && gv !== v && !eSegnaposto(nome(gv))) {
      f.push(F("gv_di_altro", { p: nome(gv), t: gv.best_str || "" }));
    }
    met("17-riepilogo", `${EMOJI.gara} RIEPILOGO — ${testa(s).replace(/^🏁 /, "")}\n\n`
      + f.join(" "));
  }

  /* ⚠ ULTIMA RETE: nessun segnaposto deve essere uscito come NOME. */
  for (const [k, testo] of Object.entries(out)) {
    for (const seg of SEGNAPOSTO) {
      if (new RegExp(`\\b${seg}\\b`, "i").test(testo)) { delete out[k]; break; }
    }
  }
  return out;
}

/* ===========================================================================
   Q1 (02/10/2026) — LA RESA «SOLO QUALIFICA»: 05 POLE · 06 PRIMA FILA ·
   07 LA GRIGLIA · 08 SCHIERAMENTO escono quando la DG pubblica la qualifica,
   PRIMA della gara (PIANO_PANNELLO_ADMIN_2026-10-02.md, chat Q1).

   ⚠ Funzione SEPARATA apposta: `componiDidascalie` (quella della gara) resta
     identica byte per byte — la controprova sulla gara 210 lo richiede.
   ⚠ Qui la gara NON c'e' ancora: niente «la pole vale la vittoria» (la
     frase della gara la deciderebbe guardando il primo della QUALIFICA come
     se fosse il vincitore). Si dice solo quello che la qualifica sa: chi, il
     tempo, il distacco dal secondo, l'ordine.
   ⚠ Nella vista della qualifica `griglia` vale 0 per tutti (misurato sulla
     223): l'ordine e' `pos`.
   =========================================================================== */
const msGiro = t => {
  const m = /^(?:(\d+):)?(\d+)\.(\d{1,3})$/.exec(String(t || "").trim());
  return m ? ((Number(m[1]) || 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, "0")) : null;
};
export function componiDidascalieQualifica(dati) {
  const s = dati.sessione || {};
  const righe = [...(dati.righe || [])].filter(r => (r.pos || 0) > 0)
    .sort((a, b) => a.pos - b.pos);
  const out = {};
  const met = (k, corpo) => { if (corpo) out[k] = `${corpo}\n\n${CODA}`; };
  const [p1, p2] = righe;

  /* 05 · pole ------------------------------------------------------------- */
  if (p1 && !eSegnaposto(nome(p1))) {
    const a = msGiro(p1.best_str), b = p2 ? msGiro(p2.best_str) : null;
    const gap = a != null && b != null && b >= a && !eSegnaposto(nome(p2))
      ? `, ${((b - a) / 1000).toFixed(3)} s davanti a ${nome(p2)}` : "";
    met("05-pole", `${EMOJI.pole} POLE — ${testa(s)}\n`
      + `${conTeam(p1)}${p1.best_str ? ` in ${p1.best_str}` : ""}${gap}.`);
  }
  /* 06 · prima fila -------------------------------------------------------- */
  if (p1 && p2 && !eSegnaposto(nome(p1)) && !eSegnaposto(nome(p2))) {
    met("06-prima-fila", `${EMOJI.griglia} PRIMA FILA — ${testa(s)}\n`
      + `${nome(p1)} e ${nome(p2)} davanti a tutti.`);
  }
  /* 07 · la griglia (e 08 schieramento) ------------------------------------ */
  if (righe.length >= 2) {
    const t = [`${EMOJI.griglia} LA GRIGLIA — ${testa(s)}`, "",
      ...righe.map(r => `${r.pos}. ${nomeLista(r)}`)].join("\n");
    met("07-la-griglia", t);
    met("08-schieramento", t);
  }
  return out;
}
