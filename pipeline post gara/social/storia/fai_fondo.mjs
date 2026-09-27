/* Rifà storia/fondo.png da storia/cornice.html (Chromium, font veri).
   Uso: node "pipeline post gara/social/storia/fai_fondo.mjs"   [CHROMIUM_PATH=...]
   Si lancia solo se cambia la cornice: resa_gara.mjs usa il PNG già fatto. */
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { STORIA } from "./geometria.mjs";
const QUI = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const p = await b.newPage({ viewport: { width: STORIA.larghezza, height: STORIA.altezza } });
  await p.goto(pathToFileURL(join(QUI, "cornice.html")).href);
  await p.evaluate(() => document.fonts.ready);
  const fontOk = await p.evaluate(() => document.fonts.check("700 30px Tit"));
  const logoOk = await p.evaluate(() => { const i = document.querySelector(".logo img"); return i.complete && i.naturalWidth > 0; });
  if (!fontOk || !logoOk) throw new Error(`fondo NON fatto: font ${fontOk ? "ok" : "MANCANTE"} · logo ${logoOk ? "ok" : "MANCANTE"}`);
  const out = join(QUI, "fondo.png");
  await p.screenshot({ path: out });
  const m = await sharp(out).metadata();
  if (m.width !== STORIA.larghezza || m.height !== STORIA.altezza) throw new Error(`fondo ${m.width}x${m.height}, atteso 1080x1920`);
  console.log(`storia/fondo.png ${m.width}x${m.height} · font ok · logo ok`);
} finally { await b.close(); }
