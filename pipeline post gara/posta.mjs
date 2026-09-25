/* ============================================================================
   POSTA — le 17 grafiche post-gara diventano 17 PNG
   12/09/2026
   ----------------------------------------------------------------------------
   COSA FA, in una riga: apre ogni grafica in un Chromium senza schermo, aspetta
   che abbia FINITO di disegnare, e ritaglia `#tela` alla sua misura vera.

   PERCHE' NON html2canvas
     html2canvas non fotografa la pagina: la RIDISEGNA con un suo motore. Sui
     font sostituisce, sui filtri approssima, e su un'immagine di un altro
     dominio restituisce un buco al posto del pilota. Qui il ritaglio lo fa il
     browser stesso, sugli stessi pixel che si vedono a schermo.
     Stesso mestiere di `sito/.github/ritratti/render.mjs`, da cui e' preso il
     server statico.

   ⚠ TRE TRAPPOLE GIA' PAGATE, TUTTE MISURATE (vedi banco_posta.mjs)
     1. `PEZZI.adatta()` mette un `transform: scale()` sulla tela per farla
        stare nella finestra. Uno screenshot dell'ELEMENTO fotografa i pixel
        DOPO la trasformazione: con una finestra bassa esce un PNG piccolo e
        sfocato che sembra giusto. Qui la finestra e' alta quanto serve E il
        rimpicciolimento viene spento prima dello scatto. La misura finale
        (1080xH esatti) e' l'unico verdetto che vale.
     2. I font arrivano da Google Fonts con un `@import`. Se si scatta prima
        che siano arrivati, il PNG esce col ripiego di sistema — e non se ne
        accorge nessuno finche' non si guardano due PNG affiancati. Si aspetta
        `document.fonts.ready` E si CONTROLLA che i tre font ci siano davvero,
        confrontando la larghezza di una stessa scritta col ripiego.
     3. La grafica e' finita quando compare il bottone `.dhn-scarica`: e'
        l'ULTIMA cosa che fa ogni template, dopo `incastraTutte()`. Aspettare
        `networkidle` o un timeout fisso vuol dire fotografare figure ancora
        da incastrare. Il bottone sta nel `body`, non nella tela: non entra
        nello scatto.

   USO
     node "pipeline post gara/posta.mjs" --storico 191
     node "pipeline post gara/posta.mjs" --banco 174 --formato tutti
     node "pipeline post gara/posta.mjs" --storico 191 --solo 01,02,13

   OPZIONI
     --storico N     la sessione da disegnare (dati veri da Supabase)
     --banco N       usa i file in `banco/dati/` invece di Supabase (senza rete)
     --formato       post | storia | tutti          (di fabbrica: post)
     --solo 01,05    solo alcune grafiche           (di fabbrica: tutte e 17)
     --out CARTELLA  dove finiscono i PNG           (di fabbrica: pipeline post gara/uscita/<id>)
     --font rete|locale|auto   da dove vengono i font  (di fabbrica: auto)
     --q "a=1&b=2"   altri parametri da passare alla grafica (facce, pagina...)
     --anche-rotte   scrive il PNG anche di una grafica che ha detto ERRORE
     --radice PERC   la radice del progetto da servire (di fabbrica: la cartella sopra)
     --porta N       la porta del server locale     (di fabbrica: 8124)

   AGGIUNTE DEL 25/09/2026 (piano social, FASE 1) — senza queste opzioni il
   comportamento e' IDENTICO a prima (SCARICA_PNG.bat non cambia):
     --lavori "209:05,06,07,08/210:01,02,03"
                     piu' sessioni in UN SOLO Chromium: ogni gruppo e'
                     `storico:grafiche`. Serve alla resa di una gara intera
                     (qualifica + gara) senza aprire due browser e senza
                     riscaricare due volte gli stessi ritratti.
     --tetto-mb N    ogni richiesta a Supabase passa da qui: si scarica UNA
                     volta (cache per indirizzo), si CONTANO i byte, e oltre N
                     MB la resa si FERMA (uscita 3). Vedi `viaSupabase()`.
     --esiti FILE    scrive l'esito di ogni grafica + i byte in un JSON
     --dati-in DIR   salva le risposte REST di Supabase (le viste) in
                     DIR/dati_supabase.json: la didascalia si scrive da li',
                     senza una seconda lettura
   ========================================================================== */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const QUI    = dirname(fileURLToPath(import.meta.url));       // "pipeline post gara"
