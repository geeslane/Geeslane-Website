/**
 * ROLLBACK ARCHIVE ONLY — not used by the live Geeslane Client Portal.
 * Live authentication is Supabase Auth with Resend SMTP configured in the
 * Supabase dashboard. Do not paste credentials into the static website.
 *
 * Historical note: this was pasted into an Apps Script project, then the web app
 * was redeployed.
 *
 * Script properties (optional):
 *   NOTIFY_EMAIL = contact@geeslane.com
 *
 * In doPost, after you parse action and payload, add:
 *
 *   if (action === "notifyTeam" || payload.notifyEmail) {
 *     sendPortalUpdateEmail_(payload, user);
 *   }
 *
 * user can be the signed-in client object, or null.
 */
function notifyEmail_() {
  const props = PropertiesService.getScriptProperties();
  return String(props.getProperty("NOTIFY_EMAIL") || props.getProperty("ADMIN_EMAIL") || "contact@geeslane.com").trim();
}

function sendPortalUpdateEmail_(payload, user) {
  const subject = String(payload.notifySubject || payload.subject || "Portal: client update").trim();
  const message = String(payload.notifyMessage || payload.message || "A client saved new details in the portal.").trim();
  const clientName = payload.clientName || (user && user.name) || "A client";
  const business = payload.business || (user && user.business) || "";
  const clientEmail = payload.clientEmail || (user && user.email) || "";
  const projectName = payload.projectName || payload.projectId || "";
  const kind = payload.notifyKind || payload.kind || "update";
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14241c">
      <p><strong>${escapeHtml_(clientName)}</strong> saved a ${escapeHtml_(kind)} update in the client portal.</p>
      <p>
        Business: ${escapeHtml_(business || "—")}<br>
        Email: ${escapeHtml_(clientEmail || "—")}<br>
        Project: ${escapeHtml_(projectName || "—")}
      </p>
      <pre style="white-space:pre-wrap;background:#f4f7f5;padding:16px;border-radius:8px">${escapeHtml_(message)}</pre>
    </div>
  `;
  MailApp.sendEmail({
    to: notifyEmail_(),
    replyTo: clientEmail || notifyEmail_(),
    subject: subject,
    body: message,
    htmlBody: html,
    name: "Geeslane Client Portal"
  });
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
