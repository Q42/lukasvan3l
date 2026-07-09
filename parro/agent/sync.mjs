// sync.mjs — leest de lokale SQLite van `gwillem/parro` (die de Parro API
// synct) en zet nieuwe items in Supabase. Draai eerst `parro check`.
//
//   node sync.mjs            # zoekt de db in ~/.local/share/parro/*.db
//   PARRO_DB=/pad/naar.db node sync.mjs
//
// Vereist Node ≥ 23.4 (node:sqlite zonder vlag); Node 24 LTS aanbevolen.

import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import "dotenv/config";
import { insertNieuweItems } from "./db.mjs";

function vindDb() {
  if (process.env.PARRO_DB) return process.env.PARRO_DB;
  const dir = join(homedir(), ".local", "share", "parro");
  const dbs = readdirSync(dir).filter((f) => f.endsWith(".db"));
  if (!dbs.length) throw new Error(`Geen .db gevonden in ${dir} — draai eerst 'parro login' + 'parro check'`);
  return join(dir, dbs[0]);
}

function soortVanDtype(dtype) {
  if (/calendar/i.test(dtype || "")) return "agenda";
  return "mededeling"; // announcements en onbekende types
}

const dbPad = vindDb();
const sqlite = new DatabaseSync(dbPad, { readOnly: true });

const items = [];

for (const r of sqlite.prepare(
  "select id, dtype, title, contents, sort_date, group_name, author_name, raw_json from events"
).all()) {
  items.push({
    id: `event:${r.id}`,
    soort: soortVanDtype(r.dtype),
    titel: r.title || null,
    tekst: r.contents || null,
    groep: r.group_name || null,
    afzender: r.author_name || null,
    datum: r.sort_date || null,
    raw: r.raw_json ? JSON.parse(r.raw_json) : null,
  });
}

for (const r of sqlite.prepare(
  "select id, chatroom_name, sender_name, contents, sent_at, raw_json from chat_messages"
).all()) {
  items.push({
    id: `chat:${r.id}`,
    soort: "chat",
    titel: r.chatroom_name || null,
    tekst: r.contents || null,
    groep: null,
    afzender: r.sender_name || null,
    datum: r.sent_at || null,
    raw: r.raw_json ? JSON.parse(r.raw_json) : null,
  });
}

sqlite.close();

const nieuw = await insertNieuweItems(items);
console.log(`[sync] ${dbPad}: ${items.length} items in SQLite, ${nieuw} nieuw naar Supabase`);