const arg = (nome, ripiego) => {
  const i = process.argv.indexOf('--' + nome);
  return (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--'))
    ? process.argv[i + 1] : ripiego;
};

const RADICE  = resolve(arg('radice', join(QUI, '..')));
const PORTA   = Number(arg('porta', 8124));
const STORICO = arg('storico', null);
const BANCO   = arg('banco', null);
const FORMATI = (arg('formato', 'post') === 'tutti') ? ['post', 'storia'] : [arg('formato', 'post')];
const SOLO    = (arg('solo', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const FONT    = arg('font', 'auto');
const SENZA_FONT = process.argv.includes('--senza-font');
const ROTTE_ANCHE = process.argv.includes('--anche-rotte');
const EXTRA   = arg('q', '');
/* ⚠ SOLO PER IL BANCO (`banco/banco_posta.mjs`). Ogni valore spegne UNA delle
   tre difese, per far vedere che senza quella il PNG esce sbagliato. Non ha
   effetto se la variabile non c'e', che e' sempre, tranne nel banco. */
const ROMPI   = (process.env.POSTA_ROMPI || '').trim();
/* ⚠ ANCHE QUESTO SOLO PER IL BANCO, e non e' un capriccio: sul banco i dati
   sono file locali che arrivano in un millisecondo, quindi «scattare in
   fretta» e «aspettare» danno lo STESSO PNG e la controprova esce verde a
   vuoto. In serata i dati arrivano da Supabase e i piloti da un bucket:
   `POSTA_RITARDO` rimette quel tempo, cosi' la controprova prova la condizione
   vera invece di una comoda. */
const RITARDO = Number(process.env.POSTA_RITARDO || 0);
/* ---- piano social, 25/09/2026 (vedi intestazione) ---- */
const LAVORI_ARG = arg('lavori', null);
const TETTO_MB   = arg('tetto-mb', null);
const TETTO      = TETTO_MB != null ? Math.round(Number(TETTO_MB) * 1024 * 1024) : null;
const ESITI      = arg('esiti', null);
const DATI_IN    = arg('dati-in', null);
/* ⚠ SOLO PER IL BANCO (`social/banco_resa.mjs`): manda le richieste a
   Supabase verso un server finto, cosi' il conto dei byte e il tetto si
   provano anche dove Supabase non si raggiunge (il container di Cowork). */
const SPECCHIO   = (process.env.POSTA_SUPABASE_SPECCHIO || '').replace(/\/$/, '');
function leggiLavori(t) {
  return String(t).split('/').map(g => g.trim()).filter(Boolean).map(g => {
    const [sid, cod] = g.split(':');
    if (!/^\d+$/.test(sid || '')) throw new Error(`--lavori: «${g}» non comincia con uno storico_id`);
    return { sid, solo: (cod || '').split(',').map(x => x.trim()).filter(Boolean) };
  });
}
const LAVORI = LAVORI_ARG ? leggiLavori(LAVORI_ARG) : null;
const USCITA  = resolve(arg('out', join(QUI, 'uscita', String(STORICO || BANCO
  || (LAVORI ? 'lavori-' + LAVORI[LAVORI.length - 1].sid : 'senza-id')))));

/* Le misure della tela, da `dhn-grafiche.css`. Non si indovinano: si
   CONTROLLANO contro il PNG che esce, e se non combaciano il PNG non si
   scrive. Un PNG della misura sbagliata passa inosservato su Instagram, che
   riscala tutto, e si scopre stampato. */
const MISURA = { post: [1080, 1350], storia: [1080, 1920] };

const log = (...a) => console.log(...a);
const kb  = n => (n / 1024).toFixed(0) + ' KB';

/* ------------------------------------------------ server statico (da render.mjs) */
const TIPI = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.css':'text/css', '.woff2':'font/woff2',
  '.woff':'font/woff', '.ttf':'font/ttf' };

function avviaServer() {
  const srv = createServer((req, res) => {
    const url  = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = normalize(join(RADICE, url));
    if (!file.startsWith(RADICE)) { res.writeHead(403).end('no'); return; }
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end('non trovato: ' + url); return; }
    res.writeHead(200, { 'Content-Type': TIPI[extname(file).toLowerCase()] || 'application/octet-stream',
                         'Access-Control-Allow-Origin': '*' });
    createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(PORTA, '127.0.0.1', () => r(srv)));
}

/* ---------------------------------------------------------------- i font
   `--font locale` serve i .woff2 da `_fonts/` al posto di Google Fonts, cosi'
   l'esportazione non dipende dalla rete e da un giorno all'altro non cambia.
   ⚠ `auto` prende il LOCALE quando c'e', e va sulla rete solo se la cartella
   manca. E' il verso giusto: un'esportazione deve dare lo stesso PNG oggi e
   fra sei mesi, e i file in `_fonts/` sono gli stessi che serve Google Fonts
   (stesso rilascio fontsource), presi una volta. La rete resta il ripiego, non
   la fonte. */
const FAMIGLIE = [
  ['Saira Condensed', 'saira-condensed', [600, 700, 800, 900]],
  ['Titillium Web',   'titillium-web',   [400, 600, 700, 900]],
  ['Chakra Petch',    'chakra-petch',    [600, 700]],
];

/* la cartella dei font sta accanto a questo file, non nella radice: cosi' tutta
   l'esportazione e' dentro `pipeline post gara/` e si sposta in un pezzo solo.
   L'indirizzo con cui il server la serve si RICAVA, non si riscrive a mano. */
const DIR_FONT = join(QUI, '_fonts');
const URL_FONT = '/' + QUI.slice(RADICE.length + 1).split(/[\\/]/).filter(Boolean)
  .concat('_fonts').map(encodeURIComponent).join('/');

function cssFontLocali() {
  const dir = DIR_FONT;
  if (!existsSync(dir)) return null;
  const ce = new Set(readdirSync(dir));
  let css = '', trovati = 0;
  for (const [nome, slug, pesi] of FAMIGLIE) {
    for (const p of pesi) {
      for (const sotto of ['latin', 'latin-ext']) {
        const f = `${slug}-${sotto}-${p}-normal.woff2`;
        if (!ce.has(f)) continue;
        trovati++;
        /* ⚠ L'INDIRIZZO VA SCRITTO PER INTERO. Questo foglio viene consegnato
           come risposta a `fonts.googleapis.com`: un `/_fonts/...` relativo si
           risolverebbe su QUEL dominio, che non esiste, e i font non
           arriverebbero — senza un solo errore, perche' un @font-face che non
           carica ripiega in silenzio sul font di sistema. Costo: la prima
           passata e' uscita coi font sbagliati e il controllo l'ha detto. */
        css += `@font-face{font-family:'${nome}';font-style:normal;font-weight:${p};`
             + `font-display:block;src:url('http://127.0.0.1:${PORTA}${URL_FONT}/${f}') format('woff2');}\n`;
      }
    }
  }
  return trovati ? css : null;
}

/* ----------------------------------------------------------------- le grafiche */
function elencoGrafiche(solo = SOLO) {
  return readdirSync(join(QUI, 'grafiche'))
    .filter(f => /^\d\d-.*\.html$/.test(f))
    .filter(f => !solo.length || solo.includes(f.slice(0, 2)))
    .sort();
}

/* ------------------------------------------------------------------- lo scatto */
async function scatta(pagina, file, formato, sid = STORICO) {
  const q = new URLSearchParams();
  if (sid) q.set('storico_id', sid);
  if (BANCO)   q.set('banco', BANCO);
  q.set('formato', formato);
  /* `--q "facce=1&pagina=2"`: qualunque altro parametro della grafica, senza
     doverne aggiungere uno qui ogni volta che una pagina ne inventa uno. */
  for (const [k, v] of new URLSearchParams(EXTRA)) q.set(k, v);
  const url = `http://127.0.0.1:${PORTA}/pipeline post gara/grafiche/${file}?${q}`;

  const errori = [];
  const mancate = [];
  const onErr = m => { if (m.type() === 'error') errori.push(m.text().slice(0, 200)); };
  const onPag = e => errori.push('pageerror: ' + String(e.message).slice(0, 200));
  const onRes = r => { if (r.status() >= 400) mancate.push(r.status() + ' ' + r.url().slice(-70)); };
  const onFail = r => mancate.push('KO ' + r.url().slice(-70));
  pagina.on('console', onErr); pagina.on('pageerror', onPag);
  pagina.on('response', onRes); pagina.on('requestfailed', onFail);

  try {
    await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    /* ⚠ FINITA = il bottone di scarico e' apparso. E' l'ultima riga di ogni
       template, dopo `incastraTutte()`. `.dhn-avviso` vuol dire che la
       grafica ha DETTO di essere andata male: si scatta lo stesso (il PNG
       serve a vedere il guasto) ma l'esito lo dice. */
    if (ROMPI !== 'fretta')
      await pagina.waitForSelector('button.dhn-scarica, .dhn-avviso:not(.dhn-banco)', { timeout: 90000 });
    const rotta = await pagina.$('button.dhn-scarica') === null;

    /* i font: si aspettano E si controllano */
    await pagina.evaluate(() => document.fonts.ready);
    /* le immagini: `complete` da solo e' vero anche per quelle fallite */
    await pagina.evaluate(() => Promise.all(
      [...document.images].map(i => i.complete ? null
        : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); }))));

    const diag = await pagina.evaluate(() => {
      /* ⚠ `document.fonts.check` dice «la conosco», non «la sto usando».
         La prova vera e' la LARGHEZZA: la stessa scritta nel font vero e nel
         ripiego di sistema non misura uguale. Se misura uguale, il font non
         c'e' e il PNG uscirebbe col ripiego senza dirlo a nessuno. */
      const c = document.createElement('canvas').getContext('2d');
      const largo = f => { c.font = '900 100px ' + f; return c.measureText('CAMPIONATO 88').width; };
      const rip = largo('monospace');
      /* ⚠ SI CONTROLLANO SOLO I FONT CHE QUESTA PAGINA USA DAVVERO.
         Primo giro: pretendevo tutti e tre su ogni grafica, e lo SCHIERAMENTO
         veniva rifiutato perche' Chakra Petch li' non lo usa nessuno — e con
         `font-display: block` un font mai chiesto non si carica, quindi la
         misura lo da' per mancante. Era un falso allarme del controllo, non
         un difetto della grafica: avrebbe bloccato un PNG sano.
         Le famiglie si raccolgono dal DOM, dagli elementi che hanno davvero
         del testo dentro. */
      const usate = new Set();
      document.querySelectorAll('#tela *').forEach(e => {
        if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.textContent.trim()) return;
        const f = getComputedStyle(e).fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        if (f) usate.add(f);
      });
      const font = {};
      for (const f of ['Saira Condensed', 'Titillium Web', 'Chakra Petch']) {
        if (!usate.has(f)) continue;                    // non serve qui
        font[f] = Math.abs(largo(`"${f}", monospace`) - rip) > 0.5;
      }

      /* ⚠ GLI ATTREZZI SONO `position: fixed`, QUINDI ENTRANO NELLO SCATTO.
         Il bottone di scarico e la fascia d'avviso stanno nel `body`, non
         nella tela — sembrava bastasse. Ma `fixed` li stacca dal flusso e li
         appoggia sopra il riquadro: nel PNG il cartellino del banco si vedeva
         come una striscia in cima. Visto nel reso il 12/09, e domani sarebbe
         stato un avviso di guasto stampato dentro una grafica pubblicata.
         Si spengono DOPO averne letto il testo, che serve al riepilogo. */
      const avvisoTesto = (document.querySelector('.dhn-avviso:not(.dhn-banco)') || {}).textContent || null;
      if (!window.__rompiAttrezzi) document.querySelectorAll('.dhn-avviso, .dhn-scarica')
        .forEach(e => { e.style.visibility = 'hidden'; });

      /* spegne il rimpicciolimento da schermo: lo scatto deve essere 1:1 */
      const t = document.getElementById('tela');
      if (!window.__rompiZoom) {
        delete document.body.dataset.zoom;
        if (t) { t.style.transform = 'none'; t.style.marginBottom = '0'; }
      }
      const r = t ? t.getBoundingClientRect() : null;
      return {
        font,
        tela: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
        imgRotte: [...document.images].filter(i => i.naturalWidth === 0).length,
        imgTot: document.images.length,
        avviso: avvisoTesto,
      };
    });

    /* ⚠⚠ UNA GRAFICA CHE HA DETTO «ERRORE» NON PRODUCE UN PNG.
       La 09 A PUNTI, quando nessuno fuori dal podio ha fatto punti, scriveva
       una tela NERA: la grafica lo diceva in pagina, ma il cartellino e'
       `position: fixed` e l'esportazione lo spegne prima dello scatto — quindi
       nel file finiva solo il nero. Un PNG vuoto in una cartella di consegna
       e' peggio di un file mancante: sembra pronto.
       ⚠ La distinzione la fa il PREFISSO, che e' gia' una convenzione di casa:
       `ERRORE:` = non c'e' niente da disegnare, niente file. `ATTENZIONE:` =
       la grafica c'e' ma qualcosa non torna (una qualifica disegnata su una
       gara): il file si scrive, con l'avviso nel riepilogo.
       `--anche-rotte` scrive tutto, per guardare cosa e' successo. */
    if (!ROTTE_ANCHE && /^\s*ERRORE/i.test(diag.avviso || ''))
      throw new Error('niente da disegnare — ' + String(diag.avviso).replace(/^\s*ERRORE:\s*/i, ''));

    /* ⚠ IL FONT SBAGLIATO NON SI VEDE, SI MISURA. Un PNG col ripiego di
       sistema al posto di Saira Condensed sembra una grafica un po' diversa,
       non una grafica rotta: si pubblica e si scopre affiancandolo a uno
       vecchio. Quindi manca un font → NIENTE PNG, a meno che non lo si chieda
       apposta con `--senza-font`. Di tutti i controlli qui dentro questo e'
       l'unico che ferma la mano. */
    const senzaFont = Object.entries(diag.font).filter(([, c]) => !c).map(([n]) => n);
    if (senzaFont.length && !SENZA_FONT)
      throw new Error('font non arrivati: ' + senzaFont.join(', ')
        + ' — il PNG uscirebbe col ripiego di sistema. Con `--font locale` si serve'
        + ' la cartella _fonts/; con `--senza-font` si scatta lo stesso.');

    const tela = await pagina.$('#tela');
    if (!tela) throw new Error('nessun #tela in pagina');
    const png = await tela.screenshot({ type: 'png', animations: 'disabled' });

    /* la misura e' un VERDETTO, non una nota a margine */
    const meta = await sharp(png).metadata();
    const [aw, ah] = MISURA[formato] || [0, 0];
    if (aw && (meta.width !== aw || meta.height !== ah))
      throw new Error(`misura sbagliata: ${meta.width}x${meta.height}, attesa ${aw}x${ah}`
        + ' (il rimpicciolimento di adatta() e\' entrato nello scatto?)');

    const ott = await sharp(png).png({ compressionLevel: 9, palette: false }).toBuffer();
    const nome = `DHN-${file.replace('.html', '')}-${sid || BANCO}-${formato}.png`;
    mkdirSync(USCITA, { recursive: true });
    writeFileSync(join(USCITA, nome), ott);

    return { file, formato, storico: sid || null, nome, ok: !rotta, byte: ott.length, ...diag, errori, mancate };
  } finally {
    pagina.off('console', onErr); pagina.off('pageerror', onPag);
    pagina.off('response', onRes); pagina.off('requestfailed', onFail);
  }
}

