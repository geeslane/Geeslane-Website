/*
 * Geeslane portal configuration.
 * supabaseUrl and supabasePublishableKey are public client values. They must live
 * in this file so production can sign people in. A hosting dashboard .env is not
 * read by this static site.
 * Never paste a service-role key, Resend API key, SMTP password, SMS token, or
 * other secret here. Custom SMTP is configured only in the Supabase dashboard.
 * Local .env may override these values and supply the admin password shortcut.
 */
window.GEESLANE_CONFIG = {
  supabaseUrl: "https://xostzntvowmdjlwpsevq.supabase.co",
  supabasePublishableKey: "sb_publishable_JCpLT044d3ukzi958C9NZw_--qpPvXL",
  portalUrl: "https://geeslane.com/client-portal/",
  supportEmail: "contact@geeslane.com",
  adminUsername: "admin",
  adminPassword: "",
  adminEmail: "contact@geeslane.com",
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
      return;
    } catch (_) {
      // Production does not serve .env. Public keys above are enough for sign-in.
    }
  }
})();
