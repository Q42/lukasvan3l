// fill-cart-ah.mjs — vult je Albert Heijn-winkelmandje met de per lijst-item
// gekozen AH-optie (of, als er niks gekozen is, de goedkoopste AH-optie op
// basisprijs). Vereist een ingelogde AH-sessie (state/ah-token.json — zie
// login.mjs / ah.mjs → wisselCodeIn) én Supabase-config in .env.
//
// Gebruik:  node fill-cart-ah.mjs
//
// Checkout/betalen doe je zelf in de app of op ah.nl — dit vult alleen het mandje.

import * as ah from "./ah.mjs";
import { heeftDb, getOffers, getListItems } from "./db.mjs";
import "dotenv/config";

// basisprijs per kg/l/stuk (voor het kiezen van de goedkoopste optie).
function basisGetal(o) {
  if (!o || o.prijs == null || !o.hoeveelheid || o.hoeveelheid <= 0 || !o.eenheid) return Infinity;
  const p = Number(o.prijs), h = Number(o.hoeveelheid);
  if (o.eenheid === "g" || o.eenheid === "ml") return p / h * 1000;
  if (o.eenheid === "stuk") return p / h;
  return Infinity;
}

async function main() {
  if (!heeftDb()) throw new Error("Geen Supabase-config in .env — het mandje vullen werkt tegen de database.");
  const [offers, lijst] = await Promise.all([getOffers(), getListItems()]);
  const perId = new Map(offers.map((o) => [o.id, o]));
  const perProduct = {};
  for (const o of offers) (perProduct[o.product_id] ||= []).push(o);

  const mandje = [];
  for (const rij of lijst) {
    // gekozen offer, anders de goedkoopste (op basisprijs) voor deze zoekterm
    let offer = rij.chosen_offer_id ? perId.get(rij.chosen_offer_id) : null;
    if (!offer) {
      const opties = (perProduct[rij.product_id] || []).slice().sort((a, b) => basisGetal(a) - basisGetal(b));
      offer = opties[0];
    }
    if (!offer) { console.log(`  – ${rij.product_id}: geen opties`); continue; }
    if (offer.shop !== "ah") { console.log(`  → ${rij.product_id}: gekozen bij ${offer.shop}, niet AH`); continue; }
    if (!offer.external_id) { console.log(`  ⚠︎ ${rij.product_id}: AH-optie zonder productId`); continue; }
    mandje.push({ productId: offer.external_id, quantity: rij.aantal || 1 });
    console.log(`  ✓ ${offer.titel || rij.product_id} ×${rij.aantal || 1} → AH-mandje`);
  }

  if (!mandje.length) { console.log("\nNiets voor AH om in het mandje te zetten."); return; }

  const { token, ingelogd } = await ah.accessToken();
  if (!ingelogd) throw new Error("Geen ingelogde AH-sessie (state/ah-token.json). Log eerst in.");
  await ah.voegToeAanMandje(token, mandje);
  await ah.actiefMandje(token).catch(() => null);
  console.log(`\n✓ ${mandje.length} producten in je AH-mandje gezet. Controleer en reken af in de AH-app of op ah.nl.`);
}

main().catch((e) => { console.error("Fout:", e.message); process.exit(1); });
