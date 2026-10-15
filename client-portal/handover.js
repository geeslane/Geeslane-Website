(function () {
  "use strict";

  const TRACKS = ["website", "automation", "consultation", "support", "other"];
  const ARCHIVE_NOTE = "Keep your own copy of these files. Geeslane will remove this copy from our drive after the days stated here.";
  const PASSWORD_NOTE = "The logins in this pack are so you can take over. Sign in, then change every password on those platforms. Keep the new passwords private. Do not send them back to Geeslane.";

  const FIELD = {
    text: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "text" }),
    area: (key, label, placeholder) => ({ key, label, placeholder: placeholder || "", type: "textarea" }),
    date: (key, label) => ({ key, label, type: "date" }),
    secret: (key, label) => ({ key, label, type: "password" }),
    select: (key, label, options) => ({ key, label, type: "select", options })
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

  const CATALOG = {
    website: [
      COMMON_SERVICE,
      {
        key: "domain",
        title: "Website domain",
        fields: [
          FIELD.text("domainName", "Domain name", "example.com"),
          FIELD.text("hostedOn", "Registered / hosted with"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Temporary password"),
          FIELD.date("expiry", "Expiry date"),
          FIELD.select("freeTrial", "Free trial", ["No", "Yes"]),
          FIELD.area("renewHow", "How to renew")
        ]
      },
      {
        key: "hosting",
        title: "Website files and hosting",
        fields: [
          FIELD.text("hostedOn", "Files hosted on"),
          FIELD.area("accessHow", "How to access it"),
          FIELD.text("loginUrl", "Log in URL", "https://"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Temporary password")
        ]
      },
      {
        key: "email",
        title: "Professional email",
        fields: [
          FIELD.text("mailbox", "Email address"),
          FIELD.text("hostedOn", "Provided by"),
          FIELD.text("loginUrl", "Log in URL", "https://"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Temporary password"),
          FIELD.date("expiry", "Expiry date"),
          FIELD.select("freeTrial", "Free trial", ["No", "Yes"]),
          FIELD.area("trialNote", "Trial or renewal notes"),
          FIELD.area("renewHow", "How to renew")
        ]
      },
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
          FIELD.secret("password", "Temporary password")
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
      {
        key: "domain",
        title: "Domain",
        fields: [
          FIELD.text("domainName", "Domain name"),
          FIELD.text("hostedOn", "Registered / hosted with"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Temporary password"),
          FIELD.date("expiry", "Expiry date"),
          FIELD.area("renewHow", "How to renew")
        ]
      },
      {
        key: "email",
        title: "Mailbox",
        fields: [
          FIELD.text("mailbox", "Email address"),
          FIELD.text("loginUrl", "Log in URL", "https://"),
          FIELD.text("username", "Username"),
          FIELD.secret("password", "Temporary password"),
          FIELD.date("expiry", "Expiry date"),
          FIELD.select("freeTrial", "Free trial", ["No", "Yes"]),
          FIELD.area("renewHow", "How to renew")
        ]
      },
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

  function blankSection(section) {
    const values = {};
    (section.fields || []).forEach((field) => {
      values[field.key] = field.key === "retentionDays" ? "30" : field.key === "warning" ? ARCHIVE_NOTE : field.key === "changeNote" ? PASSWORD_NOTE : field.key === "freeTrial" ? "No" : "";
    });
    return { enabled: true, values };
  }

  function blankPack(track) {
    const resolved = trackOf(track);
    const sections = {};
    sectionsFor(resolved).forEach((section) => { sections[section.key] = blankSection(section); });
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
      const current = incoming[key];
      if (!current || typeof current !== "object") return;
      base.sections[key].enabled = current.enabled !== false;
      base.sections[key].values = { ...base.sections[key].values, ...(current.values || {}) };
    });
    if (Array.isArray(saved.checklist)) {
      const catalog = new Map((window.GeeslaneAgreement?.handoverList?.({}, base.track) || []).map((item) => [item.key, item.label]));
      base.checklist = saved.checklist.map((item) => {
        const label = catalog.get(item?.key);
        return label ? { ...item, label } : item;
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

  function fieldValue(values, field) {
    const text = String(values?.[field.key] ?? "").trim();
    if (field.key === "warning" && !text) return ARCHIVE_NOTE;
    return text;
  }

  function sectionHtml(section, data) {
    const entry = data.sections?.[section.key];
    if (!entry || entry.enabled === false) return "";
    if (section.kind === "checklist") {
      const items = Array.isArray(data.checklist) ? data.checklist.filter((item) => item?.label) : [];
      if (!items.length) return "";
      return `<section class="agreement-block"><h2>${escapeHtml(section.title)}</h2><ul class="agreement-checklist">${items.map((item) =>
        `<li class="${item.done ? "is-done" : ""}"><span class="agreement-check" aria-hidden="true">${item.done ? "✓" : ""}</span><span>${escapeHtml(item.label)}</span></li>`
      ).join("")}</ul></section>`;
    }
    const rows = (section.fields || []).map((field) => {
      const value = fieldValue(entry.values, field);
      if (!value) return "";
      const shown = field.type === "password" ? value : value;
      return `<div class="agreement-fact"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(shown).replace(/\n/g, "<br />")}</strong></div>`;
    }).filter(Boolean).join("");
    if (!rows) return "";
    return `<section class="agreement-block"><h2>${escapeHtml(section.title)}</h2><div class="agreement-facts">${rows}</div></section>`;
  }

  function documentHtml(data, options = {}) {
    const pack = mergePack(data?.track, data);
    const defs = sectionsFor(pack.track);
    const clientName = window.GeeslaneMail?.portalName?.(options.clientName) || options.clientName || "Client";
    const projectTitle = options.projectTitle || "Project";
    const days = pack.fileRetentionDays || 30;
    return `
      <article class="agreement-sheet" lang="en">
        <header class="agreement-masthead">
          <img class="agreement-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
          <div>
            <p class="agreement-kicker">Handover pack</p>
            <h1>Project handover</h1>
          </div>
        </header>
        <section class="agreement-facts" aria-label="Project summary">
          <div class="agreement-fact"><span>Client</span><strong>${escapeHtml(clientName)}</strong></div>
          <div class="agreement-fact"><span>Project</span><strong>${escapeHtml(projectTitle)}</strong></div>
        </section>
        <p class="agreement-lead">This pack lists the accounts, logins, and files for this project. Keep your own copy. Geeslane removes our file copy after ${escapeHtml(String(days))} days.</p>
        <p class="agreement-lead">${escapeHtml(PASSWORD_NOTE)}</p>
        ${defs.map((section) => sectionHtml(section, pack)).join("")}
        ${pack.notes ? `<section class="agreement-block"><h2>Notes</h2><p class="agreement-lead">${escapeHtml(pack.notes).replace(/\n/g, "<br />")}</p></section>` : ""}
        ${pack.fileDriveUrl ? `<section class="agreement-block"><h2>File link</h2><p class="agreement-lead">${escapeHtml(pack.fileDriveUrl)}</p><p class="agreement-endorsement">${escapeHtml(ARCHIVE_NOTE)}</p></section>` : ""}
        <p class="agreement-endorsement">If something here is missing or a login fails, email contact@geeslane.com with your business name. After you change the passwords, Geeslane will not have the new ones. Help articles are also in your portal and on geeslane.com/faq.html.</p>
      </article>
    `;
  }

  function fileName(data, ext) {
    const slug = String(data?.clientName || data?.projectTitle || "handover").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "handover";
    return `${slug}-handover.${ext}`;
  }

  function emailCopy(data, options = {}) {
    const days = data?.fileRetentionDays || 30;
    const project = options.projectTitle || "project";
    return {
      subject: `Thank you — your ${project} handover pack`,
      heading: "Your handover pack is ready",
      intro: `Thank you for choosing Geeslane. It has been a pleasure to work with you, and we are grateful for your trust.\n\nYour handover pack is attached. It includes the service details, logins, and file notes for this project. Please download the PDF and keep your own copy of any files. We remove our drive copy after ${days} days.\n\nThe logins are so you can take over. Sign in, then change every password on those platforms. Keep the new passwords private, and do not send them back to us.\n\nIf anything is missing, reply to this email and we will take care of it promptly.`,
      attachmentNote: "The handover PDF is attached. You can also download it again from your portal."
    };
  }

  window.GeeslaneHandover = Object.freeze({
    ARCHIVE_NOTE,
    PASSWORD_NOTE,
    TRACKS,
    trackOf,
    sectionsFor,
    blankPack,
    mergePack,
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
