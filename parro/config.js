// Publieke Supabase-config voor het Parro-dashboard.
// Deze waarden MOGEN publiek in de repo — de beveiliging zit in Supabase
// Auth + Row-Level Security, niet in het verbergen van de publishable key.
// (De GEHEIME service_role key hoort NIET hier maar in agent/.env.)
//
// Standaard hetzelfde gezinsproject als de boodschappen-app; vervang de
// waarden als je Parro in een eigen project zet.
window.PARRO_CONFIG = {
  supabaseUrl: "https://kmmhrcdxciyobckrqolc.supabase.co",
  supabaseAnonKey: "sb_publishable_dfckYGWjwSCyySPJO96xQg_q6RVP7nZ",  // publishable (publieke) key
};
