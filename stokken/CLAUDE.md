# stokken

Een one-off leersite (Nederlands) over het zelf maken van **krachtstokken en
talking sticks**: hout en alternatieve materialen, edelstenen en hun
betekenis, bevestigings- en bewerkingstechnieken, gereedschap en goedkoop
inkopen. Inspiratiebron: Atelier Lazuli (talking sticks).

## Contents

Vijf pagina's plus één gedeelde stylesheet. Geen build step, geen
dependencies; open een `.html` in de browser en klaar.

- `index.html` — **Begin hier**: wat is een talking stick / krachtstok,
  anatomie van een stok, stappenplan voor een eerste project, wegwijzer.
- `materialen.html` — **Hout & meer**: houtsoortentabel (werkbaarheid +
  folklore-symboliek), hout drogen, gewei/bot/drijfhout/hoorn, vindplaatsen
  en goedkope inkoop.
- `stenen.html` — **Stenen**: betekenissen-tabel, vormen (punt, trommelsteen,
  donut, cabochon…), Mohs-hardheid, nep herkennen, inkoop (beurzen,
  groothandel, AliExpress).
- `technieken.html` — **Technieken**: houtbewerking met de hand en met de
  dremel (accessoiretabel), vijf bevestigingstechnieken (oplopend in
  moeilijkheid), versieren, afwerken met olie.
- `gereedschap.html` — **Gereedschap**: basisset met richtprijzen, handige
  extra's, het eerlijke AliExpress-mini-draaibank-advies, veiligheid.
- `stijl.css` — gedeelde basis: aardse kleurtokens (schors/perkament/oker/
  mos), de menubalk (`.sitenav`), hero, kaarten (`.kaarten`/`.kaart`),
  responsieve tabellen (stapelen onder 640px via `data-label`), `.tip` en
  `.letop` blokken, genummerde `.stappen`. Pagina-eigen opmaak blijft inline
  in de betreffende `.html`.

## Conventies & aandachtspunten

- **Menubalk:** elke pagina heeft dezelfde `.sitenav` met vijf tabs; de
  huidige pagina krijgt `class="active"`. Nieuwe pagina? In álle menu's
  toevoegen. Op mobiel verdwijnt de merknaam (`.brand-text`).
- **Responsieve tabellen:** onder 640px stapelen rijen tot kaartjes; elke
  `<td>` behalve de eerste heeft daarvoor een `data-label`-attribuut nodig.
- **Toon:** praktisch en eerlijk (bijv. het draaibank-advies), en
  edelsteen-betekenissen worden gepresenteerd als traditie/folklore, niet als
  feit. Culturele context van de talking stick respectvol houden; geen
  heilige symbolen of arendsveren aanraden.
- **Veiligheid serieus nemen:** stof van gewei/bot/taxus, zelfontbranding van
  oliedoeken en de wettelijke kant (veren van beschermde vogels, sprokkelen,
  CITES) staan bewust op meerdere plekken — niet wegredigeren.
- Fonts via Google Fonts (Fraunces + Inter), net als de rest van de repo.
