// enrich.mjs — laat Claude nieuwe Parro-items interpreteren: agenda-items met
// acties (meenemen/voorbereiden), kind-van-de-week-detectie en een
// belangrijkheidsvlag. Resultaat gaat naar parro_agenda / parro_acties en
// vlaggen op parro_items.
//
//   node enrich.mjs          # verwerkt max 25 onverwerkte items per run
//
// Auth: ANTHROPIC_API_KEY in .env, of een `ant auth login`-profiel.

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import { getOnverwerkteItems, saveVerrijking } from "./db.mjs";

const anthropic = new Anthropic();

const KINDEREN = process.env.PARRO_KINDEREN || "Floris, Yune";
// Vrije context die het model helpt kinderen aan groepen te koppelen, bv:
// PARRO_CONTEXT="Floris zit in groep De Vlinders (groep 3), Yune in De Rupsjes (groep 1)."
const CONTEXT = process.env.PARRO_CONTEXT || "";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["belangrijk", "actie_nodig", "agenda_items"],
  properties: {
    belangrijk: {
      type: "boolean",
      description: "Moeten de ouders dit echt gezien hebben (los van de agenda)?",
    },
    actie_nodig: {
      type: "boolean",
      description: "Vraagt dit bericht om een handeling van de ouders?",
    },
    agenda_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["datum", "eind_datum", "titel", "omschrijving", "kind", "kind_van_de_week", "acties"],
        properties: {
          datum: { type: "string", description: "YYYY-MM-DD" },
          eind_datum: { anyOf: [{ type: "string" }, { type: "null" }], description: "YYYY-MM-DD, alleen bij meerdaags" },
          titel: { type: "string" },
          omschrijving: { anyOf: [{ type: "string" }, { type: "null" }] },
          kind: { anyOf: [{ type: "string" }, { type: "null" }], description: "Naam van het kind waar dit over gaat, of null als het beide/onduidelijk is" },
          kind_van_de_week: { type: "boolean", description: "Is een van onze kinderen die week 'kind van de week' (of ster/held van de week e.d.)?" },
          acties: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["tekst", "uiterlijk"],
              properties: {
                tekst: { type: "string", description: "Concrete actie voor de ouders, bv 'gymkleren meegeven'" },
                uiterlijk: { anyOf: [{ type: "string" }, { type: "null" }], description: "YYYY-MM-DD deadline, indien genoemd" },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `Je analyseert berichten uit Parro (de schoolcommunicatie-app) voor de ouders van ${KINDEREN}. ${CONTEXT}

Haal uit elk bericht de concrete agenda-informatie voor de ouders:
- Alleen échte gebeurtenissen met een datum worden agenda-items (uitjes, vrije dagen, ouderavonden, kind van de week, gymdagen als ze specifiek genoemd worden). Algemene mededelingen zonder datum niet.
- Acties zijn dingen die de ouders moeten dóén: iets meenemen, voorbereiden, inschrijven, betalen, ophalen op afwijkende tijd. Geen acties verzinnen die er niet staan.
- "Kind van de week" (ook wel ster/held van de week): maak daar een agenda-item van op de maandag van die week, met kind_van_de_week=true en de naam van het kind.
- Bepaal per item over welk kind het gaat op basis van de groepsnaam of namen in de tekst; onduidelijk of allebei → kind=null.
- belangrijk=true alleen voor dingen die ouders echt niet mogen missen (roosterwijzigingen, ziekmeldingen op school, betalingen, deadlines). Chatberichten zijn zelden belangrijk.
- Datums zijn ISO (YYYY-MM-DD). Gebruik de datum van het bericht om relatieve aanduidingen ("volgende week vrijdag") op te lossen.`;

async function verrijk(item) {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `Vandaag is ${new Date().toISOString().slice(0, 10)}. Analyseer dit Parro-bericht:\n\n` +
          JSON.stringify(
            {
              soort: item.soort,
              datum: item.datum,
              groep: item.groep,
              afzender: item.afzender,
              titel: item.titel,
              tekst: (item.tekst || "").slice(0, 6000),
            },
            null,
            2,
          ),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.warn(`[enrich] ${item.id}: geweigerd door model, sla over`);
    return { belangrijk: false, actie_nodig: false, agenda_items: [] };
  }
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

const items = await getOnverwerkteItems(25);
if (!items.length) {
  console.log("[enrich] niets te verwerken");
  process.exit(0);
}

for (const item of items) {
  try {
    const resultaat = await verrijk(item);
    await saveVerrijking(item.id, resultaat);
    console.log(
      `[enrich] ${item.id}: ${resultaat.agenda_items.length} agenda-item(s)` +
        (resultaat.belangrijk ? ", belangrijk" : ""),
    );
  } catch (err) {
    // niet als verwerkt markeren → volgende run opnieuw
    console.error(`[enrich] ${item.id} mislukt: ${err.message}`);
  }
}
