// fetch-prices.mjs — haalt per product bij elke winkel de prijs op met de
// bewaarde sessie (zie login.mjs).
//
// Bron van producten + bestemming van prijzen:
//   • Is Supabase ingesteld (SUPABASE_URL + SUPABASE_SERVICE_KEY in .env), dan
//     leest de agent de producten uit de database en schrijft de prijzen terug.
//   • Anders valt hij terug op bestanden: leest boodschappen-export.json en
//     schrijft output/prijzen.json (die je dan in de app importeert).
//
// Gebruik:  node fetch-prices.mjs [pad-naar-boodschappen-export.json]
//
// Aanpak: één Playwright-browser, per winkel een context met de opgeslagen
// storageState. Per product: als er een winkelspecifieke `url` bekend is die
// gebruiken, anders de zoekpagina openen en het eerste resultaat pakken.
// Per winkel zit de selector-/parse-logica in SHOP_ADAPTERS hieronder — dat is
// het enige stuk dat je moet bijstellen als een winkel z'n HTML wijzigt.

import { chromium } from "playwright";
import { join } from "node:path";
import { laadExport, producten, heeftSessie, schrijfPrijzen, parsePrijs, STATE_DIR } from "./lib.mjs";
import * as ah from "./ah.mjs";
import { heeftDb, getProducten, upsertPrijzen } from "./db.mjs";
import "dotenv/config";

/* ─── winkel-adapters ───────────────────────────────────────────────
   Elke adapter krijgt (page, product) en geeft { prijs, inhoud?, url?, omschrijving? }
   of null terug. Houd ze klein en defensief: winkels wijzigen hun DOM.       */

const SHOP_ADAPTERS = {
  // Van Haver tot Gort — WooCommerce. Prijzen publiek; Store API geeft schone JSON.
  vhtg: {
    naam: "Van Haver tot Gort",
    async prijs(page, product) {
      const term = encodeURIComponent(product.naam);
      // Store API (WooCommerce) — geen login nodig voor catalogusprijzen.
      const api = `https://www.vanhavertotgort.nl/wp-json/wc/store/v1/products?search=${term}&per_page=1`;
      try {
        const res = await page.request.get(api);
        if (res.ok()) {
          const arr = await res.json();
          if (arr.length) {
            const p = arr[0];
            const prijs = p.prices ? Number(p.prices.price) / 10 ** (p.prices.currency_minor_unit ?? 2) : null;
            return prijs ? { prijs, url: p.permalink, omschrijving: p.name } : null;
          }
        }
      } catch { /* val terug op scrapen */ }
      // Fallback: zoekpagina scrapen.
      await page.goto(`https://www.vanhavertotgort.nl/?s=${term}&post_type=product`, { waitUntil: "domcontentloaded" });
      const kaart = page.locator("ul.products li.product, .products .product").first();
      if (!(await kaart.count())) return null;
      const prijsTekst = await kaart.locator(".price, .woocommerce-Price-amount").first().textContent().catch(() => null);
      const url = await kaart.locator("a").first().getAttribute("href").catch(() => null);
      const naam = await kaart.locator(".woocommerce-loop-product__title, h2, h3").first().textContent().catch(() => null);
      const prijs = parsePrijs(prijsTekst);
      return prijs ? { prijs, url, omschrijving: naam?.trim() } : null;
    },
  },

  // Albert Heijn — via de mobiele API (api.ah.nl), niet via de browser.
  // Zie ah.mjs. `browserloos: true` betekent dat main() geen Playwright-context
  // opent maar één keer een token regelt en dat aan de adapter meegeeft.
  ah: {
    naam: "Albert Heijn",
    browserloos: true,
    async init() {
      const { token, ingelogd } = await ah.accessToken();
      console.log(`  ${ingelogd ? "ingelogd (persoonlijke bonus + mandje mogelijk)" : "anoniem (publieke prijzen)"}`);
      return token;
    },
    async prijs(token, product) {
      return ah.prijsVoor(token, product.naam);
    },
  },

  // Varuvo — Magento 2, B2B. Prijzen zijn PERSOONLIJK en alleen na login zichtbaar,
  // en de site heeft een "Human verification" anti-bot laag. Daarom verplicht met
  // een bewaarde browsersessie (node login.mjs varuvo) draaien — zonder login zie
  // je geen prijzen. Magento-zoekpagina = /catalogsearch/result/?q=.
  // Let op de doos-verpakking: vul de `inhoud` (stuks per doos) zelf aan bij
  // Producten in de app, want dat parseren we niet betrouwbaar automatisch.
  varuvo: {
    naam: "Varuvo",
    async prijs(page, product) {
      const term = encodeURIComponent(product.naam);
      await page.goto(`https://www.varuvo.nl/catalogsearch/result/?q=${term}`, { waitUntil: "domcontentloaded" });
      const kaart = page.locator(".product-item, li.item.product, .products .product-item-info").first();
      if (!(await kaart.count())) return null;
      const prijsTekst = await kaart.locator('[data-price-type="finalPrice"] .price, .price-wrapper .price, .price').first().textContent().catch(() => null);
      const naam = await kaart.locator(".product-item-link, .product-item-name a, a.product-item-photo").first().textContent().catch(() => null);
      const href = await kaart.locator(".product-item-link, .product-item-photo").first().getAttribute("href").catch(() => null);
      const prijs = parsePrijs(prijsTekst);
      return prijs ? { prijs, url: href, omschrijving: naam?.trim() } : null;
    },
  },
};

