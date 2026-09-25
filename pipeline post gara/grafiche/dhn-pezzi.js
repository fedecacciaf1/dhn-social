/* ===========================================================================
   DHN — GRAFICHE POST-GARA: i pezzi di disegno, uno solo per i dieci template
   ---------------------------------------------------------------------------
   PERCHE' ESISTE
     La riga di classifica, il gradino del podio, la targa col nome e il
     ripiego quando il ritratto non arriva servono a piu' di una grafica.
     Scritti dentro ogni pagina diventano dieci copie che devono dare lo
     stesso risultato — ed e' esattamente il modo in cui, negli overlay, un
     colore giusto in un posto era sbagliato tre righe sotto. Stanno qui.

   REGOLA: qui NON si legge niente. I pezzi ricevono una riga di
   `v_grafica_sessione` (o di una vista classifica) e tornano HTML. Chi legge
   e' `dhn-dati.js`, chi impagina e' il template.
   =========================================================================== */
(function (glob) {
  "use strict";

  /* Il chiaro-scuro: su Haas (#B6BABD) o Cadillac (#FFD700) il testo bianco
     non si legge. Si decide dalla luminanza, non a occhio. */
  function testoSu(colore) {
    var c = (colore || "#5b6e84").replace("#", "");
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    return (0.2126*r + 0.7152*g + 0.0722*b) > 150 ? "chiaro" : "scuro";
  }

  /* I nick DHN non sono cognomi: "Krosso_32Forever" sta dentro solo scendendo
     di corpo. Due gradini invece dei tre puntini: un nome tagliato su una
     grafica pubblica e' un errore, non uno stile. */
  function taglia(nome) {
    var n = (nome || "").length;
    return n > 15 ? "lunghiss" : (n > 11 ? "lungo" : "");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function col(r) { return r.colore_da_stampare || "#5b6e84"; }
  function col2(r) { return r.colore2_da_stampare || r.colore_da_stampare || "#5b6e84"; }
  /* le due variabili che ogni pezzo mette sull'elemento: un colore solo non
     basta a una livrea (Cadillac nero+bianco, Haas bianco+rosso) */
  function tinte(r) {
    return '--squadra:' + esc(col(r)) + ';--squadra2:' + esc(col2(r));
  }
  /* il testo giusto sopra il colore dominante: sta nella tabella
     `scuderia_gioco`, non ricalcolato a occhio in ogni grafica */
  function suTinta(r) { return r.testo_chiaro ? "scuro" : "chiaro"; }
  function nome(r) { return esc(r.nome_da_stampare || r.scuderia_da_stampare || "?"); }
  function iniziale(r) { return esc((r.nome_da_stampare || "?").trim().charAt(0).toUpperCase()); }

  /* al posto del ritratto: il numero di gara se c'e', se no l'iniziale */
  function segno(r) {
    return r.numero_gara != null ? esc(r.numero_gara) : iniziale(r);
  }

  function immagineLogo(r, alt) {
    var l = glob.DHN.logo(r.logo_da_stampare);
    return l ? '<img src="' + esc(l) + '" alt="" onerror="this.remove()">' : (alt || "");
  }

  /* ─────────────────────────────────────────────────────── podio (01/10) */
  function gradino(r, posto) {
    var img = glob.DHN.ritratto(r, "busto");
    return '' +
      '<div class="gradino ' + (posto === 1 ? "primo" : "") + '" style="' + tinte(r) + '">' +
        '<div class="vetrina">' +
          '<span class="cifra" data-n="' + posto + '">' + posto + '</span>' +
          '<span class="senzaritratto" style="display:' + (img ? "none" : "grid") + '">' + segno(r) + '</span>' +
          (img ? '<img class="ritratto" src="' + esc(img) + '" alt="" crossorigin="anonymous" data-ripiego=".senzaritratto">' : '') +
          '<div class="punti"><b>' + glob.DHN.punti(r.punti) + '</b><i>PTS</i></div>' +
        '</div>' +
        '<div class="targa ' + suTinta(r) + '">' +
          '<span class="bandiera">' + glob.DHN.bandiera(r.nazionalita) + '</span>' +
          '<span class="nome ' + taglia(r.nome_da_stampare) + '">' + nome(r) + '</span>' +
        '</div>' +
        '<div class="squadretta">' + immagineLogo(r) +
          '<span>' + esc(r.scuderia_da_stampare || "—") + '</span>' +
          (r.giro_veloce ? ' <span class="tag-fl">GIRO VELOCE</span>' : '') +
        '</div>' +
      '</div>';
  }

  /* ──────────────────────────────────────── la testa sopra il colore ───
     ⚠ NON e' piu' un riquadro. Verdetto di Fede: «quando fa il riquadro la
       sua stona». Aveva ragione: un quadrato con dentro un ritaglio quadrato
       del ritratto mette due bordi duri in una riga che ne ha gia' uno, e la
       testa veniva tagliata a meta' fronte.
       Ora la testa e' scontornata e appoggiata sul campo colore della riga,
       piu' alta della riga stessa, cosi' si taglia da sola sul fondo: legge
       come un ritaglio, non come una miniatura in una casella.
       Il ripiego non e' un box vuoto: e' il numero di gara sul colore. */
  /* ⚠⚠ QUI C'ERA SCRITTO CHE «NELLA CATENA AVATAR NON ESISTE UN RITAGLIO
     TESTA». ERA FALSO, ed e' costato giorni di facce spente e mezzo cantiere
     progettato per niente. L'inquadratura da vicino si chiama `ritratto` e sta
     in `INQ` dall'inizio: ['ritratto', .690, 1.00, 4/5, 28]. I file veri —
     `ritratto.png` 1000x1250 e `ritratto_piccola.webp` 400x500 — sono casco e
     spalle a pieno quadro. La misura da cui nasceva l'errore era su `busto`,
     un'altra inquadratura.
     *Un commento sbagliato nel codice e' peggio di nessun commento: viene
     riletto e ripetuto invece che verificato.* Se un giorno questa riga sembra
     dubbia, si apre il PNG — costa due secondi. */
  /* ⚠ La classe si puo' cambiare, e serve. In GRIGLIA la faccia sta DENTRO
     `.chi`, e li' la regola `.riga .chi > *:not(.posto-testa)` (specificita'
     0,3,0) batte `.riga .testa` (0,2,0) e le rimette `position: relative`:
     misurato sul caso limite, l'immagine entrava nel flusso a 1000x1600 e
     schiacciava il nome a clientWidth ZERO — dieci nomi tagliati su dieci.
     Nelle classifiche non succede perche' li' la faccia sta FUORI da `.chi`.
     Quindi la griglia chiede `ritrattino`, che ha un posto riservato suo. */
  function faccina(r, classe) {
    /* ⚠⚠ 12/09/2026 — ACCESE DI SERIE, e il motivo per cui erano spente NON
       ESISTEVA. In memoria c'era scritto che `ritratto`/`ritratto_piccola`
       sono «il busto in due misure, nessuna delle due e' un primo piano».
       Guardati i file veri nel bucket: `ritratto.png` (1000x1250) e
       `ritratto_piccola.webp` (400x500) sono un PRIMO PIANO — casco e spalle,
       pieno quadro — anche sul pilota che la nota dava per il caso peggiore.
       In `INQ` (avatar-3d.html) l'inquadratura si chiama `ritratto`:
       ['ritratto', .690, 1.00, 4/5, 28] — dal 69% dell'altezza del corpo in
       su. Era li' dall'inizio.
       La differenza di misura fra un pilota e l'altro — che era il difetto
       vero — la livella `incastraGruppo()`. `?facce=0` le rispegne. */
    var vuoleFacce = glob.DHN.param("facce", "1") === "1";
    var f = vuoleFacce ? glob.DHN.ritratto(r, "piccola") : null;
    var c = classe || "testa";
    /* ⚠⚠ 12/09/2026 — IL RIPIEGO SI SCRIVE SEMPRE, ANCHE QUANDO L'IMMAGINE C'E'.
       Prima era un `onerror="this.remove()"`: se il ritratto non arrivava
       l'immagine spariva e restava un BUCO. La regola del sito, pagata in
       `live.html` (`avFail()`), e' a DUE gradini e non lascia mai un buco:
       ritratto -> avatar Discord -> iniziali. Qui il primo gradino lo da'
       `DHN.ritratto(r,'piccola')`, il secondo e' `data-passo`, il terzo e'
       questo span, che sta in pagina spento e lo accende
       `DHN.ripiegoImmagini()` — che le 21 grafiche chiamano gia' tutte.
       ⚠ Quel consumatore ESISTEVA, in `dhn-dati.js`: cercandolo solo qui in
       `dhn-pezzi.js` l'avevo dato per mancante e ne avevo scritto un secondo.
       *Due meccanismi per la stessa cosa prima o poi divergono: il posto
       giusto era quello che c'era.* Qui mancava solo di ARRIVARCI, perche'
       `faccina()` aveva un `onerror="this.remove()"` che il ripiego non lo
       chiamava mai. */
    var secondo = (r.avatar_url && r.avatar_url !== f) ? r.avatar_url : "";
    return '<span class="testa-vuota" style="display:' + (f ? "none" : "grid") + '">' + segno(r) + '</span>' +
      (f ? '<img class="' + c + '" src="' + esc(f) + '" alt="" crossorigin="anonymous"'
           + ' data-ripiego=".testa-vuota"'
           + (secondo ? ' data-passo="' + esc(secondo) + '"' : '') + '>' : '');
  }

  /* ────────────────────────────── riga risultato di sessione (01/10/07) */
  function riga(r, opzioni) {
    var o = opzioni || {};
    var fuori = (r.gap_testo === "DNF" || r.gap_testo === "DSQ");
    var valore = (Number(r.punti) > 0 && !o.mostraTempo)
      ? glob.DHN.punti(r.punti) + '<small>PTS</small>'
      : '<span class="gap ' + (fuori ? "dnf" : "") + '">' +
          esc(o.mostraTempo ? (r.best_str || r.gap_testo || "—") : (r.gap_testo || "—")) + '</span>';
    return '' +
      '<div class="riga ' + (fuori ? "fuori" : "") + '" style="' + tinte(r) + '">' +
        '<div class="pos">' + esc(r.pos) + '</div>' +
        '<div class="barra"></div>' +
        '<div class="campo-squadra"></div>' +
        '<span class="posto-faccia in-riga">' + faccina(r, "ritrattino") + '</span>' +
        '<div class="chi"><span class="posto-testa"></span>' +
          '<span class="numero">' + (r.numero_gara != null ? "#" + esc(r.numero_gara) : "") + '</span>' +
          '<span class="nome ' + taglia(r.nome_da_stampare) + '">' + nome(r) + '</span>' +
          (r.giro_veloce ? '<span class="tag-fl">GV</span>' : '') +
        '</div>' +
        '<div class="squadra">' + immagineLogo(r) +
          '<span>' + esc(r.scuderia_da_stampare || "—") + '</span>' +
        '</div>' +
        '<div class="valore">' + valore + '</div>' +
      '</div>';
  }

  /* ─────────────────────────────────── la freccia del movimento (03/04) */
  function movimento(m) {
    var n = Number(m || 0);
    if (n > 0) return '<span class="mov su">▲</span>';
    if (n < 0) return '<span class="mov giu">▼</span>';
    return '<span class="mov fermo">–</span>';
  }

  /* ──────────────────────────────────── riga classifica piloti (03) */
  function rigaClassificaPilota(r) {
    return '' +
      '<div class="riga cls" style="' + tinte(r) + '">' +
        '<div class="pos">' + esc(r.pos) + '</div>' +
        '<div class="barra"></div>' +
        '<div class="campo-squadra"></div>' +
        '<span class="posto-faccia in-riga">' + faccina(r, "ritrattino") + '</span>' +
        '<div class="chi"><span class="posto-testa"></span>' +
          '<span class="nome ' + taglia(r.nome_da_stampare) + '">' + nome(r) + '</span>' +
          (Number(r.punti_tappa) > 0
            ? '<span class="delta piu">+' + glob.DHN.punti(r.punti_tappa) + '</span>' : '') +
        '</div>' +
        '<div class="squadra">' + immagineLogo(r) +
          '<span>' + esc(r.scuderia_da_stampare || "—") + '</span>' +
        '</div>' +
        /* ⚠ 12/09/2026 — via l'etichetta «PUNTI», verdetto di Fede. In una
           classifica la colonna dei punti non ha bisogno di dire che sono
           punti: e' l'informazione ferma che ripete se stessa, ed e' la prima
           che si toglie quando lo spazio serve. */
        '<div class="valore">' + glob.DHN.punti(r.punti_tot) + '</div>' +
        movimento(r.movimento) +
      '</div>';
  }

  /* ─────────────────────────────────── riga classifica scuderie (04) */
  function rigaClassificaSquadra(r) {
    return '' +
      '<div class="riga cls squadre" style="' + tinte(r) + '">' +
        '<div class="pos">' + esc(r.pos) + '</div>' +
        '<div class="campo"></div>' +
        '<div class="nomone">' + immagineLogo(r) +
          '<span>' + esc(r.scuderia_da_stampare || "—") + '</span>' +
          (Number(r.punti_tappa) > 0
            ? '<span class="delta piu">+' + glob.DHN.punti(r.punti_tappa) + '</span>' : '') +
        '</div>' +
        /* ⚠ 12/09/2026 — via l'etichetta «PUNTI», verdetto di Fede. In una
           classifica la colonna dei punti non ha bisogno di dire che sono
           punti: e' l'informazione ferma che ripete se stessa, ed e' la prima
           che si toglie quando lo spazio serve. */
        '<div class="valore">' + glob.DHN.punti(r.punti_tot) + '</div>' +
        movimento(r.movimento) +
      '</div>';
  }

  /* ───────────────────────── il pilota solo a tutta pagina (02/05/09) */
  /* ═══════════════════ IL VESTITO NUOVO — A-01, 23/09/2026, scelte di Cava ═══
     Fondo CARBONE + alone nel colore della scuderia + i LOGHI della scuderia
     in fila dentro l'alone (sotto la vignettatura nera: fuori dal colore non
     si vedono) + la linea ECG del marchio, LISCIA, da bordo a bordo + il
     BUSTO grande (testa e petto) invece della figura intera.
     ⚠ Niente piu' tappeto obliquo di parole ne' lame diagonali: Cava ha
       scelto «niente diagonali» e i loghi al posto del tappeto. `parolaTappeto`
       e `tappeto` restano accettati (chi chiama non cambia) ma non si usano.
     `dato` = {valore, etichetta} in alto a destra del blocco testo.
     `opz.nomeGrande` (02 VINCITORE) = la gerarchia rovesciata voluta da Cava:
       il NOME e' la cosa grande, a tutta larghezza; la parola sta sopra in
       un'etichetta arancio. Senza, resta la parola grande col nome spaziato
       sopra (le altre grafiche della famiglia, finche' i loro passi non le
       rifanno). Le misure le finisce `incastraTutte()` (busto e nome). */
  function solo(r, parola, sottoparola, dato, opz) {
    var o = opz || {};
    var img = glob.DHN.ritratto(r, "busto");
    var cl = parola.length <= 5 ? "corta" : (parola.length >= 10 ? "lunga" : "");
    var logo = glob.DHN.logo(r.logo_da_stampare), loghi = "";
    if (logo) {
      var riga = "";
      for (var c = 0; c < 11; c++) riga += '<img src="' + esc(logo) + '" alt="" onerror="this.style.visibility=\'hidden\'">';
      for (var rr = 0; rr < 9; rr++) loghi += '<div class="rl">' + riga + '</div>';
      loghi = '<div class="zona-loghi"><div class="loghi">' + loghi + '</div></div>';
    }
    var testo = o.nomeGrande
      ? '<div class="etichetta">' + esc(parola) + '</div>' +
        '<div class="nomone"><span>' + nome(r) + '</span></div>'
      : '<div class="nomino">' + nome(r) + '</div>' +
        '<div class="parolona ' + cl + '">' + esc(parola) + '</div>';
    return '' +
      '<div class="solo' + (o.nomeGrande ? ' nome-grande' : '') + '" style="' + tinte(r) + '">' +
        '<div class="campo"></div><div class="alone"></div>' + loghi +
        '<div class="ecg-riga"><i></i></div>' +
        '<span class="senzafigura" style="display:' + (img ? "none" : "block") + '">' + segno(r) + '</span>' +
        (img ? '<img class="figura busto" src="' + esc(img) + '" alt="" crossorigin="anonymous" data-ripiego=".senzafigura">' : '') +
        '<div class="velo"></div>' +
        testo +
        (dato ? '<div class="dato"><b>' + esc(dato.valore) + '</b><i>' + esc(dato.etichetta) + '</i></div>' : '') +
        '<div class="sottoparola">' + esc(sottoparola) + '</div>' +
        '<div class="squadrina">' + immagineLogo(r) +
          '<span>' + esc(r.scuderia_da_stampare || "—") + '</span></div>' +
        '<img class="marchione" src="' + esc(glob.DHN.BRAND) + '" alt="">' +
      '</div>';
  }

  /* Il busto: GRANDE, la testa appena sotto la testata e il petto tagliato
     dal bordo in basso (come la WINNER F1). Si misura sul contorno vero
     (`contorno()`), non sulla tela dell'immagine: i busti hanno margini
     diversi. Se il corpo e' molto largo (braccia aperte) si scende di scala
     invece di farlo uscire di piu' di tanto dai lati.
     ⚠ Se la misura non si puo' fare resta il CSS (in basso, centrato). */
  async function piazzaBusti(radice) {
    var imgs = [].slice.call((radice || document).querySelectorAll("img.busto"));
    return Promise.all(imgs.map(async function (im) {
      await (im.complete ? null : new Promise(function (ok) {
        im.addEventListener("load", ok); im.addEventListener("error", ok);
      }));
      if (!im.naturalWidth) return null;                // c'e' il ripiego
      var box = im.parentElement, b = await contorno(im.currentSrc || im.src);
      var W = box.clientWidth, H = box.clientHeight;
      if (!b || !W || !H) return null;
      var cima = (H > 1500 ? 252 : 132);                  // storia: piu' giu'
      var hImg = (H - cima) / b.altoF, wImg = hImg * b.W / b.H;
      var largo = wImg * b.largoF;
      if (largo > W * 1.45) { var k = W * 1.45 / largo; hImg *= k; wImg *= k; }
      var cx = (b.sxF + 1 - b.dxF) / 2;
      im.style.width = wImg + "px"; im.style.height = hImg + "px";
      im.style.left = (W / 2 - cx * wImg) + "px";
      im.style.top = (H - (1 - b.sottoF) * hImg) + "px";
      im.style.bottom = "auto"; im.style.transform = "none";
      return true;
    }));
  }

  /* Il nome grande (02): prende tutta la larghezza, fino a 250 px; un nome
     da 22 caratteri si rimpicciolisce, non si taglia. L'etichetta e il dato
     si mettono SUBITO SOPRA il nome, qualunque altezza abbia preso.
     ⚠ Si misura dopo `fontPronti()`: col font di ripiego la larghezza e'
       un'altra, e il nome usciva piccolo (visto al primo giro). */
  async function nomiGrandi(radice) {
    var els = [].slice.call((radice || document).querySelectorAll(".solo.nome-grande .nomone"));
    if (!els.length) return [];
    await fontPronti(radice);
    return els.map(function (el) {
      var sp = el.firstChild, solo = el.parentElement;
      el.style.fontSize = "100px";
      var W = el.offsetWidth, w = sp.offsetWidth;
      if (!W || !w) return null;
      var f = Math.min(250, 100 * W / w);
      el.style.fontSize = f + "px";
      var giu = parseFloat(glob.getComputedStyle(el).bottom) || 0;
      var cima = giu + f * 0.86;
      var et = solo.querySelector(".etichetta"), da = solo.querySelector(".dato");
      if (et) et.style.bottom = (cima + 22) + "px";
      if (da) da.style.bottom = (cima + 22) + "px";
      return f;
    });
  }

  /* ──────────────────────────────── una colonna di line-up (08) */
  function colonna(r, posto) {
    var img = glob.DHN.ritratto(r, "figura");
    var ord = { 1: "st", 2: "nd", 3: "rd" }[posto] || "th";
    return '' +
      '<div class="colonna" style="' + tinte(r) + '">' +
        /* il ripiego prima dell'immagine e sempre in pagina: vedi `faccina()`.
           ⚠ Lo slot della colonna e' ALTO (scontorno in piedi): per la regola
           del sito una foto 1:1 qui darebbe un testone, quindi NIENTE avatar
           come secondo gradino — si passa direttamente al segno. */
        '<span class="senzaritratto" style="display:' + (img ? "none" : "grid") + '">' + segno(r) + '</span>' +
        (img ? '<img class="figurina" src="' + esc(img) + '" alt="" crossorigin="anonymous"'
             + ' data-ripiego=".senzaritratto">' : '') +
        immagineLogo({ logo_da_stampare: r.logo_da_stampare }, "").replace('<img', '<img class="stemma"') +
        '<div class="ord">' + posto + '<sup>' + ord + '</sup></div>' +
        '<div class="chi2">' + nome(r) + '</div>' +
      '</div>';
  }


  /* ═══════════════════════════════════════════════════════════════════════
     INCASTRA — la figura si misura sul CONTORNO, non sulla tela
     -----------------------------------------------------------------------
     PERCHE' ESISTE (misurato il 06/09/2026, sei piloti di Monza)
       I ritratti stanno tutti su tela 1000x1600, ma il corpo dentro no:

         Xawior        alto 82%   margine sx  4%   dx 32%
         Cavastark     alto 91%   margine sx 31%   dx 21%
         PRESTIGE      alto 89%   margine sx 26%   dx 20%
         Turiddu-pal   alto 89%   margine sx 18%   dx 12%
         FedeCaccia    alto 91%   margine sx 18%   dx 16%
         italo95italia alto 89%   margine sx 26%   dx 20%

       Xawior ha le braccia in alto (posa a cuore): riempie NOVE PUNTI in meno
       degli altri, e il suo centro sta 14 punti a sinistra del centro della
       tela. Con `height: 78%` + `translateX(-50%)` — cioe' misurando la TELA —
       esce piu' piccolo di tutti e spostato. E' esattamente il difetto che
       Fede ha visto. Alzare l'altezza per lui taglierebbe gli altri.

     COME
       Si legge l'alpha in un quadrato da 100x100 (diecimila pixel, pochi ms),
       si trova il rettangolo del corpo, e si posiziona l'immagine perche' il
       CORPO occupi la quota chiesta e stia centrato per il suo centro vero.
       Serve il CORS sui ritratti: verificato, `Access-Control-Allow-Origin: *`.

     ⚠ Se la misura non si puo' fare (rete, CORS, browser vecchio) NON si
       rompe niente: resta il posizionamento del CSS, che e' quello di prima.
     ═══════════════════════════════════════════════════════════════════════ */
  var _contorni = {};          // per URL: la galleria apre dieci iframe

  async function contorno(url) {
    if (_contorni[url] !== undefined) return _contorni[url];
    try {
      var bmp = await createImageBitmap(await fetch(url, { mode: "cors" }).then(function (r) { return r.blob(); }));
      var S = 100;
      var c = (typeof OffscreenCanvas !== "undefined") ? new OffscreenCanvas(S, S)
            : Object.assign(document.createElement("canvas"), { width: S, height: S });
      var cx = c.getContext("2d", { willReadFrequently: true });
      cx.clearRect(0, 0, S, S);
      cx.drawImage(bmp, 0, 0, S, S);
      var d = cx.getImageData(0, 0, S, S).data;
      var x0 = S, y0 = S, x1 = -1, y1 = -1;
      for (var i = 0; i < S * S; i++) {
        if (d[i * 4 + 3] > 12) {
          var px = i % S, py = (i - px) / S;
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
      }
      if (x1 < 0) { _contorni[url] = null; return null; }
      _contorni[url] = {
        W: bmp.width, H: bmp.height,
        altoF: (y1 - y0 + 1) / S, largoF: (x1 - x0 + 1) / S,
        sopraF: y0 / S, sottoF: (S - 1 - y1) / S,
        sxF: x0 / S, dxF: (S - 1 - x1) / S
      };
      return _contorni[url];
    } catch (e) {
      _contorni[url] = null;
      return null;
    }
  }

  async function incastra(img, opz) {
    var o = opz || {};
    var quota = o.quota != null ? o.quota : 0.92;   // quanta altezza del box prende il CORPO
    var giu   = o.giu   != null ? o.giu   : 0;      // px dal fondo del box
    var box = img.parentElement;
    if (!box) return;
    var b = await contorno(img.currentSrc || img.src);
    var Cw = box.clientWidth, Ch = box.clientHeight;
    if (!b || !Cw || !Ch) return;                   // resta il CSS
    /* ⚠ La quota si calcola sull'altezza DISPONIBILE (Ch - giu), non su
       tutta la colonna: con `giu` diverso da zero l'immagine sfondava sopra
       il box e la testa veniva tagliata. E' il difetto di SCHIERAMENTO e LA
       GRIGLIA visto il 06/09 — Xawior finiva 157px sopra il bordo. */
    var hUtile = Math.max(40, Ch - giu);
    var hImg = (quota * hUtile) / b.altoF;
    var wImg = hImg * (b.W / b.H);
    /* ⚠ Non basta incastrare in altezza: un corpo LARGO in una colonna
       STRETTA sborda di lato. Misurato dal banco il 06/09: nella colonna
       dello SCHIERAMENTO (196px) il corpo usciva a 272px, cioe' 38px fuori
       da ogni parte. Se la larghezza non ci sta, si scende di scala: si
       incastra DENTRO il box, non solo in altezza. */
    var largoMax = (opz && opz.largoMax != null) ? opz.largoMax : 0.98;
    var largoCorpo = wImg * b.largoF;
    if (largoCorpo > Cw * largoMax) {
      var kw = (Cw * largoMax) / largoCorpo;
      hImg *= kw; wImg *= kw;
    }
    var centroX = (b.sxF + (1 - b.dxF)) / 2;
    img.style.position = "absolute";
    img.style.height = hImg + "px";
    img.style.width = "auto";
    img.style.left = (Cw / 2 - centroX * wImg) + "px";
    img.style.top  = ((Ch - giu) - (1 - b.sottoF) * hImg) + "px";
    /* se comunque sborda sopra, si scende di scala invece di tagliare la testa */
    var sopraPx = ((Ch - giu) - (1 - b.sottoF) * hImg) + b.sopraF * hImg;
    if (sopraPx < 0) {
      var k = (hUtile) / (hImg * (b.altoF + b.sopraF));
      hImg = hImg * k; wImg = wImg * k;
      img.style.height = hImg + "px";
      img.style.height = hImg + "px";
      img.style.left = (Cw / 2 - centroX * wImg) + "px";
      img.style.top  = ((Ch - giu) - (1 - b.sottoF) * hImg) + "px";
    }
    img.style.right = "auto"; img.style.bottom = "auto";
    img.style.transform = "none";
    img.dataset.incastrata = "1";
  }

  /* Tutte le figure di una grafica, in parallelo. Le grafiche la chiamano
     dopo aver messo l'HTML in pagina. */
  /* ═══════════════ L'INCASTRO A GRUPPO — 12/09/2026 ═══════════════════════
     ⚠⚠ PRIMA ERA PER IMMAGINE, ED E' IL MOTIVO PER CUI LE FIGURE USCIVANO DI
     MISURE DIVERSE. Verdetto di Fede: «peccato che tutti gli avatar abbiano
     dimensionamenti diversi». Misurato sul caso limite 901, nello
     SCHIERAMENTO: il corpo occupava dal 50,9% al 79,4% del riquadro, cioe'
     28,5 punti di scarto.

     La causa non era un errore di conto: era la STRUTTURA. `incastra()`
     chiede una quota di altezza, poi — giustamente — rimpicciolisce se il
     corpo sborda di lato. Ma in una colonna da 192 px un corpo largo (braccia
     aperte) viene ridotto molto e uno stretto per niente: ognuno finiva alla
     sua misura, ciascuno coerente con se stesso. E' la trappola gia' scritta
     in casa: *due conti separati che devono dare lo stesso numero prima o poi
     non lo danno.*

     La cura e' una passata SOLA per gruppo: si misura quanta quota ogni
     figura potrebbe prendere restando dentro la sua colonna, si tiene la PIU'
     BASSA, e la si da' a tutte. Cosi' il corpo occupa la stessa frazione del
     riquadro per chiunque — e nessuno sborda, perche' il vincolo di chi sta
     piu' stretto vale per tutti.
     Costo dichiarato: con una posa molto larga in griglia tutte le figure
     diventano un po' piu' piccole. E' il prezzo giusto: meglio cinque figure
     uguali e un po' piu' piccole che cinque di misure diverse. */
  function incastraTutte(radice) {
    /* ⚠ SOLO PER IL BANCO (`controlla_capienza.mjs --rompi`): spegne
       l'incastro per far vedere che senza, le figure escono di misure
       diverse. Non ha effetto se la variabile non c'e', che e' sempre. */
    if (glob.__rompiIncastro) return Promise.resolve([]);
    var elenchi = [
      /* ⚠ il busto del pilota solo porta ANCHE `figura` (lo cercano i
         controlli del banco come «lo slot ha l'immagine»), ma lo piazza
         `piazzaBusti()`: qui si salta, se no due conti lo muovono a turno. */
      [".figura:not(.busto)", { quota: 0.94, giu: 0 }],
      [".ritratto", { quota: 0.96, giu: 0 }],
      [".figurina", { quota: 0.92, giu: 96 }],
      [".ritrattino", { quota: 0.98, giu: 0 }]
    ];
    return Promise.all(elenchi.map(function (par) {
      return incastraGruppo(radice, par[0], par[1]);
    }).concat([piazzaBusti(radice), nomiGrandi(radice)]));
  }

  async function incastraGruppo(radice, selettore, opz) {
    var imgs = [].slice.call((radice || document).querySelectorAll("img" + selettore));
    if (!imgs.length) return [];
    /* prima si aspetta che siano TUTTE arrivate: una misura su un'immagine
       non ancora caricata torna vuota e falserebbe il minimo del gruppo */
    await Promise.all(imgs.map(function (im) {
      return im.complete ? null : new Promise(function (ok) {
        im.addEventListener("load", ok); im.addEventListener("error", ok);
      });
    }));

    /* ⚠⚠ UN'IMMAGINE CHE NON ARRIVERA' MAI NON E' «NON MISURABILE»: NON C'E'.
       Trovato il 12/09 col banco nuovo (una riga col ritratto 404): la regola
       «o tutte misurate, o tutte uniformi» qui si girava contro: quel 404
       faceva rinunciare all'incastro anche alle altre dieci, e la quota di
       corpo passava da 1,4 a **37,5 punti** di scarto su una pagina dove
       l'unico difetto era una riga senza faccia. Nel PNG non si vede una
       figura mancante: si vedono tutte le altre sbagliate.
       Quelle qui sotto sono gia' passate dall'attesa di load/error: chi ha
       `complete && !naturalWidth` ha fallito per davvero, al suo posto c'e'
       il ripiego, e non fa piu' parte del gruppo. Il ripiego uniforme resta
       per l'altro caso, quello vero: la tela sporcata dal CORS. */
    var cadute = imgs.filter(function (im) { return im.complete && !im.naturalWidth; });
    if (cadute.length) {
      imgs = imgs.filter(function (im) { return !(im.complete && !im.naturalWidth); });
      if (glob.console) console.warn("incastra: " + cadute.length + " immagini non arrivate ("
        + selettore + "): fuori dal gruppo, al loro posto c'e' il ripiego");
      if (!imgs.length) return [];
    }

    var quotaChiesta = opz.quota != null ? opz.quota : 0.92;
    var giu = opz.giu != null ? opz.giu : 0;
    var largoMax = opz.largoMax != null ? opz.largoMax : 0.98;

    var pezzi = [];
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], box = im.parentElement;
      if (!box) continue;
      var b = null;
      try { b = await contorno(im.currentSrc || im.src); } catch (e) { b = null; }
      var Cw = box.clientWidth, Ch = box.clientHeight;
      if (!b || !Cw || !Ch) continue;              // non misurabile: resta il CSS
      var hUtile = Math.max(40, Ch - giu);
      /* la quota massima che questa figura puo' prendere restando dentro la
         larghezza: si ricava dalla stessa catena di prima, risolta per quota */
      var quotaLarg = (Cw * largoMax * b.altoF * b.H) / (hUtile * b.W * b.largoF);
      pezzi.push({ im: im, b: b, Cw: Cw, hUtile: hUtile,
                   tetto: Math.min(quotaChiesta, quotaLarg) });
    }
    /* ⚠⚠ O TUTTE MISURATE, O TUTTE UNIFORMI. Se anche UNA figura del gruppo
       non si e' potuta misurare (tela sporcata dal CORS, immagine non
       arrivata), livellare solo le altre lascia un gruppo MISTO: alcune
       incastrate sul corpo, altre al CSS — cioe' esattamente il difetto che
       si stava curando, ma piu' difficile da vedere perche' quasi tutte sono
       giuste. In quel caso si rinuncia alla misura e si mette a TUTTE lo
       stesso ritaglio: meno preciso, ma uguale per tutti.
       Il ripiego si dichiara, non si subisce: chi guarda il banco lo vede. */
    if (pezzi.length !== imgs.length) {
      imgs.forEach(function (im) {
        im.style.position = "absolute"; im.style.left = "50%"; im.style.bottom = "0";
        im.style.height = Math.round(quotaChiesta * 100) + "%"; im.style.width = "auto";
        im.style.maxWidth = "none"; im.style.transform = "translateX(-50%)";
        im.style.objectFit = "contain"; im.style.objectPosition = "bottom";
      });
      if (glob.console) console.warn("incastra: " + (imgs.length - pezzi.length) + " figure su "
        + imgs.length + " non misurabili (" + selettore + "): ripiego uniforme per tutte");
      return { ripiego: true, misurate: pezzi.length, totali: imgs.length };
    }
    if (!pezzi.length) return [];

    /* ⚠ IL MINIMO DEL GRUPPO, non la media: con la media chi sta piu' stretto
       sborderebbe comunque, e si tornerebbe a rincorrere il sintomo. */
    var comune = pezzi.reduce(function (m, p) { return Math.min(m, p.tetto); }, quotaChiesta);

    pezzi.forEach(function (p) {
      var hImg = (comune * p.hUtile) / p.b.altoF;
      var wImg = hImg * (p.b.W / p.b.H);
      var centroX = (p.b.sxF + (1 - p.b.dxF)) / 2;
      p.im.style.position = "absolute";
      p.im.style.height = hImg + "px";
      p.im.style.width = "auto";
      p.im.style.maxWidth = "none";
      p.im.style.bottom = (giu - (1 - p.b.giuF) * hImg) + "px";
      p.im.style.left = (p.Cw / 2 - centroX * wImg) + "px";
      p.im.style.transform = "none";
    });
    return pezzi.map(function (p) { return p.tetto; });
  }

  /* ═══════════════ IL TESTO CHE ENTRA — 12/09/2026 ═══════════════════════
     ⚠ `taglia()` decideva la misura dal NUMERO DI CARATTERI: tre scalini,
     >11 e >15. Ma i caratteri non sono i pixel — «MarcoVerstappen2005» e
     «NiccoloDeAngelisRacing» finivano tutti e due nello scalino piu' piccolo
     e sbordavano lo stesso, e l'ellissi si mangiava il nome. Un nome coi
     puntini non e' uno stile: e' un dato perso.
     Qui si MISURA: si rimpicciolisce finche' ci sta, con un fondo sotto cui
     non si scende.
     ⚠ Va fatto a font PRONTI. Col ripiego di sistema le larghezze sono altre
     e il risultato resta sbagliato per tutto il turno — trappola gia' pagata
     in casa. E si riparte SEMPRE dalla misura di partenza, se no due passate
     di seguito rimpiccioliscono due volte. */
  /* Il fondo sotto cui non si scende, per famiglia di elemento. Se nemmeno
     li' ci sta, il controllo diventa rosso: vuol dire che la casella e'
     troppo stretta per quel dato, e la cura e' la casella, non il carattere. */
  /* ⚠⚠ `.chi` E' NELL'ELENCO, E NON E' UN DOPPIONE DI `.nome`.
     Nel flex della riga il nome divide la larghezza con il `+26` dei punti di
     tappa: misurando `.nome` da solo il conto tornava, e a schermo usciva
     «ITALO95ITA…» con i puntini. Il controllo era verde su una grafica
     tagliata — cioe' peggio di nessun controllo.
     Si misura il contenitore, che e' quello che ha davvero la larghezza. */
  var MINIMI = { ".chi": 16, ".nome": 18, ".nomone": 20, ".squadra": 10,
                 ".chi2": 10, ".n": 14, ".valore": 15,
                 /* il sottotitolo e l'avvertenza: `nowrap` nel CSS, quindi se
                    sono lunghi sbordano, e qui rientrano rimpicciolendosi */
                 ".titolo .sotto": 12, ".titolo .avvertenza": 10 };

  /* ═══════════════ I FONT DEVONO ESSERCI PRIMA DI MISURARE ══════════════
     ⚠⚠ `await document.fonts.ready` NON BASTA, ed e' il difetto che ha tenuto
     «ITALO95ITA…» tagliato con tutti i controlli verdi. Con
     `font-display: block` un font viene CHIESTO solo quando serve a del testo
     gia' in pagina: `fonts.ready` si risolve sulle richieste in corso, che a
     quel punto sono zero. Si misurava col ripiego di sistema — piu' stretto —
     si concludeva che il nome ci stava, e poi arrivava Saira Condensed e
     l'ellissi se lo mangiava. La misura era giusta su uno stato transitorio.
     Qui i font si CHIEDONO per nome, uno per uno, e solo dopo si misura. */
  async function fontPronti(radice) {
    if (!document.fonts) return false;
    var chieste = [];
    (radice || document).querySelectorAll("*").forEach(function (e) {
      if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.textContent.trim()) return;
      var st = glob.getComputedStyle(e);
      var fam = st.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
      if (!fam) return;
      var chiave = st.fontWeight + " " + st.fontSize + ' "' + fam + '"';
      if (chieste.indexOf(chiave) < 0) chieste.push(chiave);
    });
    await Promise.all(chieste.map(function (c) {
      return document.fonts.load(c).catch(function () {});
    }));
    await document.fonts.ready;
    return chieste.length;
  }

  /* ⚠⚠ SI RESTRINGE TUTTO IL BLOCCO, NON SOLO L'ELEMENTO CHE SBORDA.
     Primo giro sbagliato: rimpicciolivo il `font-size` del contenitore, ma
     dentro c'e' un figlio con la SUA misura scritta a mano — `.valore` a 28 px
     contiene `.gap` a 22 px — e il figlio non eredita niente. Risultato: la
     misura cambiava e il testo sbordava uguale. In GRIGLIA erano 20 elementi
     su 20, compreso un tempo sul giro.
     Quindi si calcola un FATTORE e lo si applica al blocco e a tutti i suoi
     discendenti, partendo sempre dalle misure di partenza. */
  /* la larghezza VERA del testo dentro un elemento, coi decimali */
  function sborda(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    var testo = r.getBoundingClientRect().width;
    var cs = glob.getComputedStyle(el);
    var box = el.getBoundingClientRect().width
            - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)
            - parseFloat(cs.borderLeftWidth || 0) - parseFloat(cs.borderRightWidth || 0);
    return testo > box + 0.5;
  }

  /* ⚠⚠ «E' TAGLIATO?» SI CHIEDE A CHI RITAGLIA, NON ALL'ELEMENTO.
     Primo giro del controllo in altezza: confrontavo `scrollHeight` con
     `clientHeight` sull'elemento — 22 falsi allarmi, perche' il riquadro dei
     glifi e' quasi sempre piu' alto del line-box e non viene tagliato da
     nessuno. Quello che taglia e' l'antenato con `overflow: hidden` (qui la
     riga). Quindi si cerca QUELLO e si guarda se l'inchiostro del testo esce
     dal suo rettangolo. Niente clipper, niente taglio. */
  function ritagliatore(el) {
    var n = el.parentElement;
    while (n && n !== document.body) {
      var o = glob.getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(o.overflowY) || /hidden|clip|auto|scroll/.test(o.overflowX)) return n;
      n = n.parentElement;
    }
    return null;
  }

  /* ⚠⚠ E IL CONFRONTO SI FA CON L'INCHIOSTRO, NON COL RETTANGOLO DEL TESTO.
     Secondo giro: confrontavo il rect del `Range` col ritagliatore. Misurato
     il 12/09: per un nodo di testo Chrome restituisce il RIQUADRO DEL FONT
     (ascendente + discendente della famiglia), non i glifi. Sulla 19 il «2»
     della posizione a 62 px aveva il rect 1,7 px oltre il fondo riga — ma il
     discendente di quel font e' alto 19 px e la cifra non lo usa: sotto la
     linea di base non c'era un pixel di inchiostro. Falso allarme.
     Qui si ricostruisce la linea di base (cima del rect + ascendente del
     font) e si chiede al canvas quanto inchiostro c'e' DAVVERO sopra e sotto
     (`actualBoundingBox*`, che e' la scatola dei glifi di QUESTA stringa).
     ⚠ E si guardano anche le scatole dei figli che si VEDONO — la pallina
     della mescola ha un fondo colorato: se finisce fuori, e' tagliata anche
     se dentro non ci fosse una lettera. */
  var PENNELLO = null;
  function fontCanvas(cs) {
    return (cs.fontStyle || 'normal') + ' ' + (cs.fontWeight || '400') + ' '
         + cs.fontSize + ' ' + cs.fontFamily;
  }
  function inchiostroTesto(nodo) {
    var testo = nodo.textContent;
    if (!testo || !testo.trim()) return null;
    var r = document.createRange();
    r.selectNode(nodo);
    var righe = r.getClientRects();
    if (!righe.length) return null;
    var cs = glob.getComputedStyle(nodo.parentElement);
    if (!PENNELLO) PENNELLO = document.createElement('canvas').getContext('2d');
    PENNELLO.font = fontCanvas(cs);
    var m;
    try { m = PENNELLO.measureText(testo); } catch (e) { return null; }
    var fbA = m.fontBoundingBoxAscent, fbD = m.fontBoundingBoxDescent;
    if (!(fbA >= 0) || !(fbD >= 0)) return null;         // browser senza metriche: si lascia perdere
    var aA = (m.actualBoundingBoxAscent >= 0) ? m.actualBoundingBoxAscent : fbA;
    var aD = (m.actualBoundingBoxDescent >= 0) ? m.actualBoundingBoxDescent : fbD;
    var alto = null, basso = null;
    for (var i = 0; i < righe.length; i++) {
      var q = righe[i];
      if (!q.height) continue;
      /* mezza interlinea: il rect e' alto quanto il riquadro del font, ma se
         il `line-height` lo stringe o lo allarga la linea di base si sposta */
      var mezza = (q.height - (fbA + fbD)) / 2;
      var base = q.top + mezza + fbA;
      var t = base - aA, b = base + aD;
      if (alto === null || t < alto) alto = t;
      if (basso === null || b > basso) basso = b;
    }
    return (alto === null) ? null : { top: alto, bottom: basso };
  }
  function tingeQualcosa(cs) {
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    var f = cs.backgroundColor || '';
    if (f && f !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/.test(f)) return true;
    return parseFloat(cs.borderTopWidth || 0) > 0 || parseFloat(cs.borderBottomWidth || 0) > 0;
  }
  function mozzato(el) {
    var c = ritagliatore(el);
    if (!c) return false;
    var b = c.getBoundingClientRect();
    var pezzi = [];

    var cam = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    for (var n = cam.nextNode(); n; n = cam.nextNode()) {
      var i = inchiostroTesto(n);
      if (i) pezzi.push(i);
    }
    /* ⚠ Le SCATOLE che si contano sono solo quelle che dipingono E portano
       testo — la pallina della mescola, un pastiglione col numero. Le figure
       e i campi colore NO: escono dalla riga APPOSTA. Il ritratto della
       griglia sta 4,1 px sopra il bordo perche' e' scontornato e deve
       tagliarsi da solo sul fondo (verdetto di Fede, «quando fa il riquadro
       la sua stona»). Contarlo faceva dieci rossi su una grafica giusta:
       un controllo che si lamenta del disegno voluto lo si smette di
       guardare, ed e' peggio di non averlo. */
    [].slice.call(el.querySelectorAll('*')).forEach(function (e) {
      var cs = glob.getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      if (!e.textContent.trim() || !tingeQualcosa(cs)) return;
      var q = e.getBoundingClientRect();
      if (q.height) pezzi.push({ top: q.top, bottom: q.bottom });
    });

    for (var k = 0; k < pezzi.length; k++)
      if (pezzi[k].top < b.top - 0.5 || pezzi[k].bottom > b.bottom + 0.5) return true;
    return false;
  }

  async function testoCheEntra(radice, minimi) {
    await fontPronti(radice);
    var tab = minimi || MINIMI;
    var fatti = [], restano = [];
    Object.keys(tab).forEach(function (sel) {
      (radice || document).querySelectorAll(sel).forEach(function (el) {
        var pezzi = [el].concat([].slice.call(el.querySelectorAll("*")));
        pezzi.forEach(function (e) { e.style.fontSize = ""; });      // da capo, sempre
        var base = pezzi.map(function (e) { return parseFloat(glob.getComputedStyle(e).fontSize) || 16; });
        /* ⚠⚠ SI MISURA IN SUB-PIXEL, NON CON `scrollWidth`.
           `scrollWidth` e `clientWidth` sono INTERI: un testo largo 256,4 px
           in una casella da 256 li fa tornare uguali, il conto dice «ci sta»
           e il browser mette i puntini lo stesso. E' il difetto che ha tenuto
           «ITALO95ITA…» tagliato con tutti i controlli verdi.
           Un margine fisso pero' e' peggio del male: a 2 px restringeva anche
           i punteggi, che non clippano affatto. Un `Range` sul contenuto da la
           larghezza VERA del testo, con i decimali.
           ⚠ Si confrontano due rettangoli, mai un rettangolo con `clientWidth`:
           `adatta()` scala la tela, quindi i rect sono in pixel di SCHERMO. Fra
           loro il confronto regge, misto no. */
        if (!sborda(el)) return;
        var guida = base[0], k = 1, giri = 0;
        while (sborda(el) && guida * k > tab[sel] && giri < 60) {
          k = Math.max(tab[sel] / guida, k - 0.035);
          pezzi.forEach(function (e, i) { e.style.fontSize = (base[i] * k) + "px"; });
          giri++;
        }
        var voce = { sel: sel, testo: (el.textContent || "").trim().slice(0, 24),
                     da: Math.round(guida), a: Math.round(guida * k) };
        fatti.push(voce);
        /* ⚠ se anche al minimo sborda, NON si finge: lo si dice. */
        if (sborda(el)) restano.push(voce);
      });
    });
    return { ridotti: fatti, ancoraLarghi: restano };
  }

  /* la rifinitura: tutto cio' che si puo' misurare solo a contenuto messo.
     L'ordine conta — prima il testo entra (cambia le larghezze), poi le
     figure si incastrano nei riquadri che ne risultano. */
  async function rifinisci(radice) {
    var testo = await testoCheEntra(radice);
    var figure = await incastraTutte(radice);
    return { testo: testo, figure: figure };
  }

  /* Il rimpicciolimento per guardarla a schermo: la tela resta 1080 vera,
     quindi il PNG non cambia di un pixel. */
  function adatta(tela) {
    function f() {
      var z = Math.min(1, (window.innerHeight - 140) / tela.offsetHeight);
      document.body.dataset.zoom = "1";
      tela.style.setProperty("--zoom", z);
      tela.style.marginBottom = (tela.offsetHeight * (z - 1)) + "px";
    }
    f(); window.addEventListener("resize", f);
  }

  /* La testata e il piede, uguali su tutte: si scrivono una volta. */
  /* ⚠ La riga di piede «N AL VIA · N OSPITI» e' stata TOLTA per verdetto di
     Fede («toglierei anche il numero di al via e ospiti, quella riga
     completa»). Il parametro `nota` resta accettato ma non si stampa: chi
     chiama non deve cambiare, e se un giorno serve si riaccende qui. */
  function vesti(info, nota) {
    var m1 = document.getElementById("marchio"), m2 = document.getElementById("marchio2");
    if (m1) m1.src = glob.DHN.BRAND;
    if (m2) m2.src = glob.DHN.BRAND;
    var ev = document.getElementById("evento");
    if (ev) ev.textContent = glob.DHN.occhiello(info);
    var nt = document.getElementById("nota");
    if (nt) nt.remove();
  }


  /* ═══════════════════════════════ IL FONDO DHN — 12/09/2026 ═════════════
     Mette dietro la grafica l'alone nel colore di chi comanda e la linea ECG
     del marchio (vedi `dhn-fondo.css` per come e' stata ritagliata).

     ⚠⚠ IL VINCOLO DI FEDE: «basta che non vada sopra le classifiche e i
     dati». Non si rispetta tarando due numeri a mano: si MISURA dove
     comincia e dove finisce il contenuto, si scrivono le due bande libere in
     `--banda-alta` / `--banda-bassa`, e il CSS ritaglia la linea li' dentro
     con `overflow: hidden`. Cosi' il vincolo lo tiene la geometria: se
     domani le righe diventano dodici, la linea si accorcia da sola invece di
     finire sopra un nome.

     ⚠ Va chiamata DOPO aver riempito il contenuto, se no misura il vuoto. */
  function fondoDhn(tela, opz) {
    var o = opz || {};
    var capo = o.capo || {}, sec = o.secondo || capo;
    tela.style.setProperty("--capo", capo.colore_da_stampare || "#ff7000");
    tela.style.setProperty("--capo2",
      (sec.colore_da_stampare && sec.colore_da_stampare !== capo.colore_da_stampare
        ? sec.colore_da_stampare : capo.colore2_da_stampare) || "#2b6cff");

    /* la diagonalina del titolo se ne va: verdetto di Fede, «non mi dice
       nulla». Sta nel markup delle pagine, quindi si toglie qui una volta. */
    var tg = tela.querySelector(":scope > .taglio");
    if (tg) tg.remove();

    var d = document.createElement("div");
    d.className = "dhn-fondo";
    d.innerHTML = '<i class="alone"></i><i class="alone2"></i>' +
      '<div class="banda alta"><i class="battito"></i></div>' +
      '<div class="banda bassa"><i class="battito"></i></div>';
    tela.insertBefore(d, tela.firstChild);
    tela.classList.add("con-fondo");
    misuraBande(tela, o.contenuto || ".righe");
    return d;
  }

  /* ⚠ SI MISURA CON offsetTop, NON CON getBoundingClientRect().
     `PEZZI.adatta()` mette un `transform: scale()` sulla tela per farla stare
     nella finestra: i rect tornano in pixel di SCHERMO, e un valore letto
     cosi' e riscritto DENTRO la tela sbaglierebbe del fattore di scala —
     giusto a schermo pieno, sbagliato su un portatile, cioe' il tipo di
     difetto che si scopre in onda. `offsetTop` il transform non lo vede.
     E' la stessa trappola gia' registrata per le sorgenti OBS. */
  function misuraBande(tela, selettore) {
    var box = tela.querySelector(selettore);
    if (!box || !box.children.length) return false;
    var figli = box.children;
    var scarto = 0, n = box;
    while (n && n !== tela) { scarto += n.offsetTop; n = n.offsetParent; }
    if (n !== tela) return false;                  // non e' dentro la tela: non si indovina
    var primo = figli[0], ultimo = figli[figli.length - 1];
    var cima  = scarto + primo.offsetTop;
    var fondo = scarto + ultimo.offsetTop + ultimo.offsetHeight;
    tela.style.setProperty("--banda-alta", Math.max(0, cima - 10) + "px");
    tela.style.setProperty("--banda-bassa", (fondo + 10) + "px");
    return { cima: cima, fondo: fondo };
  }


  /* ═══ A-09 — I LOGHI DIETRO, NELLE FASCE (03, 04, 18-21) ═══
     Ogni logo del tappeto si misura una volta (canvas, cache per indirizzo):
     - logo di UN colore solo (Audi, Haas, Williams…): diventa una sagoma,
       bianca sulle fasce scure e nera su quelle chiare. Si legge benissimo.
     - logo con un DISEGNO DENTRO (Ferrari, Mercedes, Red Bull: la luce va dal
       nero al bianco): la sagoma lo svuotava (lo scudo Ferrari senza
       cavallino, visto da Cava il 24/09). Diventa il logo vero in grigio,
       classe `dettaglio`.
     Si chiama da `onload` dell'immagine; se il logo non si puo' misurare lo
     dice in console e resta sagoma. */
  var misureLogo = {};
  function logoTappeto(im) {
    var src = im.currentSrc || im.src;
    if (!(src in misureLogo)) {
      misureLogo[src] = false;
      try {
        var cv = document.createElement("canvas"); cv.width = cv.height = 48;
        var cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, 48, 48);
        var d = cx.getImageData(0, 0, 48, 48).data, lo = 255, hi = 0;
        for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 128) {
          var l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          if (l < lo) lo = l; if (l > hi) hi = l;
        }
        misureLogo[src] = (hi - lo) > 100;
      } catch (e) { console.warn("logo del tappeto non misurabile (" + src + "): " + e.message + " — resta sagoma"); }
    }
    if (misureLogo[src]) im.classList.add("dettaglio");
  }

  glob.PEZZI = {
    testoSu: testoSu, taglia: taglia, esc: esc, col: col, col2: col2,
    tinte: tinte, suTinta: suTinta, nome: nome,
    faccina: faccina, gradino: gradino, riga: riga, movimento: movimento,
    rigaClassificaPilota: rigaClassificaPilota,
    rigaClassificaSquadra: rigaClassificaSquadra,
    solo: solo, colonna: colonna, adatta: adatta, vesti: vesti,
    piazzaBusti: piazzaBusti, nomiGrandi: nomiGrandi,
    contorno: contorno, incastra: incastra, incastraTutte: incastraTutte,
    fondoDhn: fondoDhn, misuraBande: misuraBande,
    testoCheEntra: testoCheEntra, rifinisci: rifinisci, incastraGruppo: incastraGruppo,
    fontPronti: fontPronti, sborda: sborda, mozzato: mozzato, ritagliatore: ritagliatore,
    segno: segno, iniziale: iniziale, immagineLogo: immagineLogo,
    logoTappeto: logoTappeto
  };
})(window);
