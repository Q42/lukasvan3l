// Publieke Supabase-config voor de boodschappen-app.
// Deze twee waarden MOGEN publiek in de repo — de beveiliging zit in Supabase
// Auth + Row-Level Security, niet in het verbergen van de publishable key.
// (De GEHEIME service_role / secret key hoort NIET hier maar in agent/.env.)
window.BOODSCHAPPEN_CONFIG = {
  supabaseUrl: "https://kmmhrcdxciyobckrqolc.supabase.co",
  supabaseAnonKey: "sb_publishable_dfckYGWjwSCyySPJO96xQg_q6RVP7nZ",  // publishable (publieke) key
};
