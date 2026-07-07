// fill-cart-ah.mjs — vult je Albert Heijn-winkelmandje met de producten die (op
// stuksprijs) het goedkoopst bij AH zijn. Vereist een ingelogde AH-sessie
// (state/ah-token.json — zie login.mjs / ah.mjs → wisselCodeIn).
//
// Gebruik:  node fill-cart-ah.mjs [pad/naar/boodschappen-export.json]
//
// Nodig: output/prijzen.json (voor prijzen + AH productId's) én het exportbestand
// uit de app (voor aantallen). Draai dus eerst `node fetch-prices.mjs`.
// Checkout/betalen doe je zelf in de app of op ah.nl — dit vult alleen het mandje.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { laadExport, producten as productenUit, HIER } from "./lib.mjs";
import * as ah from "./ah.mjs";
import "dotenv/config";

const SHOPS = ["varuvo", "ah", "vhtg"];
const stuksprijs = (s) => (s && typeof s.prijs === "number") ? s.prijs / (s.inhoud > 0 ? s.inhoud : 1) : null;

function laadPrijzen() {
  const pad = join(HIER, "output", "prijzen.json");
  if (!existsSync(pad)) throw new Error(`Geen ${pad}. Draai eerst: node fetch-prices.mjs`);
  const data = JSON.parse(readFileSync(pad, "utf8"));
  // index: productId -> { shop -> {prijs, inhoud, productId(=AH webshopId)} }
  const idx = {};
  for (const r of data.prijzen || []) {
    (idx[r.product] ||= {})[r.shop] = r;
  }
  return idx;
}

function goedkoopste(shops) {
  let beste = null;
  for (const s of SHOPS) {
    const sp = stuksprijs(shops[s]);
    if (sp !== null && (beste === null || sp < beste.sp)) beste = { shop: s, sp };
  }
  return beste;
}

async function main() {
  const exp = laadExport(process.argv[2]);
  const prijsIdx = laadPrijzen();
  const lijst = exp.lijst || productenUit(exp).map((p) => ({ productId: p.id, product: p.naam, aantal: 1 }));

  const mandje = [];
  for (const rij of lijst) {
    const pid = rij.productId || rij.id;
    const shops = prijsIdx[pid];
    if (!shops) { console.log(`  – ${rij.product}: geen prijzen, overslaan`); continue; }
    const beste = goedkoopste(shops);
    if (!beste) continue;
    if (beste.shop !== "ah") { console.log(`  → ${rij.product}: goedkoopst bij ${beste.shop}, niet AH`); continue; }
    const ahProductId = shops.ah.productId;
    if (!ahProductId) { console.log(`  ⚠︎ ${rij.product}: AH goedkoopst maar geen productId bekend`); continue; }
    mandje.push({ productId: ahProductId, quantity: rij.aantal || 1 });
    console.log(`  ✓ ${rij.product} ×${rij.aantal || 1} → AH-mandje`);
  }

  if (!mandje.length) { console.log("\nNiets voor AH om in het mandje te zetten."); return; }

  const { token, ingelogd } = await ah.accessToken();
  if (!ingelogd) throw new Error("Geen ingelogde AH-sessie (state/ah-token.json). Log eerst in — zonder login kan het mandje niet gevuld worden.");
  await ah.voegToeAanMandje(token, mandje);
  const actief = await ah.actiefMandje(token).catch(() => null);
  console.log(`\n✓ ${mandje.length} producten in je AH-mandje gezet.`);
  if (actief) console.log("  Controleer en reken af in de AH-app of op ah.nl.");
}

main().catch((e) => { console.error("Fout:", e.message); process.exit(1); });
