(function () {
  "use strict";

  const LOGO_URL = "https://geeslane.com/images/logo.png";
  const TEAM_NAME = "Geeslane";
  const TITLE_KEYS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "Engr", "Chief", "Pastor", "Barr"];
  const TITLED_WITH_DOT = new Set(["Mr", "Mrs", "Ms", "Dr", "Prof", "Engr", "Barr"]);

  function config() { return window.GEESLANE_CONFIG || {}; }
  function supportEmail() { return config().supportEmail || "contact@geeslane.com"; }
  function capWord(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function formatTitle(key) {
    const title = TITLE_KEYS.find((item) => item.toLowerCase() === String(key || "").replace(/\.$/, "").toLowerCase());
    if (!title) return "";
    return TITLED_WITH_DOT.has(title) ? `${title}.` : title;
  }
  function parsePersonName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const title = formatTitle(parts[0]);
    const rest = title ? parts.slice(1) : parts;
    const given = capWord(rest[0] || "");
    const family = rest.slice(1).join(" ");
    const familyCap = family ? family.split(/\s+/).map((part) => /^[A-Z.]+$/.test(part) ? part : capWord(part)).join(" ") : "";
    const bareName = [given, familyCap].filter(Boolean).join(" ");
    const respectful = title && given ? `${title} ${given}` : given;
    return { title, titleKey: title.replace(/\.$/, ""), given, family: familyCap, bareName, respectful };
  }
  function composePersonName(title, name) {
    const bare = parsePersonName(name).bareName || String(name || "").trim();
    const label = formatTitle(title);
    return [label, bare].filter(Boolean).join(" ");
  }
  function givenName(name) {
    const given = parsePersonName(name).given;
    return !given || /^(a|there)$/i.test(given) ? "" : given;
  }
  function respectfulName(name) {
    const person = parsePersonName(name);
    return person.respectful || givenName(name);
  }
  function firstName(name) {
    return givenName(name);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function portalLink(page, fragment) {
    const base = String(config().portalUrl || "https://geeslane.com/client-portal/").replace(/\/?$/, "/");
    const url = page === "admin" ? `${base}admin.html` : base;
    if (!fragment) return url;
    const hash = String(fragment).startsWith("#") ? fragment : `#${fragment}`;
    return `${url}${hash}`;
  }

  function commentLink({ audience, projectId, milestoneId, noteId } = {}) {
    const params = new URLSearchParams();
    if (audience === "team" && projectId) params.set("project", projectId);
    if (milestoneId) params.set("milestone", milestoneId);
    if (noteId) params.set("note", noteId);
    const query = params.toString();
    if (audience === "team") return portalLink("admin", query ? `milestones?${query}` : "milestones");
    return portalLink("client", query ? `project?${query}` : "project");
  }

  function titleCase(value) {
    const small = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
    return String(value || "").trim().split(/\s+/).map((word, index, all) => {
      if (word === "&") return word;
      if (/^[A-Z0-9]{2,}(?:'[A-Z]+)?$/.test(word)) return word;
      const core = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, "");
      if (!core) return word;
      const lower = core.toLowerCase();
      const titled = (index === 0 || index === all.length - 1 || !small.has(lower))
        ? core.charAt(0).toUpperCase() + core.slice(1)
        : lower;
      return word.replace(core, titled);
    }).join(" ");
  }

  function rowsHtml(rows) {
    const filled = (rows || []).filter((row) => row && row[1]);
    if (!filled.length) return "";
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">${filled.map(([label, value]) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #edf2ef;font-size:12px;color:#697870;width:38%;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #edf2ef;font-size:14px;color:#17211c;">${escapeHtml(value)}</td>
      </tr>`).join("")}</table>`;
  }

  function buildHtml({ greeting, heading, intro, rows, ctaLabel, ctaUrl, signoff }) {
    const hello = greeting ? `<p style="margin:0 0 6px;font-size:14px;color:#0b6b45;font-weight:600;text-align:center;">${escapeHtml(greeting)}</p>` : "";
    const bye = `<p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#2a3931;text-align:center;">${escapeHtml(signoff || "Kind regards,")}<br><strong style="color:#063b29;">Geeslane</strong></p>`;
    const button = ctaLabel && ctaUrl ? `
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 0;">
        <tr>
          <td align="center" style="border-radius:999px;background:#0b6b45;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>` : "";
    return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#eef6f1;font-family:'DM Sans',Arial,sans-serif;color:#17211c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef6f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d7ebe0;border-radius:20px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:30px 36px 8px;">
                <img src="${LOGO_URL}" alt="Geeslane" width="132" style="display:block;margin:0 auto;border:0;height:auto;max-width:132px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 36px 36px;">
                ${hello}
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;letter-spacing:-.02em;color:#063b29;text-align:center;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#2a3931;text-align:center;">${escapeHtml(intro)}</p>
                ${rowsHtml(rows)}
                ${button}
                ${bye}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  function plainText({ greeting, heading, intro, rows, ctaUrl, signoff }) {
    const lines = [greeting, heading, intro, ""].filter(Boolean);
    (rows || []).filter((row) => row && row[1]).forEach(([label, value]) => lines.push(`${label}: ${value}`));
    if (ctaUrl) lines.push("", ctaUrl);
    lines.push("", signoff || "Kind regards,", "Geeslane");
    return lines.join("\n").trim();
  }

  async function notify(options) {
    const audience = options.audience || "team";
    const heading = titleCase(options.heading || options.subject || "A Note from Geeslane");
    const subject = titleCase(options.subject || options.heading || "A Note from Geeslane");
    const ctaLabel = titleCase(options.ctaLabel || (audience === "team" ? "Open Admin Portal" : "Open Your Portal"));
    const ctaUrl = options.ctaUrl || portalLink(options.ctaPage || (audience === "team" ? "admin" : "client"));
    const name = respectfulName(options.greetingName) || givenName(options.greetingName);
    const greeting = options.greeting || (audience === "team" ? "Hi team," : name ? `Hi ${name},` : "Hi there,");
    const payload = {
      greeting,
      heading,
      intro: options.intro,
      rows: options.rows || [],
      ctaLabel,
      ctaUrl,
      signoff: options.signoff
    };
    const mail = {
      audience,
      subject,
      heading,
      intro: options.intro || "",
      html: buildHtml(payload),
      text: plainText(payload),
      clientEmail: options.clientEmail || "",
      clientPhone: options.clientPhone || "",
      ctaUrl,
      replyTo: options.replyTo || supportEmail()
    };
    if (window.GeeslaneAPI?.sendPortalMail) {
      try {
        if (await window.GeeslaneAPI.sendPortalMail(mail)) return true;
      } catch (_) { /* fall back */ }
    }
    const accessKey = config().web3formsAccessKey;
    if (!accessKey) return false;
    const form = new FormData();
    form.append("access_key", accessKey);
    form.append("subject", mail.subject);
    form.append("from_name", TEAM_NAME);
    form.append("replyto", mail.replyTo);
    form.append("message", mail.text);
    form.append("botcheck", "");
    if ((audience === "client" || audience === "both") && mail.clientEmail && /@/.test(mail.clientEmail)) {
      form.append("ccemail", String(mail.clientEmail).trim());
    }
    return fetch("https://api.web3forms.com/submit", { method: "POST", body: form }).then(() => true).catch(() => false);
  }

  window.GeeslaneMail = Object.freeze({
    notify, portalLink, commentLink, titleCase, logoUrl: LOGO_URL, parsePersonName, composePersonName, respectfulName, givenName, formatTitle
  });
})();
