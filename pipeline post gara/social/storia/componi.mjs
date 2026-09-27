/* La STORIA a cornice (B1): il PNG del post, incollato sul fondo nel riquadro
   di geometria.mjs, angoli arrotondati. Una funzione sola, usata da
   resa_gara.mjs e provata da storia/banco_storia.mjs sui PNG veri. */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { STORIA } from "./geometria.mjs";
import { misuraImmagine } from "../misure.mjs";

export const FONDO = join(dirname(fileURLToPath(import.meta.url)), "fondo.png");
const P = STORIA.post;
const MASCHERA = Buffer.from(`<svg width="${P.larghezza}" height="${P.altezza}"><rect width="${P.larghezza}" height="${P.altezza}" rx="${P.raggio}" ry="${P.raggio}"/></svg>`);

/* sorg = PNG (o JPEG) del post 1080x1350 · dest = cartella della gara · nome = «01-race-result.jpg» */
export async function faiStoria(sorg, dest, nome, fondo = FONDO) {
  if (!existsSync(fondo)) throw new Error(`manca il fondo ${fondo}`);
  const ms = await sharp(sorg).metadata();
  if (Math.abs(ms.width / ms.height - 0.8) > 0.002) throw new Error(`il post è ${ms.width}x${ms.height}, non 4:5: la cornice lo deformerebbe`);
  mkdirSync(join(dest, "storie", "min"), { recursive: true });
  const post = await sharp(sorg).flatten({ background: "#000000" }).resize(P.larghezza, P.altezza, { fit: "fill" })
    .composite([{ input: MASCHERA, blend: "dest-in" }]).png().toBuffer();
  const file = join(dest, "storie", nome);
  await sharp(fondo).composite([{ input: post, left: P.left, top: P.top }]).flatten({ background: "#0b0b0f" })
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(file);
  await sharp(file).resize({ width: 360 }).jpeg({ quality: 78, mozjpeg: true }).toFile(join(dest, "storie", "min", nome));
  const m = misuraImmagine(file);
  if (m.larghezza !== STORIA.larghezza || m.altezza !== STORIA.altezza) throw new Error(`storia ${nome} ${m.larghezza}x${m.altezza}, attesa 1080x1920`);
  return { file: `storie/${nome}`, miniatura: `storie/min/${nome}`, larghezza: m.larghezza, altezza: m.altezza, byte: m.byte };
}
