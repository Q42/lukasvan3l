# boodschappen

Een boodschappen-app die per product de **goedkoopste van drie winkels** kiest:
**Varuvo**, **Albert Heijn** en **Van Haver tot Gort**. Bij het bestellen maakt
de app een bestellijst per winkel (welk product waar het goedkoopst is).

Voor Lukas persoonlijk (`lukas@q42.nl`). Nederlands, houden zo.

## Twee delen

1. **`index.html`** — de app zelf. Één self-contained HTML-bestand (inline CSS +
   JS, geen build, geen dependencies). Draait via GitHub Pages, dus **puur
   client-side**. Alle data (boodschappenlijst, productcatalogus, prijzen) staat
   in `localStorage` van de browser. Er gaat **niets naar een server**.

   Tabs: **Lijst** (items toevoegen/afvinken), **Bestellen** (verdeling per
   winkel + besparing), **Producten** (catalogus: per winkel link/prijs/inhoud),
   **Data** (import/export).

2. **`agent/`** — een los Node/Playwright-scriptje dat op **Lukas' eigen machine**
   draait, inlogt bij de winkels met zíjn credentials, prijzen ophaalt en een
   `prijzen.json` produceert. Dat bestand importeer je in de app (tab Data).
   Staat los omdat persoonlijke prijzen en inloggegevens **niet** in deze
   publieke repo horen.

## Waarom de prijs-agent niet in de webpagina zit

- GitHub Pages is statisch: geen server-side code, dus geen plek om veilig in te
  loggen of credentials te bewaren.
- Varuvo-prijzen zijn **persoonlijk** (zakelijk account) en alleen na login
  zichtbaar. AH heeft persoonlijke bonus. Die data mag niet publiek.
- Winkels hebben bot-bescherming; een echte browser (Playwright) met een
  bewaarde sessie is de betrouwbare route. Dat kan niet vanuit een statische
  pagina.

Daarom: app = publiek & dom; agent = lokaal & met geheimen. Ze praten via
`prijzen.json` (agent schrijft, app importeert) en `boodschappen-export.json`
(app schrijft welke producten je wilt, agent leest).

## Prijsvergelijking: stuksprijs

Varuvo verkoopt vaak per **doos**. Daarom heeft elk product per winkel een veld
`inhoud` (stuks per verpakking). De app vergelijkt op **stuksprijs**
(`prijs / inhoud`), zodat 1 pak bij AH eerlijk tegen een doos bij Varuvo afgezet
wordt.

## Datamodel (localStorage `boodschappen.v1`)

```
producten: { [id]: { id, naam, shops: { varuvo|ah|vhtg: { url, prijs, inhoud, omschrijving, bijgewerkt } } } }
lijst:      [ { productId, aantal, af, shopKeuze } ]
prijzenOpgehaald: iso-string | null
```

`shopKeuze` overschrijft de automatische goedkoopste-keuze als de gebruiker in
het Bestellen-tabblad handmatig een andere winkel kiest.

## Werkregels

- **Blijf in deze map.** Niets buiten `boodschappen/` aanraken, behalve de tegel
  in de root-`index.html` (verplicht voor elke nieuwe one-off).
- App-bestand blijft dependency-loos en self-contained.
- Zet nooit echte prijzen, credentials, `state/` of `.env` in git — zie
  `agent/.gitignore`.
