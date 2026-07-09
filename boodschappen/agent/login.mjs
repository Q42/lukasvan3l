// login.mjs — eenmalig interactief inloggen per winkel; bewaart de sessie
// (cookies/localStorage) in state/<shop>.json zodat fetch-prices.mjs die hergebruikt.
// Albert Heijn gebruikt OAuth → state/ah-token.json (zie loginAh).
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
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { wisselCodeIn } from "./ah.mjs";
import "dotenv/config";

const HIER = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(HIER, "state");
mkdirSync(STATE_DIR, { recursive: true });

const SHOPS = {
  varuvo: {
    start: "https://www.varuvo.nl/customer/account/login/",
    email: process.env.VARUVO_EMAIL,
    wachtwoord: process.env.VARUVO_WACHTWOORD,
  },
  ah: {
    start: "https://www.ah.nl/mijn/inloggen",
    email: process.env.AH_EMAIL,
    wachtwoord: process.env.AH_WACHTWOORD,
  },
  vhtg: {
    start: "https://www.vanhavertotgort.nl/mijn-account/",
    email: process.env.VHTG_EMAIL,
    wachtwoord: process.env.VHTG_WACHTWOORD,
  },
};

const vraag = (q) =>
  new Promise((res) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(q, (a) => {
      rl.close();
      res(a);
    });
  });

function pakAhCode(url) {
  if (!url?.includes("login-exit")) return null;
  const m = url.match(/[?&]code=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function loginAh(shop) {
  console.log("\n── ah ──");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let code = null;
  const vangCode = (url) => {
    const c = pakAhCode(url);
    if (c) code = c;
  };
  page.on("framenavigated", (f) => vangCode(f.url()));
  page.on("request", (r) => vangCode(r.url()));

  await page.goto(shop.start, { waitUntil: "commit" }).catch(() => {});
  if (shop.email) console.log(`  Inlog e-mail (uit .env): ${shop.email}`);
  console.log(
    "  Log in in het browservenster. Na succes redirect AH naar appie://login-exit — de code wordt automatisch opgepikt.",
  );
  await vraag(
    "  Klaar? Druk op Enter (na inloggen of automatische redirect)… ",
  );

  if (!code) {
    const handmatig = (
      await vraag(
        "  Geen code opgepikt. Plak de code uit de redirect-URL (of Enter om over te slaan): ",
      )
    ).trim();
    if (handmatig) code = handmatig;
  }

  if (code) {
    await wisselCodeIn(code);
    console.log("  ✓ OAuth-token opgeslagen in state/ah-token.json");
  } else {
    console.warn("  ⚠︎ Geen code — state/ah-token.json niet bijgewerkt.");
  }
  await browser.close();
}

async function loginShop(key) {
  const shop = SHOPS[key];
  if (!shop) {
    console.error(`Onbekende shop: ${key}`);
    return;
  }
  if (key === "ah") return loginAh(shop);

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
