/* Le misure della STORIA a cornice (variante B1, scelta da Fede il 27/09/2026
   sull'anteprima `social/fase5/anteprima/ANTEPRIMA_STORIE_A_B1_B2.png`).
   Il post 1080x1350 entra intero nella zona che l'app di Instagram NON copre:
   ~270 px sotto la barra del profilo in alto, ~340 px sopra «Invia messaggio»
   in basso (misura DEDOTTA da guide di terzi: la doc Meta dice solo «9:16»).
   1920 - 270 - 340 = 1310 px di altezza utile → post scalato a 1048x1310. */
export const STORIA = Object.freeze({
  larghezza: 1080, altezza: 1920,
  zona_alto: 270, zona_basso: 340,
  post: { left: 16, top: 270, larghezza: 1048, altezza: 1310, raggio: 14 },
});
