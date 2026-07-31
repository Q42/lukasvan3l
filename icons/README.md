# icons

App-iconen voor de PWA op <https://apps.3l.nl/>. De PNG's zijn gegenereerd uit
de SVG's in deze map en checked-in, zodat er geen buildstap nodig is.

- `icon.svg` → `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180)
- `icon-maskable.svg` → `maskable-512.png` (full-bleed, inhoud binnen de veilige
  zone zodat Android er elke vorm uit kan snijden)

Opnieuw genereren na een wijziging in de SVG's (vereist `rsvg-convert`,
`brew install librsvg`):

```bash
cd icons
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
rsvg-convert -w 180 -h 180 icon.svg -o apple-touch-icon.png
rsvg-convert -w 512 -h 512 icon-maskable.svg -o maskable-512.png
```

Het beeldmerk is de tegel-layout van de landingspagina: vier afgeronde vlakken
in de kleuren van de app-tegels op een donkere achtergrond.
