# Prijs-agent

Haalt bij **Varuvo**, **Albert Heijn** en **Van Haver tot Gort** de prijzen op
voor de boodschappen-app en schrijft een `prijzen.json` die je in de app
importeert (tab **Data**).

Dit draait op **jouw eigen machine** — niet op GitHub Pages. Reden: het gebruikt
je persoonlijke inloggegevens en een echte browser, en persoonlijke prijzen
(vooral Varuvo) mogen niet in de publieke repo staan.

> Let op: in de cloud-omgeving waarin deze code is gemaakt zijn `ah.nl`,
> `varuvo.nl` en `vanhavertotgort.nl` geblokkeerd door netwerkbeleid, dus daar
> kon ik de prijsophaling niet live testen. Op je eigen machine (zonder die
> blokkade) werkt het wel. De selectors kunnen na een site-update bijstelling
> nodig hebben — zie *Onderhoud* onderaan.

## Eenmalige setup

```bash
cd boodschappen/agent
npm install                 # installeert playwright + dotenv
npx playwright install chromium   # (op je eigen machine; in deze repo-omgeving stond Chromium al klaar)
cp .env.example .env        # vul je e-mailadressen/wachtwoorden in (optioneel; alleen om loginvelden voor te vullen)
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

2. **Exporteer je lijst uit de app:** tab **Data → Exporteer boodschappen**.
   Leg het bestand hier neer als `boodschappen-export.json` (of geef het pad mee).

3. **Prijzen ophalen:**
   ```bash
   node fetch-prices.mjs [pad/naar/boodschappen-export.json]
   ```
   Resultaat: `output/prijzen.json`.

4. **Importeer** `output/prijzen.json` in de app (tab **Data → Importeer prijzen**).
   De app kiest nu per product de goedkoopste winkel.

5. **(optioneel) AH-mandje automatisch vullen:**
   ```bash
   node fill-cart-ah.mjs [pad/naar/boodschappen-export.json]
   ```
   Zet alle producten die (op stuksprijs) het goedkoopst bij AH zijn in je
   Albert Heijn-winkelmandje. Vereist een ingelogde AH-sessie. Afrekenen doe je
   zelf in de AH-app / op ah.nl.

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
