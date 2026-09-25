# dhn-social — il motore delle immagini del DHN Championship

Trasforma le grafiche post-gara (HTML) in JPEG pronte per Instagram e Facebook,
e le mette online su GitHub Pages: `https://fedecacciaf1.github.io/dhn-social/`.

- **Non si modifica qui.** La fonte e' la cartella RJDHN sul PC dell'admin
  (`pipeline post gara/`); arriva qui con `PUBBLICA_GRAFICHE.bat`.
- **Ramo `main`**: le grafiche e il codice che le rende.
- **Ramo `uscite`**: solo le immagini, un commit solo, riscritto a ogni resa.
  GitHub Pages pubblica da qui.
- **Workflow `Rendi grafiche`**: parte solo su richiesta (Direzione Gara o a
  mano). Nessun orario fisso.
- Nessun segreto qui dentro: la chiave Supabase nelle grafiche e' quella
  pubblicabile, la stessa del sito.