/* ------------------------------------------------------------------------ via */
async function main() {
  if (!STORICO && !BANCO && !LAVORI)
    throw new Error('serve --storico N (dati veri), --banco N (file locali) oppure --lavori "N:01,02/M:05"');
  const lavori = LAVORI || [{ sid: STORICO, solo: SOLO }];
  for (const l of lavori) {
    l.grafiche = elencoGrafiche(l.solo);
    if (!l.grafiche.length) throw new Error('nessuna grafica trovata in ' + join(QUI, 'grafiche')
      + (l.solo.length ? ' fra ' + l.solo.join(',') : ''));
  }

  const server = await avviaServer();
  log(`servo ${RADICE} su 127.0.0.1:${PORTA}`);

  /* `CHROMIUM_PATH` serve solo dove il Chromium e' gia' installato altrove
     (un container, un runner): sul PC lo mette `npx playwright install`. */
  const eseguibile = process.env.CHROMIUM_PATH || arg('chromium', null);
  const browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {});
  /* ⚠ la finestra e' alta quanto la tela PIU' il margine che `adatta()` toglie
     (140 px): cosi' il rimpicciolimento vale gia' 1 e lo spegnimento di sopra
     e' una seconda difesa, non l'unica. `deviceScaleFactor: 1` perche' la tela
     e' gia' in pixel veri: raddoppiarlo darebbe un PNG 2160 di larghezza. */
  const contesto = await browser.newContext({
    /* `rompi=zoom`: una finestra bassa, come quella di un portatile. E' la
       condizione normale di chi guarda — ed e' quella che fa uscire il PNG
       rimpicciolito se nessuno spegne `adatta()`. */
    viewport: { width: 1240, height: ROMPI === 'zoom' ? 800 : 2100 },
    deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  if (ROMPI === 'zoom') await contesto.addInitScript(() => { window.__rompiZoom = true; });
  if (ROMPI === 'attrezzi') await contesto.addInitScript(() => { window.__rompiAttrezzi = true; });
  if (RITARDO) await contesto.route(/\.json(\?|$)|\/rest\/v1\//, async r => {
    await new Promise(x => setTimeout(x, RITARDO)); await r.continue();
  });
  if (ROMPI === 'font')
    await contesto.route(/fonts\.googleapis\.com/, r =>
      r.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  /* html2canvas non serve piu': si toglie dalla rete invece di aspettarlo. */
  await contesto.route(/html2canvas/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));

  /* 25/09/2026 — SUPABASE PASSA DA QUI (solo con --tetto-mb / --esiti).
     Registrata DOPO le altre: in Playwright l'ultima rotta registrata e' la
     prima a rispondere. */
  if (TETTO != null || ESITI || DATI_IN || SPECCHIO)
    await contesto.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, viaSupabase);

  const locali = cssFontLocali();
  let fontDa = 'rete';
  if (ROMPI !== 'font' && (FONT === 'locale' || (FONT === 'auto' && locali))) {
    if (!locali) throw new Error('--font locale ma manca la cartella _fonts/ con i .woff2');
    fontDa = 'locale';
    await contesto.route(/fonts\.googleapis\.com/, r =>
      r.fulfill({ status: 200, contentType: 'text/css', body: locali }));
  }
  log(`font: ${fontDa}`);

  const pagina = await contesto.newPage();
  pagina.on('dialog', d => d.dismiss().catch(() => {}));

  const esiti = [];
  fuori: for (const formato of FORMATI) {
    for (const l of lavori) {
      for (const g of l.grafiche) {
        try { esiti.push(await scatta(pagina, g, formato, l.sid)); }
        catch (e) { esiti.push({ file: g, formato, storico: l.sid || null, ok: false,
                                 errore: String(e.message).slice(0, 300) }); }
        const u = esiti[esiti.length - 1];
        log(`  ${l.sid ? l.sid + ' ' : ''}${u.file} ${u.formato}: ` + (u.errore ? 'FALLITO — ' + u.errore
          : `${kb(u.byte)}${u.ok ? '' : '  ⚠ avviso in pagina'}${u.imgRotte ? `  ⚠ ${u.imgRotte}/${u.imgTot} immagini mancanti` : ''}`));
        /* ⚠ il tetto ferma TUTTO, non solo la grafica: una resa che ha
           sforato non si porta a termine a meta', si butta e si avvisa */
        if (CONTA.fermata) break fuori;
      }
    }
  }

  await browser.close();
  server.close();
  riepilogo(esiti);
  scriviEsiti(esiti, fontDa);
  if (CONTA.fermata) {
    console.error('\nRESA FERMATA — ' + CONTA.fermata);
    process.exitCode = 3;
    return;
  }
  if (!esiti.some(e => !e.errore)) process.exitCode = 1;
}

