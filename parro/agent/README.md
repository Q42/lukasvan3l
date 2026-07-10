# Parro-agent

Draait op **jouw eigen machine** (niet op GitHub Pages) en houdt Supabase bij:

```
Parro API ──(gwillem/parro)──▶ ~/.local/share/parro/*.db (SQLite)
                                        │ sync.mjs
                                        ▼
                                    Supabase (parro_items)
                                        │ enrich.mjs (Claude API)
                                        ▼
                    parro_agenda + parro_acties + vlaggen op parro_items
                                        │ week.mjs (wekelijks, Claude API)
                                        ▼
                                 parro_weekoverzicht
```

Het ophalen zelf doet [`gwillem/parro`](https://github.com/gwillem/parro):
een Go-CLI die met dezelfde OAuth2+PKCE-flow als de app inlogt en
mededelingen, agenda-items en chats incrementeel naar SQLite synct.
Let op: dat is een **onofficiële, reverse-engineered API** — kan breken als
Topicus iets wijzigt.

> **Al een Parro-CLI geïnstalleerd?** Check welke: `sync.mjs` leest de
> SQLite-database van **gwillem/parro** (`~/.local/share/parro/*.db`, heeft
> een `parro check`-commando). Heb je de Python-variant
> [anneschuth/parro-cli](https://github.com/anneschuth/parro-cli) (commando's
> als `parro announcements`), dan moet `sync.mjs` in plaats daarvan de
> JSON-uitvoer daarvan inlezen — kleine aanpassing, vraag Claude ernaar.

## Eenmalige setup

```bash
# 1. gwillem/parro installeren en inloggen (overslaan als je hem al hebt)
go install github.com/gwillem/parro/cmd/parro@latest   # of download een release
parro login          # Parro/ParnasSys-account, tokens komen in ~/.config/parro/
parro check          # eerste sync → ~/.local/share/parro/<guardian>.db

# 2. deze agent
cd parro/agent
npm install
cp .env.voorbeeld .env    # zie hieronder; .env staat in .gitignore
```

Vereist **Node ≥ 23.4** (voor `node:sqlite`); Node 24 LTS aanbevolen.

### `.env`

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>        # GEHEIM — nooit in git
PARRO_KINDEREN=Floris, Yune
PARRO_CONTEXT=Floris zit in groep <naam>, Yune in groep <naam>.
# PARRO_DB=/pad/naar/parro.db                  # alleen als autodetectie faalt
```

`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`: zelfde project en key als de
boodschappen-agent (Project Settings → API → service_role).

### Claude: abonnement of API key

De verrijking (`enrich.mjs`, `week.mjs`) heeft Claude nodig. Twee smaken,
gekozen in `llm.mjs`:

- **Standaard: je Claude-abonnement**, via de Claude Code CLI headless
  (`claude -p`). Geen API key, geen extra kosten — het telt mee in je normale
  abonnementslimieten (een paar schoolberichten per dag is verwaarloosbaar).
  Vereist dat `claude` geïnstalleerd en ingelogd is op deze machine. Voor
  cron: zet `CLAUDE_BIN=$(which claude)` in `.env`, want cron heeft een kaal
  PATH.
- **Optioneel: de Anthropic API** — zet `ANTHROPIC_API_KEY` in `.env` (of
  forceer met `PARRO_LLM=api`). Betaald per gebruik, maar met strikte
  structured output (iets robuuster geparsete JSON).

## Draaien

```bash
./run.sh          # parro check → sync.mjs → enrich.mjs
node week.mjs     # weeksamenvatting van de lopende week
```

## Cron

```cron
# elk uur tussen 7 en 21 uur: ophalen + verrijken
0 7-21 * * *  cd $HOME/…/parro/agent && ./run.sh >> agent.log 2>&1

# zondagavond: weeksamenvatting
0 19 * * 0    cd $HOME/…/parro/agent && node week.mjs >> agent.log 2>&1
```

De cron houdt meteen het gratis Supabase-project wakker (dat pauzeert na 7
dagen zonder activiteit). Tip: laat cron bij falen iets van zich horen
(`|| curl -d "parro-agent stuk" ntfy.sh/<topic>`) — de onofficiële API kan
stilletjes breken.

## Onderdelen

| Script | Doet |
|---|---|
| `sync.mjs` | Leest `events` + `chat_messages` uit de gwillem/parro-SQLite en upsert ze als ruwe `parro_items` (bestaande rijen blijven onaangeroerd). |
| `enrich.mjs` | Stuurt onverwerkte items naar Claude (structured output): agenda-items met datum/kind/acties, kind-van-de-week, belangrijk-vlag. Mislukte items blijven onverwerkt en gaan de volgende run opnieuw. |
| `week.mjs` | Vat één week Parro-verkeer samen in markdown → `parro_weekoverzicht`. Draai met een datum-argument om een oude week (opnieuw) te genereren. |

Opnieuw verrijken na een promptwijziging: zet in Supabase `verwerkt=false`
op de betreffende `parro_items` en draai `node enrich.mjs`.
