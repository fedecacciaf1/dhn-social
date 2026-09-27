/* Edge Function `social` — Piano social FASE 3 + FASE 4 (27/09/2026).
   Collega logica.ts a fetch, a Supabase e al segreto META_PAGE_TOKEN.
   Due porte:
   - admin (superadmin/admin ATTIVI, non «regia»), col loro login:
       {azione:"stato"} · {azione:"pubblica", chiave, gara_id, file|files, versione, didascalia, piattaforme, quando?}
       {azione:"riconferma", id, versione, quando}
   - la sveglia del database (pg_cron → social_chiama), con l'header
     x-social-cron = segreto `social_cron` del Vault, controllato da social_cron_ok:
       {azione:"scatta", id|null}
   Sorgente: pipeline post gara/social/fase4/funzione/ */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { leggiAccount, pubblicaOra, riconferma, scatta, type Dipendenze } from "./logica.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const d: Dipendenze = {
      fetch: (u, i) => fetch(u, { ...(i || {}), signal: AbortSignal.timeout(25000) }),
      token: Deno.env.get("META_PAGE_TOKEN") || null,
      db: {
        async inserisci(riga) {
          const { data, error } = await sb.from("post_social").insert(riga).select().single();
          if (error) return error.code === "23505" ? { doppia: true } : { errore: error.message };
          return { riga: data };
        },
        async perChiave(chiave) {
          const { data } = await sb.from("post_social").select("*").eq("chiave", chiave).maybeSingle();
          return data;
        },
        async perId(id) {
          const { data } = await sb.from("post_social").select("*").eq("id", id).maybeSingle();
          return data;
        },
        async aggiorna(id, campi) {
          const { error } = await sb.from("post_social").update(campi).eq("id", id);
          if (error) console.error(`post_social ${id}: aggiornamento non riuscito: ${error.message}`);
        },
        async aggiornaSe(id, stati, campi) {
          const { data, error } = await sb.from("post_social").update(campi).eq("id", id).in("stato", stati).select("id");
          if (error) { console.error(`post_social ${id}: aggiornamento condizionato non riuscito: ${error.message}`); return false; }
          return (data || []).length === 1;
        },
        async prenota(id) {
          const { data, error } = await sb.rpc("social_prenota", { p_id: id });
          if (error) { console.error(`social_prenota ${id}: ${error.message}`); return { esito: "errore_db" }; }
          return data;
        },
        async dovuti() {
          const { data, error } = await sb.from("post_social").select("id,programmato_per,prossimo_tentativo")
            .eq("stato", "in_attesa").order("programmato_per").limit(50);
          if (error) { console.error(`dovuti: ${error.message}`); return []; }
          const ora = Date.now() + 60e3;
          return (data || []).filter((r: any) => Date.parse(r.prossimo_tentativo || r.programmato_per) <= ora).slice(0, 10).map((r: any) => r.id);
        },
        async avvisa(id, testo) {
          const { error } = await sb.rpc("social_avvisa", { p_id: id, p_testo: testo });
          if (error) console.error(`social_avvisa ${id}: ${error.message}`);
        },
      },
    };
    const corpo = await req.json().catch(() => ({}));

    /* la sveglia del database */
    if (corpo.azione === "scatta") {
      const seg = req.headers.get("x-social-cron") || "";
      const { data: ok, error } = await sb.rpc("social_cron_ok", { p: seg });
      if (error || ok !== true) return json({ errore: "sveglia non autorizzata" }, 401);
      const id = corpo.id == null ? null : Number(corpo.id);
      const r = await scatta(d, Number.isInteger(id) && id! > 0 ? id : null);
      console.log("social scatta:", JSON.stringify(r));
      return json(r);
    }

    /* gli admin */
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: ud, error: uErr } = await sb.auth.getUser(jwt);
    if (uErr || !ud?.user) return json({ errore: "non autenticato" }, 401);
    const { data: au } = await sb.from("admin_users").select("ruolo,attivo,email").eq("user_id", ud.user.id).maybeSingle();
    if (!au || !au.attivo || !["superadmin", "admin"].includes(au.ruolo)) return json({ errore: "pubblicare sui social è riservato agli admin" }, 403);
    const utente = { id: ud.user.id, email: au.email || ud.user.email || "", ruolo: au.ruolo };

    if (corpo.azione === "stato") { const a: any = await leggiAccount(d); delete a.errore; return json(a); }
    if (corpo.azione === "pubblica") { const r = await pubblicaOra(d, corpo, utente); return json(r.esito, r.http); }
    if (corpo.azione === "riconferma") { const r = await riconferma(d, corpo, utente); return json(r.esito, r.http); }
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("social:", e);
    return json({ errore: String((e as Error)?.message || e) }, 500);
  }
});
