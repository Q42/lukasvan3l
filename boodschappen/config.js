// Publieke Supabase-config voor de boodschappen-app.
// Deze twee waarden MOGEN publiek in de repo — de beveiliging zit in Supabase
// Auth + Row-Level Security, niet in het verbergen van de anon key.
// Vul ze in vanuit: Supabase → Project Settings → API.
// (De GEHEIME service_role key hoort NIET hier maar in agent/.env.)
window.BOODSCHAPPEN_CONFIG = {
  supabaseUrl: "",       // bv https://abcdefgh.supabase.co
  supabaseAnonKey: "",   // de "anon public" key
};
