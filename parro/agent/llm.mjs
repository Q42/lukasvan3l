// llm.mjs — één plek voor alle Claude-aanroepen, met twee backends:
//
//   1. "claude"  (standaard) — de Claude Code CLI headless (`claude -p`),
//      draait op je bestaande Claude-abonnement. Geen API key nodig.
//   2. "api"     — de Anthropic API via @anthropic-ai/sdk (aparte betaling).
//      Wordt automatisch gekozen als ANTHROPIC_API_KEY gezet is.
//
// Forceren kan met PARRO_LLM=claude of PARRO_LLM=api in .env.
// CLAUDE_BIN=/pad/naar/claude als de CLI niet op het (cron-)PATH staat.

import { spawnSync } from "node:child_process";
import "dotenv/config";

const backend =
  process.env.PARRO_LLM || (process.env.ANTHROPIC_API_KEY ? "api" : "claude");

let anthropic = null;
async function apiClient() {
  if (!anthropic) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropic = new Anthropic();
  }
  return anthropic;
}

function claudeCli(prompt) {
  const bin = process.env.CLAUDE_BIN || "claude";
  const res = spawnSync(bin, ["-p", "--output-format", "json", "--model", "opus"], {
    input: prompt,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error) throw new Error(`kan '${bin}' niet starten: ${res.error.message}`);
  if (res.status !== 0)
    throw new Error(`claude -p faalde (exit ${res.status}): ${(res.stderr || res.stdout || "").slice(0, 500)}`);
  const envelop = JSON.parse(res.stdout);
  if (envelop.is_error) throw new Error(`claude -p fout: ${String(envelop.result).slice(0, 500)}`);
  return envelop.result ?? "";
}

// Trek het JSON-object uit een tekstantwoord (evt. met codeblok eromheen).
function jsonUit(tekst) {
  const blok = tekst.match(/```(?:json)?\s*([\s\S]*?)```/);
  const kaal = (blok ? blok[1] : tekst).trim();
  const start = kaal.indexOf("{");
  const eind = kaal.lastIndexOf("}");
  if (start === -1 || eind === -1) throw new Error("geen JSON in modelantwoord");
  return JSON.parse(kaal.slice(start, eind + 1));
}

// Gestructureerde vraag: geeft een object terug dat aan `schema` voldoet.
export async function vraagJson({ system, prompt, schema, maxTokens = 4096 }) {
  if (backend === "api") {
    const client = await apiClient();
    const r = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: maxTokens,
      system,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    });
    if (r.stop_reason === "refusal") throw new Error("geweigerd door model");
    return JSON.parse(r.content.find((b) => b.type === "text")?.text ?? "{}");
  }
  const tekst = claudeCli(
    `${system}\n\n` +
      `Antwoord met uitsluitend één JSON-object dat exact voldoet aan dit JSON-schema — ` +
      `geen uitleg, geen tekst eromheen:\n${JSON.stringify(schema)}\n\n${prompt}`,
  );
  return jsonUit(tekst);
}

// Vrije-tekstvraag (voor het weekoverzicht).
export async function vraagTekst({ system, prompt, maxTokens = 8000 }) {
  if (backend === "api") {
    const client = await apiClient();
    const r = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (r.stop_reason === "refusal") throw new Error("geweigerd door model");
    return r.content.find((b) => b.type === "text")?.text ?? "";
  }
  return claudeCli(`${system}\n\n${prompt}`);
}
