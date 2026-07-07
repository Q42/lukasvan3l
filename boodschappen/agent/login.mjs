// login.mjs — eenmalig interactief inloggen per winkel; bewaart de sessie
// (cookies/localStorage) in state/<shop>.json zodat fetch-prices.mjs die hergebruikt.
//
// Gebruik:  node login.mjs varuvo        (of: ah | vhtg | alle)
//
// Dit opent een ZICHTBARE browser. Log in (inclusief evt. 2FA/captcha met de hand),
// en zodra je op je account/overzicht staat druk je hier in de terminal op Enter.
// De sessie wordt opgeslagen. Draai dit opnieuw als prijzen "onbekend" blijven
// omdat de sessie verlopen is.
//
// Er worden GEEN wachtwoorden opgeslagen — alleen de sessiecookies die de winkel
// zelf zet. Dit script leest .env alleen om de loginvelden alvast in te vullen.

import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import "dotenv/config";

const HIER = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(HIER, "state");
mkdirSync(STATE_DIR, { recursive: true });

const SHOPS = {
  varuvo: { start: "https://www.varuvo.nl/customer/account/login/", email: process.env.VARUVO_EMAIL, wachtwoord: process.env.VARUVO_WACHTWOORD },
  ah:     { start: "https://www.ah.nl/mijn/inloggen", email: process.env.AH_EMAIL, wachtwoord: process.env.AH_WACHTWOORD },
  vhtg:   { start: "https://www.vanhavertotgort.nl/mijn-account/", email: process.env.VHTG_EMAIL, wachtwoord: process.env.VHTG_WACHTWOORD },
};

const vraag = (q) => new Promise((res) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); res(a); });
});

async function loginShop(key) {
  const shop = SHOPS[key];
  if (!shop) { console.error(`Onbekende shop: ${key}`); return; }
  console.log(`\n── ${key} ──`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(shop.start, { waitUntil: "commit" }).catch(() => {});
  if (shop.email) console.log(`  Inlog e-mail (uit .env): ${shop.email}`);
  console.log("  Log in in het browservenster (evt. handmatig 2FA/captcha).");
  await vraag("  Klaar en ingelogd? Druk op Enter om de sessie op te slaan… ");
  await context.storageState({ path: join(STATE_DIR, `${key}.json`) });
  console.log(`  ✓ Sessie opgeslagen in state/${key}.json`);
  await browser.close();
}

const doel = (process.argv[2] || "alle").toLowerCase();
const lijst = doel === "alle" ? Object.keys(SHOPS) : [doel];
for (const k of lijst) await loginShop(k);
console.log("\nKlaar. Draai nu `npm run prijzen`.");
