/* Larghezza/altezza di un JPEG o PNG leggendo l'INTESTAZIONE del file.
   Niente `sharp`: questo deve girare anche dove sharp non c'e' (il banco), e
   soprattutto deve dire la verita' sul FILE, non su come lo reinterpreta una
   libreria. ~40 righe contro una dipendenza. */
import { readFileSync, statSync } from "node:fs";

export function misuraImmagine(percorso) {
  const b = readFileSync(percorso);
  const byte = statSync(percorso).size;
  const est = percorso.toLowerCase().split(".").pop();

  // PNG: firma 8 byte, poi IHDR con larghezza/altezza a 32 bit big-endian
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { ext: "png", larghezza: b.readUInt32BE(16),
             altezza: b.readUInt32BE(20), byte };
  }
  // JPEG: si scorrono i marcatori fino a un SOFn (che NON sia SOF4/8/12)
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { ext: "jpg", altezza: b.readUInt16BE(i + 5),
                 larghezza: b.readUInt16BE(i + 7), byte };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return { ext: est, larghezza: null, altezza: null, byte };
}
