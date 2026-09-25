/* ===========================================================================
   REGOLE META — cosa accetta un post su Instagram e su una Pagina Facebook.
   Verificate sulla documentazione VIVA il 12/09/2026 (non a memoria: la
   conoscenza del modello si ferma a maggio 2026).

   Fonti:
     developers.facebook.com/docs/instagram-platform/overview/   (accesso)
     postproxy.dev/blog/post-to-instagram-via-api/               (formato, flusso)
     postproxy.dev/blog/facebook-graph-api-posting-guide/        (Pagina FB)

   ⚠ Queste regole cambiano. Se un post viene rifiutato con un errore che qui
   non e' previsto, la prima cosa da fare e' RILEGGERE la documentazione, non
   allargare una soglia a caso.
   =========================================================================== */

export const REGOLE = {
  verificate_il: "2026-09-12",

  instagram: {
    /* ⚠⚠ JPEG. NON PNG. E' la trappola numero uno: le grafiche escono in PNG
       e Instagram le rifiuta senza spiegare granche'. */
    formati: ["jpg", "jpeg"],
    /* ⚠ un post nel FEED sta fra 4:5 (verticale) e 1.91:1 (orizzontale).
       1080x1350 = 0.800 -> dentro, e' il limite verticale esatto.
       1080x1920 = 0.5625 -> FUORI: il formato "storia" NON si puo' postare
       nel feed. Le Storie sono un'altra strada (altro endpoint), non una
       variante di questa. */
    proporzione_min: 4 / 5,       // 0.800
    proporzione_max: 1.91,
    lato_min_px: 320,
    lato_max_px: 1440,            // oltre, Instagram ridimensiona da sola
    didascalia_max: 2200,
    hashtag_max: 30,
    /* l'immagine NON si carica: si passa un URL pubblico e ci va lei */
    vuole_url_pubblico: true,
    post_per_24h: 100,
  },

  facebook: {
    formati: ["jpg", "jpeg", "png"],   // la Pagina accetta anche PNG
    lato_min_px: 200,
    vuole_url_pubblico: true,          // /{page-id}/photos?url=...
  },
};

/* --------------------------------------------------------------------------
   Un solo posto che dice se un'immagine e' postabile, e PERCHE' no.
   Torna { ok, problemi: [...] } — mai un'eccezione: chi chiama vuole
   l'elenco completo dei guai, non il primo.
   -------------------------------------------------------------------------- */
export function controllaImmagine({ nome, ext, larghezza, altezza, byte },
                                  dove = "instagram") {
  const R = REGOLE[dove];
  const problemi = [];
  const e = String(ext || "").toLowerCase().replace(/^\./, "");

  if (!R.formati.includes(e)) {
    problemi.push(`formato .${e}: ${dove} vuole ${R.formati.join(" o ")}`
      + (dove === "instagram" && e === "png"
         ? "  ⚠ e' il caso piu' comune: le grafiche escono in PNG" : ""));
  }
  if (!larghezza || !altezza) {
    problemi.push("misure non leggibili");
    return { ok: false, problemi };
  }
  const prop = larghezza / altezza;
  if (R.proporzione_min && prop < R.proporzione_min - 1e-9) {
    problemi.push(
      `proporzione ${prop.toFixed(3)} (${larghezza}x${altezza}): piu' stretta `
      + `del minimo ${R.proporzione_min.toFixed(3)} (4:5)`
      + (Math.abs(prop - 0.5625) < 1e-3
         ? "  ⚠ e' il formato STORIA: nel feed non ci va" : ""));
  }
  if (R.proporzione_max && prop > R.proporzione_max + 1e-9) {
    problemi.push(
      `proporzione ${prop.toFixed(3)}: piu' larga del massimo ${R.proporzione_max}`);
  }
  if (R.lato_min_px && Math.min(larghezza, altezza) < R.lato_min_px) {
    problemi.push(`lato corto ${Math.min(larghezza, altezza)}px: minimo ${R.lato_min_px}`);
  }
  if (R.lato_max_px && Math.max(larghezza, altezza) > R.lato_max_px) {
    problemi.push(`lato lungo ${Math.max(larghezza, altezza)}px: oltre ${R.lato_max_px} `
      + `Instagram ridimensiona da sola (non e' un errore, ma il reso cambia)`);
  }
  if (!byte) problemi.push("file vuoto");
  return { ok: problemi.length === 0, problemi };
}

/* -------------------------------------------------------------------------- */
export function controllaDidascalia(testo, dove = "instagram") {
  const R = REGOLE[dove];
  const problemi = [];
  const t = String(testo || "");
  if (!t.trim()) problemi.push("didascalia vuota");
  if (R.didascalia_max && t.length > R.didascalia_max) {
    problemi.push(`didascalia ${t.length} caratteri: massimo ${R.didascalia_max}`);
  }
  const tag = t.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (R.hashtag_max && tag.length > R.hashtag_max) {
    problemi.push(`${tag.length} hashtag: massimo ${R.hashtag_max}`);
  }
  return { ok: problemi.length === 0, problemi, hashtag: tag.length };
}
