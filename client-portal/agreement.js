(function () {
  "use strict";

  const MAX_REVISIONS = 5;
  const TRACK_KEYS = ["website", "automation", "consultation", "support", "other"];
  const PAYMENT = {
    website: "50% deposit to begin. Balance due before launch and handover.",
    automation: "50% deposit to begin. Balance due before handover.",
    consultation: "Payment is due as stated on the approved invoice.",
    support: "Payment is due as stated on the approved invoice.",
    other: "Payment is due as stated on the approved invoice."
  };
  const DEFAULT_PAYMENT = PAYMENT.website;
  const LAW = "Nigerian law applies. Disputes will first be settled in writing.";
  const TIME = ["Timeline", "Work starts after the agreed payment and required materials have been received. Inactivity of more than 5 days may pause the project and reset the completion date."];
  const PAY_DEPOSIT = ["Payment", "Fees follow the invoice and payment plan above. The deposit is non-refundable once work starts. Handover follows full payment."];
  const PAY_INVOICE = ["Payment", "Fees follow the invoice and payment plan above. Project handover is completed after full payment."];
  const ACCEPT = ["Acceptance", "Report any material issue within 10 working days of delivery. A material issue is a real problem with the delivered work: something broken, missing, or clearly different from what was agreed, and significant enough that the client should not have to accept the work as finished. Approval, use, or silence after that is acceptance."];
  const END = ["Ending the work", `Either party may end the work in writing. Fees remain due for work completed and costs already committed. Geeslane's liability is limited to the amount paid for this project. Project details remain confidential. ${LAW}`];

  const TRACKS = {
    website: {
      title: "Website Project Agreement",
      fileSlug: "website-project-agreement",
      checklist: "Handover Checklist",
      lead: "These terms apply to the project summarised above.",
      payment: PAYMENT.website,
      handover: [
        { key: "finalPayment", party: "client", label: "The Client has paid the project balance in full" },
        { key: "adminCredentials", party: "geeslane", label: "Geeslane has supplied website administrator credentials" },
        { key: "codeAccess", party: "geeslane", label: "Geeslane has supplied website code, repository or code archive access" },
        { key: "domainHosting", party: "geeslane", label: "Geeslane has confirmed domain and hosting access, including where it is managed" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party services, licences and renewal dates & has prompted the client to change the passwords on all handed-over accounts" },
        { key: "monitoringDates", party: "geeslane", label: "Geeslane has confirmed post-delivery monitoring start and end dates with the Client" }
      ],
      clauses: [
        {
          heading: "Terms",
          items: [
            ["Scope", "Geeslane will design, build, test and launch the website listed above. Extra pages or features are quoted separately."],
            ["Client responsibilities", "The Client supplies accurate content, brand files, access and approvals on time, and confirms the right to use all materials provided."],
            TIME,
            PAY_DEPOSIT,
            ["Revisions", "Included revision rounds are listed above. A revision is a change to agreed work. New pages, features or a change of direction are extra work and might increase cost and project timeline."],
            ["After launch", "Geeslane monitors the agreed work for 30 days after launch. Domain, hosting and plugin renewals are paid by the Client. After monitoring, further work is billed separately."],
            ["Ownership", "After full payment, Geeslane hands over website access, code and setup notes. The Client owns the custom website. Third-party licences remain with their owners."],
            ACCEPT,
            END
          ]
        }
      ]
    },
    automation: {
      title: "Automation Project Agreement",
      fileSlug: "automation-project-agreement",
      checklist: "Handover Checklist",
      lead: "These terms apply to the project summarised above.",
      payment: PAYMENT.automation,
      handover: [
        { key: "clientAccess", party: "client", label: "The Client has granted Geeslane access to the connected tools and accounts" },
        { key: "clientProcess", party: "client", label: "The Client has supplied sample data, process notes and approval contacts" },
        { key: "finalPayment", party: "client", label: "The Client has paid the project balance in full" },
        { key: "workflowAccess", party: "geeslane", label: "Geeslane has handed over workflow and account access" },
        { key: "credentials", party: "geeslane", label: "Geeslane has supplied login details for connected tools" },
        { key: "clientPasswordChange", party: "client", label: "The Client has been prompted to change the passwords on all handed-over accounts" },
        { key: "runbook", party: "geeslane", label: "Geeslane has supplied operating notes for the workflow" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party tools, licences and usage costs" },
        { key: "supportWindow", party: "geeslane", label: "Geeslane has confirmed the post-delivery review start and end dates with the Client" }
      ],
      clauses: [
        {
          heading: "Terms",
          items: [
            ["Scope", "Geeslane will design, connect, test and hand over the workflows listed above. Extra systems or a change of process are quoted separately."],
            ["Client responsibilities", "The Client supplies accurate process details, sample data, access and approvals on time, and reviews automated output before it reaches customers."],
            TIME,
            PAY_DEPOSIT,
            ["Changes", "A revision is a change to agreed work. A new workflow or change of direction is extra work and may increase cost and project timeline. Extra costs must be agreed before it starts."],
            ["After handover", "Geeslane supports the agreed workflows for 30 days. Tool costs sit with the Client. AI output can be incomplete. After the review window, further work is billed separately."],
            ["Ownership", "After full payment, Geeslane hands over the workflows, access and operating notes. The Client owns the custom automation."],
            ACCEPT,
            END
          ]
        }
      ]
    },
    consultation: {
      title: "Consultation Agreement",
      fileSlug: "consultation-agreement",
      checklist: "Handover Checklist",
      lead: "These terms apply to the project summarised above.",
      payment: PAYMENT.consultation,
      handover: [
        { key: "clientInfo", party: "client", label: "The Client has supplied the information and people Geeslane needed to speak with" },
        { key: "finalPayment", party: "client", label: "The Client has paid the agreed fee in full" },
        { key: "report", party: "geeslane", label: "Geeslane has delivered the recommendation or strategy document" },
        { key: "session", party: "geeslane", label: "Geeslane has completed the review session" },
        { key: "nextSteps", party: "geeslane", label: "Geeslane has recorded the agreed next steps" },
        { key: "materials", party: "geeslane", label: "Geeslane has supplied the reference materials" }
      ],
      clauses: [
        {
          heading: "Terms",
          items: [
            ["Scope", "Geeslane will provide the advice, recommendations and sessions listed above. Design, development or ongoing support is a separate project unless included here."],
            ["Client responsibilities", "The Client supplies accurate information, access to the people required, and timely feedback. Advice is based on the information provided."],
            TIME,
            PAY_INVOICE,
            ["Advice", "Advice is not a promise of rankings, sales or funding. The Client remains responsible for decisions taken. After payment, the Client may use the agreed documents in their business. Geeslane retains its methods and templates."],
            ACCEPT,
            END
          ]
        }
      ]
    },
    support: {
      title: "Support Agreement",
      fileSlug: "support-agreement",
      checklist: "Handover Checklist",
      lead: "These terms apply to the project summarised above.",
      payment: PAYMENT.support,
      handover: [
        { key: "clientAccess", party: "client", label: "The Client has granted authorised access to domain, hosting or mailbox accounts" },
        { key: "clientRenewals", party: "client", label: "The Client has approved and paid any renewal or coverage charges due" },
        { key: "finalPayment", party: "client", label: "The Client has paid the agreed fee in full" },
        { key: "access", party: "geeslane", label: "Geeslane has confirmed domain, hosting or mailbox access" },
        { key: "credentials", party: "geeslane", label: "Geeslane has supplied administrator credentials" },
        { key: "clientPasswordChange", party: "client", label: "The Client has been prompted to change the passwords on all handed-over accounts" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party services and renewal dates" },
        { key: "monitoringDates", party: "geeslane", label: "Geeslane has confirmed post-delivery monitoring start and end dates with the Client" },
        { key: "workingState", party: "geeslane", label: "Geeslane has confirmed the working state with the Client" }
      ],
      clauses: [
        {
          heading: "Terms",
          items: [
            ["Scope", "Geeslane will complete the domain, hosting, email, monitoring or support work listed above. A new website, redesign or unrelated feature is extra work."],
            ["Client responsibilities", "The Client grants authorised access and approves renewals on time."],
            TIME,
            ["Payment", "Fees follow the invoice and payment plan above. Coverage may pause while an invoice is overdue. Renewals must be paid before the provider deadline."],
            ["Coverage", "Support covers the services and dates listed above. It does not include redesigns, new features, content updates or problems from later changes. After coverage ends, the Client manages renewals, passwords and backups."],
            ACCEPT,
            END
          ]
        }
      ]
    },
    other: {
      title: "Project Agreement",
      fileSlug: "project-agreement",
      checklist: "Handover Checklist",
      lead: "These terms apply to the project summarised above.",
      payment: PAYMENT.other,
      handover: [
        { key: "clientInfo", party: "client", label: "The Client has supplied the information, access and approvals needed" },
        { key: "finalPayment", party: "client", label: "The Client has paid the agreed fee in full" },
        { key: "deliverables", party: "geeslane", label: "Geeslane has supplied the agreed deliverables" },
        { key: "access", party: "geeslane", label: "Geeslane has handed over access and materials" },
        { key: "closeout", party: "geeslane", label: "Geeslane has confirmed the work with the Client" }
      ],
      clauses: [
        {
          heading: "Terms",
          items: [
            ["Scope", "Geeslane will complete the work listed above. Anything not listed is quoted separately."],
            ["Client responsibilities", "The Client supplies accurate information, access and approvals on time."],
            TIME,
            PAY_INVOICE,
            ["Changes", "A change of direction is extra work and needs a new fee and timeline before it starts. After full payment, the Client owns the custom work. Third-party tools remain under their own terms."],
            ACCEPT,
            END
          ]
        }
      ]
    }
  };

  const HANDOVER_ITEMS = TRACKS.website.handover;

  function localTrack(service) {
    const value = String(service || "").toLowerCase();
    if (/automat|chatbot|workflow|n8n|zapier|make\.com|(^|[^a-z])ai([^a-z]|$)/.test(value)) return "automation";
    if (/consult|strateg|advice/.test(value)) return "consultation";
    if (/(host|domain|dns|ssl|monitor|maintenance)/.test(value) || (/\bsupport\b/.test(value) && !/(website|revamp|landing|portfolio)/.test(value))) return "support";
    if (/website|revamp|landing|portfolio|web\s*app|\bweb\b/.test(value)) return "website";
    return "other";
  }

  function trackFrom(project, data) {
    const direct = String(data?.track || "").toLowerCase();
    if (TRACK_KEYS.includes(direct)) return direct;
    const source = project?.service || data?.service || "";
    return window.GeeslaneAPI?.projectTrack?.(source) || localTrack(source);
  }

  function packFor(project, data) {
    return TRACKS[trackFrom(project, data)] || TRACKS.other;
  }

  function hasRevisions(track) {
    return trackFrom(null, { track }) === "website";
  }

  function handoverItems(track) {
    return (TRACKS[track] || TRACKS.website).handover.slice();
  }

  function partyFromLabel(label) {
    const value = String(label || "").trim().toLowerCase();
    if (/^the client\b|^client\b/.test(value)) return "client";
    if (/^geeslane\b/.test(value)) return "geeslane";
    return "";
  }

  function handoverParty(entry) {
    const explicit = String(entry?.party || "").toLowerCase();
    if (explicit === "client" || explicit === "geeslane") return explicit;
    return partyFromLabel(entry?.label || entry?.title || entry?.text);
  }

  function handoverItem(entry, index) {
    if (typeof entry === "string") {
      const label = entry.trim();
      return label ? { key: `item-${index + 1}`, label, party: partyFromLabel(label), done: false } : null;
    }
    if (!entry || typeof entry !== "object") return null;
    const label = String(entry.label || entry.title || entry.text || "").trim();
    if (!label) return null;
    const key = String(entry.key || `item-${index + 1}`).trim() || `item-${index + 1}`;
    return { key, label, party: handoverParty({ ...entry, label }), done: entry.done === true || entry.checked === true };
  }

  function defaultHandoverList(track) {
    return handoverItems(track).map((item) => ({
      key: item.key,
      label: item.label,
      party: item.party || partyFromLabel(item.label),
      done: false
    }));
  }

  const RETIRED_WEBSITE_KEYS = new Set(["clientContent", "clientContacts", "clientAccess", "clientPasswordChange"]);

  function restoreChecklistLabels(items, track) {
    const catalog = new Map(defaultHandoverList(track).map((item) => [item.key, item]));
    return items.filter((item) => track !== "website" || !RETIRED_WEBSITE_KEYS.has(item.key)).map((item) => {
      const standard = catalog.get(item.key);
      if (!standard) return item;
      return { ...item, label: standard.label, party: standard.party || item.party };
    });
  }

  function handoverList(value, track) {
    if (Array.isArray(value)) {
      const items = value.map(handoverItem).filter(Boolean);
      return items.length ? restoreChecklistLabels(items, track) : defaultHandoverList(track);
    }
    const source = value && typeof value === "object" ? value : {};
    if (Array.isArray(source.items)) {
      const items = source.items.map(handoverItem).filter(Boolean);
      return items.length || Object.prototype.hasOwnProperty.call(source, "items") ? restoreChecklistLabels(items, track) : defaultHandoverList(track);
    }
    const defaults = defaultHandoverList(track);
    const known = new Set(defaults.map((item) => item.key));
    const fromDefaults = defaults.map((item) => {
      const entry = source[item.key];
      if (entry && typeof entry === "object") return handoverItem({ ...item, ...entry }, 0) || { ...item, done: false };
      return { ...item, done: entry === true };
    });
    const extras = Object.keys(source).filter((key) => key !== "items" && !known.has(key)).map((key, index) => {
      const entry = source[key];
      if (entry && typeof entry === "object") return handoverItem({ key, ...entry }, index);
      if (entry === true || entry === false) return { key, label: key, done: entry === true };
      return null;
    }).filter(Boolean);
    return restoreChecklistLabels(extras.length ? fromDefaults.concat(extras) : fromDefaults, track);
  }

  function packHandover(list) {
    const items = (Array.isArray(list) ? list : []).map(handoverItem).filter(Boolean);
    const packed = { items };
    items.forEach((item) => { packed[item.key] = item.done; });
    return packed;
  }

  function defaultPayment(track) {
    return (TRACKS[track] || TRACKS.website).payment;
  }

  function documentTitle(data, project) {
    return packFor(project, data).title;
  }

  function checklistTitle(track) {
    return (TRACKS[track] || TRACKS.website).checklist;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(String(value).length <= 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function clampRevisions(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return MAX_REVISIONS;
    return Math.min(MAX_REVISIONS, Math.max(1, Math.round(number)));
  }

  function emptyHandover(track) {
    return packHandover(defaultHandoverList(track));
  }

  function normalizeHandover(value, track) {
    return packHandover(handoverList(value, track));
  }

  function blankAgreement(track) {
    const resolved = TRACK_KEYS.includes(track) ? track : "website";
    return {
      track: resolved,
      clientName: "",
      projectTitle: "",
      deliverables: "",
      fee: "",
      paymentPlan: defaultPayment(resolved),
      revisionRounds: hasRevisions(resolved) ? MAX_REVISIONS : 0,
      startDate: "",
      completionDate: "",
      timeline: "",
      handover: emptyHandover(resolved),
      savedAt: "",
      saved: false
    };
  }

  function joinParts(values) {
    return values.map((item) => String(item || "").trim()).filter(Boolean).join("\n\n");
  }

  function defaultDeliverables(project, brief) {
    const track = trackFrom(project);
    const service = project?.service || brief?.serviceLabel || "";
    const features = String(brief?.features || "").trim();
    const extra = String(brief?.featuresOther || "").trim();
    const scope = String(brief?.visitorDetails || brief?.visitorsCanDo || brief?.scope || "").trim();
    if (track === "website") {
      return joinParts([
        service,
        features ? `Features: ${features}` : "",
        extra ? `Other features: ${extra}` : "",
        scope ? `Visitors should be able to: ${scope}` : ""
      ]);
    }
    return joinParts([service, features, extra, scope]);
  }

  function defaultTimeline(project) {
    const start = formatDate(project?.startDate);
    const target = formatDate(project?.targetDate);
    if (start && target) return `${start} – ${target}`;
    if (target) return `Target completion: ${target}`;
    if (start) return `Starts ${start}`;
    return "";
  }

  function defaultsFrom(project, profile, brief) {
    const track = trackFrom(project);
    const business = String(profile?.business || "").trim();
    const name = String(profile?.name || "").trim();
    return {
      ...blankAgreement(track),
      clientName: business || window.GeeslaneMail?.portalName?.(name) || name,
      projectTitle: String(project?.name || project?.service || brief?.serviceLabel || "").trim(),
      deliverables: defaultDeliverables(project, brief),
      revisionRounds: hasRevisions(track) ? MAX_REVISIONS : 0,
      startDate: project?.startDate || "",
      completionDate: project?.targetDate || "",
      timeline: defaultTimeline(project)
    };
  }

  function mergeAgreement(defaults, saved) {
    const base = { ...blankAgreement(defaults?.track), ...(defaults || {}) };
    if (!saved || typeof saved !== "object") return base;
    const track = trackFrom(null, { track: base.track || saved.track });
    const savedPayment = saved.paymentPlan != null && String(saved.paymentPlan).trim() ? saved.paymentPlan : base.paymentPlan;
    const paymentPlan = track !== "website" && savedPayment === PAYMENT.website ? defaultPayment(track) : savedPayment;
    return {
      track,
      clientName: saved.clientName != null ? saved.clientName : base.clientName,
      projectTitle: saved.projectTitle != null ? saved.projectTitle : base.projectTitle,
      deliverables: saved.deliverables != null ? saved.deliverables : base.deliverables,
      fee: saved.fee != null ? saved.fee : base.fee,
      paymentPlan,
      revisionRounds: hasRevisions(track) ? clampRevisions(saved.revisionRounds != null ? saved.revisionRounds : base.revisionRounds) : 0,
      startDate: saved.startDate != null && String(saved.startDate).trim() ? saved.startDate : base.startDate,
      completionDate: saved.completionDate != null && String(saved.completionDate).trim() ? saved.completionDate : base.completionDate,
      timeline: saved.timeline != null ? saved.timeline : base.timeline,
      handover: normalizeHandover(saved.handover || base.handover, track),
      savedAt: saved.savedAt || saved.updatedAt || "",
      saved: true
    };
  }

  function resolve(project, profile, brief, saved) {
    return mergeAgreement(defaultsFrom(project, profile, brief), saved);
  }

  function displayFee(value) {
    const text = String(value || "").trim();
    if (!text) return "To be confirmed";
    if (/^(ngn|₦)/i.test(text)) return text;
    return `NGN ${text}`;
  }

  function displayRevisions(value) {
    const count = clampRevisions(value);
    return `${count} revision round${count === 1 ? "" : "s"}`;
  }

  function displayOrPending(value, fallback = "To be confirmed") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function logoUrl() {
    try {
      return new URL("../images/logo.png", location.href).href;
    } catch (_) {
      return "../images/logo.png";
    }
  }

  function fact(label, value, wide) {
    const body = escapeHtml(displayOrPending(value)).replace(/\n/g, "<br />");
    return `<div class="agreement-fact${wide ? " agreement-fact-wide" : ""}"><span>${escapeHtml(label)}</span><strong>${body}</strong></div>`;
  }

  function clausesHtml(pack) {
    let number = 0;
    return pack.clauses.map((section) => {
      const items = section.items.map(([title, body]) => {
        number += 1;
        return `<li><strong>${number}. ${escapeHtml(title)}:</strong><span>${escapeHtml(body)}</span></li>`;
      }).join("");
      return `<section class="agreement-block"><h2>${escapeHtml(section.heading)}</h2><ol class="agreement-clauses">${items}</ol></section>`;
    }).join("");
  }

  function checklistItemsHtml(items) {
    return `<ul class="agreement-checklist">${items.map((item) => {
      return `<li class="${item.done ? "is-done" : ""}"><span class="agreement-check" aria-hidden="true">${item.done ? "✓" : ""}</span><span>${escapeHtml(item.label)}</span></li>`;
    }).join("")}</ul>`;
  }

  function handoverHtml(handover, track) {
    const items = handoverList(handover, track);
    if (!items.length) return '<p class="agreement-checklist-empty">No handover items listed.</p>';
    const client = items.filter((item) => item.party === "client");
    const geeslane = items.filter((item) => item.party === "geeslane");
    const other = items.filter((item) => item.party !== "client" && item.party !== "geeslane");
    if (!client.length && !geeslane.length) return checklistItemsHtml(items);
    return checklistItemsHtml([...client, ...geeslane, ...other]);
  }

  function documentHtml(data, options = {}) {
    const agreement = { ...blankAgreement(data?.track), ...(data || {}) };
    const pack = packFor(null, agreement);
    const dateLabel = formatDate(agreement.savedAt) || formatDate(new Date().toISOString());
    const clientName = window.GeeslaneMail?.portalName?.(agreement.clientName) || displayOrPending(agreement.clientName, "Client");
    return `
      <article class="agreement-sheet" lang="en">
        <header class="agreement-masthead">
          <div>
            <img class="agreement-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
            <p class="agreement-kicker">Geeslane Technologies</p>
          </div>
          <div class="agreement-masthead-title">
            <p class="agreement-doc-type">Agreement</p>
            <h1>${escapeHtml(pack.title)}</h1>
          </div>
        </header>
        <section class="agreement-facts" aria-label="Project summary">
          ${fact("Client", clientName)}
          ${fact("Project", agreement.projectTitle)}
          ${fact("Fee", displayFee(agreement.fee))}
          ${fact("Payment", agreement.paymentPlan)}
          ${hasRevisions(agreement.track) ? fact("Revisions", displayRevisions(agreement.revisionRounds)) : ""}
          ${fact("Start", formatDate(agreement.startDate))}
          ${fact("Completion", formatDate(agreement.completionDate) || agreement.timeline)}
          ${fact("Deliverables", agreement.deliverables, true)}
        </section>
        <p class="agreement-lead">${escapeHtml(pack.lead)}</p>
        ${clausesHtml(pack)}
        <section class="agreement-block">
          <h2>${escapeHtml(pack.checklist)}</h2>
          ${handoverHtml(agreement.handover, trackFrom(null, agreement))}
        </section>
        <section class="agreement-sign">
          <h2>Acceptance</h2>
          <p class="agreement-sign-copy">Continuing this project confirms acceptance of these terms.</p>
          <div class="agreement-sign-grid">
            <div class="agreement-sign-card">
              <span>For Geeslane</span>
              <div class="agreement-sign-line"><img class="agreement-sign-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" /></div>
              <small>${escapeHtml(dateLabel)}</small>
            </div>
            <div class="agreement-sign-card">
              <span>For the Client</span>
              <div class="agreement-sign-line"><strong class="agreement-client-mark">${escapeHtml(clientName)}</strong></div>
              <small>${escapeHtml(dateLabel)}</small>
            </div>
          </div>
          <p class="agreement-endorsement">Geeslane Technologies · geeslane.com</p>
        </section>
      </article>
    `;
  }

  function documentCss() {
    return `
      .agreement-sheet { position: relative; max-width: 820px; margin: 0 auto; padding: 42px 48px 36px 70px; color: #17211c; background: #fff; overflow: hidden; }
      .agreement-sheet::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: #063b29; }
      .agreement-sheet::after { content: ""; position: absolute; left: 16px; top: 0; bottom: 0; width: 10px; background: #d8eee3; }
      .agreement-masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 8px; }
      .agreement-logo { height: 42px; width: auto; }
      .agreement-kicker { margin: 12px 0 0; color: #8a9690; font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .agreement-masthead-title { text-align: right; }
      .agreement-doc-type { margin: 0 0 6px; color: #111; font-size: 1.85rem; font-weight: 800; letter-spacing: .1em; line-height: 1; text-transform: uppercase; }
      .agreement-masthead h1 { margin: 0; color: #063b29; font-size: 1rem; font-weight: 700; line-height: 1.35; }
      .agreement-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 22px 0 18px; overflow: hidden; background: #dfe7e2; border: 1px solid #dfe7e2; }
      .agreement-fact { display: grid; gap: 5px; padding: 12px 14px; background: #f7fbf8; }
      .agreement-fact span { color: #8a9690; font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .agreement-fact strong { color: #17211c; font-size: .92rem; font-weight: 700; line-height: 1.45; white-space: pre-wrap; }
      .agreement-fact-wide { grid-column: 1 / -1; background: #eff9f4; }
      .agreement-lead { margin: 0 0 22px; color: #697870; font-size: .9rem; line-height: 1.55; }
      .agreement-block { margin: 0 0 24px; }
      .agreement-block h2 { margin: 0 0 12px; padding-bottom: 8px; color: #063b29; border-bottom: 1px solid #edf2ef; font-size: .78rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .agreement-clauses { margin: 0; padding: 0; list-style: none; display: grid; gap: 0; }
      .agreement-clauses li { display: grid; gap: 4px; padding: 12px 0; color: #2a3931; border-bottom: 1px solid #edf2ef; font-size: .9rem; line-height: 1.55; }
      .agreement-clauses li:last-child { border-bottom: 0; }
      .agreement-clauses strong { color: #063b29; font-size: .92rem; }
      .agreement-clauses span { color: #2a3931; }
      .agreement-check-group { margin: 0 0 14px; }
      .agreement-check-group:last-child { margin-bottom: 0; }
      .agreement-check-group h3 { margin: 0 0 8px; color: #8a9690; font-size: .68rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .agreement-checklist { margin: 0; padding: 0; list-style: none; display: grid; gap: 0; }
      .agreement-checklist li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #edf2ef; font-size: .9rem; line-height: 1.45; }
      .agreement-checklist li:last-child { border-bottom: 0; }
      .agreement-check { width: 16px; height: 16px; flex: 0 0 16px; display: grid; place-items: center; margin-top: 2px; color: #fff; background: #fff; border: 1.5px solid #0b6b45; border-radius: 3px; font-size: .68rem; font-weight: 800; }
      .agreement-checklist li.is-done .agreement-check { background: #0b6b45; border-color: #0b6b45; }
      .agreement-checklist-empty { margin: 0; color: #697870; font-size: .9rem; }
      .agreement-sign-copy { margin: 0 0 16px; color: #2a3931; font-size: .9rem; line-height: 1.55; }
      .agreement-sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
      .agreement-sign-card { display: grid; gap: 8px; min-height: 0; padding: 0; background: none; border: 0; }
      .agreement-sign-card > span { color: #8a9690; font-size: .68rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .agreement-sign-line { display: flex; align-items: flex-end; min-height: 52px; padding-bottom: 8px; border-bottom: 1px solid #dfe7e2; }
      .agreement-sign-logo { height: 32px; width: auto; }
      .agreement-client-mark { color: #063b29; font-size: 1rem; line-height: 1.3; }
      .agreement-sign-card small { color: #8a9690; font-size: .78rem; }
      .agreement-endorsement { margin: 28px 0 0; color: #8a9690; font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      @media (max-width: 720px) {
        .agreement-sheet { padding: 28px 18px 28px 36px; }
        .agreement-masthead, .agreement-facts, .agreement-sign-grid { grid-template-columns: 1fr; }
        .agreement-masthead { display: grid; }
        .agreement-masthead-title { text-align: left; }
      }
      @media print {
        html, body { height: auto; overflow: visible; }
        .agreement-sheet { overflow: visible; break-before: avoid; page-break-before: avoid; }
        .agreement-sheet::before, .agreement-sheet::after { position: fixed; bottom: auto; height: 100%; }
        .agreement-facts, .agreement-sign-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; }
        .agreement-fact-wide { grid-column: 1 / -1 !important; }
        .agreement-masthead { display: flex !important; }
        .agreement-masthead-title { text-align: right !important; }
      }
    `;
  }

  function fileSlug(value) {
    return String(value || "geeslane-agreement").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "geeslane-agreement";
  }

  function downloadName(data, ext) {
    const pack = packFor(null, data);
    return `${fileSlug(data?.clientName || data?.projectTitle)}-${pack.fileSlug}.${ext}`;
  }

  function printDocument(data) {
    const title = documentTitle(data);
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>${escapeHtml(title)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 24px; color: #17211c; background: #fff; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
        ${documentCss()}
        .agreement-sheet { box-shadow: none; border: 0; border-radius: 0; max-width: none; }
        @page { margin: 16mm; }
        @media print { body { padding: 0; } }
      </style></head><body>${documentHtml(data)}</body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:200px;border:0;";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    const run = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (_) {}
      cleanup();
    };
    setTimeout(run, 350);
  }

  function downloadDocument(data) {
    const title = documentTitle(data);
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px 16px 48px; color: #17211c; background: #f5f8f6; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
        ${documentCss()}
      </style></head><body>${documentHtml(data)}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName(data, "html");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  window.GeeslaneAgreement = Object.freeze({
    MAX_REVISIONS,
    DEFAULT_PAYMENT,
    HANDOVER_ITEMS,
    trackFrom,
    handoverItems,
    handoverList,
    packHandover,
    defaultPayment,
    documentTitle,
    checklistTitle,
    hasRevisions,
    blank: blankAgreement,
    defaultsFrom,
    merge: mergeAgreement,
    resolve,
    clampRevisions,
    displayFee,
    documentHtml,
    documentCss,
    renderInto(node, data, options) {
      if (!node) return;
      node.innerHTML = documentHtml(data, options);
    },
    print: printDocument,
    download: downloadDocument,
    downloadPdf(data) {
      const title = documentTitle(data);
      if (window.GeeslaneDocs?.downloadPdf) {
        return window.GeeslaneDocs.downloadPdf(title, documentHtml(data), downloadName(data, "pdf"));
      }
      printDocument(data);
      return false;
    }
  });
})();
