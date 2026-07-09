// week.mjs — genereert een Nederlandse weeksamenvatting van alles wat er in
// Parro voorbijkwam en zet die in parro_weekoverzicht. Bedoeld voor een
// wekelijkse cron (bv. zondagavond), dan vat hij de lopende week samen.
//
//   node week.mjs                # de week van vandaag (maandag t/m zondag)
//   node week.mjs 2026-06-29     # expliciete week_start (een maandag)

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import { getItemsVanWeek, upsertWeekoverzicht } from "./db.mjs";

const anthropic = new Anthropic();
const KINDEREN = process.env.PARRO_KINDEREN || "Floris, Yune";

function maandagVan(d) {
  const dag = (d.getDay() + 6) % 7; // ma=0 ... zo=6
  const m = new Date(d);
  m.setDate(d.getDate() - dag);
  return m.toISOString().slice(0, 10);
}

const weekStart = process.argv[2] || maandagVan(new Date());
const items = await getItemsVanWeek(weekStart);

if (!items.length) {
  console.log(`[week] geen items in de week van ${weekStart}, geen samenvatting`);
  process.exit(0);
}

const invoer = items.map((i) => ({
  soort: i.soort,
  datum: i.datum,
  groep: i.groep,
  afzender: i.afzender,
  titel: i.titel,
  tekst: (i.tekst || "").slice(0, 1500),
}));

const response = await anthropic.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 8000,
  system:
    `Je schrijft voor de ouders van ${KINDEREN} een korte weeksamenvatting van de schoolcommunicatie uit Parro. ` +
    `Schrijf in het Nederlands, in markdown. Structuur: een alinea of wat bullets per kind/groep over wat er gebeurd is, ` +
    `daarna een kopje "Niet vergeten" met openstaande acties of aankondigingen voor de komende tijd (alleen als die er zijn). ` +
    `Wees concreet en beknopt; sla nietszeggende chatberichten over.`,
  messages: [
    {
      role: "user",
      content: `De week van maandag ${weekStart}. Dit kwam er voorbij in Parro:\n\n${JSON.stringify(invoer, null, 2)}`,
    },
  ],
});

if (response.stop_reason === "refusal") {
  console.error("[week] samenvatting geweigerd door model");
  process.exit(1);
}

const samenvatting = response.content.find((b) => b.type === "text")?.text ?? "";
await upsertWeekoverzicht(weekStart, samenvatting.trim());
console.log(`[week] samenvatting voor week van ${weekStart} opgeslagen (${items.length} items)`);
