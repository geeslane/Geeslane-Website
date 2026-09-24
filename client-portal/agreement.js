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
  const CANCELLATION = ["Cancellation.", "Either party may end the project in writing. The Client will pay for work completed and third-party costs already committed up to the cancellation date. Geeslane will provide paid-for completed work in its current condition where reasonably practical."];
  const LAW = "This agreement is governed by Nigerian law, and both parties will first try to resolve any disagreement through a good-faith written discussion.";

  const TRACKS = {
    website: {
      title: "Website Project Agreement",
      fileSlug: "website-project-agreement",
      checklist: "Handover checklist",
      lead: "The approved proposal, invoices, and written change requests form part of this agreement.",
      payment: PAYMENT.website,
      handover: [
        { key: "finalPayment", label: "Final payment received" },
        { key: "codeAccess", label: "Website code or repository access supplied" },
        { key: "domainHosting", label: "Domain and hosting access confirmed" },
        { key: "adminCredentials", label: "Website administrator credentials supplied" },
        { key: "thirdParty", label: "Third-party services and renewal dates listed" },
        { key: "monitoringDates", label: "Monitoring start and end dates confirmed" }
      ],
      clauses: [
        {
          heading: "Our Agreement",
          items: [
            ["What Geeslane will deliver.", "Geeslane will design, develop, test and launch the website described above and in the approved proposal. Anything not listed in the agreed scope, including extra pages, new features, major design changes, copywriting or ongoing content updates, will be quoted separately."],
            ["What the Client will provide.", "The Client will provide accurate text, images, brand materials, contact details, approvals and any required account access on time. The Client confirms that it has permission to use every item supplied and will check all final content before launch."],
            ["Timeline.", "Work begins after the agreed deposit has been received and the required content has been supplied. The timeline may move if feedback, content, approval or third-party access is delayed. If the Client is inactive for more than fourteen days, Geeslane may pause the project and provide a new completion date."],
            ["Payment.", "Payments are due according to the approved proposal or invoice. The deposit becomes non-refundable once work begins. Geeslane may pause the project or delay launch and handover while an invoice is overdue. All project fees and approved additional charges must be paid before final handover."]
          ]
        },
        {
          heading: "Revisions, Hosting and Handover",
          items: [
            ["Revisions and additional requests.", "The project includes the revision rounds stated above. A revision adjusts work already agreed. A new page, feature, integration or major change of direction is additional work and will require approval of its cost and timeline before work begins."],
            ["Domain, hosting and other services.", "Domain registration, hosting, business email, plugins and other third-party services may have separate charges. First-year or promotional prices do not guarantee future renewal prices. Renewal costs may rise because of provider prices, exchange rates, taxes, traffic, storage or a required plan upgrade. Geeslane will communicate the known cost before renewal, but the Client must approve and pay it before the provider deadline to keep the website online."],
            ["Code, credentials and ownership.", "After full payment, Geeslane will hand over the applicable website code, repository or code archive, website administrator access, domain and hosting access, and relevant setup information. The Client will own the final custom website work created specifically for the project. Third-party software, fonts, stock assets, plugins and open-source components remain subject to their own licences. Geeslane may show the public website in its portfolio unless the Client requests confidentiality in writing."],
            ["Thirty-day monitoring.", "Geeslane will monitor the website for thirty calendar days after launch and correct reproducible errors in the agreed work. This does not include new features, design changes, content updates, third-party outages, attacks, traffic-related upgrades or problems caused by later changes. After thirty days, maintenance and updates will require a separate paid request or maintenance plan."]
          ]
        },
        {
          heading: "Cancellation, Responsibility and Approval",
          items: [
            CANCELLATION,
            ["Website operation and liability.", "Geeslane will use reasonable skill and care but cannot guarantee uninterrupted hosting, search ranking, sales, revenue or protection from every cyber incident. After handover and the monitoring period, the Client is responsible for renewals, passwords, backups, content, account access and future changes. To the extent permitted by law, Geeslane’s total project liability will not exceed the amount paid for the affected project."],
            ["Confidentiality and personal information.", "Both parties will protect non-public project information and access credentials. The Client is responsible for deciding what visitor information the website collects and for supplying any privacy wording or consent requirements needed for its business."],
            ["Approval and applicable law.", `The Client will report any material issue within five business days of receiving the final website for review. Approval, launch, public use or no material issue within that period will count as acceptance. ${LAW}`]
          ]
        }
      ]
    },
    automation: {
      title: "Automation Project Agreement",
      fileSlug: "automation-project-agreement",
      checklist: "Handover checklist",
      lead: "The approved proposal, invoices, and written change requests form part of this agreement.",
      payment: PAYMENT.automation,
      handover: [
        { key: "finalPayment", label: "Final payment received" },
        { key: "workflowAccess", label: "Workflow and account access handed over" },
        { key: "credentials", label: "Login details for connected tools supplied" },
        { key: "runbook", label: "How to operate the workflow supplied" },
        { key: "thirdParty", label: "Third-party tools, licences and usage costs listed" },
        { key: "supportWindow", label: "Review window confirmed" }
      ],
      clauses: [
        {
          heading: "Our Agreement",
          items: [
            ["What Geeslane will deliver.", "Geeslane will design, connect, test and hand over the workflows listed above and in the approved proposal. Extra systems, new channels, or a material change of process will be quoted separately."],
            ["What the Client will provide.", "The Client will provide accurate process details, sample data, account access and approvals on time. The Client remains responsible for reviewing automated messages, decisions and published content before they reach customers."],
            ["Timeline.", "Work begins after the agreed deposit has been received and the required access has been supplied. The timeline may move if feedback, data, approval or third-party access is delayed. If the Client is inactive for more than fourteen days, Geeslane may pause the project and provide a new completion date."],
            ["Payment.", "Payments are due according to the approved proposal or invoice. The deposit becomes non-refundable once work begins. Geeslane may pause the project or delay handover while an invoice is overdue. All project fees and approved additional charges must be paid before final handover."]
          ]
        },
        {
          heading: "Revisions, Tools and Handover",
          items: [
            ["Revisions and additional requests.", "A revision adjusts work already agreed. A new workflow, integration or major change of direction is additional work and will require approval of its cost and timeline before work begins."],
            ["Tools, licences and usage.", "Third-party tools, API usage and model costs sit with the Client unless the proposal says otherwise. Results depend on the quality of the Client’s data, the tools in use, and how the Client’s team operates the system."],
            ["Access, credentials and ownership.", "After full payment, Geeslane will hand over the applicable workflows, account access and operating notes. The Client will own the custom automation work created specifically for the project. Third-party platforms remain subject to their own terms. Geeslane may describe the work in its portfolio unless the Client requests confidentiality in writing."],
            ["Thirty-day review.", "Geeslane will support the agreed workflows for thirty calendar days after handover and correct reproducible errors in the agreed work. This does not include new workflows, changes of process, third-party outages, usage overages or problems caused by later changes. After thirty days, further work will require a separate paid request or support plan."]
          ]
        },
        {
          heading: "Cancellation, Responsibility and Approval",
          items: [
            CANCELLATION,
            ["Operation and liability.", "Geeslane will use reasonable skill and care but cannot guarantee uninterrupted tools, sales, revenue or protection from every incident. AI output can be incomplete or wrong. After handover and the review window, the Client is responsible for account access, data, tool renewals and future changes. To the extent permitted by law, Geeslane’s total project liability will not exceed the amount paid for the affected project."],
            ["Confidentiality and personal information.", "Both parties will protect non-public project information, credentials and data. The Client is responsible for the lawful use of personal information processed through the workflows."],
            ["Approval and applicable law.", `The Client will report any material issue within five business days of receiving the final workflows for review. Approval, live use or no material issue within that period will count as acceptance. ${LAW}`]
          ]
        }
      ]
    },
    consultation: {
      title: "Consultation Agreement",
      fileSlug: "consultation-agreement",
      checklist: "Close-out checklist",
      lead: "The approved proposal, invoices, and written change requests form part of this agreement.",
      payment: PAYMENT.consultation,
      handover: [
        { key: "finalPayment", label: "Final payment received" },
        { key: "report", label: "Recommendation or strategy document delivered" },
        { key: "session", label: "Review session completed" },
        { key: "nextSteps", label: "Agreed next steps recorded" },
        { key: "materials", label: "Reference materials supplied" }
      ],
      clauses: [
        {
          heading: "Our Agreement",
          items: [
            ["What Geeslane will deliver.", "Geeslane will provide the advice, recommendations and sessions listed above and in the approved proposal. Implementation, design, development or ongoing support is a separate project unless included in the same proposal."],
            ["What the Client will provide.", "The Client will provide accurate business information, access to the people Geeslane needs to speak with, and timely feedback. Advice is based on the information supplied."],
            ["Timeline.", "Work begins after the agreed payment has been received, or as stated on the invoice. The timeline may move if information, attendance or approval is delayed. If the Client is inactive for more than fourteen days, Geeslane may pause the engagement and provide a new completion date."],
            ["Payment.", "Payments are due according to the approved proposal or invoice. The deposit, if any, becomes non-refundable once work begins. Geeslane may pause the engagement while an invoice is overdue. Agreed materials are released after payment of the fees due."]
          ]
        },
        {
          heading: "Scope and Close-out",
          items: [
            ["Changes of scope.", "A new problem, market or scope of advice is additional work and will require approval of its cost and timeline before work begins."],
            ["Outcomes.", "Advice is not a guarantee of search ranking, sales, funding or any particular business result."],
            ["Materials and ownership.", "After full payment, Geeslane will supply the agreed documents. The Client may use them for its business. Geeslane retains its methods, templates and unused materials. Geeslane may mention the engagement in its portfolio unless the Client requests confidentiality in writing."],
            ["Close-out.", "The engagement ends when the agreed advice has been delivered and the close-out items above are complete. Further work will require a new proposal."]
          ]
        },
        {
          heading: "Cancellation, Responsibility and Approval",
          items: [
            CANCELLATION,
            ["Responsibility and liability.", "Geeslane will use reasonable skill and care. The Client remains responsible for decisions it takes on the advice. To the extent permitted by law, Geeslane’s total project liability will not exceed the amount paid for the affected project."],
            ["Confidentiality.", "Both parties will protect non-public information shared for this engagement."],
            ["Approval and applicable law.", `The Client will report any material issue within five business days of receiving the final recommendations. Approval, use of the advice or no material issue within that period will count as acceptance. ${LAW}`]
          ]
        }
      ]
    },
    support: {
      title: "Support Agreement",
      fileSlug: "support-agreement",
      checklist: "Handover checklist",
      lead: "The approved proposal, invoices, and written change requests form part of this agreement.",
      payment: PAYMENT.support,
      handover: [
        { key: "finalPayment", label: "Final payment received" },
        { key: "access", label: "Domain, hosting or mailbox access confirmed" },
        { key: "credentials", label: "Administrator credentials supplied" },
        { key: "thirdParty", label: "Third-party services and renewal dates listed" },
        { key: "monitoringDates", label: "Coverage start and end dates confirmed" },
        { key: "workingState", label: "Working state confirmed with the Client" }
      ],
      clauses: [
        {
          heading: "Our Agreement",
          items: [
            ["What Geeslane will deliver.", "Geeslane will complete the domain, hosting, email, monitoring or support work listed above and in the approved proposal. A new website, redesign or unrelated feature is additional work."],
            ["What the Client will provide.", "The Client will provide authorised access to the relevant accounts and timely approval of renewals and changes. The Client confirms it is entitled to grant that access."],
            ["Timeline.", "Work begins after the agreed payment has been received and access has been supplied. The timeline may move if access, approval or a third-party provider is delayed. If the Client is inactive for more than fourteen days, Geeslane may pause the work and provide a new completion date."],
            ["Payment.", "Payments are due according to the approved proposal or invoice. Geeslane may pause coverage while an invoice is overdue. Renewals must be paid before the provider deadline."]
          ]
        },
        {
          heading: "Coverage, Renewals and Handover",
          items: [
            ["Coverage.", "Support is limited to the services and period stated above. It does not include a redesign, new features, content updates, attacks, or problems caused by later changes the Client or another vendor make."],
            ["Domain, hosting and other services.", "Domain registration, hosting, business email, SSL, plugins and other third-party services may have separate charges. First-year or promotional prices do not guarantee future renewal prices. Renewal costs may rise because of provider prices, exchange rates, taxes, traffic, storage or a required plan upgrade. Geeslane will communicate the known cost before renewal. The Client must approve and pay it before the provider deadline to keep the service online."],
            ["Credentials and ownership.", "After payment, Geeslane will confirm access and relevant setup information. The Client owns its accounts. Third-party services remain subject to their own terms."],
            ["Working state.", "Geeslane will confirm the agreed work is complete. After that confirmation, the Client is responsible for renewals, passwords, backups and future changes, except where a paid coverage period is still running."]
          ]
        },
        {
          heading: "Cancellation, Responsibility and Approval",
          items: [
            CANCELLATION,
            ["Operation and liability.", "Geeslane will use reasonable skill and care but cannot guarantee uninterrupted hosting, mail delivery or protection from every cyber incident. To the extent permitted by law, Geeslane’s total project liability will not exceed the amount paid for the affected project."],
            ["Confidentiality.", "Both parties will protect non-public project information and access credentials."],
            ["Approval and applicable law.", `The Client will report any material issue within five business days of being told the work is complete. Approval, continued use or no material issue within that period will count as acceptance. ${LAW}`]
          ]
        }
      ]
    },
    other: {
      title: "Project Agreement",
      fileSlug: "project-agreement",
      checklist: "Close-out checklist",
      lead: "The approved proposal, invoices, and written change requests form part of this agreement.",
      payment: PAYMENT.other,
      handover: [
        { key: "finalPayment", label: "Final payment received" },
        { key: "deliverables", label: "Agreed deliverables supplied" },
        { key: "access", label: "Access and materials handed over" },
        { key: "closeout", label: "Work confirmed with the Client" }
      ],
      clauses: [
        {
          heading: "Our Agreement",
          items: [
            ["What Geeslane will deliver.", "Geeslane will complete the work listed above and in the approved proposal. Anything not listed will be quoted separately."],
            ["What the Client will provide.", "The Client will provide accurate information, access and approvals on time."],
            ["Timeline.", "Work begins after the agreed payment has been received. The timeline may move if information, access or approval is delayed. If the Client is inactive for more than fourteen days, Geeslane may pause the project and provide a new completion date."],
            ["Payment.", "Payments are due according to the approved proposal or invoice. Geeslane may pause the work while an invoice is overdue. Agreed materials are released after payment of the fees due."]
          ]
        },
        {
          heading: "Scope and Close-out",
          items: [
            ["Changes of scope.", "A material change of direction is additional work and will require approval of its cost and timeline before work begins."],
            ["Materials and ownership.", "After full payment, Geeslane will supply the agreed work. The Client will own the custom work created specifically for the project. Third-party tools and licences remain subject to their own terms."],
            ["Close-out.", "The project ends when the agreed work has been delivered and the close-out items above are complete. Further work will require a new proposal."]
          ]
        },
        {
          heading: "Cancellation, Responsibility and Approval",
          items: [
            CANCELLATION,
            ["Responsibility and liability.", "Geeslane will use reasonable skill and care. To the extent permitted by law, Geeslane’s total project liability will not exceed the amount paid for the affected project."],
            ["Confidentiality.", "Both parties will protect non-public project information."],
            ["Approval and applicable law.", `The Client will report any material issue within five business days of receiving the completed work. Approval, use of the work or no material issue within that period will count as acceptance. ${LAW}`]
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
    return (TRACKS[track] || TRACKS.website).handover;
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
    return handoverItems(track).reduce((acc, item) => { acc[item.key] = false; return acc; }, {});
  }

  function normalizeHandover(value, track) {
    const next = emptyHandover(track);
    const source = value && typeof value === "object" ? value : {};
    handoverItems(track).forEach((item) => { next[item.key] = source[item.key] === true; });
    return next;
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

  function handoverHtml(handover, track) {
    const flags = normalizeHandover(handover, track);
    return `<ul class="agreement-checklist">${handoverItems(track).map((item) => {
      const done = flags[item.key];
      return `<li class="${done ? "is-done" : ""}"><span class="agreement-check" aria-hidden="true">${done ? "✓" : ""}</span><span>${escapeHtml(item.label)}</span></li>`;
    }).join("")}</ul>`;
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
            <p class="agreement-kicker">${escapeHtml(pack.title)}</p>
            <h1>A Clear Agreement Between Geeslane and the Client</h1>
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
      .agreement-checklist { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .agreement-checklist li { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #f7fbf8; border: 1px solid #edf2ef; border-radius: 10px; font-size: .92rem; }
      .agreement-check { width: 18px; height: 18px; flex: 0 0 18px; display: grid; place-items: center; margin-top: 1px; color: #fff; background: #fff; border: 1.5px solid #0b6b45; border-radius: 4px; font-size: .72rem; font-weight: 800; }
      .agreement-checklist li.is-done { background: #eff9f4; }
      .agreement-checklist li.is-done .agreement-check { background: #0b6b45; border-color: #0b6b45; }
      .agreement-sign-copy { margin: 0 0 18px; color: #2a3931; font-size: .95rem; line-height: 1.65; }
      .agreement-sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .agreement-sign-card { display: grid; gap: 14px; min-height: 170px; padding: 20px; background: linear-gradient(180deg, #f7fbf8, #fff); border: 1px solid #dfe7e2; border-radius: 14px; }
      .agreement-sign-card > span { color: #0b6b45; font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .agreement-sign-logo { height: 40px; width: auto; }
      .agreement-client-mark { color: #063b29; font-size: 1.2rem; line-height: 1.3; letter-spacing: -.02em; }
      .agreement-sign-card small { margin-top: auto; color: #697870; font-size: .82rem; }
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