/* ============================================================================
   SUPABASE: UNA VOLTA SOLA, CONTATO, CON IL TETTO                   25/09/2026
   ----------------------------------------------------------------------------
   Perche': l'egress di Supabase e' gia' stato sforato una volta (31/08). Una
   resa di gara apre ~20 grafiche, e ognuna chiede la sessione e i ritratti:
   senza una cache comune gli stessi file uscirebbero da Supabase 20 volte.
   Qui ogni INDIRIZZO si scarica una volta per resa, e il byte si conta
   quando esce da Supabase, non quando la pagina lo riusa.

   ⚠ I byte contati sono il `content-length` della risposta; se manca
   (risposte compresse a pezzi) il corpo DECOMPRESSO — cioe' per eccesso,
   mai per difetto. Un tetto che sottostima non protegge niente.
   ⚠ Si cancellano `content-encoding`/`content-length` prima di girare la
   risposta alla pagina: il corpo che arriva qui e' gia' decompresso, e un
   «gzip» rimasto nell'intestazione farebbe fallire la lettura in silenzio.
   ========================================================================== */
const CONTA = { byte: 0, richieste: 0, dalla_cache: 0, bloccate: 0,
                per_tipo: { rest: 0, storage: 0, altro: 0 }, fermata: null };
const CACHE = new Map();
const REST  = new Map();          // url -> json, per la didascalia e l'impronta

