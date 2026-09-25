/* ===========================================================================
   FRASI — la libreria da cui le didascalie pescano.   12/09/2026

   ⚠⚠ IL CASO E' SEMINATO, NON CASUALE.
   `Math.random()` qui sarebbe un difetto: rigenerando l'anteprima cambierebbe
   il testo, e Fede non saprebbe piu' se quello che ha approvato e' quello che
   esce. Il seme e' `storico_id` + la chiave della frase: **stessa gara ->
   sempre la stessa frase**, gare diverse -> frasi diverse.
   E' lo stesso principio di `__esultanzaDiPilota` (impronta del discord_id):
   varieta' stabile, non sorpresa.

   ⚠ Le frasi dicono solo quello che i dati sanno. Nessuna sa se c'e' stato un
   contatto al via: quello lo aggiunge Fede a mano nell'anteprima.
   =========================================================================== */

/* hash a 32 bit, deterministico e stabile fra versioni di Node */
export function impronta32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* pesca sempre lo stesso elemento per la stessa coppia (seme, chiave) */
export function pesca(seme, chiave, elenco) {
  if (!elenco || !elenco.length) return "";
  return elenco[impronta32(`${seme}|${chiave}`) % elenco.length];
}

/* bandiera del paese dal codice a due lettere (mx -> 🇲🇽). Algoritmica:
   niente tabella da tenere aggiornata a ogni GP nuovo. */
export function bandiera(cc) {
  const c = String(cc || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map(x => 0x1f1e6 + x.charCodeAt(0) - 65));
}

export const EMOJI = {
  gara: "🏁", vittoria: "🏆", pole: "🅿️", giro_veloce: "⏱️",
  rimonta: "📈", ritiro: "💥", classifica: "📊", strategia: "🔧",
  griglia: "🚦", punti: "🎯",
};

/* --------------------------------------------------------------------------
   Le frasi. Segnaposto: {v} vincitore · {g} griglia di partenza · {n} numero
   · {s} scuderia · {p} pilota · {q} quanti · {t} tempo · {gp} nome del GP
   -------------------------------------------------------------------------- */
export const FRASI = {

  /* — come ha vinto — */
  vittoria_dalla_pole: [
    "{v} parte davanti e non si volta mai.",
    "{v} comanda dalla prima curva all'ultima.",
    "Pole, testa della gara, vittoria: giornata piena per {v}.",
  ],
  vittoria_rimonta: [
    "{v} parte {g}º e se la prende comunque.",
    "Dalla {g}ª casella al gradino più alto: {v}.",
    "{v} risale dalla {g}ª posizione e vince.",
  ],
  vittoria_normale: [
    "{v} passa davanti e chiude i conti.",
    "Vittoria di {v}, che si prende la testa e la tiene.",
    "{v} porta a casa il GP.",
  ],

  /* — quanti sono arrivati — */
  ritiri_tanti: [
    "Gara dura: solo {q} al traguardo.",
    "Ne restano {q}: il resto si è fermato per strada.",
    "Arrivano in {q}, e non è stata una passeggiata.",
  ],
  ritiri_pochi: [
    "{q} ritiri lungo il percorso.",
    "Qualcuno resta per strada: {q} ritiri.",
  ],
  ritiri_zero: [
    "Tutti al traguardo.",
    "Nessun ritiro: gara pulita.",
  ],

  /* — la pole — */
  pole_vince: [
    "La pole vale la vittoria.",
    "Chi partiva davanti ci è rimasto.",
  ],
  pole_ritiro: [
    "La pole però finisce al ritiro.",
    "Chi partiva davanti non vede la bandiera a scacchi.",
    "Partenza da davanti, gara chiusa in anticipo.",
  ],
  pole_niente: [
    "La pole non basta: {p} chiude {q}º.",
    "Partire davanti non è servito a {p}.",
  ],

  /* — giro veloce — */
  /* ⚠ frasi INTERE, non spezzoni da attaccare: la prima versione diceva
     «... e vince e il giro veloce è suo» perche' incollavo un pezzo che
     cominciava per «e». Una frase per volta, e i punti tornano. */
  gv_del_vincitore: [
    "Suo anche il giro veloce.",
    "E si prende pure il giro veloce.",
    "Giro veloce compreso.",
  ],
  gv_di_altro: [
    "Giro veloce a {p} in {t}.",
    "Il passo migliore è di {p}: {t}.",
    "{p} firma il giro più veloce, {t}.",
  ],
  /* ⚠ per la GRAFICA del giro veloce il titolo lo dice gia': qui non si
     ripete «giro veloce», si danno pilota e tempo. */
  gv_scheda: [
    "{p} in {t}.",
    "Il passo migliore: {p}, {t}.",
    "{p} firma {t}.",
  ],

  /* — rimonta — */
  rimonta: [
    "{p} guadagna {q} posizioni, dalla {g}ª alla {n}ª.",
    "La rimonta è di {p}: {q} posizioni recuperate.",
    "{p} ne passa {q} e chiude {n}º.",
  ],
};

/* Le frasi non si scelgono a mano: si passa la situazione e la chiave.
   Cosi' la variazione e' in UN posto e non sparsa nelle didascalie. */
export function frase(seme, chiave, valori = {}) {
  let t = pesca(seme, chiave, FRASI[chiave]);
  for (const [k, v] of Object.entries(valori)) {
    t = t.replaceAll(`{${k}}`, String(v));
  }
  return t;
}
