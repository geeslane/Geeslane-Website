(function () {
  "use strict";

  const LOGO_URL = "https://geeslane.com/images/logo.png";
  const LOGO_WHITE_URL = "https://geeslane.com/images/logo-white.png";
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
  function portalName(name) {
    return parsePersonName(name).bareName || String(name || "").trim();
  }
  function firstName(name) {
    return givenName(name);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function portalLink(page, fragment, query) {
    const base = String(config().portalUrl || "https://geeslane.com/client-portal/").replace(/\/?$/, "/");
    const url = new URL(page === "admin" ? `${base}admin.html` : base);
    const params = query && typeof query === "object" ? query : {};
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, String(value));
    });
    if (fragment) url.hash = String(fragment).replace(/^#/, "");
    return url.href;
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

  function cellText(value) {
    return escapeHtml(value).replace(/\r\n|\n|\r/g, "<br>").replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);
  }

  function darkModeCss() {
    return `:root{color-scheme:light dark;}
@media (prefers-color-scheme:dark){
.email-bg{background:#102018!important;color:#e8f2ec!important;}
.email-card{background:#173028!important;border-color:#2c4a3e!important;}
.email-header{background:#063b29!important;}
.email-hello,.email-accent{color:#8ad4ad!important;}
.email-title{color:#d8f3e6!important;}
.email-copy{color:#d5e6dc!important;}
.email-muted{color:#9bb5a8!important;}
.email-brand{color:#c8ead8!important;}
.email-code{color:#e8f8ef!important;}
.email-btn{background:#1ea36a!important;}
.email-btn a{color:#ffffff!important;}
.email-logo-light{display:none!important;max-height:0!important;overflow:hidden!important;}
.email-logo-dark{display:block!important;max-height:none!important;overflow:visible!important;width:132px!important;height:auto!important;}
.email-row-label{color:#9bb5a8!important;border-color:#2c4a3e!important;}
.email-row-value{color:#e8f2ec!important;border-color:#2c4a3e!important;}
.email-block{background:#1b332a!important;border-color:#2c4a3e!important;}
.email-block-title{color:#d8f3e6!important;}
}
[data-ogsc] .email-bg{background:#102018!important;color:#e8f2ec!important;}
[data-ogsc] .email-card{background:#173028!important;border-color:#2c4a3e!important;}
[data-ogsc] .email-hello,[data-ogsc] .email-accent{color:#8ad4ad!important;}
[data-ogsc] .email-title{color:#d8f3e6!important;}
[data-ogsc] .email-copy{color:#d5e6dc!important;}
[data-ogsc] .email-muted{color:#9bb5a8!important;}
[data-ogsc] .email-brand{color:#c8ead8!important;}
[data-ogsc] .email-code{color:#e8f8ef!important;}
[data-ogsc] .email-btn{background:#1ea36a!important;}
[data-ogsc] .email-btn a{color:#ffffff!important;}
[data-ogsc] .email-logo-light{display:none!important;max-height:0!important;overflow:hidden!important;}
[data-ogsc] .email-logo-dark{display:block!important;max-height:none!important;overflow:visible!important;width:132px!important;height:auto!important;}
[data-ogsc] .email-row-label{color:#9bb5a8!important;border-color:#2c4a3e!important;}
[data-ogsc] .email-row-value{color:#e8f2ec!important;border-color:#2c4a3e!important;}
[data-ogsc] .email-block{background:#1b332a!important;border-color:#2c4a3e!important;}
[data-ogsc] .email-block-title{color:#d8f3e6!important;}`;
  }

  function introHtml(intro) {
    const parts = String(intro || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return "";
    return parts.map((part) => `<p class="email-copy" style="margin:0 0 10px;font-size:15px;line-height:1.45;color:#2a3931;text-align:left;">${cellText(part)}</p>`).join("");
  }

  function logoHtml() {
    return `<img class="email-logo email-logo-light" src="${LOGO_URL}" alt="Geeslane" width="132" style="display:block;margin:0 auto;border:0;height:auto;max-width:132px;background:#ffffff;padding:10px 14px;border-radius:12px;" />
<!--[if !mso]><!-->
<img class="email-logo email-logo-dark" src="${LOGO_WHITE_URL}" alt="" width="132" style="display:none;max-height:0;overflow:hidden;margin:0 auto;border:0;height:auto;max-width:132px;" />
<!--<![endif]-->`;
  }

  function rowsHtml(rows) {
    const filled = (rows || []).filter((row) => row && String(row[1] || "").trim());
    if (!filled.length) return "";
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 12px;">${filled.map(([label, value]) => `
      <tr>
        <td class="email-row-label" valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid #edf2ef;font-size:12px;color:#697870;width:34%;">${escapeHtml(label)}</td>
        <td class="email-row-value" valign="top" style="padding:8px 0;border-bottom:1px solid #edf2ef;font-size:14px;line-height:1.4;color:#17211c;">${cellText(value)}</td>
      </tr>`).join("")}</table>`;
  }

  function answersHtml(rows) {
    const filled = (rows || []).filter((row) => row && String(row[1] || "").trim());
    if (!filled.length) return "";
    return `<div style="margin:6px 0 14px;text-align:left;">${filled.map(([label, value]) => `
      <div class="email-block" style="margin:0 0 10px;padding:12px 14px;background:#f7fbf8;border:1px solid #d7ebe0;border-radius:12px;">
        <p class="email-muted" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a9690;">${escapeHtml(label)}</p>
        <p class="email-copy" style="margin:0;font-size:15px;line-height:1.5;color:#17211c;text-align:left;">${cellText(value)}</p>
      </div>`).join("")}</div>`;
  }

  function blocksHtml(blocks) {
    const items = (blocks || []).filter((block) => block && (block.title || block.body));
    if (!items.length) return "";
    return `<div style="margin:28px 0 8px;text-align:left;width:100%;">${items.map((block) => `
      <div class="email-block" style="margin:0 0 22px;padding:16px 16px 14px;background:#f7fbf8;border:1px solid #d7ebe0;border-radius:14px;">
        ${block.title ? `<p class="email-block-title" style="margin:0 0 10px;font-size:14px;font-weight:700;color:#063b29;">${escapeHtml(block.title)}</p>` : ""}
        <p class="email-copy" style="margin:0;font-size:14px;line-height:1.7;color:#2a3931;">${cellText(block.body)}</p>
      </div>`).join("")}</div>`;
  }

  function flyerLinkLabel(url) {
    const file = String(url || "").split("?")[0].split("/").pop() || "";
    if (/services/i.test(file)) return "Services flyer";
    if (/help/i.test(file)) return "Help flyer";
    return "Open flyer";
  }

  function resourceLinkText(label, url, multiple) {
    if (multiple) return flyerLinkLabel(url);
    if (/invite/i.test(label)) return url;
    if (/dashboard|partner page/i.test(label)) return "Open your partner page";
    if (/whatsapp/i.test(label)) return "Join the WhatsApp group";
    return "Open link";
  }

  function partnerResourcesHtml(rows) {
    const filled = (rows || []).filter((row) => row && String(row[1] || "").trim());
    if (!filled.length) return "";
    return filled.map(([label, value]) => {
      const urls = String(value).split(/\n/).map((item) => item.trim()).filter(Boolean);
      const links = urls.map((url) => {
        const href = escapeHtml(url);
        const text = escapeHtml(resourceLinkText(label, url, urls.length > 1));
        return `<a class="email-link" href="${href}" style="color:#0b6b45;text-decoration:underline;word-break:break-all;">${text}</a>`;
      }).join("<br>");
      return `<p style="margin:0 0 18px;">
        <span class="email-accent" style="display:block;margin:0 0 4px;font-size:13px;line-height:1.4;font-weight:700;color:#0b6b45;">${escapeHtml(label)}</span>
        <span style="font-size:15px;line-height:1.55;">${links}</span>
      </p>`;
    }).join("");
  }

  function partnerBullet(html) {
    return `<tr>
      <td valign="top" width="18" style="padding:0 0 12px;font-size:16px;line-height:1.6;color:#0b6b45;">•</td>
      <td class="email-copy" valign="top" style="padding:0 0 12px;font-size:15px;line-height:1.65;color:#2a3931;">${html}</td>
    </tr>`;
  }

  function buildPartnerWelcomeHtml({ greeting, heading, rows, ctaLabel, ctaUrl }) {
    const name = String(greeting || "Hi there,").replace(/,\s*$/, "");
    const hello = `<p class="email-hello" style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b6b45;font-weight:600;">${escapeHtml(name)}, 👋</p>`;
    const title = `<h1 class="email-title" style="margin:0 0 20px;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-.02em;color:#063b29;">${escapeHtml(heading || "🎉 Your November Partner Link Is Ready!")}</h1>`;
    const copy = "margin:0 0 16px;font-size:16px;line-height:1.65;color:#2a3931;";
    const whatsapp = ((rows || []).find((row) => /whatsapp/i.test(String(row?.[0] || ""))) || [])[1];
    const whatsappUrl = String(whatsapp || "").split(/\n/)[0].trim();
    const groupLink = whatsappUrl
      ? `<a class="email-link" href="${escapeHtml(whatsappUrl)}" style="color:#0b6b45;font-weight:700;text-decoration:underline;">WhatsApp group</a>`
      : "WhatsApp group";
    const button = ctaLabel && ctaUrl ? `
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 0;">
        <tr>
          <td class="email-btn" align="center" bgcolor="#0b6b45" style="border-radius:999px;background:#0b6b45;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:15px 32px;font-size:16px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>` : "";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style type="text/css">
      ${darkModeCss()}
      .email-link{color:#0b6b45;}
      @media (prefers-color-scheme:dark){.email-link{color:#8ad4ad!important;}}
      [data-ogsc] .email-link{color:#8ad4ad!important;}
    </style>
  </head>
  <body class="email-bg" style="margin:0;padding:0;background:#eef6f1;font-family:Arial,Helvetica,sans-serif;color:#17211c;">
    <table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef6f1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table class="email-card" role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:20px;">
            <tr>
              <td class="email-header" align="center" style="padding:28px 32px;background:#063b29;">
                ${logoHtml()}
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 40px;">
                ${hello}
                ${title}
                <p class="email-copy" style="${copy}">Welcome to the Geeslane November Partner Programme!</p>
                <p class="email-copy" style="${copy}">Your personal invite link is ready. Share it with friends, family, and businesses looking to get online.</p>
                <p class="email-copy" style="margin:0;font-size:16px;line-height:1.65;color:#2a3931;">Any new requests submitted through your link between <strong>1–30 November 2026</strong> will be attributed to you.</p>

                <table class="email-block" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0 0;background:#f4faf6;border-radius:16px;">
                  <tr>
                    <td style="padding:24px 22px 12px;">
                      <p class="email-title" style="margin:0 0 8px;font-size:18px;line-height:1.35;font-weight:700;color:#063b29;">How You Earn 💰</p>
                      <p class="email-copy" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2a3931;">Here's how your commission works:</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${partnerBullet("Earn <strong>20%</strong> when a referred client's initial 50% payment clears in November.")}
                        ${partnerBullet("Earn another <strong>20%</strong> when their final 50% payment clears. The balance can be paid after November.")}
                      </table>
                      <p class="email-copy" style="margin:6px 0 12px;font-size:15px;line-height:1.65;color:#2a3931;">A few things to note:</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        ${partnerBullet("Only Geeslane service fees qualify. Domains, hosting, and other third-party costs are excluded.")}
                        ${partnerBullet("Maximum commission per project: <strong>NGN 100,000</strong>.")}
                      </table>
                    </td>
                  </tr>
                </table>

                <p class="email-title" style="margin:32px 0 8px;font-size:18px;line-height:1.35;font-weight:700;color:#063b29;">When Do You Get Paid?</p>
                <p class="email-copy" style="${copy}">No long waits! Your commission is transferred to your registered Nigerian bank account within <strong>1–3 working days</strong> after the client's payment clears.</p>
                <p class="email-copy" style="margin:0;font-size:16px;line-height:1.65;color:#2a3931;">Your partner page will remain active after November, so you can keep track of your transfers.</p>

                <p class="email-title" style="margin:32px 0 16px;font-size:18px;line-height:1.35;font-weight:700;color:#063b29;">Your Partner Resources 🔗</p>
                ${partnerResourcesHtml(rows)}

                ${button}

                <p class="email-copy" style="margin:32px 0 16px;font-size:16px;line-height:1.65;color:#2a3931;">Need help or have questions? Join our ${groupLink} for updates, marketing materials, and tips.</p>
                <p class="email-copy" style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#2a3931;">We're excited to have you on board. Let's grow together! 💚</p>
                <p class="email-copy" style="margin:0;font-size:16px;line-height:1.65;color:#2a3931;">Kind regards,<br><strong class="email-brand" style="color:#063b29;">Team Geeslane</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  function partnerWelcomeText({ greeting, heading, rows, ctaLabel, ctaUrl }) {
    const name = String(greeting || "Hi there,").replace(/,\s*$/, "");
    const lines = [
      `${name}, 👋`,
      "",
      heading || "🎉 Your November Partner Link Is Ready!",
      "",
      "Welcome to the Geeslane November Partner Programme!",
      "",
      "Your personal invite link is ready. Share it with friends, family, and businesses looking to get online.",
      "",
      "Any new requests submitted through your link between 1–30 November 2026 will be attributed to you.",
      "",
      "How You Earn 💰",
      "",
      "Here's how your commission works:",
      "",
      "- Earn 20% when a referred client's initial 50% payment clears in November.",
      "- Earn another 20% when their final 50% payment clears. The balance can be paid after November.",
      "",
      "A few things to note:",
      "- Only Geeslane service fees qualify. Domains, hosting, and other third-party costs are excluded.",
      "- Maximum commission per project: NGN 100,000.",
      "",
      "When Do You Get Paid?",
      "",
      "No long waits! Your commission is transferred to your registered Nigerian bank account within 1–3 working days after the client's payment clears.",
      "",
      "Your partner page will remain active after November, so you can keep track of your transfers.",
      "",
      "Your Partner Resources 🔗"
    ];
    (rows || []).filter((row) => row && row[1]).forEach(([label, value]) => lines.push("", `${label}: ${String(value).replace(/\n/g, "\n")}`));
    if (ctaUrl) lines.push("", ctaLabel || "Open Your Partner Page", ctaUrl);
    lines.push(
      "",
      "Need help or have questions? Join our WhatsApp group for updates, marketing materials, and tips.",
      "",
      "We're excited to have you on board. Let's grow together! 💚",
      "",
      "Kind regards,",
      "Team Geeslane"
    );
    return lines.join("\n").trim();
  }

  function buildHtml({ greeting, heading, intro, rows, blocks, ctaLabel, ctaUrl, signoff, attachmentNote, rowStyle }) {
    const hello = greeting ? `<p class="email-hello" style="margin:0 0 8px;font-size:14px;color:#0b6b45;font-weight:600;text-align:left;">${escapeHtml(greeting)}</p>` : "";
    const note = attachmentNote ? `<p class="email-muted" style="margin:0 0 12px;font-size:14px;line-height:1.45;color:#697870;text-align:left;">${escapeHtml(attachmentNote)}</p>` : "";
    const lead = introHtml(intro);
    const bye = `<p class="email-copy" style="margin:14px 0 0;font-size:14px;line-height:1.45;color:#2a3931;text-align:left;">${escapeHtml(signoff || "Kind regards,")}<br><strong class="email-brand" style="color:#063b29;">Geeslane</strong></p>`;
    const button = ctaLabel && ctaUrl ? `
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:4px auto 8px;">
        <tr>
          <td class="email-btn" align="center" style="border-radius:999px;background:#0b6b45;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>` : "";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style type="text/css">${darkModeCss()}</style>
  </head>
  <body class="email-bg" style="margin:0;padding:0;background:#eef6f1;font-family:'DM Sans',Arial,sans-serif;color:#17211c;">
    <table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef6f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table class="email-card" role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d7ebe0;border-radius:20px;overflow:hidden;">
            <tr>
              <td class="email-header" align="center" style="padding:22px 36px 10px;background:#063b29;">
                ${logoHtml()}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px 22px;">
                ${hello}
                <h1 class="email-title" style="margin:0 0 10px;font-size:20px;line-height:1.3;letter-spacing:-.02em;color:#063b29;text-align:left;">${escapeHtml(heading)}</h1>
                ${lead}
                ${note}
                ${rowStyle === "cards" ? answersHtml(rows) : rowsHtml(rows)}
                ${button}
                ${blocksHtml(blocks)}
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

  function plainText({ greeting, heading, intro, rows, blocks, ctaUrl, signoff, attachmentNote }) {
    const lines = [greeting, heading, intro, attachmentNote, ""].filter(Boolean);
    (rows || []).filter((row) => row && row[1]).forEach(([label, value]) => lines.push(`${label}: ${value}`));
    (blocks || []).filter((block) => block && (block.title || block.body)).forEach((block) => {
      if (block.title) lines.push("", block.title);
      if (block.body) lines.push(block.body);
    });
    if (ctaUrl) lines.push("", ctaUrl);
    lines.push("", signoff || "Kind regards,", "Geeslane");
    return lines.join("\n").trim();
  }

  async function notify(options) {
    const audience = options.audience || "team";
    const heading = String(options.heading || options.subject || "A note from Geeslane");
    const subject = String(options.subject || options.heading || "A note from Geeslane");
    const ctaLabel = options.ctaLabel !== undefined
      ? String(options.ctaLabel || "")
      : (audience === "team" ? "Open admin portal" : "Open your portal");
    const ctaUrl = ctaLabel ? (options.ctaUrl || portalLink(options.ctaPage || (audience === "team" ? "admin" : "client"))) : "";
    const partnerWelcome = options.kind === "partner-welcome";
    const name = partnerWelcome
      ? givenName(options.greetingName)
      : (respectfulName(options.greetingName) || givenName(options.greetingName));
    const greeting = options.greeting !== undefined
      ? String(options.greeting || "")
      : (audience === "team" ? "Hi team," : name ? `Hi ${name},` : "Hi there,");
    const payload = {
      greeting,
      heading,
      intro: options.intro,
      rows: options.rows || [],
      blocks: options.blocks || [],
      ctaLabel,
      ctaUrl,
      signoff: options.signoff,
      attachmentNote: options.attachmentNote || "",
      rowStyle: options.rowStyle || ""
    };
    const mail = {
      audience,
      kind: options.kind || "",
      subject,
      heading,
      intro: options.intro || "",
      html: partnerWelcome ? buildPartnerWelcomeHtml(payload) : buildHtml(payload),
      text: partnerWelcome ? partnerWelcomeText(payload) : plainText(payload),
      clientEmail: options.clientEmail || "",
      clientPhone: options.clientPhone || "",
      ctaUrl,
      replyTo: options.replyTo || supportEmail(),
      attachments: Array.isArray(options.attachments) ? options.attachments.filter((item) => item?.filename && (item?.content || item?.path)) : []
    };
    if (window.GeeslaneAPI?.sendPortalMail) {
      try {
        if (await window.GeeslaneAPI.sendPortalMail(mail)) return true;
      } catch (_) { /* fall back only when no file must go with the mail */ }
    }
    if (mail.attachments.length) return false;
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
      form.append("email", String(mail.clientEmail).trim());
      form.append("ccemail", String(mail.clientEmail).trim());
    }
    return fetch("https://api.web3forms.com/submit", { method: "POST", body: form }).then(() => true).catch(() => false);
  }

  window.GeeslaneMail = Object.freeze({
    notify, portalLink, commentLink, titleCase, logoUrl: LOGO_URL, parsePersonName, composePersonName, respectfulName, givenName, portalName, formatTitle
  });
})();
