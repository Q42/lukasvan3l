# podcasts

Een lijstje aanbevolen **luisterverhalen** (scripted fictie + afgeronde true
crime series), met daaronder een lijst van wat Lukas al geluisterd heeft en wat
hij ervan vond. Bedoeld voor lange autoritten.

Eén statische `index.html`, geen build, geen dependencies.

## Hoe het werkt

- Alle series staan in de `SHOWS`-array bovenaan het script. `id` is het
  **Apple Podcasts `collectionId`** en doet twee dingen: artwork ophalen en de
  Pocket Casts deeplink vormen.
- **Pocket Casts deeplink:** `https://pca.st/itunes/<collectionId>`. Op mobiel
  vangt de Pocket Casts app deze universal link op; op desktop redirect hij naar
  de webspeler (`pocketcasts.com/podcast/<slug>`). Dit is de enige linkvorm die
  hier gebruikt wordt — geen `pktc://`, want dat werkt niet als webfallback.
- **Artwork** staat in de `ART`-map en linkt rechtstreeks naar de Apple-CDN
  (`is1-ssl.mzstatic.com/.../300x300bb.jpg`). Niet lokaal opgeslagen.
- **State** (sterren + geluisterd-vlag) zit in `localStorage` onder
  `podcasts-3l-v1`. De defaults in `SHOWS` (`done`, `rating`) gelden zolang er
  niks is opgeslagen; opgeslagen waarden overschrijven ze per id.
- De uur-schatting onder "Aanraders" is ruw: `aantal afleveringen × 0,75 uur`.

## Een serie toevoegen

Zoek het `collectionId` op via de iTunes Search API, bijvoorbeeld:

```
https://itunes.apple.com/search?term=<naam>&entity=podcast&country=NL&limit=5
```

Voeg daarna een object toe aan `SHOWS` (`cat` is `nl`, `en` of `tc`) en de
`artworkUrl600`-URL aan `ART` (vervang `600x600` door `300x300`).

## Notities

- Verifieer altijd dat een `pca.st/itunes/<id>` link een 302 naar een
  `pocketcasts.com/podcast/...` slug geeft; zo niet, dan staat de show niet in
  de Pocket Casts index.
- Audible-exclusives (bijv. *The Sacrifice*) hebben geen publieke RSS en staan
  dus niet in Apple Podcasts of Pocket Casts. Die horen niet in deze lijst.