async function viaSupabase(route) {
  const req = route.request();
  const url = req.url();
  if (req.method() !== 'GET') return route.continue();          // le grafiche leggono e basta
  const c = CACHE.get(url);
  if (c) { CONTA.dalla_cache++; return route.fulfill(c); }
  if (CONTA.fermata) { CONTA.bloccate++; return route.abort('blockedbyclient'); }
  const u = new URL(url);
  const dove = SPECCHIO ? SPECCHIO + u.pathname + u.search : url;
  let r;
  try { r = await route.fetch({ url: dove, timeout: 30000 }); }
  catch (e) { CONTA.bloccate++; return route.abort('failed'); }
  const corpo = await r.body();
  const h = { ...r.headers() };
  const n = Number(h['content-length']) > 0 ? Number(h['content-length']) : corpo.length;
  CONTA.byte += n; CONTA.richieste++;
  const tipo = u.pathname.startsWith('/rest/') ? 'rest' : u.pathname.startsWith('/storage/') ? 'storage' : 'altro';
  CONTA.per_tipo[tipo] += n;
  if (TETTO != null && CONTA.byte > TETTO && !CONTA.fermata)
    CONTA.fermata = `scaricati da Supabase ${(CONTA.byte / 1048576).toFixed(2)} MB, tetto ${TETTO_MB} MB`
      + ` (${CONTA.richieste} richieste; ultima: ${u.pathname.slice(-60)})`;
  delete h['content-encoding']; delete h['content-length']; delete h['transfer-encoding'];
  if (!h['access-control-allow-origin']) h['access-control-allow-origin'] = '*';
  const risposta = { status: r.status(), headers: h, body: corpo };
  if (r.status() === 200) {
    CACHE.set(url, risposta);
    if (tipo === 'rest') { try { REST.set(url, JSON.parse(corpo.toString('utf8'))); } catch { /* non JSON */ } }
  }
  return route.fulfill(risposta);
}

