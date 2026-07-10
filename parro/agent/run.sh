#!/usr/bin/env bash
# Volledige sync-run: Parro API → lokale SQLite → Supabase → Claude-verrijking.
# Bedoeld voor cron (zie agent/README.md).
set -euo pipefail
cd "$(dirname "$0")"

parro check          # gwillem/parro: haal nieuwe Parro-items op (+ bijlagen)
node sync.mjs        # SQLite → Supabase (parro_items)
node fotos.mjs       # bijlagen uit de cache → Supabase Storage (parro_fotos)
node enrich.mjs      # Claude: agenda + acties + belangrijk-vlaggen
