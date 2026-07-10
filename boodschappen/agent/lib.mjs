// Gedeelde helpers voor de prijs-agent.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const HIER = dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = join(HIER, "state");
export const OUT_DIR = join(HIER, "output");

export function laadExport(pad) {
  // Verwacht het bestand dat de app exporteert (Data → Exporteer boodschappen).
  const bestand = pad || join(HIER, "boodschappen-export.json");
  if (!existsSync(bestand)) {
    throw new Error(`Geen exportbestand gevonden op ${bestand}. Exporteer eerst in de app (tab Data) en leg het hier neer, of geef het pad mee als argument.`);
  }
  return JSON.parse(readFileSync(bestand, "utf8"));
}

// Haal per product de zoekterm + evt. winkelspecifieke url/artikelnummer op.
export function producten(exp) {
  const bron = exp.catalogus || exp.lijst || [];
  return bron.map((p) => ({
    id: p.id || p.productId || p.product,
    naam: p.naam || p.product,
    shops: p.shops || {},
  }));
}

export function heeftSessie(shop) {
  return existsSync(join(STATE_DIR, `${shop}.json`));
}

export function schrijfPrijzen(regels) {
  mkdirSync(OUT_DIR, { recursive: true });
  const uit = { opgehaald: new Date().toISOString(), prijzen: regels };
  const pad = join(OUT_DIR, "prijzen.json");
  writeFileSync(pad, JSON.stringify(uit, null, 2));
  return pad;
}

// Pak het eerste getal dat op een euro-prijs lijkt uit een stuk tekst.
export function parsePrijs(tekst) {
  if (tekst == null) return null;
  const m = String(tekst).replace(/\s/g, "").match(/(\d+)[.,](\d{2})/);
  if (m) return Number(`${m[1]}.${m[2]}`);
  const heel = String(tekst).match(/(\d+)/);
  return heel ? Number(heel[1]) : null;
}

// Haal verpakkingsgrootte uit een titel/omschrijving en normaliseer naar
// { hoeveelheid, eenheid } met eenheid 'g' | 'ml' | 'stuk'. Herkent o.a.
// "500 g", "1,5 kg", "1 l", "750ml", "6 stuks", "6 x 500 g" (→ 3000 g).
// Geeft {hoeveelheid:null, eenheid:null} als er niks te herkennen valt.
export function parseHoeveelheid(tekst) {
  if (!tekst) return { hoeveelheid: null, eenheid: null };
  const t = String(tekst).toLowerCase().replace(",", ".");

  // multipack: "6 x 500 g" of "6x500g"
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/);
  if (multi) {
    const n = Number(multi[1]);
    const per = normEenheid(Number(multi[2]), multi[3]);
    if (per) return { hoeveelheid: Math.round(n * per.hoeveelheid), eenheid: per.eenheid };
  }
  // gewicht/volume: "500 g", "1.5 kg", "750ml", "1 l", "50 cl"
  const gv = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/);
  if (gv) { const n = normEenheid(Number(gv[1]), gv[2]); if (n) return n; }
  // stuks: "6 stuks", "10 st", "per stuk", "4-pack"
  const st = t.match(/(\d+)\s*(?:stuks?|st\b|x\b|-?pack|stk)/) || (/(per stuk|per sts)/.test(t) ? [null, "1"] : null);
  if (st) return { hoeveelheid: Number(st[1]), eenheid: "stuk" };

  return { hoeveelheid: null, eenheid: null };
}

function normEenheid(waarde, eenheid) {
  switch (eenheid) {
    case "kg": return { hoeveelheid: Math.round(waarde * 1000), eenheid: "g" };
    case "g":  return { hoeveelheid: waarde, eenheid: "g" };
    case "l":  return { hoeveelheid: Math.round(waarde * 1000), eenheid: "ml" };
    case "cl": return { hoeveelheid: Math.round(waarde * 10), eenheid: "ml" };
    case "ml": return { hoeveelheid: waarde, eenheid: "ml" };
    default:   return null;
  }
}
