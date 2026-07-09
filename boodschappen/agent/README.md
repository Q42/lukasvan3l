# Prijs-agent

Haalt bij **Varuvo**, **Albert Heijn** en **Van Haver tot Gort** de prijzen op
en schrijft ze naar **Supabase**, waar de app ze live oppikt. (Zonder Supabase-
config valt hij terug op een `output/prijzen.json`-bestand — handig om de
scrapers los te testen.)

Dit draait op **jouw eigen machine** — niet op GitHub Pages. Reden: het gebruikt
je persoonlijke inloggegevens en een echte browser, en de geheime Supabase
service-role key mag niet in de publieke repo staan.

> Let op: in de cloud-omgeving waarin deze code is gemaakt zijn `ah.nl`,
> `varuvo.nl` en `vanhavertotgort.nl` geblokkeerd door netwerkbeleid, dus daar
> kon ik de prijsophaling niet live testen. Op je eigen machine (zonder die
> blokkade) werkt het wel. De selectors kunnen na een site-update bijstelling
> nodig hebben — zie *Onderhoud* onderaan.

## Eenmalige setup

```bash
cd boodschappen/agent
npm install                 # playwright + dotenv + @supabase/supabase-js
npx playwright install chromium
cp .env.example .env        # vul in: SUPABASE_URL + SUPABASE_SERVICE_KEY, evt. shop-logins
```

Zet in `.env` de **Supabase** waarden (uit `supabase/README.md` stap 5):
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>   # GEHEIM
```

`.env`, `state/` en `output/` staan in `.gitignore` — geheimen en persoonlijke
data verlaten je machine niet.

## Werkwijze

1. **Inloggen (eenmalig per winkel, sessies verlopen na dagen/weken):**
   ```bash
   node login.mjs alle      # of: node login.mjs ah | varuvo | vhtg
   ```
   Er opent een zichtbaar browservenster. Log in (evt. 2FA/captcha met de hand)
   en druk in de terminal op Enter. De sessie wordt opgeslagen in `state/`.

   **Albert Heijn** werkt iets anders: die gebruikt een mobiele API. Log in het
   browservenster in; na succes stuurt AH je naar `appie://login-exit?code=…`.
   Kopieer die `code` en wissel 'm in (zie `ah.mjs` → `wisselCodeIn`). Voor
   alleen prijsvergelijking is dit niet nodig — publieke prijzen werken anoniem.
   Inloggen is alleen nodig voor je **persoonlijke bonus** en het **vullen van je
   mandje**.

2. **Opties ophalen en naar Supabase schrijven:**
   ```bash
   node fetch-prices.mjs
   ```
   Leest de zoektermen uit de database (die je in de app toevoegt) en haalt per
   winkel **alle matchende producten (SKU's)** op — inclusief verpakkingsgrootte —
   en schrijft ze als `offers` terug. De app werkt live bij. Zet dit in een
   **cron** (bv dagelijks); dat houdt meteen je gratis Supabase-project wakker.

   > Zonder `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` valt hij terug op bestanden:
   > leest `boodschappen-export.json` en schrijft `output/prijzen.json`. Puur voor
   > lokaal testen — de app zelf werkt met Supabase, niet met dat bestand.

3. **(optioneel) AH-mandje automatisch vullen:**
   ```bash
   node fill-cart-ah.mjs
   ```
   Zet per lijst-item de **gekozen** AH-optie (of, zonder keuze, de goedkoopste AH-
   optie op basisprijs) in je Albert Heijn-winkelmandje. Vereist een ingelogde AH-
   sessie. Afrekenen doe je zelf in de AH-app / op ah.nl.

## Per winkel

| Winkel | Prijzen | Inloggen nodig? | Hoe |
|---|---|---|---|
| **Albert Heijn** | publiek + persoonlijke bonus | alleen voor bonus/mandje | Mobiele API `api.ah.nl` (`ah.mjs`). Anoniem token voor publieke prijzen; refresh-token voor bonus + winkelmandje vullen. |
| **Van Haver tot Gort** | publiek | nee | WooCommerce Store API `/wp-json/wc/store/v1/products`, met scrape-fallback. |
| **Varuvo** | **persoonlijk** | **ja** | Browser met bewaarde sessie (zie `login.mjs`). Magento B2B, prijzen accountspecifiek. Site heeft een "Human verification"-laag; log daarom met een echte browser in. Sessie verloopt snel (reken op ± dagelijks opnieuw inloggen). Verkoopt vaak per **doos** — vul `inhoud` per product in de app aan voor een eerlijke stuksprijs. |

## Tip voor Varuvo: vraag naar een export

Varuvo is een B2B-groothandel met een stevige anti-bot laag; automatiseren blijft
daar het meest fragiel (± dagelijks opnieuw inloggen). Er bestaat een
officiële partner-koppeling (bijv. met MijnDiAd) en mogelijk een prijslijst-/
bestellijst-export voor accounthouders. Het kan de moeite waard zijn de Varuvo-
klantenservice te vragen of jij als klant een prijslijst kunt exporteren — dat is
duurzamer dan tegen de bot-bescherming aan blijven werken.

## Winkelmandje automatisch vullen

- **Albert Heijn:** volledig mogelijk via de API — `ah.mjs` heeft
  `voegToeAanMandje(token, items)` (vereist ingelogd token). De app-export bevat
  per product het AH-`productId` zodra prijzen zijn opgehaald.
- **Varuvo / Van Haver tot Gort:** via de bewaarde browsersessie kan Playwright
  op "in winkelmandje" klikken. Dit zit nog niet in het script (eerst prijzen
  goed werkend krijgen); makkelijk toe te voegen per winkel-adapter.

## Onderhoud

Winkels wijzigen hun HTML. Als een winkel "niet gevonden" blijft geven:
- **AH:** endpoints staan in `ah.mjs`. Meestal stabiel; bij een grote update kijk
  naar het actuele veldnaam-schema (`priceBeforeBonus`, `bonusPrice`, `webshopId`).
- **VHTG / Varuvo:** de CSS-selectors staan in `fetch-prices.mjs` in
  `SHOP_ADAPTERS`. Open de zoekpagina in een browser, inspecteer de
  productkaart en werk de selectors bij.
