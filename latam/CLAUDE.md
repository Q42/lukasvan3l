# latam

Reisplanner voor **onze 3-maanden Latijns-Amerika trip** (half juni – half
september), in het Nederlands. Statisch, geen build step, geen backend.

## Trip context

- **Wie:** Lukas + Hester. Hester heeft eerder 3 maanden in **Guatemala**
  gewoond en wil daar terugkeren.
- **Doel:** Spaans leren + ervaring opdoen, in **3 fases**:
  1. weken **intensieve Spaanse les**
  2. weken **workaway / gemeenschapsleven**
  3. weken **vakantie / roadtrip**
- **Landen:** Guatemala (alleen per vlucht bereikbaar vanuit Zuid-Amerika —
  Darién Gap!) + Spaanstalig Zuid-Amerika: Colombia, Ecuador, Peru, Bolivia,
  Chili, Argentinië.
- **Seizoen:** juni–sept = droog seizoen in de Andes (beste tijd);
  Patagonië is dan winter (vermijden); Guatemala regenseizoen maar met
  vooral middag-/avondbuien (goed te doen).
- **Auto:** geen doorlopende auto; per land/regio een **4x4 met daktent
  huren** voor de vakantieweken. Cross-border met huurauto in
  Midden-Amerika meestal niet toegestaan.

## Contents

- `index.html` — intro, de 3 fases, interactieve kaart met highlights,
  seizoensoverzicht per regio.
- `planning.html` — invulbaar weekschema (13 weken), opslag in
  `localStorage` (key `latam-planning-v1`), knop voor voorbeeldplanning.
- `reizen.html` — hoe je tussen de landen reist (vlucht vs bus, indicatie
  reistijd/kosten), incl. de Guatemala-vlucht-regel.
- `verhuur.html` — 4x4-verhuur per regio: bedrijven, links,
  grensovergang-regels, kosten, ophaal/inleverlocaties.
- `style.css` — gedeelde styling + navigatie voor alle pagina's.

## How it works

- **Kaart:** [Leaflet](https://leafletjs.com/) van de unpkg CDN met
  OpenStreetMap-tiles — geen API key. Markers staan als JS-array in
  `index.html`; popup toont naam + korte notitie.
- **Planning:** rijen worden door JS gegenereerd (weken vanaf 15 juni);
  elke wijziging wordt direct in `localStorage` bewaard. Geen server.
- Styling volgt de repo-look: Fraunces + Inter via Google Fonts, licht
  thema, kaart-tegels.
