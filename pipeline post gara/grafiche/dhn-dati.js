/* ===========================================================================
   DHN — GRAFICHE POST-GARA: lo strato dati, uno solo per tutti i template
   ---------------------------------------------------------------------------
   PERCHE' ESISTE
     I dieci template leggono la STESSA cosa: una sessione (`?storico_id=NNN`)
     o la classifica dopo quella sessione. Scritto dentro ogni pagina, sarebbe
     dieci volte la stessa fetch e dieci occasioni di scriverla diversa. Sta
     qui una volta.

   LA REGOLA CHE NON SI VIOLA
     I template NON conoscono `live_storico`, non conoscono il motore, non
     sanno cosa sia un car_idx. Leggono SOLO le viste:
       v_grafica_sessione            una riga per pilota per sessione
       v_grafica_classifica_piloti   la classifica DOPO quella sessione
       v_grafica_classifica_scuderie idem, per squadra del gioco
       v_grafica_sessioni_valide     l'elenco, per la galleria
     Se una grafica ha bisogno di un dato che non c'e' in vista, si aggiunge
     alla VISTA, non si va a pescare nel motore dalla pagina.

   ⚠ IL COLORE E IL NOME SQUADRA ARRIVANO DAL GIOCO
     `colore_da_stampare` / `scuderia_da_stampare` / `logo_da_stampare` sono
     gia' risolti in vista con l'ordine di `squadra_kit.js`: prima il team
     in-gioco (team_id, dizionario 476-486), poi l'anagrafica DHN. Qui non si
     decide niente, si stampa. Il dizionario SQL e quello JS sono confrontati
     da `banco/banco_scuderie_gioco.py`.

   ⚠ SERVE UN SERVER, NON IL DOPPIO CLIC
     Come per la galleria overlay: da `file://` i loghi (percorso relativo che
     esce dalla cartella) e le fetch si rompono. Si apre con
     GRAFICHE_POST_GARA.bat, che serve la RADICE del progetto su 127.0.0.1:8123.
   =========================================================================== */
