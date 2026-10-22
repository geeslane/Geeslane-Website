(function () {
  "use strict";

  const TRACKS = ["website", "automation", "consultation", "support", "other"];
  const ARCHIVE_NOTE = "Keep your own copy of these files. Geeslane will remove this copy from our drive after the days stated here.";
  const OLD_PASSWORD_NOTE = "The logins in this pack are so you can take over. Sign in, then change every password on those platforms. Keep the new passwords private. Do not send them back to Geeslane.";
  const PASSWORD_NOTE = "The logins and access details to the domain & hosting platforms have been shared. Please, keep the credentials private & secured. You are also advised to sign in to the accounts and change your password.";
  const CHANGE_NOTE = "Kindly update your account passwords for security & confidentiality.";
  const NAMECHEAP_RENEW = "You will get a mail from namecheap once the expiry date approaches including the renewal steps.";
  const COST_NOTE = "This is the renewal cost at handover. The provider can change the price before the next renewal.";
  const HOSTING_NOTE = "This hosting is on Vercel's free plan. If the app goes beyond the free limits, such as traffic, bandwidth, builds, or commercial use, it will need a paid upgrade. The upgrade options are shown in the Vercel account after you sign in.";
  const SIGN_IN = [
    { test: /namecheap/i, href: "https://www.namecheap.com/myaccount/login/" },
    { test: /vercel/i, href: "https://vercel.com/login" },
    { test: /github/i, href: "https://github.com/login" },
    { test: /godaddy/i, href: "https://sso.godaddy.com/" },
    { test: /cloudflare/i, href: "https://dash.cloudflare.com/login" },
    { test: /netlify/i, href: "https://app.netlify.com/login" },
    { test: /resend/i, href: "https://resend.com/login" },
    { test: /stripe/i, href: "https://dashboard.stripe.com/login" },
    { test: /supabase/i, href: "https://supabase.com/dashboard/sign-in" },
    { test: /mailgun/i, href: "https://login.mailgun.com/" },
    { test: /twilio/i, href: "https://console.twilio.com/" },
    { test: /sendgrid/i, href: "https://login.sendgrid.com/" }
  ];

  const FIELD = {
    text: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "text" }),
    area: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "textarea" }),
    date: (key, label) => ({ key, label, type: "date" }),
    secret: (key, label) => ({ key, label, type: "password" }),
    select: (key, label, options) => ({ key, label, type: "select", options }),
    signIn: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "text", link: "signin" }),
    url: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "text", link: "url" })
  };

  const DOMAIN = {
    key: "domain",
    title: "Domain",
    fields: [
      FIELD.url("domainName", "Domain name (website link)", "example.com"),
      FIELD.signIn("hostedOn", "Where to log in", "namecheap.com"),
      FIELD.text("username", "Username"),
      FIELD.secret("password", "Password"),
      FIELD.date("expiry", "Expiry date"),
      FIELD.text("renewCost", "Renewal cost", "e.g. 15 USD / year"),
      FIELD.area("costNote", "Renewal note"),
      FIELD.area("renewHow", "How to renew")
    ]
  };
  const HOSTING = {
    key: "hosting",
    title: "Hosting",
    fields: [
      FIELD.signIn("hostedOn", "Where to log in", "vercel.com"),
      FIELD.text("plan", "Plan"),
      FIELD.text("username", "Username"),
      FIELD.secret("password", "Password"),
      FIELD.area("planNote", "About this plan"),
      FIELD.area("accessHow", "How to access it")
    ]
  };
  const EMAIL = {
    key: "email",
    title: "Email",
    fields: [
      FIELD.text("mailbox", "Email address"),
      FIELD.signIn("loginUrl", "Where to log in"),
      FIELD.text("username", "Username"),
      FIELD.secret("password", "Password"),
      FIELD.date("expiry", "Expiry date"),
      FIELD.text("renewCost", "Renewal cost", "e.g. 15 USD / year"),
      FIELD.area("costNote", "Renewal note"),
      FIELD.area("renewHow", "How to renew")
    ]
  };
  const CODE = {
    key: "code",
    title: "Code archive",
    fields: [
      FIELD.signIn("hostedOn", "Where the code is hosted", "GitHub"),
      FIELD.url("repoUrl", "Repository link", "https://"),
      FIELD.text("username", "Username"),
      FIELD.secret("password", "Password")
    ]
  };

  const COMMON_SERVICE = {
    key: "service",
    title: "Project service details",
    fields: [
      FIELD.text("serviceName", "Type of work"),
      FIELD.area("summary", "What was delivered")
    ]
  };
  const COMMON_PASSWORDS = {
    key: "passwords",
    title: "Change your passwords",
    fields: [
      FIELD.area("changeNote", "What the client must do")
    ]
  };
  const COMMON_ARCHIVE = {
    key: "archive",
    title: "File copy",
    fields: [
      FIELD.text("driveUrl", "Drive or file link", "https://"),
      FIELD.select("retentionDays", "Days until we remove our copy", ["30", "45", "60"]),
      FIELD.area("warning", "Keep-your-copy note")
    ]
  };
  const COMMON_CHECKLIST = { key: "checklist", title: "Handover checklist", kind: "checklist" };
  const EXTRA_FIELDS = [
    FIELD.text("serviceName", "Service", "e.g. Resend"),
    FIELD.signIn("loginUrl", "Where to log in", "resend.com or a login link"),
    FIELD.text("username", "Username"),
    FIELD.secret("password", "Password"),
    FIELD.area("note", "Anything else", "Plan, sender address, API notes, or how the client uses it.")
  ];

  const CATALOG = {
    website: [
      COMMON_SERVICE,
      DOMAIN,
      HOSTING,
      CODE,
      EMAIL,
      COMMON_PASSWORDS,
      COMMON_ARCHIVE,
      COMMON_CHECKLIST
    ],
    automation: [
      COMMON_SERVICE,
      {
        key: "access",
        title: "Workflow access",
        fields: [
          FIELD.text("hostedOn", "Tools used"),
          FIELD.area("accessHow", "How to operate it"),
          FIELD.text("loginUrl", "Log in URL", "https://"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Password")
        ]
      },
      COMMON_PASSWORDS,
      COMMON_ARCHIVE,
      COMMON_CHECKLIST
    ],
    consultation: [
      COMMON_SERVICE,
      {
        key: "materials",
        title: "Documents delivered",
        fields: [
          FIELD.text("driveUrl", "Document link", "https://"),
          FIELD.area("accessHow", "How to open them"),
          FIELD.area("nextSteps", "Agreed next steps")
        ]
      },
      COMMON_CHECKLIST
    ],
    support: [
      COMMON_SERVICE,
      DOMAIN,
      HOSTING,
      CODE,
      EMAIL,
      COMMON_PASSWORDS,
      COMMON_ARCHIVE,
      COMMON_CHECKLIST
    ],
    other: [
      COMMON_SERVICE,
      COMMON_ARCHIVE,
      COMMON_CHECKLIST
    ]
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function trackOf(value) {
    const key = String(value || "").toLowerCase();
    if (TRACKS.includes(key)) return key;
    return window.GeeslaneAPI?.projectTrack?.(value) || "website";
  }

  function sectionsFor(track) {
    return (CATALOG[trackOf(track)] || CATALOG.other).map((section) => ({ ...section, fields: (section.fields || []).slice() }));
  }

  function defaultIntro() {
    return "This pack lists the accounts, logins, and code archive link for this project.";
  }

  function isDefaultIntro(text) {
    const value = String(text || "").trim();
    return !value || value === defaultIntro() || /^This pack lists the accounts, logins, and files for this project\. Keep your own copy\. Geeslane removes our file copy after \d+ days\.$/.test(value);
  }

  function isDefaultPassword(text) {
    const value = String(text || "").trim();
    return !value || value === PASSWORD_NOTE || value === OLD_PASSWORD_NOTE;
  }

  const CLOSING = "If something is missing or a login fails, kindly email contact@geeslane.com or reset the password. You can also check answers to common questions at geeslane.com/faq.html.";
  const PREVIOUS_CLOSING = "If something here is missing or a login fails, email contact@geeslane.com with your business name. After you change the passwords, Geeslane will not have the new ones. Help articles are also in your portal and on geeslane.com/faq.html.";

  function isDefaultClosing(text) {
    const value = String(text || "").trim();
    return !value || value === CLOSING || value === PREVIOUS_CLOSING;
  }

  function defaultDocumentCopy(days) {
    return {
      intro: defaultIntro(days),
      password: PASSWORD_NOTE,
      archive: ARCHIVE_NOTE,
      closing: CLOSING
    };
  }

  function linkText(value) {
    const source = String(value || "");
    const pattern = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(https?:\/\/[^\s]+)|((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/gi;
    let html = "";
    let last = 0;
    source.replace(pattern, (match, email, _url, _bare, offset) => {
      html += escapeHtml(source.slice(last, offset));
      const trailing = match.match(/[.,)]+$/);
      const extra = trailing ? trailing[0] : "";
      const core = extra ? match.slice(0, -extra.length) : match;
      if (email) html += `<a href="mailto:${escapeHtml(core)}">${escapeHtml(core)}</a>`;
      else html += `<a href="${escapeHtml(/^https?:/i.test(core) ? core : `https://${core}`)}">${escapeHtml(core)}</a>`;
      html += escapeHtml(extra);
      last = offset + match.length;
      return match;
    });
    html += escapeHtml(source.slice(last));
    return html.replace(/\n/g, "<br />");
  }

  function resolveDocumentCopy(saved, days) {
    const base = defaultDocumentCopy(days);
    const values = saved?.values && typeof saved.values === "object" ? saved.values : {};
    const pick = (key) => {
      const value = String(values[key] ?? "").trim();
      if (key === "intro" && isDefaultIntro(value)) return base.intro;
      if (key === "password" && isDefaultPassword(value)) return base.password;
      if (key === "closing" && isDefaultClosing(value)) return base.closing;
      return value || base[key];
    };
    return {
      intro: pick("intro"),
      password: pick("password"),
      archive: pick("archive"),
      closing: pick("closing")
    };
  }

  function fillSectionDefaults(key, values) {
    const next = { ...(values || {}) };
    if (key === "domain" || key === "email") {
      if (key === "domain" && !String(next.hostedOn || "").trim()) next.hostedOn = "namecheap.com";
      if (!String(next.renewHow || "").trim()) next.renewHow = NAMECHEAP_RENEW;
      if (!String(next.renewCost || "").trim()) next.renewCost = key === "email" ? "$14.88 per year" : "$14.98 per year";
      if (!String(next.costNote || "").trim()) next.costNote = COST_NOTE;
    }
    if (key === "hosting") {
      if (!String(next.hostedOn || "").trim() && String(next.loginUrl || "").trim()) next.hostedOn = next.loginUrl;
      if (!String(next.hostedOn || "").trim()) next.hostedOn = "vercel.com";
      if (!String(next.plan || "").trim()) next.plan = "Free";
      if (!String(next.planNote || "").trim()) next.planNote = HOSTING_NOTE;
    }
    if (key === "passwords" && (!String(next.changeNote || "").trim() || next.changeNote === OLD_PASSWORD_NOTE || next.changeNote === PASSWORD_NOTE)) {
      next.changeNote = CHANGE_NOTE;
    }
    return next;
  }

  function blankSection(section) {
    const values = {};
    (section.fields || []).forEach((field) => {
      values[field.key] = field.key === "retentionDays" ? "30" : field.key === "warning" ? ARCHIVE_NOTE : field.key === "freeTrial" ? "No" : "";
    });
    return { enabled: true, values: fillSectionDefaults(section.key, values) };
  }

  function blankPack(track) {
    const resolved = trackOf(track);
    const sections = {};
    sectionsFor(resolved).forEach((section) => { sections[section.key] = blankSection(section); });
    sections.documentCopy = { enabled: true, values: defaultDocumentCopy(30) };
    sections.extraServices = { enabled: true, items: [] };
    return {
      track: resolved,
      sections,
      checklist: (window.GeeslaneAgreement?.handoverList?.({}, resolved) || []).map((item) => ({ key: item.key, label: item.label, done: false })),
      notes: "",
      fileDriveUrl: "",
      fileRetentionDays: 30,
      status: "draft",
      sentAt: "",
      sentTo: "",
      storagePath: ""
    };
  }

  function mergePack(track, saved) {
    const base = blankPack(track);
    if (!saved || typeof saved !== "object") return base;
    const incoming = saved.sections && typeof saved.sections === "object" ? saved.sections : {};
    Object.keys(base.sections).forEach((key) => {
      if (key === "extraServices") return;
      const current = incoming[key];
      if (!current || typeof current !== "object") return;
      base.sections[key].enabled = current.enabled !== false;
      base.sections[key].values = fillSectionDefaults(key, { ...base.sections[key].values, ...(current.values || {}) });
    });
    const savedExtras = Array.isArray(incoming.extraServices?.items) ? incoming.extraServices.items : [];
    base.sections.extraServices = {
      enabled: true,
      items: savedExtras.map(normalizeExtra).filter(extraHasContent)
    };
    if (incoming.documentCopy && typeof incoming.documentCopy === "object") {
      const values = incoming.documentCopy.values && typeof incoming.documentCopy.values === "object"
        ? incoming.documentCopy.values
        : {};
      base.sections.documentCopy = {
        enabled: true,
        values: { ...base.sections.documentCopy.values, ...values }
      };
    }
    if (Array.isArray(saved.checklist)) {
      const catalog = new Map((window.GeeslaneAgreement?.handoverList?.({}, base.track) || []).map((item) => [item.key, item.label]));
      base.checklist = saved.checklist.map((item) => {
        const savedLabel = String(item?.label || "").trim();
        const catalogLabel = catalog.get(item?.key);
        return { ...item, label: savedLabel || catalogLabel || "" };
      });
    }
    base.notes = saved.notes || "";
    base.fileDriveUrl = saved.fileDriveUrl || saved.file_drive_url || "";
    base.fileRetentionDays = Number(saved.fileRetentionDays || saved.file_retention_days || 30);
    base.status = saved.status || "draft";
    base.sentAt = saved.sentAt || saved.sent_at || "";
    base.sentTo = saved.sentTo || saved.sent_to || "";
    base.storagePath = saved.storagePath || saved.storage_path || "";
    return base;
  }

  function logoUrl() {
    try { return new URL("../images/logo.png", location.href).href; }
    catch (_) { return "../images/logo.png"; }
  }

  function signInHref(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const known = SIGN_IN.find((item) => item.test.test(text));
    const hasPath = /[a-z0-9.-]+\.[a-z]{2,}\/\S+/i.test(text.replace(/^https?:\/\//i, ""));
    if (known && !hasPath) return known.href;
    if (/^https?:\/\//i.test(text)) return text;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return `https://${text}`;
    return "";
  }

  function directHref(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return `https://${text}`;
    return "";
  }

  function linkedValue(field, value) {
    const safe = escapeHtml(value).replace(/\n/g, "<br />");
    const href = field.link === "signin" ? signInHref(value) : field.link === "url" ? directHref(value) : "";
    if (!href) return safe;
    return `<a href="${escapeHtml(href)}">${safe}</a>`;
  }

  function formatPackDate(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(value || "").trim();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[Number(match[2]) - 1];
    const day = Number(match[3]);
    if (!month || !day) return String(value || "").trim();
    return `${day} ${month}, ${match[1]}`;
  }

  function fieldValue(values, field) {
    const text = String(values?.[field.key] ?? "").trim();
    if (field.key === "warning" && !text) return ARCHIVE_NOTE;
    if (field.key === "changeNote" && (!text || text === OLD_PASSWORD_NOTE || text === PASSWORD_NOTE)) return CHANGE_NOTE;
    if (field.type === "select" && /^no$/i.test(text)) return "";
    if (field.type === "date") return formatPackDate(text);
    return text;
  }

  function normalizeExtra(item, index) {
    const values = item?.values && typeof item.values === "object" ? item.values : {};
    return {
      id: String(item?.id || `svc-${index + 1}`).replace(/[^a-z0-9-]/gi, "") || `svc-${index + 1}`,
      values: {
        serviceName: String(values.serviceName || "").trim(),
        loginUrl: String(values.loginUrl || "").trim(),
        username: String(values.username || "").trim(),
        password: String(values.password || "").trim(),
        note: String(values.note || "").trim()
      }
    };
  }

  function extraHasContent(item) {
    return Object.values(item?.values || {}).some((value) => String(value || "").trim());
  }

  function extraItems(pack) {
    const raw = pack?.sections?.extraServices?.items || [];
    return (Array.isArray(raw) ? raw : []).map(normalizeExtra);
  }

  function documentSections(pack) {
    const defs = sectionsFor(pack.track);
    const extras = extraItems(pack).filter(extraHasContent).map((item) => ({
      key: item.id,
      title: item.values.serviceName || "Other service",
      extra: true,
      fields: EXTRA_FIELDS.filter((field) => field.key !== "serviceName")
    }));
    const at = defs.findIndex((section) => section.key === "passwords" || section.key === "checklist");
    if (at === -1) return defs.concat(extras);
    return defs.slice(0, at).concat(extras, defs.slice(at));
  }

  function sectionHtml(section, data) {
    const entry = section.extra
      ? extraItems(data).find((item) => item.id === section.key)
      : data.sections?.[section.key];
    if (!entry || entry.enabled === false) return "";
    if (section.kind === "checklist") {
      const items = Array.isArray(data.checklist) ? data.checklist.filter((item) => item?.label) : [];
      if (!items.length) return "";
      return `<section class="agreement-block"><h2>${escapeHtml(section.title)}</h2><ul class="agreement-checklist">${items.map((item) =>
        `<li class="${item.done ? "is-done" : ""}"><span class="agreement-check" aria-hidden="true">${item.done ? "✓" : ""}</span><span>${escapeHtml(item.label)}</span></li>`
      ).join("")}</ul></section>`;
    }
    const facts = (section.fields || []).map((field) => {
      const value = fieldValue(entry.values, field);
      if (!value) return null;
      const wide = field.type === "textarea" && (value.includes("\n") || value.length > 60);
      return { field, value, wide };
    }).filter(Boolean);
    const laid = [];
    let pending = null;
    facts.forEach((fact) => {
      if (fact.wide) {
        if (pending) {
          pending.wide = true;
          laid.push(pending);
          pending = null;
        }
        laid.push(fact);
        return;
      }
      if (pending) {
        laid.push(pending, fact);
        pending = null;
      } else pending = fact;
    });
    if (pending) {
      pending.wide = true;
      laid.push(pending);
    }
    const rows = laid.map((fact) => `<div class="agreement-fact${fact.wide ? " agreement-fact-wide" : ""}"><span>${escapeHtml(fact.field.label)}</span><strong>${linkedValue(fact.field, fact.value)}</strong></div>`).join("");
    if (!rows) {
      if (section.extra && section.title && section.title !== "Other service") {
        return `<section class="agreement-block"><h2>${escapeHtml(section.title)}</h2></section>`;
      }
      return "";
    }
    return `<section class="agreement-block"><h2>${escapeHtml(section.title)}</h2><div class="agreement-facts handover-facts">${rows}</div></section>`;
  }

  function documentHtml(data, options = {}) {
    const pack = mergePack(data?.track, data);
    const defs = documentSections(pack);
    const savedName = String(pack.sections?.documentCopy?.values?.clientName || "").trim();
    const clientName = savedName || window.GeeslaneMail?.portalName?.(options.clientName) || options.clientName || "Client";
    const projectTitle = options.projectTitle || "Project";
    const days = pack.fileRetentionDays || 30;
    const copy = resolveDocumentCopy(pack.sections.documentCopy, days);
    return `
      <article class="agreement-sheet" lang="en">
        <header class="agreement-masthead">
          <img class="agreement-logo handover-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
          <div>
            <p class="agreement-kicker">Handover pack</p>
            <h1>Project handover</h1>
          </div>
        </header>
        <section class="agreement-facts" aria-label="Project summary">
          <div class="agreement-fact"><span>Client</span><strong>${escapeHtml(clientName)}</strong></div>
          <div class="agreement-fact"><span>Project</span><strong>${escapeHtml(projectTitle)}</strong></div>
        </section>
        <p class="agreement-lead">${escapeHtml(copy.intro)}</p>
        <p class="agreement-lead">${escapeHtml(copy.password)}</p>
        ${defs.map((section) => sectionHtml(section, pack)).join("")}
        ${pack.notes ? `<section class="agreement-block"><h2>Notes</h2><p class="agreement-lead">${escapeHtml(pack.notes).replace(/\n/g, "<br />")}</p></section>` : ""}
        ${pack.fileDriveUrl ? `<section class="agreement-block"><h2>File link</h2><p class="agreement-lead">${escapeHtml(pack.fileDriveUrl)}</p><p class="agreement-endorsement">${escapeHtml(copy.archive)}</p></section>` : ""}
        <p class="handover-closing">${linkText(copy.closing)}</p>
      </article>
    `;
  }

  function slugPart(value) {
    return String(value || "").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  }

  function fileName(data, ext) {
    const projectRaw = String(data?.projectTitle || data?.projectName || "Project").trim();
    const values = data?.sections?.service?.values || {};
    let serviceRaw = String(values.serviceName || data?.service || values.summary || "Service").trim();
    if (projectRaw && serviceRaw.toLowerCase().includes(projectRaw.toLowerCase())) {
      const escaped = projectRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      serviceRaw = serviceRaw.replace(new RegExp(escaped, "ig"), " ").replace(/\b(for|the|a|an)\b/gi, " ");
    }
    const project = slugPart(projectRaw) || "Project";
    const service = slugPart(serviceRaw) || "Service";
    return `${project}-${service}-handover.${ext || "pdf"}`;
  }

  function courtesyGreeting(name) {
    const person = window.GeeslaneMail?.parsePersonName?.(name);
    const titled = person?.title && person?.bareName ? `${person.title} ${person.bareName}` : "";
    const label = titled || person?.bareName || person?.respectful || String(name || "").trim();
    return label ? `Hi ${label},` : "Hi,";
  }

  function workPhrase(data, options = {}) {
    const values = data?.sections?.service?.values || {};
    const summary = String(values.summary || "").trim();
    const named = String(values.serviceName || "").trim();
    const project = String(options.projectTitle || "").trim();
    const service = summary || named || String(options.service || "").trim();
    if (!service) return project || "project";
    if (project && service.toLowerCase().includes(project.toLowerCase())) return service;
    return `${project} ${service}`.trim();
  }

  function emailCopy(data, options = {}) {
    const days = data?.fileRetentionDays || 30;
    const project = options.projectTitle || "Project";
    const subject = `Your ${project} Handover Pack`;
    return {
      subject,
      heading: subject,
      intro: `${courtesyGreeting(options.clientName)}\n\nYour ${workPhrase(data, options)} is done, and your handover pack is attached. Please download the PDF and keep your own copy. We remove ours after ${days} days.\n\nWhen you can, sign in and update your passwords. If anything is missing, just reply and we will be happy to help.\n\nThank you so much for working with us, and we look forward to working with you again.`,
      attachmentNote: "You can also download the PDF again from your portal."
    };
  }

  window.GeeslaneHandover = Object.freeze({
    ARCHIVE_NOTE,
    PASSWORD_NOTE,
    TRACKS,
    trackOf,
    sectionsFor,
    extraServiceFields() { return EXTRA_FIELDS.map((field) => ({ ...field })); },
    extraItems,
    blankPack,
    mergePack,
    defaultIntro,
    isDefaultIntro,
    defaultDocumentCopy,
    resolveDocumentCopy,
    documentHtml,
    fileName,
    emailCopy,
    renderInto(node, data, options) {
      if (!node) return;
      node.innerHTML = documentHtml(data, options);
    },
    downloadPdf(data, options) {
      const title = "Project handover";
      if (window.GeeslaneDocs?.downloadPdf) {
        return window.GeeslaneDocs.downloadPdf(title, documentHtml(data, options), fileName({ ...data, ...options }, "pdf"));
      }
      return false;
    },
    pdfAttachment(data, options) {
      if (!window.GeeslaneDocs?.pdfAttachment) return Promise.resolve(null);
      return window.GeeslaneDocs.pdfAttachment("Handover", documentHtml(data, options), fileName({ ...data, ...options }, "pdf"));
    }
  });
})();
