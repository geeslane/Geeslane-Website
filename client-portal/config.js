/*
 * Geeslane portal configuration.
 * Supabase URL and publishable key are loaded from .env in this folder.
 * Never paste a service-role key, Resend API key, SMTP password, or other secret
 * into this file, HTML, or Git. Custom SMTP is configured only in the Supabase dashboard.
 */
window.GEESLANE_CONFIG = {
  supabaseUrl: "",
  supabasePublishableKey: "",
  portalUrl: "https://geeslane.com/client-portal/",
  supportEmail: "contact@geeslane.com",
  adminUsername: "",
  adminPassword: "",
  adminEmail: "",
  web3formsAccessKey: "2a0e630b-0865-4b85-b0da-4824d6f264f2",
  storageMode: "supabase"
};

window.GEESLANE_ENV_READY = (async function loadLocalEnv() {
  function parseDotEnv(text) {
    const values = {};
    String(text || "").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const divider = trimmed.indexOf("=");
      if (divider < 1) return;
      const key = trimmed.slice(0, divider).trim();
      let value = trimmed.slice(divider + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    });
    return values;
  }

  function applyEnv(env) {
    if (env.SUPABASE_URL) window.GEESLANE_CONFIG.supabaseUrl = String(env.SUPABASE_URL).trim();
    if (env.SUPABASE_PUBLISHABLE_KEY) window.GEESLANE_CONFIG.supabasePublishableKey = String(env.SUPABASE_PUBLISHABLE_KEY).trim();
    if (env.SUPPORT_EMAIL) window.GEESLANE_CONFIG.supportEmail = String(env.SUPPORT_EMAIL).trim();
    if (env.ADMIN_USERNAME) window.GEESLANE_CONFIG.adminUsername = String(env.ADMIN_USERNAME).trim();
    if (env.ADMIN_PASSWORD) window.GEESLANE_CONFIG.adminPassword = String(env.ADMIN_PASSWORD);
    if (env.ADMIN_EMAIL) window.GEESLANE_CONFIG.adminEmail = String(env.ADMIN_EMAIL).trim();
  }

  const candidates = [];
  if (document.currentScript?.src) candidates.push(new URL(".env", document.currentScript.src).href);
  candidates.push(new URL("./.env", location.href).href);

  for (const envUrl of [...new Set(candidates)]) {
    try {
      const response = await fetch(envUrl, { cache: "no-store" });
      if (!response.ok) continue;
      applyEnv(parseDotEnv(await response.text()));
      if (window.GEESLANE_CONFIG.supabaseUrl && window.GEESLANE_CONFIG.supabasePublishableKey) return;
    } catch (_) {
      // Try the next location. Opening the portal as a file:// page cannot read .env.
    }
  }
})();
