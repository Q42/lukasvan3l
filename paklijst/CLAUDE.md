# paklijst

De **gezins-paklijst die meegroeit**: één pagina met hoofdstukken per soort
vakantie. Na elke vakantie wordt hij aangevuld met wat we geleerd hebben, zodat
de volgende keer inpakken begint waar de vorige reis ophield. In het Nederlands,
geen build step: alles zit in `index.html`.

## Hoe de pagina werkt

- **Hoofdstukken** zijn `<section class="hfd">`-blokken met een `id`,
  `data-naam` en `data-emoji`. Uit die attributen bouwt het script bovenaan de
  **chips** ("Wat voor vakantie wordt het?") waarmee je hoofdstukken aan- en
  uitzet; een uitgezet hoofdstuk verdwijnt van het scherm én van de print.
  De keuze staat in `localStorage` (`paklijst-hoofdstukken`).
- Het hoofdstuk **Basis** heeft `data-vast` en staat altijd aan.
- **Items** zijn `<li>`'s met een `label.item` (checkbox + `.box` + `.tekst`).
  Vinkjes worden per apparaat onthouden in `localStorage` (`paklijst-vinkjes`),
  gekeyd op hoofdstuk-id + de (genormaliseerde) itemtekst — pas je de tekst van
  een item aan, dan is dat vinkje dus weg; geen ramp.
- **Printbaar**: de `@media print`-stijlen strippen alle chrome, zetten de
  items in twee kolommen met lege hokjes en tonen de printdatum. "Vinkjes
  wissen" + printen = lege lijst voor op de keukentafel.

## Learnings toevoegen (de kern van deze one-off)

Na elke vakantie:

1. Kies (of maak) het juiste hoofdstuk en voeg het item als `<li>` toe.
2. Een learning uit een echte reis krijgt een bronlabel:
   `<span class="src">Naam reis</span>` (bijv. `Slovenië 2026`) achter de
   tekst. Algemene items (die niet uit een specifieke reis komen) krijgen
   geen label.
3. Formuleer het als **inpak-item**, niet als verhaal: vet het ding zelf
   (`<b>Onderwatercamera</b>`), met hoogstens één korte reden erachter.
4. Nieuw soort vakantie? Nieuw hoofdstuk-`<section>` met een uniek `id`,
   `data-naam` en `data-emoji`; de chip verschijnt vanzelf.

De eerste vulling komt uit **Slovenië 2026** (kamperen). De reis-specifieke
learnings-pagina van zo'n vakantie blijft in de eigen reis-directory staan;
hierheen verhuist alleen wat over *inpakken* gaat.

## Scope

Standalone one-off. Verwijs niet naar andere directories in deze repo (de link
terug naar `/` in de header is de enige uitzondering, net als op elke one-off).
