# slovenie

A one-off static page: a travel itinerary for a two-week summer camping trip
through Slovenia (August 2026), in Dutch.

## Trip context (who's going & what they like)

This page is tailored to **our family trip**, so keep content relevant to:

- **Who:** Lukas + Hester, with the kids **Floris (9)** and **Yune (7)**.
- **Bikes:** we bring **2 mountainbikes** (one for Lukas, one shared by Hester
  or Floris). We like **gravel riding**, **not** steep/technical climbs — favour
  mellow valley/riverside gravel.
- **No slackline:** we decided *not* to bring one — don't mention slacklines
  anywhere on the page or the packing list.
- **Water play:** Floris and Yune love **playing by/in water** (shallow
  streams, rivers) — highlight kid-friendly water spots.

When adding or editing content, lean into these preferences (gentle gravel,
water play for the kids) and keep the kids' names (Floris & Yune) consistent.

## Contents

Vier pagina's plus één gedeelde stylesheet. Geen build step, geen dependencies;
open een `.html` in de browser en klaar.

- `index.html` — **Reisplan**: route, kaart, de drie basiskampen en de dagtrips.
- `geschiedenis.html` — **Geschiedenis**: tijdlijn + "waar zie je het terug".
- `paklijst.html` — **Paklijst**: afvinklijst, voortgang in `localStorage`.
- `learnings.html` — **Learnings**: wat we meenemen naar de vólgende vakantie.
- `stijl.css` — gedeelde basis: kleurtokens, `body`, de menubalk, de hero,
  `.section*`, `.booking-box`, `.btn`/`.actions` en `.site-footer`. Pagina-eigen
  opmaak blijft inline in de betreffende `.html`.

## Navigatie tussen de pagina's

- Elke pagina begint met dezelfde **menubalk** (`.sitenav`, sticky): merk links,
  vier tabs rechts. De tab van de huidige pagina krijgt `class="active"`. Voeg je
  een pagina toe, zet 'm dan in **alle vier** de menu's. Op de telefoon verdwijnt
  de merknaam (`.brand-text`) zodat de vier tabs passen.
- Alleen het reisplan heeft daaronder een **springbalk** (`.jumpbar`, sticky op
  `top: 52px`) naar `#heenreis`, `#kamp1`, `#kamp2`, `#kamp3` en `#terugweg`. De
  stops in de routebalk linken naar diezelfde ankers. Secties met een `id`
  krijgen via `stijl.css` een `scroll-margin-top` zodat de kop niet onder de
  sticky balken verdwijnt — pas die aan als de balkhoogtes veranderen.

## How it works

- **Layout/styling** is plain CSS: `stijl.css` + een inline `<style>` per pagina.
  Fonts come from Google Fonts.
- **Interactive map**: [Leaflet](https://leafletjs.com/) (loaded from the
  unpkg CDN) with OpenStreetMap tiles. Markers for the 3 basecamps and the day
  trips, plus a route line. No API key required.
- **Photos** are fetched at runtime in the visitor's browser. Each `<img>` has
  a `data-wiki` attribute (one or more `|`-separated Wikipedia article titles)
  and a `data-search` attribute (a Wikimedia Commons image-search query). The
  loader tries each Wikipedia article's lead image first (`prop=pageimages`),
  then falls back to a Commons photo search, then to the styled gradient +
  emoji placeholder. So to fix a blank card, tweak its `data-wiki` candidates
  or `data-search` query.

## Plan wordt logboek

Tijdens de reis wordt het reisplan bijgewerkt naar **wat er echt gebeurd is**.
Een dag die geweest is:

- krijgt `class="day-row done"` en een `<span class="day-flag">✅ Gedaan</span>`
  achter het daglabel (dat dan de weekdag noemt: "Dinsdag 4 aug");
- krijgt een beschrijving in de **verleden tijd** van wat we werkelijk deden —
  ook als dat iets heel anders was dan gepland. De oude planregel verdwijnt.
- Een geplande dag die niet doorging maar nog wél kan, blijft staan met
  `<span class="day-flag open">Niet gepland</span>` in plaats van een datum —
  dan vervalt ook de `data-date` (zulke reserverijen staan onderaan de
  `days-grid` van hun kamp). Een uitje dat definitief niet meer kan (de dag is
  voorbij) houdt zijn datum en krijgt
  `<span class="day-flag open">Niet doorgegaan</span>`, met in één zin wat er
  wél gebeurde of waarom het niet lukte.
