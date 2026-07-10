// fetch-prices.mjs — haalt per zoekterm bij elke winkel ALLE matchende producten
// (SKU's) op met de bewaarde sessie (zie login.mjs), inclusief verpakkingsgrootte,
// en schrijft ze als "offers" weg.
//
// Bron van producten + bestemming van offers:
//   • Is Supabase ingesteld (SUPABASE_URL + SUPABASE_SERVICE_KEY in .env), dan
//     leest de agent de zoektermen uit de database en schrijft de offers terug.
//   • Anders valt hij terug op bestanden: leest boodschappen-export.json en
//     schrijft output/prijzen.json (puur voor lokaal testen).
//
// Gebruik:  node fetch-prices.mjs [pad-naar-boodschappen-export.json]
//
// Elke adapter geeft een LIJST offers terug: { prijs, titel, hoeveelheid,
// eenheid, url, productId }. De selector-/parse-logica per winkel staat in
// SHOP_ADAPTERS — pas dat aan als een winkel z'n HTML wijzigt.

import { chromium } from "playwright";
import { join } from "node:path";
import { laadExport, producten, heeftSessie, parsePrijs, parseHoeveelheid, STATE_DIR } from "./lib.mjs";
import * as ah from "./ah.mjs";
import { heeftDb, getProducten, vervangOffers, schrijfOffersBestand } from "./db.mjs";
import "dotenv/config";

const MAX_PER_WINKEL = 8;  // hoeveel matches per winkel maximaal opslaan

const SHOP_ADAPTERS = {
  // Van Haver tot Gort — WooCommerce. Publiek; Store API geeft schone JSON.
  vhtg: {
    naam: "Van Haver tot Gort",
    async offers(page, product) {
      const term = encodeURIComponent(product.naam);
      const api = `https://www.vanhavertotgort.nl/wp-json/wc/store/v1/products?search=${term}&per_page=${MAX_PER_WINKEL}`;
      try {
        const res = await page.request.get(api);
        if (res.ok()) {
          const arr = await res.json();
          if (arr.length) return arr.map((p) => {
            const prijs = p.prices ? Number(p.prices.price) / 10 ** (p.prices.currency_minor_unit ?? 2) : null;
            if (prijs == null) return null;
            const { hoeveelheid, eenheid } = parseHoeveelheid(p.name);
            return { prijs, titel: p.name, url: p.permalink, productId: String(p.id), hoeveelheid, eenheid };
          }).filter(Boolean);
        }
      } catch { /* val terug op scrapen */ }
      // Fallback: zoekpagina scrapen.
      await page.goto(`https://www.vanhavertotgort.nl/?s=${term}&post_type=product`, { waitUntil: "domcontentloaded" });
      const kaarten = page.locator("ul.products li.product, .products .product");
      const n = Math.min(await kaarten.count(), MAX_PER_WINKEL);
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = kaarten.nth(i);
        const prijs = parsePrijs(await k.locator(".price, .woocommerce-Price-amount").first().textContent().catch(() => null));
        if (prijs == null) continue;
        const titel = (await k.locator(".woocommerce-loop-product__title, h2, h3").first().textContent().catch(() => ""))?.trim();
        const url = await k.locator("a").first().getAttribute("href").catch(() => null);
        out.push({ prijs, titel, url, ...parseHoeveelheid(titel) });
      }
      return out;
    },
  },

  // Albert Heijn — mobiele API (api.ah.nl). browserloos.
  ah: {
    naam: "Albert Heijn",
    browserloos: true,
    async init() {
      const { token, ingelogd } = await ah.accessToken();
      console.log(`  ${ingelogd ? "ingelogd (persoonlijke bonus + mandje mogelijk)" : "anoniem (publieke prijzen)"}`);
      return token;
    },
    async offers(token, product) {
      return (await ah.offersVoor(token, product.naam)).slice(0, MAX_PER_WINKEL);
    },
  },

  // Varuvo — Magento 2, B2B. Persoonlijke prijzen, alleen na login + anti-bot.
  // Draai met bewaarde sessie (node login.mjs varuvo). Zoekpagina = /catalogsearch/result/?q=.
  varuvo: {
    naam: "Varuvo",
    async offers(page, product) {
      const term = encodeURIComponent(product.naam);
      await page.goto(`https://www.varuvo.nl/catalogsearch/result/?q=${term}`, { waitUntil: "domcontentloaded" });
      const kaarten = page.locator(".product-item-info, li.item.product");
      const n = Math.min(await kaarten.count(), MAX_PER_WINKEL);
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = kaarten.nth(i);
        const prijs = parsePrijs(await k.locator('[data-price-type="finalPrice"] .price, .price-wrapper .price, .price').first().textContent().catch(() => null));
        if (prijs == null) continue;
        const titel = (await k.locator(".product-item-link, .product-item-name a").first().textContent().catch(() => ""))?.trim();
        const url = await k.locator(".product-item-link, a.product-item-photo").first().getAttribute("href").catch(() => null);
        out.push({ prijs, titel, url, ...parseHoeveelheid(titel) });
      }
      return out;
    },
  },
};

async function main() {
  const naarDb = heeftDb();
  const items = naarDb ? await getProducten() : producten(laadExport(process.argv[2]));
  if (!items.length) { console.error(naarDb ? "Geen producten in de database (voeg ze toe in de app)." : "Geen producten in het exportbestand."); process.exit(1); }
  console.log(`${items.length} zoektermen, ${Object.keys(SHOP_ADAPTERS).length} winkels. Bestemming: ${naarDb ? "Supabase" : "output/prijzen.json"}.`);

  const browser = await chromium.launch({ headless: true });
  // per (product, shop) verzamelen zodat we die set in één keer kunnen vervangen
  const verzameld = [];  // { product, shop, offers: [...] }

  for (const [shop, adapter] of Object.entries(SHOP_ADAPTERS)) {
    console.log(`\n── ${adapter.naam} ──`);
    let ctx, doel;
    if (adapter.browserloos) {
      try { doel = await adapter.init(); }
      catch (e) { console.warn(`  ⚠︎ ${shop} overslaan: ${e.message}`); continue; }
    } else {
      const statePad = join(STATE_DIR, `${shop}.json`);
      if (!heeftSessie(shop)) console.warn(`  ⚠︎ Geen sessie voor ${shop} — draai \`node login.mjs ${shop}\`.`);
      ctx = await browser.newContext(heeftSessie(shop) ? { storageState: statePad } : {});
      doel = await ctx.newPage();
    }
    for (const product of items) {
      try {
        const offers = (await adapter.offers(doel, product)) || [];
        verzameld.push({ product: product.id, shop, offers });
        console.log(`  ${offers.length ? "✓" : "–"} ${product.naam}: ${offers.length} optie(s)`);
      } catch (e) {
        console.log(`  ✗ ${product.naam}: ${e.message.split("\n")[0]}`);
      }
    }
    if (ctx) await ctx.close();
  }

  await browser.close();
  const totaal = verzameld.reduce((t, v) => t + v.offers.length, 0);
  if (naarDb) {
    await vervangOffers(verzameld);
    console.log(`\n✓ ${totaal} offers weggeschreven naar Supabase. De app werkt live bij.`);
  } else {
    const pad = schrijfOffersBestand(verzameld);
    console.log(`\n✓ ${totaal} offers geschreven naar ${pad} (lokale test-fallback).`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
