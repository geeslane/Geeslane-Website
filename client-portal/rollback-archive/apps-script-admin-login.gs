/**
 * ROLLBACK ARCHIVE ONLY — not used by the live Geeslane Client Portal.
 * Live authentication is Supabase Auth with Resend SMTP configured in the
 * Supabase dashboard. Do not paste credentials into the static website.
 *
 * Historical note: this was pasted into an Apps Script project and wired in doGet.
 *
 * Script properties (Project Settings → Script properties):
 *   ADMIN_USERNAME
 *   ADMIN_PASSWORD
 *
 * In doGet, add:
 *   case "adminPasswordLogin":
 *     return jsonp_(handleAdminPasswordLogin(e.parameter.username, e.parameter.password), callback);
 */
function handleAdminPasswordLogin(username, password) {
  const props = PropertiesService.getScriptProperties();
  const expectedUser = String(props.getProperty("ADMIN_USERNAME") || "").trim();
  const expectedPass = String(props.getProperty("ADMIN_PASSWORD") || "");
  if (!expectedUser || !expectedPass) {
    throw new Error("Administrator credentials are not configured");
  }
  if (String(username || "").trim() !== expectedUser || String(password || "") !== expectedPass) {
    throw new Error("Invalid administrator details");
  }
  const admin = findAdminUser_();
  if (!admin) {
    throw new Error("No administrator account exists yet");
  }
  return createSessionForUser_(admin);
}
