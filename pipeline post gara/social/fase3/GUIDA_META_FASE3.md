# FASE 3 — collegare Meta (guida per Fede)

27/09/2026. Tempo: ~30 min. **Si fa in chat con Claude, un passo alla volta**: i menu di Meta
cambiano spesso nome, quindi le etichette qui sotto sono quelle della documentazione del
27/09 (Graph API **v25.0**) e possono essere diverse sullo schermo. Quando non corrispondono, fai
una foto dello schermo e la mandi.

**Alla fine ti serve UN solo valore**: il token della Pagina. Id Pagina e id Instagram li legge
da solo la funzione. Il token **non va mai** in chat, in un file o nel repo: va solo nei segreti
di Supabase.

---

## Passo 0 — gli account di prova (o saltare la prova)
Instagram non ha un ambiente di test: la prima foto esce davvero. Il piano dice: prima su
account di prova.
1. Crea una **Pagina Facebook** di prova (es. «DHN Prova»), dal tuo profilo.
2. Crea un **Instagram** di prova, passalo a **account professionale** (Impostazioni → Tipo di
   account → Professionale → Creator o Business).
3. Nelle impostazioni dell'Instagram: **collega la Pagina** di prova (Centro gestione account, o
   dalla Pagina: Impostazioni → Account collegati → Instagram).

Se decidi di saltare la prova: usi la Pagina e l'Instagram veri del campionato, e la prima foto
esce davanti a tutti.

## Passo 1 — l'app su Meta for Developers
1. https://developers.facebook.com → **My Apps** → **Create App**.
2. Caso d'uso: quello per **Instagram** con **«API setup with Facebook login»** (la documentazione
   dice di scegliere questo quando l'Instagram professionale è collegato a una Pagina).
   Aggiungi anche il caso d'uso per **gestire la Pagina** (pubblicare contenuti).
3. L'app resta in **modalità sviluppo**: per i propri account basta, **niente App Review**
   (verificato sulla doc il 12/09).

## Passo 2 — il token (Graph API Explorer)
1. https://developers.facebook.com/tools/explorer → in alto a destra scegli **la tua app**.
2. «User or Page» → **Get User Access Token**. Spunta i permessi:
   `pages_show_list` · `pages_read_engagement` · `pages_manage_posts` ·
   `instagram_basic` · `instagram_content_publish`
   (se la Pagina sta in un portfolio business e poi non compare: anche `business_management`).
3. **Generate Access Token** → nella finestra di Facebook scegli **la Pagina** di prova e
   **l'Instagram** di prova → consenti.
4. Allunga il token: https://developers.facebook.com/tools/debug/accesstoken → incolla il token
   → **Debug** → in fondo **Extend Access Token** → copia il token lungo.
5. Torna nell'Explorer, incolla il token lungo nel campo in alto e chiama:
   `me/accounts?fields=name,access_token,instagram_business_account{username}`
   → nella riga della Pagina di prova c'è `access_token`: **quello è il token della Pagina**.
6. Controllo: incollalo nel Debugger → deve dire **Type: Page** e **Expires: Never**.
   Se dice una data, il passo 4 non è andato: si rifà.

## Passo 3 — il segreto su Supabase
1. Supabase → progetto **RJDHN-Championship** → **Edge Functions** → **Secrets**
   (o Project Settings → Edge Functions).
2. **Add new secret** → nome `META_PAGE_TOKEN` → valore = token della Pagina → Save.
3. Non serve ripubblicare niente.

## Passo 4 — il controllo, dal pannello
1. Pannello admin → **📣 Social** → apri una grafica.
2. Sotto «Pubblica ora» deve comparire: **Va su: @<instagram di prova> · <Pagina di prova>**.
   - Se dice «manca il segreto META_PAGE_TOKEN» → il passo 3 non è salvato.
   - Se dice «token Meta scaduto o revocato (errore 190)» → token sbagliato: si rifà il passo 2.
   - Se dice «la Pagina non ha un Instagram professionale collegato» → passo 0.3.
3. **Il collaudo della fase**: pubblica UNA grafica (Instagram + Facebook), una volta.
   Deve uscire un post per parte, e sotto la grafica comparire «✔ uscita» coi due link.

## Passo 5 — dopo il collaudo: passare all'account vero
Si rifanno i passi 2.3 → 3 scegliendo la **Pagina e l'Instagram veri**, e si sostituisce il valore
di `META_PAGE_TOKEN`. Il pannello mostrerà subito il nome dell'account vero.

## Cose da sapere
- **Chi può pubblicare**: superadmin e i 3 admin (non l'account «regia»). Ogni post è una riga
  in `post_social`: chi, quando, dove, i link.
- **Non si annulla da qui**: un post uscito si toglie dall'app di Instagram/Facebook.
- **Doppio clic, rete che cade**: non fanno un secondo post (una chiave per clic, unica nel
  database). Ripubblicare di proposito la stessa grafica chiede conferma.
- **Grafiche rifatte** dopo che le hai aperte: la pubblicazione si ferma e chiede di ricaricare.
- **Tetto Instagram**: 100 post in 24 ore; il pannello mostra quanti ne restano.
- Il token della Pagina ottenuto così **non scade**, ma si invalida se cambi la password di
  Facebook, togli l'app o perdi il ruolo sulla Pagina (errore 190: il pannello lo dice).
