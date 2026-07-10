// fotos.mjs — haalt de foto's/video's uit Parro-berichten en zet ze in de
// private Supabase-bucket 'parro-fotos', met metadata in parro_fotos.
//
// De bestanden zelf staan al lokaal: gwillem/parro downloadt elke bijlage bij
// `parro check` naar ~/.cache/parro/<guardian>/<msgId>_<bestandsnaam>. Wij
// lezen de `attachments` uit de ruwe JSON die al in parro_items staat, zoeken
// het bijbehorende bestand in die cache en uploaden het naar Supabase Storage.
// (De directe Parro-URL's vereisen het OAuth-token van de CLI, dus we gaan via
// de cache — dan hoeft alleen gwillem/parro de onofficiële API te kennen.)
//
//   node fotos.mjs
//   PARRO_CACHE=/pad/naar/cache node fotos.mjs   # als autodetectie faalt
//
// Draai na `parro check` + `node sync.mjs` (zie run.sh).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, extname } from "node:path";
import "dotenv/config";
import {
  getItemsMetRaw,
  bestaandeFotoIds,
  uploadFoto,
  insertFoto,
} from "./db.mjs";

const cacheRoot =
  process.env.PARRO_CACHE || join(homedir(), ".cache", "parro");

// content-type raden uit de extensie als Parro er geen meegeeft.
const TYPE_PER_EXT = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v",
};

// De bijlagen uit een ruw item halen. Mededelingen hebben `attachments` (array),
// chatberichten `attachment` (enkel). We pakken de SOURCE-entry (volle resolutie).
function bijlagenVan(item) {
  const raw = item.raw || {};
  const lijst = Array.isArray(raw.attachments)
    ? raw.attachments
    : raw.attachment
      ? [raw.attachment]
      : [];
  const uit = [];
  lijst.forEach((att, index) => {
    const entries = Array.isArray(att?.entries) ? att.entries : [];
    const src = entries.find((e) => e.type === "SOURCE") || entries[0];
    if (!src?.url) return;
    uit.push({
      index,
      soort: att.attachmentType || null, // IMAGE / VIDEO
      bestandsnaam: src.filename || basenaamUitUrl(src.url),
      contentType: src.contentType || null,
    });
  });
  return uit;
}

function basenaamUitUrl(url) {
  try {
    const p = new URL(url).pathname;
    const b = p.slice(p.lastIndexOf("/") + 1);
    return b || "bijlage";
  } catch {
    return "bijlage";
  }
}

// Alle guardian-mappen in de cache (~/.cache/parro/<guardian>/).
function guardianMappen() {
  try {
    return readdirSync(cacheRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(cacheRoot, d.name));
  } catch {
    return [];
  }
}

// Het lokale bestand voor bijlage `index` van bericht `msgId` vinden.
// gwillem/parro schrijft naar <msgId>_<bestandsnaam>; als de naam onbekend is
// pakken we het n-de bestand dat met "<msgId>_" begint.
function vindBestand(msgId, bestandsnaam, index) {
  const mappen = guardianMappen();
  if (bestandsnaam) {
    for (const dir of mappen) {
      const exact = join(dir, `${msgId}_${bestandsnaam}`);
      if (existsSync(exact)) return exact;
    }
  }
  const treffers = [];
  for (const dir of mappen) {
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.startsWith(`${msgId}_`)) treffers.push(join(dir, f));
    }
  }
  treffers.sort();
  return treffers[index] || treffers[0] || null;
}

// Pad in de storage-bucket, afgeleid van het item-id (":" mag daar niet in).
function opslagPad(itemId, index, bestandsnaam) {
  const map = itemId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const naam = (bestandsnaam || "bijlage").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${map}/${index}_${naam}`;
}

const items = await getItemsMetRaw();
const bekend = await bestaandeFotoIds();

let nieuw = 0;
let gemist = 0;

for (const item of items) {
  const msgId = item.id.split(":")[1];
  for (const bijlage of bijlagenVan(item)) {
    const fotoId = `${item.id}#${bijlage.index}`;
    if (bekend.has(fotoId)) continue;

    const bestand = vindBestand(msgId, bijlage.bestandsnaam, bijlage.index);
    if (!bestand) {
      gemist++;
      console.warn(
        `[fotos] ${fotoId}: geen lokaal bestand voor ${bijlage.bestandsnaam} — draai eerst 'parro check'`,
      );
      continue;
    }

    const pad = opslagPad(item.id, bijlage.index, bijlage.bestandsnaam);
    const contentType =
      bijlage.contentType || TYPE_PER_EXT[extname(bestand).toLowerCase()] || null;

    try {
      await uploadFoto(pad, readFileSync(bestand), contentType);
      await insertFoto({
        id: fotoId,
        item_id: item.id,
        pad,
        bestandsnaam: bijlage.bestandsnaam,
        content_type: contentType,
        soort: bijlage.soort,
        datum: item.datum,
      });
      bekend.add(fotoId);
      nieuw++;
      console.log(`[fotos] ${fotoId} → ${pad}`);
    } catch (err) {
      console.error(`[fotos] ${fotoId} mislukt: ${err.message}`);
    }
  }
}

console.log(
  `[fotos] klaar: ${nieuw} nieuw geüpload` +
    (gemist ? `, ${gemist} zonder lokaal bestand overgeslagen` : ""),
);
