// db.mjs — Supabase-verbinding voor de parro-agent, met de service-role key
// (omzeilt RLS; dit is een vertrouwd lokaal proces). Zet in agent/.env:
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY=<service_role key>

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

let client = null;
export function db() {
  if (!client) {
    if (!url || !key)
      throw new Error("Geen SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Nieuwe ruwe items wegschrijven. ignoreDuplicates: bestaande rijen blijven
// onaangeroerd (anders zou `verwerkt` bij elke sync weer op false gaan).
export async function insertNieuweItems(items) {
  let nieuw = 0;
  for (let i = 0; i < items.length; i += 500) {
    const batch = items.slice(i, i + 500);
    const { data, error } = await db()
      .from("parro_items")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`parro_items upsert: ${error.message}`);
    nieuw += (data || []).length;
  }
  return nieuw;
}

export async function getOnverwerkteItems(limit = 25) {
  // Nieuwste eerst: bij een grote achterstand willen we juist de aankomende
  // agenda-items (die staan met een toekomstige datum bovenaan) als eerste
  // verrijken, niet eerst jaren oude chatberichten. Anders vult parro_agenda
  // zich met verleden-events (die de frontend verbergt) en blijft de agenda
  // leeg tot de hele backlog is weggewerkt.
  const { data, error } = await db()
    .from("parro_items")
    .select("id, soort, titel, tekst, groep, afzender, datum")
    .eq("verwerkt", false)
    .order("datum", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`parro_items lezen: ${error.message}`);
  return data || [];
}

// Verrijkingsresultaat opslaan: vlaggen op het item, agenda + acties eronder.
// Idempotent: oude agenda-rijen van dit item worden eerst opgeruimd.
export async function saveVerrijking(itemId, resultaat) {
  const d = db();

  const del = await d.from("parro_agenda").delete().eq("item_id", itemId);
  if (del.error) throw new Error(`parro_agenda opschonen: ${del.error.message}`);

  for (const a of resultaat.agenda_items || []) {
    const { data, error } = await d
      .from("parro_agenda")
      .insert({
        item_id: itemId,
        datum: a.datum,
        eind_datum: a.eind_datum || null,
        titel: a.titel,
        omschrijving: a.omschrijving || null,
        kind: a.kind || null,
        kind_van_de_week: !!a.kind_van_de_week,
      })
      .select("id")
      .single();
    if (error) throw new Error(`parro_agenda insert: ${error.message}`);

    const acties = (a.acties || []).map((x) => ({
      agenda_id: data.id,
      tekst: x.tekst,
      uiterlijk: x.uiterlijk || null,
    }));
    if (acties.length) {
      const { error: e2 } = await d.from("parro_acties").insert(acties);
      if (e2) throw new Error(`parro_acties insert: ${e2.message}`);
    }
  }

  const upd = await d
    .from("parro_items")
    .update({
      verwerkt: true,
      belangrijk: !!resultaat.belangrijk,
      actie_nodig: !!resultaat.actie_nodig,
    })
    .eq("id", itemId);
  if (upd.error) throw new Error(`parro_items update: ${upd.error.message}`);
}

// Items van één week (voor het weekoverzicht). weekStart = maandag (YYYY-MM-DD).
export async function getItemsVanWeek(weekStart) {
  const eind = new Date(weekStart + "T00:00:00");
  eind.setDate(eind.getDate() + 7);
  const { data, error } = await db()
    .from("parro_items")
    .select("soort, titel, tekst, groep, afzender, datum, belangrijk")
    .gte("datum", weekStart)
    .lt("datum", eind.toISOString().slice(0, 10))
    .order("datum", { ascending: true });
  if (error) throw new Error(`parro_items week lezen: ${error.message}`);
  return data || [];
}

export async function upsertWeekoverzicht(weekStart, samenvatting) {
  const { error } = await db()
    .from("parro_weekoverzicht")
    .upsert({ week_start: weekStart, samenvatting }, { onConflict: "week_start" });
  if (error) throw new Error(`parro_weekoverzicht upsert: ${error.message}`);
}
