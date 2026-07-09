// db.mjs — verbinding met Supabase voor de prijs-agent, met de service-role key
// (omzeilt RLS; dit is een vertrouwd server-side proces). Zet in agent/.env:
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY=<service_role key>
//
// Is er geen Supabase-config, dan geeft `heeftDb()` false terug en valt de agent
// terug op het oude bestand-gebaseerde pad (boodschappen-export.json / prijzen.json).

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

export const heeftDb = () => Boolean(url && key);

let client = null;
function db() {
  if (!client) {
    if (!heeftDb())
      throw new Error("Geen SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Producten waarvoor we prijzen moeten ophalen (de gedeelde catalogus).
export async function getProducten() {
  const { data, error } = await db().from("products").select("id, naam");
  if (error) throw new Error(`products lezen: ${error.message}`);
  return (data || []).map((p) => ({ id: p.id, naam: p.naam, shops: {} }));
}

// Eén prijsregel wegschrijven (upsert op product_id+shop).
export async function upsertPrijs(regel) {
  const rij = {
    product_id: regel.product,
    shop: regel.shop,
    prijs: regel.prijs ?? null,
    url: regel.url ?? null,
    omschrijving: regel.omschrijving ?? null,
    external_id: regel.productId != null ? String(regel.productId) : null,
    updated_at: new Date().toISOString(),
  };
  // Alleen overschrijven als de scraper inhoud meegeeft — handmatig ingevulde
  // doosgroottes (Varuvo) blijven anders bij elke cron-run staan.
  if (regel.inhoud != null) rij.inhoud = regel.inhoud;
  const { error } = await db()
    .from("prices")
    .upsert(rij, { onConflict: "product_id,shop" });
  if (error)
    throw new Error(
      `prices upsert (${regel.product}/${regel.shop}): ${error.message}`,
    );
}

export async function upsertPrijzen(regels) {
  for (const r of regels) await upsertPrijs(r);
  return regels.length;
}

// Alle prijzen (voor het bepalen van de goedkoopste winkel + AH external_id).
export async function getPrijzen() {
  const { data, error } = await db().from("prices").select("*");
  if (error) throw new Error(`prices lezen: ${error.message}`);
  return data || [];
}

// Actieve (niet-afgevinkte) boodschappen per regel (incl. shop_keuze override).
export async function getActieveLijstRijen() {
  const { data, error } = await db()
    .from("list_items")
    .select("product_id, aantal, shop_keuze")
    .eq("afgevinkt", false);
  if (error) throw new Error(`list_items lezen: ${error.message}`);
  return data || [];
}

// Opgeteld per product (legacy; zonder shop_keuze).
export async function getActieveLijst() {
  const perProduct = {};
  for (const r of await getActieveLijstRijen()) {
    perProduct[r.product_id] =
      (perProduct[r.product_id] || 0) + (r.aantal || 1);
  }
  return Object.entries(perProduct).map(([product_id, aantal]) => ({
    product_id,
    aantal,
  }));
}
