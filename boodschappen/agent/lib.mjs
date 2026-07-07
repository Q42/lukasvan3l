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
