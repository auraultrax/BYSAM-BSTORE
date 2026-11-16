window.BERAY_PORTAL_CONFIG = {
  supabaseUrl: "https://zblbsjmtituericpmazj.supabase.co",
  // Public publishable key only. Never expose a service_role or secret key here.
  supabaseKey: "sb_publishable_0XUjb6u_goYIjSB6m7vYsQ_hpyI0Az7"
};
window.berayPortal = window.supabase.createClient(
 window.BERAY_PORTAL_CONFIG.supabaseUrl,window.BERAY_PORTAL_CONFIG.supabaseKey,
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);