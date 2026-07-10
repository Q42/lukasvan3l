// db.mjs — verbinding met Supabase voor de prijs-agent, met de service-role key
// (omzeilt RLS; dit is een vertrouwd server-side proces). Zet in agent/.env:
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY=<service_role / sb_secret key>
//
// Is er geen Supabase-config, dan geeft `heeftDb()` false terug en valt de agent
// terug op het bestand-pad (output/prijzen.json), puur voor lokaal testen.

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./lib.mjs";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

export const heeftDb = () => Boolean(url && key);

let client = null;
function db() {
  if (!client) {
    if (!heeftDb()) throw new Error("Geen SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Zoektermen waarvoor we opties moeten ophalen (de gedeelde catalogus).
export async function getProducten() {
  const { data, error } = await db().from("products").select("id, naam");
  if (error) throw new Error(`products lezen: ${error.message}`);
  return (data || []).map((p) => ({ id: p.id, naam: p.naam }));
}

// Vervang per (product, shop) de offers door de vers opgehaalde set, zodat
// verdwenen SKU's ook echt weg zijn. `verzameld` = [{product, shop, offers}].
export async function vervangOffers(verzameld) {
  const client = db();
  for (const { product, shop, offers } of verzameld) {
    const { error: delErr } = await client.from("offers").delete().eq("product_id", product).eq("shop", shop);
    if (delErr) throw new Error(`offers wissen (${product}/${shop}): ${delErr.message}`);
    if (!offers.length) continue;
    const rijen = offers.map((o) => ({
      product_id: product,
      shop,
      external_id: o.productId != null ? String(o.productId) : null,
      titel: o.titel ?? null,
      prijs: o.prijs ?? null,
      hoeveelheid: o.hoeveelheid ?? null,
      eenheid: o.eenheid ?? null,
      url: o.url ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error: insErr } = await client.from("offers").insert(rijen);
    if (insErr) throw new Error(`offers schrijven (${product}/${shop}): ${insErr.message}`);
  }
}

// Alle offers (voor het mandje-script om de gekozen/goedkoopste AH-optie te vinden).
export async function getOffers() {
  const { data, error } = await db().from("offers").select("*");
  if (error) throw new Error(`offers lezen: ${error.message}`);
  return data || [];
}

// Actieve (niet-afgevinkte) lijst-items over alle leden, met evt. gekozen offer.
export async function getListItems() {
  const { data, error } = await db().from("list_items").select("product_id, aantal, afgevinkt, chosen_offer_id");
  if (error) throw new Error(`list_items lezen: ${error.message}`);
  return (data || []).filter((r) => !r.afgevinkt);
}

// Bestand-fallback voor lokaal testen zonder database.
export function schrijfOffersBestand(verzameld) {
  mkdirSync(OUT_DIR, { recursive: true });
  const pad = join(OUT_DIR, "prijzen.json");
  writeFileSync(pad, JSON.stringify({ opgehaald: new Date().toISOString(), offers: verzameld }, null, 2));
  return pad;
}
