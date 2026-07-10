# Supabase-setup (eenmalig)

Aanbevolen: gebruik **hetzelfde Supabase-project als de boodschappen-app** —
dan zijn Google-login, allowlist en service-role key al geregeld en hoef je
alleen stap 1 en 2 te doen.

## 1. Schema draaien

SQL Editor → New query → plak [`schema.sql`](./schema.sql) → **Run**.
Het allowlist/leden-deel is identiek aan dat van boodschappen en idempotent;
dubbel draaien kan geen kwaad.

## 2. Redirect-URL toevoegen

**Authentication → URL Configuration → Redirect URLs**:

- `https://q42.github.io/lukasvan3l/parro/`
- (`http://localhost:*` en `http://127.0.0.1:*` staan er als het goed is al)

## 3. Alleen bij een vers project

Volg dan eerst `boodschappen/supabase/README.md` stappen 1 en 3 (project
aanmaken, Google OAuth-provider instellen), vul de allowlist onderaan
`schema.sql`, en zet de Project URL + publishable key in `../config.js`.

## Allowlist

Jij en je vrouw loggen in met Google; alleen e-mailadressen in
`allowed_emails` worden lid en zien data. Toevoegen kan via Table editor →
`allowed_emails` → Insert. Staat je vrouw er nog niet in (voor boodschappen),
voeg haar Google-adres toe.

## Testen

Log in met een niet-toegelaten Google-account: die hoort "geen toegang" te
zien en geen agenda/berichten. Zie je toch data → RLS-probleem, meld het.