(function (glob) {
  "use strict";

  var SB_URL = "https://afzgermmvjuukojxrhet.supabase.co";
  var SB_KEY = "sb_publishable_sA_339mSUA_HI5bUAivhzw_dBv2WZ33";   // stessa dei file in sito/
  var LOGHI  = "../../dhn_telemetry/overlay/loghi/";               // dalla radice servita
  var BRAND  = "../../brand/loghi senza sfondo/DHN CHAMPIONSHIP LOGO BIANCO-Photoroom.png";

  var MESCOLA = { 16: "S", 17: "M", 18: "H", 7: "I", 8: "W" };     // udp/packets.py:587
  var MESCOLA_COL = { 16: "var(--tyre-s)", 17: "var(--tyre-m)", 18: "var(--tyre-h)",
                      7: "var(--tyre-i)", 8: "var(--tyre-w)" };


  /* ─────────────────────────────────────────────────────────── IL BANCO ───
     `?banco=174` fa leggere i file in `banco/dati/*.json` invece di Supabase.
     Non e' una comodita': e' il modo di provare una grafica senza rete e
     senza aspettare la prossima gara, con i dati VERI di una sessione vera
     scaricati una volta. La regola di casa: il banco dice sempre da dove ha
     letto, in pagina, cosi' nessuno confonde una prova con la diretta.  */
  var BANCO = param("banco", null);
  var DATI_BANCO = "../banco/dati/";

  async function fileBanco(nome) {
    var r = await fetch(DATI_BANCO + nome + ".json");
    if (!r.ok) throw new Error("banco: manca " + nome + ".json (HTTP " + r.status + ")");
    return r.json();
  }

  function segnaBanco(quale) {
    var d = document.createElement("div");
    /* ⚠ 12/09/2026 — la classe `dhn-banco` in piu' NON e' cosmetica: il
       cartellino del banco e un avviso di guasto sono due cose diverse, e
       finche' portavano la stessa classe l'esportazione headless (`posta.mjs`)
       leggeva «BANCO — dati dal file...» come «questa grafica e' rotta» e
       segnava un avviso su tutte e diciassette. La pelle non cambia: il
       selettore del CSS resta `.dhn-avviso`. */
    d.className = "dhn-avviso dhn-banco";
    d.style.background = "#7a4a00";
    d.textContent = "BANCO — dati dal file " + quale + ".json, non da Supabase";
    document.body.appendChild(d);
  }

  function param(nome, ripiego) {
    var v = new URLSearchParams(glob.location.search).get(nome);
    return (v === null || v === "") ? ripiego : v;
  }

  async function leggi(vista, query) {
    var url = SB_URL + "/rest/v1/" + vista + "?" + query;
    var r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    if (!r.ok) throw new Error(vista + " -> HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    return r.json();
  }

  /* Una sessione intera, ordinata per posizione. Torna anche l'intestazione
     (GP, tipo, giri, regolamento) presa dalla prima riga: in vista e' ripetuta
     su ogni riga, ed e' giusto cosi' — una vista per disegnare, non normalizzata. */
  async function sessione(storicoId) {
    var righe = await leggi("v_grafica_sessione",
      "storico_id=eq." + encodeURIComponent(storicoId) + "&select=*&order=pos.asc");
    decoraRighe(righe, await squadre());
    if (!righe.length) throw new Error("sessione " + storicoId + ": zero righe in v_grafica_sessione");
    var p = righe[0];
    return {
      righe: righe,
      info: {
        storico_id: p.storico_id, tipo: p.tipo, stato: p.stato,
        gp_nome: p.gp_nome, gp_cc: p.gp_cc, gp_key: p.gp_key, gp_f1_slug: p.gp_f1_slug,
        round: p.round, giri_totali: p.giri_totali, meteo: p.meteo,
        bandiera_rossa: p.bandiera_rossa, regolamento: p.regolamento,
        stagione_id: p.stagione_id, categoria_id: p.categoria_id,
        created_at: p.created_at,
        riconosciuti: righe.filter(function (r) { return r.riconosciuto; }).length,
        con_ritratto: righe.filter(function (r) { return r.ha_ritratto; }).length
      }
    };
  }

  async function classificaPiloti(storicoId) {
    return decoraRighe(await leggi("v_grafica_classifica_piloti",
      "storico_id=eq." + encodeURIComponent(storicoId) + "&select=*&order=pos.asc,punti_tot.desc"),
      await squadre());
  }

  async function classificaScuderie(storicoId) {
    return decoraRighe(await leggi("v_grafica_classifica_scuderie",
      "storico_id=eq." + encodeURIComponent(storicoId) + "&select=*&order=pos.asc,punti_tot.desc"),
      await squadre());
  }

  /* ⚠ IL PASSO GARA legge `v_grafica_passo`, che a sua volta legge i giri
     dallo SNAPSHOT del motore, non dalla tabella `giro`: quella viene dagli
     export RLT e dalla S2 resta vuota per sempre (misurato: zero righe in
     comune fra i due mondi). Qui, come sempre, si legge solo la vista. */
  async function passo(storicoId) {
    var righe = await leggi("v_grafica_passo",
      "storico_id=eq." + encodeURIComponent(storicoId) + "&select=*&order=mediana_ms.asc");
    return righe;
  }

  /* ⚠ LA TENUTA non e' «degrado gomme» e non va chiamata cosi'. E' come e'
     cambiato il passo dentro lo stint piu' lungo: dentro c'e' la gomma che si
     consuma MA anche il carburante che cala, che vale per tutti e spinge il
     numero verso il verde. Ha senso solo come CONFRONTO fra piloti della
     stessa gara, e la grafica lo scrive. */
  async function tenuta(storicoId) {
    return leggi("v_grafica_degrado",
      "storico_id=eq." + encodeURIComponent(storicoId) + "&select=*&order=degrado_ms.asc");
  }

  async function sessioniValide(quante) {
    return leggi("v_grafica_sessioni_valide",
      "select=*&order=storico_id.desc&limit=" + (quante || 40));
  }

  /* L'ultima sessione che ha senso disegnare: piloti riconosciuti > 0.
     Serve alla galleria e come ripiego quando manca ?storico_id. */
  async function ultimaBuona(tipo) {
    var q = "select=*&vale_per_classifica=is.true&order=storico_id.desc&limit=1";
    if (tipo) q += "&tipo=eq." + encodeURIComponent(tipo);
    var r = await leggi("v_grafica_sessioni_valide", q);
    return r.length ? r[0] : null;
  }


  /* ─────────────────────────────────────────── LE SCUDERIE, DUE TONI ─────
     06/09/2026. Una livrea non ha un colore, ne ha due: Cadillac e' nero e
     bianco, Haas bianco e rosso, Williams blu e bianco. Schiacciate in un
     solo esadecimale escono sbagliate per forza — ed e' esattamente il
     difetto che Fede ha visto guardando il podio.

     Il dizionario (11 righe) si legge UNA volta e si appiccica alle righe
     delle viste, invece di aggiungere due colonne a `v_grafica_sessione`:
     la verita' resta in un posto solo, la tabella `scuderia_gioco`.

     `testo_chiaro` NON si ricalcola a occhio in ogni grafica: sta nella
     tabella, deciso una volta. Su Haas (#ECECEC) o Cadillac (#101014) il
     testo giusto e' l'opposto, e sbagliarlo rende una grafica illeggibile. */
  var _squadre = null;

  async function squadre() {
    if (_squadre) return _squadre;
    var righe = BANCO ? await fileBanco("squadre")
                      : await leggi("v_grafica_scuderie_controllo", "select=*");
    _squadre = {};
    righe.forEach(function (s) { _squadre[s.team_id] = s; });
    return _squadre;
  }

  function decoraRighe(righe, mappa) {
    righe.forEach(function (r) {
      var s = (r.team_id != null) ? mappa[r.team_id] : null;
      if (s) {
        r.colore_da_stampare  = s.colore;
        r.colore2_da_stampare = s.colore2;
        r.testo_chiaro        = s.testo_chiaro;
        r.scuderia_da_stampare = s.nome;
        r.logo_da_stampare     = s.logo;
      } else {
        /* nessun team dal gioco: resta quello che ha risolto la vista
           (anagrafica DHN) e il testo si decide dalla luminanza */
        r.colore2_da_stampare = r.colore_secondario || null;
        if (r.testo_chiaro == null) r.testo_chiaro = _chiaroSu(r.colore_da_stampare);
      }
    });
    return righe;
  }

  function _chiaroSu(colore) {
    var c = String(colore || "#5b6e84").replace("#", "");
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    return (0.2126*r + 0.7152*g + 0.0722*b) <= 150;
  }

  /* ---------------------------------------------------------------- pezzi */

  function logo(nomeFile) { return nomeFile ? LOGHI + nomeFile : null; }

  /* Il ritratto giusto per il posto in cui va. Ordine di ripiego dichiarato:
     mai un buco, al massimo l'avatar piatto, al massimo niente e la grafica
     regge senza. */
  function ritratto(r, taglia) {
    if (!r) return null;
    if (taglia === "figura")  return r.figura_url   || r.busto_url || r.ritratto_url || null;
    if (taglia === "busto")   return r.busto_url    || r.figura_url || r.ritratto_url || null;
    if (taglia === "piccola") return r.ritratto_piccola_url || r.ritratto_url || r.avatar_url || null;
    return r.ritratto_url || r.busto_url || r.avatar_url || null;
  }

  /* ⚠ `nazionalita` NON e' una sigla a due lettere: su Supabase e' il nome del
     paese in inglese ("Italy", "Portugal", "Switzerland") e su 84 righe ne ha
     45 vuote. Misurato il 05/09/2026, dopo aver visto Cavastark uscire con due
     bandiere e un quadratino: "Italy" dato in pasto agli indicatori regionali
     diventa I-t-a-l-y, cioe' spazzatura.
     Chi ha una sigla vera (i circuiti, `gp_cc`) passa dritto; chi ha il nome
     lo fa tradurre qui. Se il nome non e' in elenco NON si stampa niente: una
     bandiera sbagliata e' peggio di nessuna bandiera.
     Se domani serve anche al sito, questo elenco diventa una tabella
     `nazione(nome, cc)` e la vista espone `naz_cc`; finche' serve solo alle
     grafiche sta qui, in un posto solo. */
  var CC = {
    "italy": "it", "italia": "it", "portugal": "pt", "portogallo": "pt",
    "switzerland": "ch", "svizzera": "ch", "france": "fr", "francia": "fr",
    "spain": "es", "spagna": "es", "germany": "de", "germania": "de",
    "united kingdom": "gb", "great britain": "gb", "england": "gb",
    "netherlands": "nl", "olanda": "nl", "belgium": "be", "belgio": "be",
    "austria": "at", "poland": "pl", "polonia": "pl", "romania": "ro",
    "albania": "al", "greece": "gr", "grecia": "gr", "croatia": "hr",
    "slovenia": "si", "malta": "mt", "san marino": "sm", "brazil": "br",
    "brasile": "br", "argentina": "ar", "mexico": "mx", "messico": "mx",
    "united states": "us", "usa": "us", "canada": "ca", "australia": "au",
    "japan": "jp", "giappone": "jp", "morocco": "ma", "tunisia": "tn",
    "egypt": "eg", "turkey": "tr", "turchia": "tr", "ukraine": "ua",
    "moldova": "md", "bulgaria": "bg", "hungary": "hu", "ungheria": "hu",
    "czechia": "cz", "slovakia": "sk", "serbia": "rs", "ireland": "ie",
    "sweden": "se", "svezia": "se", "norway": "no", "denmark": "dk",
    "finland": "fi", "iceland": "is", "colombia": "co", "peru": "pe",
    "venezuela": "ve", "chile": "cl", "uruguay": "uy", "india": "in",
    "china": "cn", "cina": "cn", "south africa": "za"
  };

  function sigla(naz) {
    if (!naz) return null;
    var s = String(naz).trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toLowerCase();     // gia' una sigla
    return CC[s.toLowerCase()] || null;
  }

  function bandiera(naz) {
    var cc = sigla(naz);
    if (!cc) return "";
    return cc.toUpperCase().replace(/./g, function (c) {
      return String.fromCodePoint(127397 + c.charCodeAt(0));
    });
  }

  function punti(v) {
    var n = Number(v || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".0", "");
  }

  function mescole(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (c) {
      return { sigla: MESCOLA[c] || "?", colore: MESCOLA_COL[c] || "var(--dhn-dim)" };
    });
  }

  /* Il titolo dell'evento. ⚠ `round` e' NULL finche' la tabella `calendario`
     su Supabase e' vuota: in quel caso si stampa il GP senza numero, non
     "ROUND null". */
  function occhiello(info) {
    var gp = (info.gp_nome || "").toUpperCase();
    return info.round ? ("ROUND " + info.round + "  //  " + gp) : gp;
  }

  function titoloTipo(tipo) {
    return ({ gara: "GARA", qualifica: "QUALIFICA", sprint: "SPRINT",
              sprint_qualifica: "SPRINT SHOOTOUT", prova: "PROVE LIBERE" })[tipo] || (tipo || "").toUpperCase();
  }

  /* Un guasto va DETTO, non nascosto: se una grafica gira su una sessione
     senza piloti riconosciuti, in pagina compare una fascia. Meglio una
     fascia brutta che un podio con tre sconosciuti pubblicato su Instagram. */
  function avviso(testo) {
    var d = document.createElement("div");
    d.className = "dhn-avviso";
    d.textContent = testo;
    document.body.appendChild(d);
  }

  /* Un'immagine che non arriva e' un caso NORMALE qui: i ritratti stanno su
     Supabase Storage, e la quota di banda e' gia' stata sforata una volta
     (31/08). Se non arriva si spegne l'<img> e resta il fondo col colore
     squadra: mai l'icona dell'immagine rotta in una grafica pubblicata. */
  function ripiegoImmagini(radice) {
    /* ⚠ SOLO PER IL BANCO (`controlla_capienza.mjs --rompi`): spegne
       l'aggancio, cosi' l'immagine che non arriva torna a essere un BUCO e
       R7d diventa rossa. Come `__rompiIncastro`. */
    if (glob.__rompiRipieghi) return 0;
    var imgs = [].slice.call((radice || document).querySelectorAll("img[data-ripiego]"));
    imgs.forEach(function (im) {
      function cade() {
        /* ⚠⚠ 12/09/2026 — IL SECONDO GRADINO. La regola e' quella del sito
           (`sito/live.html`, `avFail()`): ritratto -> avatar Discord ->
           iniziali, e mai un buco. Qui il primo gradino lo sceglie
           `ritratto()`, il secondo e' `data-passo`.
           ⚠ `data-passo` lo mettono SOLO le caselle quadre (la faccina nelle
           righe): l'avatar Discord e' 1:1 e in uno slot alto — la figura
           intera, la colonna della 08 — darebbe un testone. E' la regola
           della FORMA del sito, non una svista. */
        var passo = im.getAttribute("data-passo");
        if (passo && im.getAttribute("data-passo-usato") !== "1") {
          im.setAttribute("data-passo-usato", "1");
          im.src = passo;
          return;
        }
        im.style.visibility = "hidden";
        var q = im.getAttribute("data-ripiego");
        if (q) { var e = im.parentElement.querySelector(q);
                 if (e) e.style.display = (q === ".senzafigura" ? "block" : "grid"); }
      }
      /* ⚠ E anche il caso GIA' FALLITO: se l'errore e' arrivato prima di
         questa riga — succede coi file locali del banco, che rispondono
         subito — `addEventListener` non riparte piu' e il ripiego non si
         accende mai. */
      if (im.complete && !im.naturalWidth) { cade(); return; }
      im.addEventListener("error", cade);
    });
    return imgs.length;
  }

  async function scaricaPNG(elemento, nomeFile) {
    if (!glob.html2canvas) { alert("html2canvas non caricato: serve la rete."); return; }
    var tela = await glob.html2canvas(elemento, {
      backgroundColor: null, scale: 1, useCORS: true, allowTaint: false,
      width: elemento.offsetWidth, height: elemento.offsetHeight,
      windowWidth: elemento.offsetWidth, windowHeight: elemento.offsetHeight
    });
    var a = document.createElement("a");
    a.download = nomeFile;
    a.href = tela.toDataURL("image/png");
    a.click();
  }

  /* Il bottone di scarico, uguale su ogni template: nessuno si ricorda di
     metterlo a mano su dieci pagine. */
  function bottoneScarico(tela, nomeFile) {
    var b = document.createElement("button");
    b.className = "dhn-scarica";
    b.textContent = "⤓  SCARICA PNG";
    b.onclick = function () {
      b.textContent = "...";
      scaricaPNG(tela, nomeFile).finally(function () { b.textContent = "⤓  SCARICA PNG"; });
    };
    document.body.appendChild(b);
  }

  /* Se il banco e' acceso, le tre letture cambiano fonte e NIENTE ALTRO:
     i template non sanno di essere su un banco, quindi quello che si vede e'
     lo stesso codice che andra' in onda. */
  if (BANCO) {
    var _sess = sessione, _cp = classificaPiloti, _cs = classificaScuderie;
    sessione = async function (id) {
      /* se il banco ha il file di QUELLA sessione lo usa: cosi' la galleria
         puo' mostrare qualifica e gara dello stesso GP anche senza rete. */
      var righe;
      try { righe = await fileBanco("sessione_" + (id != null ? id : BANCO)); }
      catch (e) { righe = await fileBanco("sessione_" + BANCO); }
      decoraRighe(righe, await squadre());
      var p = righe[0];
      return { righe: righe, info: {
        storico_id: p.storico_id, tipo: p.tipo, stato: p.stato,
        gp_nome: p.gp_nome, gp_cc: p.gp_cc, gp_key: p.gp_key, gp_f1_slug: p.gp_f1_slug,
        round: p.round, giri_totali: p.giri_totali, meteo: p.meteo,
        bandiera_rossa: p.bandiera_rossa, regolamento: p.regolamento,
        stagione_id: p.stagione_id, categoria_id: p.categoria_id, created_at: p.created_at,
        riconosciuti: righe.filter(function (r) { return r.riconosciuto; }).length,
        con_ritratto: righe.filter(function (r) { return r.ha_ritratto; }).length
      } };
    };
    classificaPiloti = async function (id) {
      var r;
      try { r = await fileBanco("classifica_piloti_" + (id != null ? id : BANCO)); }
      catch (e) { r = await fileBanco("classifica_piloti_" + BANCO); }
      return decoraRighe(r, await squadre());
    };
    classificaScuderie = async function (id) {
      var r;
      try { r = await fileBanco("classifica_scuderie_" + (id != null ? id : BANCO)); }
      catch (e) { r = await fileBanco("classifica_scuderie_" + BANCO); }
      return decoraRighe(r, await squadre());
    };
    /* anche l'elenco: cosi' la GALLERIA gira sul banco, non solo i template */
    passo = async function (id) {
      try { return await fileBanco("passo_" + (id != null ? id : BANCO)); }
      catch (e) { return fileBanco("passo_" + BANCO); }
    };
    tenuta = async function (id) {
      try { return await fileBanco("tenuta_" + (id != null ? id : BANCO)); }
      catch (e) { return fileBanco("tenuta_" + BANCO); }
    };
    sessioniValide = function () { return fileBanco("sessioni_valide"); };
    ultimaBuona = async function (tipo) {
      var l = await fileBanco("sessioni_valide");
      return l.find(function (s) { return s.vale_per_classifica && (!tipo || s.tipo === tipo); }) || null;
    };
    document.addEventListener("DOMContentLoaded", function () { segnaBanco("sessione_" + BANCO); });
  }

  glob.DHN = {
    SB_URL: SB_URL, SB_KEY: SB_KEY, LOGHI: LOGHI, BRAND: BRAND,
    param: param, leggi: leggi, BANCO: BANCO, squadre: squadre,
    CAMPIONATO: "DHN CHAMPIONSHIP",
    sessione: function (id) { return sessione(id); },
    classificaPiloti: function (id) { return classificaPiloti(id); },
    classificaScuderie: function (id) { return classificaScuderie(id); },
    sessioniValide: function (n) { return sessioniValide(n); },
    passo: function (id) { return passo(id); },
    tenuta: function (id) { return tenuta(id); },
    ultimaBuona: function (t) { return ultimaBuona(t); },
    logo: logo, ritratto: ritratto, bandiera: bandiera, sigla: sigla, punti: punti,
    mescole: mescole, occhiello: occhiello, titoloTipo: titoloTipo,
    avviso: avviso, ripiegoImmagini: ripiegoImmagini,
    scaricaPNG: scaricaPNG, bottoneScarico: bottoneScarico
  };
})(window);