/* L'IMPRONTA DEI DATI: stessa sessione, stessi numeri -> stessa impronta.
   Serve alla FASE 4: un post programmato con un'impronta diversa da quella
   del manifesto corrente vuol dire «grafica vecchia», e non esce. Si calcola
   sulle risposte REST in ordine di indirizzo, non sull'ordine d'arrivo. */
function impronta() {
  const h = createHash('sha256');
  for (const k of [...REST.keys()].sort()) h.update(k).update('\n').update(JSON.stringify(REST.get(k))).update('\n');
  return h.digest('hex').slice(0, 16);
}

function scriviEsiti(esiti, fontDa) {
  if (DATI_IN) {
    mkdirSync(DATI_IN, { recursive: true });
    writeFileSync(join(DATI_IN, 'dati_supabase.json'), JSON.stringify(
      [...REST.entries()].map(([url, json]) => {
        const u = new URL(url);
        return { url, vista: u.pathname.split('/').pop(), query: u.search.slice(1), json };
      }), null, 1));
  }
  if (!ESITI) return;
  mkdirSync(dirname(resolve(ESITI)), { recursive: true });
  writeFileSync(ESITI, JSON.stringify({
    generato: new Date().toISOString(), uscita: USCITA, font: fontDa,
    supabase: { ...CONTA, tetto_byte: TETTO, url_diversi: CACHE.size,
                metodo: 'content-length della risposta; se manca, corpo decompresso (per eccesso)' },
    impronta_dati: impronta(),
    esiti: esiti.map(e => ({ file: e.file, formato: e.formato, storico: e.storico ?? null,
      nome: e.nome || null, ok: !!e.ok && !e.errore, errore: e.errore || null, avviso: e.avviso || null,
      byte: e.byte || 0, img_rotte: e.imgRotte || 0, img_tot: e.imgTot || 0, font: e.font || null,
      errori_pagina: (e.errori || []).slice(0, 5), mancate: (e.mancate || []).slice(0, 5) })),
  }, null, 1));
}