async function main() {
  const naarDb = heeftDb();
  const items = naarDb ? await getProducten() : producten(laadExport(process.argv[2]));
  if (!items.length) { console.error(naarDb ? "Geen producten in de database (voeg ze toe in de app)." : "Geen producten in het exportbestand."); process.exit(1); }
  console.log(`${items.length} producten, ${Object.keys(SHOP_ADAPTERS).length} winkels. Bestemming: ${naarDb ? "Supabase" : "output/prijzen.json"}.`);

  const browser = await chromium.launch({ headless: true });
  const regels = [];

  for (const [shop, adapter] of Object.entries(SHOP_ADAPTERS)) {
    console.log(`\n── ${adapter.naam} ──`);
    let ctx, doel;
    if (adapter.browserloos) {
      try { doel = await adapter.init(); }
      catch (e) { console.warn(`  ⚠︎ ${shop} overslaan: ${e.message}`); continue; }
    } else {
      const statePad = join(STATE_DIR, `${shop}.json`);
      if (!heeftSessie(shop)) console.warn(`  ⚠︎ Geen sessie voor ${shop} — draai \`node login.mjs ${shop}\`. Ik probeer zonder login (werkt alleen voor publieke prijzen).`);
      ctx = await browser.newContext(heeftSessie(shop) ? { storageState: statePad } : {});
      doel = await ctx.newPage();
    }
    for (const product of items) {
      try {
        const r = await adapter.prijs(doel, product);
        if (r && r.prijs) {
          regels.push({ product: product.id, shop, ...r });
          console.log(`  ✓ ${product.naam}: € ${Number(r.prijs).toFixed(2)}`);
        } else {
          console.log(`  – ${product.naam}: niet gevonden`);
        }
      } catch (e) {
        console.log(`  ✗ ${product.naam}: ${e.message.split("\n")[0]}`);
      }
    }
    if (ctx) await ctx.close();
  }

  await browser.close();
  if (naarDb) {
    const n = await upsertPrijzen(regels);
    console.log(`\n✓ ${n} prijzen weggeschreven naar Supabase. De app werkt live bij.`);
  } else {
    const pad = schrijfPrijzen(regels);
    console.log(`\n✓ ${regels.length} prijzen geschreven naar ${pad}`);
    console.log("Importeer dit bestand in de app (tab Data → Importeer prijzen).");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
