/* Edge Function `social` — Piano social FASE 3 (27/09/2026).
   Collega logica.ts a fetch, a Supabase e al segreto META_PAGE_TOKEN.
   Chi può chiamarla: solo superadmin e admin ATTIVI (non «regia»).
   Azioni: {azione:"stato"} · {azione:"pubblica", chiave, gara_id, file, versione, didascalia, piattaforme} */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { leggiAccount, pubblicaOra, type Dipendenze } from "./logica.ts";

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

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: ud, error: uErr } = await sb.auth.getUser(jwt);
    if (uErr || !ud?.user) return json({ errore: "non autenticato" }, 401);
    const { data: au } = await sb.from("admin_users").select("ruolo,attivo,email").eq("user_id", ud.user.id).maybeSingle();
    if (!au || !au.attivo || !["superadmin", "admin"].includes(au.ruolo)) return json({ errore: "pubblicare sui social è riservato agli admin" }, 403);

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
        async aggiorna(id, campi) {
          const { error } = await sb.from("post_social").update(campi).eq("id", id);
          if (error) console.error(`post_social ${id}: aggiornamento non riuscito: ${error.message}`);
        },
      },
    };

    const corpo = await req.json().catch(() => ({}));
    if (corpo.azione === "stato") return json(await leggiAccount(d));
    if (corpo.azione === "pubblica") {
      const r = await pubblicaOra(d, corpo, { id: ud.user.id, email: au.email || ud.user.email || "" });
      return json(r.esito, r.http);
    }
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("social:", e);
    return json({ errore: String((e as Error)?.message || e) }, 500);
  }
});
