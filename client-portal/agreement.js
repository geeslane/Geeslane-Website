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
  const LAW = "Nigerian law applies. If we disagree, we will first try to settle it in writing.";

  const TRACKS = {
    website: {
      title: "Website Project Agreement",
      fileSlug: "website-project-agreement",
      checklist: "Handover checklist",
      lead: "This covers the work, payment and handover listed above.",
      payment: PAYMENT.website,
      handover: [
        { key: "clientContent", party: "client", label: "The Client has supplied final text, images, logos and remaining brand files" },
        { key: "clientContacts", party: "client", label: "The Client has confirmed launch contact details, addresses and remaining copy" },
        { key: "clientAccess", party: "client", label: "The Client has granted Geeslane access to domain, hosting and any required third-party accounts" },
        { key: "finalPayment", party: "client", label: "The Client has paid the project balance in full" },
        { key: "adminCredentials", party: "geeslane", label: "Geeslane has supplied website administrator credentials" },
        { key: "clientPasswordChange", party: "client", label: "The Client has changed the passwords on all handed-over accounts" },
        { key: "codeAccess", party: "geeslane", label: "Geeslane has supplied website code, repository or code archive access" },
        { key: "domainHosting", party: "geeslane", label: "Geeslane has confirmed domain and hosting access, including where it is managed" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party services, licences and renewal dates" },
        { key: "monitoringDates", party: "geeslane", label: "Geeslane has confirmed post-delivery monitoring start and end dates with the Client" }
      ],
      clauses: [
        {
          heading: "The project",
          items: [
            ["What Geeslane will do.", "We will design, build, test and launch the website listed above. Extra pages, new features, big design changes or extra copywriting are quoted separately."],
            ["What you will provide.", "Send accurate text, images, brand files, contact details, approvals and any account access we need, on time. You confirm you have the right to use everything you send, and you will check the final content before launch."],
            ["Time and payment.", "We start after the agreed deposit and the content we need. Dates can move if we are waiting on you. If the Client is inactive for more than 5 days, Geeslane may pause the project and give a new completion date. Pay as shown on the invoice. The deposit is not refundable once work starts. The full fee must be paid before handover."]
          ]
        },
        {
          heading: "Changes, launch and aftercare",
          items: [
            ["Revisions and extra work.", "The included revision rounds are listed above. A revision is a change to work already agreed. A new page, feature or change of direction is extra work and needs a new cost and timeline before we start it."],
            ["Hosting and renewals.", "Domain, hosting, email and plugins can have their own fees. First-year prices can change at renewal. We will tell you the known cost in time; you must approve and pay before the due date to keep the website online."],
            ["Handover and ownership.", "After full payment we give you the website access, code and setup notes. You own the custom website we built for you. Plugins, fonts and stock stay under their own licences. We may show the public site in our portfolio unless you ask us not to in writing."],
            ["After launch.", "We monitor the website for 30 days after launch, or for the start and end dates written on the handover checklist. In that time we fix faults in the agreed work. New features, content edits, attacks, hosting outages or problems from later changes are not included. After the end date, further work is a paid request."],
            ["If something is wrong.", "Tell us within 5 working days of receiving the finished website if something important is wrong or missing. If you approve it, go live, or do not tell us in that time, the work is accepted."],
            ["Stopping, care and law.", `Either of us can stop the project in writing. You pay for work already done and costs already committed. We take reasonable care but cannot promise rankings, sales or zero downtime. After monitoring, you look after renewals, passwords and updates. Our total responsibility for this project is limited to what you paid for it. We both keep project details private. ${LAW}`]
          ]
        }
      ]
    },
    automation: {
      title: "Automation Project Agreement",
      fileSlug: "automation-project-agreement",
      checklist: "Handover checklist",
      lead: "This covers the work, payment and handover listed above.",
      payment: PAYMENT.automation,
      handover: [
        { key: "clientAccess", party: "client", label: "The Client has granted Geeslane access to the connected tools and accounts" },
        { key: "clientProcess", party: "client", label: "The Client has supplied sample data, process notes and approval contacts" },
        { key: "finalPayment", party: "client", label: "The Client has paid the project balance in full" },
        { key: "workflowAccess", party: "geeslane", label: "Geeslane has handed over workflow and account access" },
        { key: "credentials", party: "geeslane", label: "Geeslane has supplied login details for connected tools" },
        { key: "clientPasswordChange", party: "client", label: "The Client has changed the passwords on all handed-over accounts" },
        { key: "runbook", party: "geeslane", label: "Geeslane has supplied operating notes for the workflow" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party tools, licences and usage costs" },
        { key: "supportWindow", party: "geeslane", label: "Geeslane has confirmed the post-delivery review start and end dates with the Client" }
      ],
      clauses: [
        {
          heading: "The project",
          items: [
            ["What Geeslane will do.", "We will design, connect, test and hand over the workflows listed above. Extra systems, new channels or a change of process are quoted separately."],
            ["What you will provide.", "Send accurate process details, sample data, account access and approvals on time. You remain responsible for checking automated messages and published content before they reach customers."],
            ["Time and payment.", "We start after the agreed deposit and the access we need. Dates can move if we are waiting on you. If the Client is inactive for more than 5 days, Geeslane may pause the project and give a new completion date. Pay as shown on the invoice. The deposit is not refundable once work starts. The full fee must be paid before handover."]
          ]
        },
        {
          heading: "Tools, handover and aftercare",
          items: [
            ["Changes and extra work.", "A revision is a change to work already agreed. A new workflow or change of direction is extra work and needs a new cost and timeline before we start it."],
            ["Tools and ownership.", "Third-party tools, API and model costs sit with you unless the proposal says otherwise. After full payment we hand over the workflows, access and operating notes. You own the custom automation we built for you. We may describe the work in our portfolio unless you ask us not to in writing."],
            ["After handover.", "We support the agreed workflows for 30 days after handover, or for the start and end dates written on the handover checklist. In that time we fix faults in the agreed work. New workflows, tool outages, usage overages or problems from later changes are not included."],
            ["If something is wrong.", "Tell us within 5 working days of receiving the finished workflows if something important is wrong or missing. If you approve it, go live, or do not tell us in that time, the work is accepted."],
            ["Stopping, care and law.", `Either of us can stop the project in writing. You pay for work already done and costs already committed. We take reasonable care, but AI output can be incomplete or wrong, and we cannot promise sales or uninterrupted tools. After the review window, you look after access, data and renewals. Our total responsibility for this project is limited to what you paid for it. We both keep project details private. ${LAW}`]
          ]
        }
      ]
    },
    consultation: {
      title: "Consultation Agreement",
      fileSlug: "consultation-agreement",
      checklist: "Close-out checklist",
      lead: "This covers the work, payment and close-out listed above.",
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
          heading: "The engagement",
          items: [
            ["What Geeslane will do.", "We will provide the advice, recommendations and sessions listed above. Building, design, development or ongoing support is a separate project unless it is included here."],
            ["What you will provide.", "Send accurate business information, access to the people we need to speak with, and timely feedback. Advice is based on what you give us."],
            ["Time and payment.", "We start after the agreed payment, or as stated on the invoice. Dates can move if we are waiting on you. If the Client is inactive for more than 5 days, Geeslane may pause the project and give a new completion date. Pay as shown on the invoice. Agreed documents are released after payment."]
          ]
        },
        {
          heading: "Close-out and care",
          items: [
            ["Scope and documents.", "A new problem or wider brief is extra work. Advice is not a promise of rankings, sales or funding. After payment you may use the agreed documents in your business. We keep our methods and templates. We may mention the work in our portfolio unless you ask us not to in writing."],
            ["If something is wrong.", "Tell us within 5 working days of receiving the final recommendations if something important is wrong or missing. If you approve it, use the advice, or do not tell us in that time, the work is accepted."],
            ["Stopping, care and law.", `Either of us can stop the engagement in writing. You pay for work already done. You remain responsible for decisions you take on the advice. Our total responsibility for this project is limited to what you paid for it. We both keep shared details private. ${LAW}`]
          ]
        }
      ]
    },
    support: {
      title: "Support Agreement",
      fileSlug: "support-agreement",
      checklist: "Handover checklist",
      lead: "This covers the work, payment and coverage listed above.",
      payment: PAYMENT.support,
      handover: [
        { key: "clientAccess", party: "client", label: "The Client has granted authorised access to domain, hosting or mailbox accounts" },
        { key: "clientRenewals", party: "client", label: "The Client has approved and paid any renewal or coverage charges due" },
        { key: "finalPayment", party: "client", label: "The Client has paid the agreed fee in full" },
        { key: "access", party: "geeslane", label: "Geeslane has confirmed domain, hosting or mailbox access" },
        { key: "credentials", party: "geeslane", label: "Geeslane has supplied administrator credentials" },
        { key: "clientPasswordChange", party: "client", label: "The Client has changed the passwords on all handed-over accounts" },
        { key: "thirdParty", party: "geeslane", label: "Geeslane has listed third-party services and renewal dates" },
        { key: "monitoringDates", party: "geeslane", label: "Geeslane has confirmed post-delivery monitoring start and end dates with the Client" },
        { key: "workingState", party: "geeslane", label: "Geeslane has confirmed the working state with the Client" }
      ],
      clauses: [
        {
          heading: "The work",
          items: [
            ["What Geeslane will do.", "We will complete the domain, hosting, email, monitoring or support work listed above. A new website, redesign or unrelated feature is extra work."],
            ["What you will provide.", "Give us authorised access to the relevant accounts and approve renewals and changes on time. You confirm you are allowed to grant that access."],
            ["Time and payment.", "We start after payment and access. Dates can move if we are waiting on you or a provider. If the Client is inactive for more than 5 days, Geeslane may pause the project and give a new completion date. Pay as shown on the invoice. We may pause coverage while an invoice is overdue. Renewals must be paid before the provider deadline."]
          ]
        },
        {
          heading: "Coverage and aftercare",
          items: [
            ["Monitoring and coverage.", "Support runs for the services and dates listed above and on the handover checklist. The start date is when the work is live, or the written start date. The end date is the last day we monitor or support it unless a paid plan continues. Coverage does not include a redesign, new features, content updates, attacks, or problems from later changes."],
            ["Renewals and access.", "Domain, hosting, email and similar services can have their own fees, and renewal prices can change. We will tell you the known cost in time; you must approve and pay before the due date to keep the service online. You own your accounts. After we confirm the work is complete, you look after renewals, passwords and backups, except while paid coverage is still running."],
            ["If something is wrong.", "Tell us within 5 working days of being told the work is complete if something important is wrong or missing. If you approve it, keep using it, or do not tell us in that time, the work is accepted."],
            ["Stopping, care and law.", `Either of us can stop the work in writing. You pay for work already done and costs already committed. We take reasonable care but cannot promise uninterrupted hosting or mail. Our total responsibility for this project is limited to what you paid for it. We both keep project details private. ${LAW}`]
          ]
        }
      ]
    },
    other: {
      title: "Project Agreement",
      fileSlug: "project-agreement",
      checklist: "Close-out checklist",
      lead: "This covers the work, payment and close-out listed above.",
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
          heading: "The project",
          items: [
            ["What Geeslane will do.", "We will complete the work listed above. Anything not listed is quoted separately."],
            ["What you will provide.", "Send accurate information, access and approvals on time."],
            ["Time and payment.", "We start after the agreed payment. Dates can move if we are waiting on you. If the Client is inactive for more than 5 days, Geeslane may pause the project and give a new completion date. Pay as shown on the invoice. Agreed materials are released after payment."]
          ]
        },
        {
          heading: "Close-out and care",
          items: [
            ["Changes and ownership.", "A change of direction is extra work and needs a new cost and timeline before we start it. After full payment you own the custom work we created for you. Third-party tools stay under their own terms."],
            ["If something is wrong.", "Tell us within 5 working days of receiving the finished work if something important is wrong or missing. If you approve it, start using it, or do not tell us in that time, the work is accepted."],
            ["Stopping, care and law.", `Either of us can stop the project in writing. You pay for work already done. We take reasonable care. Our total responsibility for this project is limited to what you paid for it. We both keep project details private. ${LAW}`]
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

  function handoverList(value, track) {
    if (Array.isArray(value)) {
      const items = value.map(handoverItem).filter(Boolean);
      return items.length ? items : defaultHandoverList(track);
    }
    const source = value && typeof value === "object" ? value : {};
    if (Array.isArray(source.items)) {
      const items = source.items.map(handoverItem).filter(Boolean);
      return items.length || Object.prototype.hasOwnProperty.call(source, "items") ? items : defaultHandoverList(track);
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
    return extras.length ? fromDefaults.concat(extras) : fromDefaults;
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

  function fact(label, value) {
    return `<div class="agreement-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayOrPending(value))}</strong></div>`;
  }

  function clausesHtml(pack) {
    let number = 0;
    return pack.clauses.map((section) => {
      const items = section.items.map(([title, body]) => {
        number += 1;
        return `<li><strong>${number}. ${escapeHtml(title)}</strong> ${escapeHtml(body)}</li>`;
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
    return `${client.length ? `<div class="agreement-check-group"><h3>The Client provides</h3>${checklistItemsHtml(client)}</div>` : ""}${geeslane.length ? `<div class="agreement-check-group"><h3>Geeslane provides</h3>${checklistItemsHtml(geeslane)}</div>` : ""}${other.length ? `<div class="agreement-check-group"><h3>Also required</h3>${checklistItemsHtml(other)}</div>` : ""}`;
  }

  function documentHtml(data, options = {}) {
    const agreement = { ...blankAgreement(data?.track), ...(data || {}) };
    const pack = packFor(null, agreement);
    const dateLabel = formatDate(agreement.savedAt) || formatDate(new Date().toISOString());
    const clientName = window.GeeslaneMail?.portalName?.(agreement.clientName) || displayOrPending(agreement.clientName, "Client");
    return `
      <article class="agreement-sheet" lang="en">
        <header class="agreement-masthead">
          <img class="agreement-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
          <div>
            <p class="agreement-kicker">Terms &amp; Agreement</p>
            <h1>${escapeHtml(pack.title)}</h1>
          </div>
        </header>
        <section class="agreement-facts" aria-label="Project summary">
          ${fact("Client", clientName)}
          ${fact("Project", agreement.projectTitle)}
          ${fact("Project Fee", displayFee(agreement.fee))}
          ${fact("Payment Plan", agreement.paymentPlan)}
          ${hasRevisions(agreement.track) ? fact("Included Revisions", displayRevisions(agreement.revisionRounds)) : ""}
          ${fact("Start date", formatDate(agreement.startDate))}
          ${fact("Projected completion", formatDate(agreement.completionDate) || agreement.timeline)}
          <div class="agreement-fact agreement-fact-wide"><span>Main Deliverables</span><strong>${escapeHtml(displayOrPending(agreement.deliverables)).replace(/\n/g, "<br />")}</strong></div>
        </section>
        <p class="agreement-lead">${escapeHtml(pack.lead)}</p>
        ${clausesHtml(pack)}
        <section class="agreement-block">
          <h2>${escapeHtml(pack.checklist)}</h2>
          ${handoverHtml(agreement.handover, trackFrom(null, agreement))}
        </section>
        <section class="agreement-sign">
          <h2>Signatures</h2>
          <p class="agreement-sign-copy">By continuing with this project, both parties confirm that they understand and accept this agreement and the completed project details above.</p>
          <div class="agreement-sign-grid">
            <div class="agreement-sign-card">
              <span>For Geeslane</span>
              <img class="agreement-sign-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
              <small>Date: ${escapeHtml(dateLabel)}</small>
            </div>
            <div class="agreement-sign-card">
              <span>For the Client</span>
              <strong class="agreement-client-mark">${escapeHtml(clientName)}</strong>
              <small>Date: ${escapeHtml(dateLabel)}</small>
            </div>
          </div>
          <p class="agreement-endorsement">This is the same terms document shown in the Geeslane client portal. Price, timeline, and deliverables follow the approved project details.</p>
        </section>
      </article>
    `;
  }

  function documentCss() {
    return `
      .agreement-sheet { max-width: 820px; margin: 0 auto; padding: 42px 48px 48px; color: #17211c; background: #fff; border: 1px solid #dfe7e2; border-radius: 18px; box-shadow: 0 18px 50px rgba(8,54,37,.06); }
      .agreement-masthead { display: flex; align-items: center; gap: 22px; padding-bottom: 28px; border-bottom: 3px solid #0b6b45; }
      .agreement-logo { height: 46px; width: auto; }
      .agreement-kicker { margin: 0 0 6px; color: #0b6b45; font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
      .agreement-masthead h1 { margin: 0; color: #063b29; font-size: 1.55rem; line-height: 1.25; letter-spacing: -.03em; }
      .agreement-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 28px 0 24px; overflow: hidden; background: #dfe7e2; border: 1px solid #dfe7e2; border-radius: 14px; }
      .agreement-fact { display: grid; gap: 5px; padding: 14px 16px; background: #f7fbf8; }
      .agreement-fact span { color: #697870; font-size: .68rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .agreement-fact strong { color: #17211c; font-size: .95rem; font-weight: 700; line-height: 1.45; white-space: pre-wrap; }
      .agreement-fact-wide { grid-column: 1 / -1; background: #eff9f4; }
      .agreement-lead { margin: 0 0 28px; color: #2a3931; font-size: 1rem; line-height: 1.7; }
      .agreement-block { margin: 0 0 26px; }
      .agreement-block h2 { margin: 0 0 12px; padding-bottom: 8px; color: #063b29; border-bottom: 1px solid #edf2ef; font-size: 1.05rem; letter-spacing: -.02em; }
      .agreement-clauses { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
      .agreement-clauses li { color: #2a3931; font-size: .95rem; line-height: 1.7; }
      .agreement-clauses strong { color: #063b29; }
      .agreement-check-group { margin: 0 0 16px; }
      .agreement-check-group:last-child { margin-bottom: 0; }
      .agreement-check-group h3 { margin: 0 0 8px; color: #0b6b45; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .agreement-checklist { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .agreement-checklist li { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #f7fbf8; border: 1px solid #edf2ef; border-radius: 10px; font-size: .92rem; }
      .agreement-check { width: 18px; height: 18px; flex: 0 0 18px; display: grid; place-items: center; margin-top: 1px; color: #fff; background: #fff; border: 1.5px solid #0b6b45; border-radius: 4px; font-size: .72rem; font-weight: 800; }
      .agreement-checklist li.is-done { background: #eff9f4; }
      .agreement-checklist li.is-done .agreement-check { background: #0b6b45; border-color: #0b6b45; }
      .agreement-checklist-empty { margin: 0; color: #697870; font-size: .92rem; }
      .agreement-sign-copy { margin: 0 0 18px; color: #2a3931; font-size: .95rem; line-height: 1.65; }
      .agreement-sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .agreement-sign-card { display: grid; gap: 14px; min-height: 170px; padding: 20px; background: linear-gradient(180deg, #f7fbf8, #fff); border: 1px solid #dfe7e2; border-radius: 14px; }
      .agreement-sign-card > span { color: #0b6b45; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .agreement-sign-logo { height: 40px; width: auto; }
      .agreement-client-mark { color: #063b29; font-size: 1.2rem; line-height: 1.3; letter-spacing: -.02em; }
      .agreement-sign-card small { margin-top: auto; color: #697870; font-size: .82rem; }
      .agreement-endorsement { margin: 18px 0 0; color: #697870; font-size: .82rem; line-height: 1.55; }
      @media (max-width: 720px) {
        .agreement-sheet { padding: 24px 18px 28px; }
        .agreement-masthead, .agreement-facts, .agreement-sign-grid { grid-template-columns: 1fr; }
        .agreement-masthead { display: grid; }
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
        .agreement-sheet { box-shadow: none; border: 0; border-radius: 0; max-width: none; padding: 0; }
        @page { margin: 16mm; }
        @media print { body { padding: 0; } }
      </style></head><body>${documentHtml(data)}</body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
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
