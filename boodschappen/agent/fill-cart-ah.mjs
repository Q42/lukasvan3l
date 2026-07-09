// fill-cart-ah.mjs — vult je Albert Heijn-winkelmandje met de producten die (op
// stuksprijs) het goedkoopst bij AH zijn. Vereist een ingelogde AH-sessie
// (state/ah-token.json — zie login.mjs / ah.mjs → wisselCodeIn).
//
// Gebruik:  node fill-cart-ah.mjs [pad/naar/boodschappen-export.json]
//
// Bron:
//   • Is Supabase ingesteld, dan leest hij de prijzen + de actieve lijst uit de
//     database (opgeteld over alle leden).
//   • Anders leest hij output/prijzen.json (draai eerst fetch-prices.mjs) plus
//     het exportbestand uit de app voor de aantallen.
// Checkout/betalen doe je zelf in de app of op ah.nl — dit vult alleen het mandje.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { laadExport, producten as productenUit, HIER } from "./lib.mjs";
import * as ah from "./ah.mjs";
import { heeftDb, getPrijzen, getActieveLijst } from "./db.mjs";
import "dotenv/config";

const SHOPS = ["varuvo", "ah", "vhtg"];
const stuksprijs = (s) => (s && typeof s.prijs === "number") ? s.prijs / (s.inhoud > 0 ? s.inhoud : 1) : null;

// index: product_id -> { shop -> {prijs, inhoud, external_id, ...} }
function indexeer(prijsRegels) {
  const idx = {};
  for (const r of prijsRegels) {
    const shop = r.shop;
    const prod = r.product ?? r.product_id;
    (idx[prod] ||= {})[shop] = { ...r, external_id: r.external_id ?? r.productId };
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

async function bronDb() {
  const [prijzen, lijst] = await Promise.all([getPrijzen(), getActieveLijst()]);
  return { idx: indexeer(prijzen), lijst: lijst.map((r) => ({ product: r.product_id, aantal: r.aantal })) };
}

function bronBestand() {
  const pad = join(HIER, "output", "prijzen.json");
  if (!existsSync(pad)) throw new Error(`Geen ${pad}. Draai eerst: node fetch-prices.mjs`);
  const idx = indexeer(JSON.parse(readFileSync(pad, "utf8")).prijzen || []);
  const exp = laadExport(process.argv[2]);
  const lijst = (exp.lijst || productenUit(exp).map((p) => ({ productId: p.id, product: p.naam, aantal: 1 })))
    .map((r) => ({ product: r.productId || r.id || r.product, aantal: r.aantal || 1 }));
  return { idx, lijst };
}

async function main() {
  const { idx, lijst } = heeftDb() ? await bronDb() : bronBestand();

  const mandje = [];
  for (const rij of lijst) {
    const shops = idx[rij.product];
    if (!shops) { console.log(`  – ${rij.product}: geen prijzen, overslaan`); continue; }
    const beste = goedkoopste(shops);
    if (!beste) continue;
    if (beste.shop !== "ah") { console.log(`  → ${rij.product}: goedkoopst bij ${beste.shop}, niet AH`); continue; }
    const ahId = shops.ah.external_id;
    if (!ahId) { console.log(`  ⚠︎ ${rij.product}: AH goedkoopst maar geen productId bekend`); continue; }
    mandje.push({ productId: ahId, quantity: rij.aantal });
    console.log(`  ✓ ${rij.product} ×${rij.aantal} → AH-mandje`);
  }

  if (!mandje.length) { console.log("\nNiets voor AH om in het mandje te zetten."); return; }

  const { token, ingelogd } = await ah.accessToken();
  if (!ingelogd) throw new Error("Geen ingelogde AH-sessie (state/ah-token.json). Log eerst in — zonder login kan het mandje niet gevuld worden.");
  await ah.voegToeAanMandje(token, mandje);
  await ah.actiefMandje(token).catch(() => null);
  console.log(`\n✓ ${mandje.length} producten in je AH-mandje gezet. Controleer en reken af in de AH-app of op ah.nl.`);
}

main().catch((e) => { console.error("Fout:", e.message); process.exit(1); });