/* prova la rete una volta sola, con poco tempo: se Google Fonts non risponde
   non si sta li' ad aspettarlo diciassette volte */
async function reteFont() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700&display=swap',
      { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

function riepilogo(esiti) {
  const ok = esiti.filter(e => !e.errore);
  log(`\n${ok.length}/${esiti.length} PNG scritti in ${USCITA}`);
  if (ok.length) {
    const f = ok[0].font || {};
    log('font davvero usati: ' + Object.entries(f).map(([k, v]) => `${k} ${v ? 'si' : 'NO'}`).join(' · '));
    const rotte = ok.filter(e => e.imgRotte);
    if (rotte.length) log(`⚠ immagini mancanti in ${rotte.length} grafiche `
      + `(${rotte.reduce((s, e) => s + e.imgRotte, 0)} in tutto) — se sono i piloti e' il bucket, non la grafica`);
    const avvisi = ok.filter(e => !e.ok);
    if (avvisi.length) log(`⚠ ${avvisi.length} grafiche hanno stampato un avviso: `
      + avvisi.map(e => e.file.slice(0, 2) + ' ' + String(e.avviso || '').slice(0, 60)).join(' | '));
  }
  for (const e of esiti.filter(x => x.errore)) log(`❌ ${e.file} ${e.formato}: ${e.errore}`);
}

main().catch(e => { console.error('\nPOSTA FALLITA:', e.message); process.exit(1); });
