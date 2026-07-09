# Supabase-setup (eenmalig)

Deze stappen moet **jij** één keer doen met je eigen Google/Supabase-account.
Daarna werkt de app op elk device en vult de agent de prijzen.

## 1. Project aanmaken

1. Ga naar <https://supabase.com> → **New project**. Kies een naam (bv
   `boodschappen`) en een sterk database-wachtwoord. Regio: EU (Frankfurt).
2. Wacht tot het project klaar is (~2 min).

## 2. Schema + beveiliging installeren

1. Open in het project **SQL Editor** → **New query**.
2. Plak de volledige inhoud van [`schema.sql`](./schema.sql) en **Run**.
   Krijg je later `permission denied for table products` in de agent, draai dan
   [`fix-grants.sql`](./fix-grants.sql) in de SQL Editor (eenmalig).
3. Vul je allowlist. Onderaan `schema.sql` staat een `insert into allowed_emails`
   — haal het commentaar weg, zet er jullie **Google**-e-mailadressen in en run
   dat stukje (of gebruik **Table editor → allowed_emails → Insert**).

## 3. Google-login aanzetten

1. **Authentication → Providers → Google** → enable.
2. Je hebt een Google OAuth-client nodig (Google Cloud Console →
   *APIs & Services → Credentials → OAuth client ID → Web application*):
   - **Authorized redirect URI**: de waarde die Supabase toont op het Google-
     providerscherm (`https://<project>.supabase.co/auth/v1/callback`).
   - Plak de **Client ID** en **Client secret** terug in Supabase.
3. **Authentication → URL Configuration → Redirect URLs**: voeg toe waar de app
   draait:
   - `https://q42.github.io/lukasvan3l/boodschappen/` (productie)
   - `http://localhost:*` en `http://127.0.0.1:*` (lokaal testen)

## 4. App koppelen (publieke sleutels)

1. **Project Settings → API**: kopieer de **Project URL** en de **anon public**
   key.
2. Zet ze in [`../config.js`](../config.js). Deze twee mógen publiek in de repo —
   de beveiliging zit in Auth + RLS, niet in het verbergen van de anon key.

## 5. Agent koppelen (geheime sleutel)

1. **Project Settings → API**: kopieer de **service_role** key. **Deze is
   geheim** — nooit in git, alleen in `agent/.env`.
2. Zet in `agent/.env`:
   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_KEY=<service_role key>
   ```
3. De agent (`node fetch-prices.mjs`) leest voortaan de producten uit de
   database en schrijft de prijzen terug — geen `prijzen.json` meer nodig.

## Testen dat de allowlist werkt

Log in met een **niet**-toegelaten Google-account (of vraag iemand). Die hoort
"geen toegang" te zien en **geen** producten/prijzen. Zie je toch data, dan klopt
er iets in de RLS-policies — meld het, dan kijk ik mee.

## Weetje: het gratis project "pauzeert"

Gratis Supabase-projecten pauzeren na 7 dagen zonder database-activiteit. Omdat
de prijs-cron dagelijks schrijft, blijft het project vanzelf wakker. Draait de
cron een tijd niet (vakantie), dan unpauze je het met één klik in het dashboard.