- Reisdagen en de boekingsblokken volgen hetzelfde: `travel-row done`,
  en de status wordt `✅ Gedaan` / `✅ Verbleven` / `✅ Aangekomen`.
- Elke `.day-row` heeft een `data-date="JJJJ-MM-DD"`. Een scriptje onderaan
  zet daarmee automatisch `class="today"` + een geel `👉 Vandaag`-chipje op de
  dag van vandaag. Nieuwe dagrij? Zet er dus een `data-date` op.
- In de kaart-JS krijgt zo'n dagtrip `done: true`; die stippen worden gevuld
  getekend in plaats van open. Verwijder de markers van dingen die we niet
  gedaan hebben, en voeg de echte plekken toe (coördinaten mogen ruw).

## Voorleesweetjes bij elk uitje

- Elke `.day-row` heeft onder de tags een `<details class="facts">` met
  "Wist je dat…" — een uitklapper (geen modal, zodat je gewoon kunt blijven
  scrollen en voorlezen). Ze staan standaard **dicht**.
- De toon is **om hardop voor te lezen aan Floris (9) en Yune (7)**: korte
  zinnen, één weetje per regel, elk met een eigen emoji in `.fico`. Drie tot
  zes per uitje; liever vier goede dan acht flauwe.
- Mengsel van **geschiedenis en natuurkunde-van-de-plek**: waarom is het water
  turquoise, wie stond hier honderd jaar geleden, welke legende hoort erbij.
  Leg waar het kan een **verband met een ander uitje** ("dit is dezelfde
  rivier als bij de camping") — dat werkt goed bij het voorlezen.
- Controleer een weetje voordat je het opschrijft. Bij twijfel: weglaten of
  voorzichtiger formuleren; dit wordt letterlijk aan kinderen voorgelezen.

## `geschiedenis.html`

- Een **tijdlijn** (`.timeline` / `.hist-item`, met `era-1/2/3` voor de kleur van
  de stip) van neanderthalers tot 1991, plus een grid **"waar zie je het terug op
  onze route"** (`.hist-spots` / `.hist-spot`) dat per basiskamp een verhaal
  koppelt aan een plek die we toch al bezoeken.
- Houd de tijdlijn **gekoppeld aan de route**: elk item dat je toevoegt hoort
  iets te zeggen over waar we slapen of heen rijden (Isonzofront bij kamp 1,
  Venetië/zout bij kamp 2, de vlotters van Ljubno bij kamp 3). De
  `.hist-here`-pil is daarvoor bedoeld.
- Onder het Sloveense deel staat een tweede hoofdstuk **Istrië & Kroatië**
  (`#istrie`), met dezelfde tijdlijn-opmaak en een eigen `.hist-spots`-grid.
  Vanaf kamp 2 rijden we die kant op, dus daar hoort ook wat we in Kroatië
  doen. Bovenaan staat een `.jump-down`-knop naar dat blok.

## `learnings.html`

- Bewust **niet reisspecifiek**: dit is de pagina die je bij het plannen van de
  vólgende vakantie openslaat. Geordend op scenario ("als we naar een mooie kust
  gaan", "een warm land", …) in `.lrn-card`s, want zo gebruik je ze ook.
- Een learning die uit deze reis komt krijgt het label
  `<span class="lrn-src">Slovenië 2026</span>`. Komt-ie van een volgende reis,
  gebruik dan die naam — zo blijft zichtbaar waar iets vandaan komt.
- Onderaan staat een notitieblokje dat in `localStorage` schrijft
  (`learnings-notities`), bedoeld om onderweg snel iets vast te leggen. Dat is
  **per apparaat** en staat niet in de repo; met "Kopieer alles" haal je de
  notities eruit om ze daarna als echte `.lrn-card`-regels in te typen.

## Booking & navigation

- Each basecamp card has a **booking box** (`.booking-box`) with a status badge
  (`.bk-ok` geboekt / `.bk-todo` nog te boeken) plus dates, address, payment
  and check-in info. Source data comes from the reservation e-mails.
  - **Kaki Plac** (kamp 2): Liminjan 8, 6320 Portorož · 7–12 aug · ref
    WTB1A9A3EC · €440 cash bij vertrek · tel +386 41 359 801.
  - **Kamp na Otoku** (kamp 3): Na Pečeh 7, 3333 Ljubno ob Savinji (island in
    the Savinja) · 12–17 aug · aanbetaling gedaan, rest + toeristenbelasting
    contant · tel +386 41 390 515.
  - **Camp Šorli / Camp Koritnica** (kamp 1): Koritnica 61a, 5242 Grahovo ob
    Bači · 2–7 aug · nog te boeken (22 juni gemaild) · tel +386 31 356 367.
    Note: this is in the **Baška grapa**, 12 km from Tolmin — *not* near
    Bovec, which is ±1,5u away over the mountain road.
  - **Berghof Oberweiler** (heenweg-tussenstop): Oberweiler 5, 91802 Meinheim,
    Duitsland · 1–2 aug · geboekt via Campspace · tel +49 9146 940 560.
  - **Terugweg** (17 & 18 aug): in tweeën, met dezelfde tussenstop als op de
    heenweg — Berghof Oberweiler bij Meinheim. Wel een nieuwe reservering via
    Campspace.
  - **Bootverhuur** (dagtrip 11 aug, kamp 2): is er niet van gekomen — die
    dagrij staat nu als *Niet doorgegaan* op de pagina en de learning
    ("boek een bootje vóór de vakantie") staat op `learnings.html`.
  - **Ljubljana** (dagtrip 14 aug, kamp 3): niks te boeken. Centrum is
    autovrij. Vanuit kamp 3 kom je aan de noordoostkant binnen, dus P+R Center
    Stožice (inrit Štajerska cesta) — €1,50/dag inclusief twee busritten,
    bus 13/18/20 het centrum in. Let op: in dezelfde garage geldt ook het
    ŠRC Stožice-uurtarief van €1,50/uur, dus bij de Urbanomat het P+R-tarief
    kiezen. Alternatieven: P+R Dolgi most (zuidwest) en P+R Ježica (noord, via
    Kamnik), of garage Kongresni trg ±€2–3/uur. Op vrijdag staat de
    *Odprta kuhna* op Pogačarjev trg (10:00–22:00, niet bij regen).
  - **Golte** (dagtrip 15 aug, kamp 3): niks te boeken, wel bellen voor het
    actuele schema van de nihalka (+386 3 839 1212, of hotel Montis
    +386 3 839 1100). Onderstation Radegunda 19c, Mozirje.
  - **Uit eten** (kamp 3): *Okrepčevalnica Ribiški dom* (Matej Podkrižnik
    s.p.), Na Pečeh 10, Ljubno — naast de camping, forel uit eigen vijver,
    +386 31 408 428. *Gostilna Weiss*, Radegunda 53A, Mozirje, bij het
    dalstation van de Golte-kabelbaan, +386 3 583 28 54 (reserveren tot een
    uur voor sluiting). Waar we gegeten hebben komt in de dagrij van die dag
    te staan, in een `booking-box` met de status "🐟 Waar we aten".
  - Vignetten zijn geregeld; het tweede vignet loopt van 10 t/m 19 aug.
  - **Snežna jama op Raduha is gesloten** (ingang ingestort bij het noodweer
    van aug 2023; ook seizoen 2025 en 2026 dicht). Stond in het oorspronkelijke
    plan; vervangen door Golte. Niet terugzetten zonder op snezna-jama.com te
    checken of hij weer open is.
- Every camp and day-trip has **action buttons** (`.actions` / `.btn`): a
  `🧭 Navigatie` link (`google.com/maps/dir/?api=1&destination=…`, opens
  turn-by-turn from the phone's location), a `📍 Maps` search link, and a
  `📞 Bel camping` `tel:` link on the camps. Drive time is shown both on the
  photo `.drive-badge` and in the nav button label.
- Alle pagina's zijn **responsive** (breekpunt `max-width: 760px`, de paklijst
  heeft er daarnaast één op 640px): kaarten en dagrijen worden één kolom, de
  route- en springbalk scrollen horizontaal. Het is bedoeld om onderweg op een
  telefoon open te hebben.

## Notes

- All external resources (Leaflet, OSM tiles, Wikipedia images, Google Fonts)
  load from the **visitor's** browser, so they won't render in a sandboxed
  environment without internet — that's expected; the fallbacks kick in.
- Map coordinates are approximate (overview only).
- Content is Dutch; keep it that way.

## Scope

This is a standalone one-off. Don't pull in or reference anything from other
directories in this repo.
