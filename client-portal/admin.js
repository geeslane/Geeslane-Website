(function () {
  "use strict";

  /* Admin shell: auth, lists, billing, agreement, files, milestones. Shared table UI lives in ui.js. */

  const pageTitles = { overview: "Overview", registrations: "Access Requests", clients: "Clients", projects: "Projects", agreements: "Agreements", invoices: "Payments", files: "Brand & Files", requests: "Requests & Approvals", milestones: "Milestones" };
  const requestStatuses = ["Received", "In review", "Approved", "Changes requested", "Completed", "Declined"];
  const milestoneStatuses = ["upcoming", "current", "review", "admin_review", "complete"];
  let data = { metrics: {}, registrations: [], users: [], projects: [], requests: [], milestones: [], pushDevices: {} };
  let milestoneMessages = [];
  let adminOpenIds = new Set();
  let adminOpenProjectId = "";
  let materials = { projectId: "", brand: null, content: null, brief: null, files: [] };
  let agreementContext = { projectId: "", project: null, profile: null, brief: null, saved: null };
  let invoices = [];
  let receipts = [];
  let portalSettings = { bankName: "", accountName: "", accountNumber: "", bankNotes: "" };
  let toastTimer = null;
  let savingStages = false;
  let adminContextOpen = true;
  let adminContextClosed = new Set();

  const ui = window.GeeslaneUI;
  const escapeHtml = (value) => ui.escapeHtml(value);
  const rowActions = (items) => ui.rowActions(items);
  const tablePages = { registrations: 1, clients: 1, projects: 1, requests: 1, invoices: 1, receipts: 1 };

  function pagedRows(key, rows) {
    const slice = ui.pageSlice(rows, tablePages[key]);
    tablePages[key] = slice.page;
    return slice;
  }

  function drawPager(id, key, slice, render) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = ui.pagerHtml(slice);
    ui.bindPager(node, (page) => {
      tablePages[key] = page;
      render();
    });
  }

  function formatDate(value) { if (!value) return "—"; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  function dateInputValue(value) {
    const raw = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  }
  function todayInputValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function constrainDateInput(input, currentValue = "") {
    if (!input) return;
    const today = todayInputValue();
    const current = dateInputValue(currentValue || input.value);
    input.min = current && current < today ? current : today;
  }
  function relativeWeights(rows) {
    const total = rows.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (!total) return rows.map(() => 0);
    const raw = rows.map((item) => (100 * Number(item.weight || 0)) / total);
    const rounded = raw.map((value) => Math.round(value));
    const drift = 100 - rounded.reduce((sum, value) => sum + value, 0);
    if (drift && rounded.length) {
      const richest = raw.reduce((best, value, index) => value > raw[best] ? index : best, 0);
      rounded[richest] += drift;
    }
    return rounded;
  }
  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    return value === "pending" ? "is-pending"
      : value === "rejected" || value === "declined" || value === "cancelled" ? "is-rejected"
      : value === "in review" || value === "review" ? "is-review"
      : value === "admin_review" ? "is-admin-review"
      : value === "paid" || value === "issued" ? "is-paid"
      : value === "part paid" ? "is-part"
      : value === "overdue" ? "is-overdue"
      : value === "draft" ? "is-draft"
      : value === "sent" ? "is-sent"
      : "";
  }
  function projectName(projectId) { return data.projects.find((item) => item.id === projectId)?.name || projectId || "—"; }
  function toast(message) { clearTimeout(toastTimer); document.getElementById("admin-toast-message").textContent = message; document.getElementById("admin-toast").classList.add("is-visible"); toastTimer = setTimeout(() => document.getElementById("admin-toast").classList.remove("is-visible"), 2800); }
  function openModal(id) { document.getElementById(id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(id) { document.getElementById(id).hidden = true; document.body.style.overflow = ""; }

  function milestoneLabel(status) {
    return {
      upcoming: "Upcoming",
      current: "In Progress",
      review: "Awaiting Client Review",
      admin_review: "Awaiting Geeslane Review",
      complete: "Complete"
    }[status] || status;
  }

  function requestStatusLabel(status) {
    return status === "In review" ? "Geeslane Reviewing" : status;
  }

  function phaseMeta(item) {
    const title = String(item?.title || "").toLowerCase();
    if (/discover/.test(title)) return { placeholder: "Ask about goals, audience, pages, or scope…", emailIntro: "Please answer the Discovery questions in Brief and Brand in your portal." };
    if (/brand/.test(title)) return { placeholder: "Ask about assets, or confirm the direction…", emailIntro: "Please check Brand and Content in your portal and tell us if anything should change." };
    if (/wire/.test(title)) return { placeholder: "Paste the wireframe link and what to check…", emailIntro: "Wireframes are ready. Please check the layout in your portal." };
    if (/visual|design/.test(title) && !/build|connect/.test(title)) return { placeholder: "Paste the Figma or preview link…", emailIntro: "The design is ready. Please leave notes in your portal." };
    if (/build|connect/.test(title)) return { placeholder: "Paste a test case or note what to connect…", emailIntro: "The workflow is ready to try. Please check it in your portal." };
    if (/setup|fix/.test(title)) return { placeholder: "Note access details or what still needs fixing…", emailIntro: "Please check that the setup is working, then approve it or list what is left." };
    if (/recommend/.test(title)) return { placeholder: "Share the recommendation and what to decide…", emailIntro: "The recommendation is ready. Please review it in your portal." };
    if (/develop/.test(title)) return { placeholder: "Paste the preview link and what to test…", emailIntro: "A preview is ready. Please try it and note any issues in your portal." };
    if (/qa|test/.test(title)) return { placeholder: "Note what to check before launch…", emailIntro: "Please do a final check. Approve to launch, or list what is left." };
    if (/launch|handover|next step/.test(title)) return { placeholder: "Note handover items or access details…", emailIntro: "Handover is ready. Please confirm you have what you need." };
    return { placeholder: "Ask a question or paste a preview link…", emailIntro: `${item?.title || "This stage"} is ready for your review.` };
  }

  function messageKindLabel(kind) {
    return { approval: "Approved", changes: "Changes requested", question: "Question", comment: "Note" }[kind] || "Note";
  }

  function noteHtml(body) {
    return escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const clean = url.replace(/[),.;]+$/, "");
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${url.slice(clean.length)}`;
    });
  }

  function requestSnippet(item) {
    const values = item.values || {};
    const bits = [values.decision, values.feedback, values.details, values.goal].map((value) => String(value || "").trim()).filter(Boolean);
    return bits.length ? bits.join(" · ").slice(0, 160) : "";
  }

  function latestDecision(milestoneId) {
    return milestoneMessages.filter((note) => note.milestoneId === milestoneId && (note.kind === "approval" || note.kind === "changes")).at(-1);
  }

  function contactForProject(projectId) {
    const project = data.projects.find((item) => item.id === projectId);
    const user = data.users.find((item) => item.clientId && item.clientId === project?.clientId) || data.users.find((item) => item.email && item.role === "client");
    return { project, user, email: user?.email || "", name: user?.name || "", phone: user?.phone || "" };
  }

  function openingPaymentFrom(form) {
    return {
      contractAmount: String(form?.elements?.contractAmount?.value || "").trim(),
      invoiceAmount: String(form?.elements?.invoiceAmount?.value || "").trim(),
      invoiceTitle: String(form?.elements?.invoiceTitle?.value || "").trim() || "Initial payment"
    };
  }

  function paymentsLink() {
    return window.GeeslaneMail?.portalLink("client", "payments", { next: "payments" }) || "https://geeslane.com/client-portal/?next=payments#payments";
  }

  function invoiceMailData(invoice, contact) {
    const balance = window.GeeslaneAPI.invoiceBalance(invoice) || {};
    return {
      ...invoice,
      projectName: contact?.project?.name || "",
      business: contact?.user?.business || contact?.business || "",
      clientName: portalName(contact?.name),
      remainingLabel: balance.remainingLabel || "",
      paidLabel: balance.paidLabel || "",
      bank: portalSettings
    };
  }

  async function documentAttachment(kind, data) {
    try {
      if (kind === "invoice") return await window.GeeslaneInvoice?.pdfAttachment?.(data) || null;
      return await window.GeeslaneReceipt?.pdfAttachment?.(data) || null;
    } catch (_) {
      return null;
    }
  }

  async function attachOpeningPayment(projectId, contact, opening) {
    if (!projectId || !opening) return null;
    const total = opening.contractAmount || opening.invoiceAmount;
    const amount = opening.invoiceAmount;
    if (total) {
      try {
        await window.GeeslaneAPI.adminSubmit("adminSetProjectBilling", {
          projectId,
          contractAmount: total,
          contractCurrency: "NGN",
          showPaymentSummary: true,
          onlinePayments: true
        });
      } catch (error) {
        toast(window.GeeslaneAPI.userFacingError(error, "Project was created, but totals could not be saved. Run project_payments.sql, then set billing on Payments."));
      }
    }
    if (!amount) return null;
    try {
      return await window.GeeslaneAPI.adminSubmit("adminSaveInvoice", {
        projectId,
        invoice: {
          title: opening.invoiceTitle,
          description: "Opening payment for this project",
          amount,
          currency: "NGN",
          status: "Sent"
        }
      });
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Project was created, but the first invoice could not be saved. Add it under Payments."));
      return null;
    }
  }

  async function notifyClient(email, heading, intro, rows, greetingName, extras = {}) {
    const phone = extras.sms === false ? "" : (extras.clientPhone || "");
    if (!email && !phone) return;
    await window.GeeslaneMail?.notify({
      audience: "client",
      subject: heading,
      heading,
      intro,
      rows: rows || [],
      greetingName,
      clientEmail: email,
      clientPhone: phone,
      replyTo: window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com",
      ctaPage: extras.ctaPage || "client",
      ctaUrl: extras.ctaUrl,
      ctaLabel: extras.ctaLabel || "Open your portal",
      attachments: extras.attachments || [],
      attachmentNote: extras.attachmentNote,
      blocks: extras.blocks || [],
      sms: extras.sms
    });
  }

  async function notifyTeam(heading, intro, rows, extras = {}) {
    await window.GeeslaneMail?.notify({
      audience: "team",
      subject: heading,
      heading,
      intro,
      rows: (rows || []).filter(Boolean),
      greeting: "Hi team,",
      ctaPage: extras.ctaPage || "admin",
      ctaUrl: extras.ctaUrl || window.GeeslaneMail?.portalLink("admin", "invoices"),
      ctaLabel: extras.ctaLabel || "Open Payments",
      attachments: extras.attachments || [],
      attachmentNote: extras.attachmentNote
    });
  }

  function invoicePayOnline() {
    return Boolean(window.GeeslaneAPI?.paystackEnabled?.());
  }

  function invoiceClientIntro(asPdf) {
    const attached = asPdf ? "Your invoice is attached as a PDF." : "Your invoice is attached.";
    if (invoicePayOnline()) return `${attached} You can pay in the portal, or transfer to the Geeslane account below.`;
    return `${attached} Transfer to the Geeslane account below.`;
  }

  function invoiceClientCta() {
    return invoicePayOnline() ? "Pay now" : "View invoice";
  }

  function bankMailRows() {
    const bank = portalSettings || {};
    return [
      bank.bankName ? ["Bank", bank.bankName] : null,
      bank.accountName ? ["Account name", bank.accountName] : null,
      bank.accountNumber ? ["Account number", bank.accountNumber] : null,
      bank.bankNotes ? ["Payment note", bank.bankNotes] : null
    ].filter(Boolean);
  }

  function installAppBlocks(email) {
    const signIn = String(email || "").trim()
      ? `sign in with ${String(email).trim()}`
      : "sign in with your email";
    return [
      {
        title: "Add Geeslane to your iPhone",
        body: `1. Open the portal link in Safari. Other iPhone browsers cannot add it to the home screen.\n2. Tap the Share button (the square with an arrow pointing up).\n3. Scroll the list and tap Add to Home Screen.\n4. Tap Add. The Geeslane icon will sit on your home screen like an app.\n5. Open it from there and ${signIn}. A 6 digit code is sent only then, not with this email.`
      },
      {
        title: "Add Geeslane to your Android phone",
        body: `1. Open the portal link in Chrome.\n2. Tap the menu (three dots) at the top right.\n3. Tap Install app or Add to Home screen.\n4. Tap Install. Geeslane will appear with your other apps.\n5. Open it and ${signIn}. A 6 digit code is sent only then, not with this email.`
      }
    ];
  }

  function clientDeviceConnected(user) {
    const record = (data.pushDevices || {})[user?.id] || {};
    return Boolean(record.client || record.team);
  }

  async function sendDeviceReminder(userId, button) {
    const user = data.users.find((item) => item.id === userId);
    if (!user?.email) { toast("This client does not have an email address yet."); return; }
    const project = data.projects.find((item) => item.clientId && item.clientId === user.clientId);
    const email = String(user.email).trim();
    const portalUrl = window.GeeslaneMail?.portalLink("client") || "https://geeslane.com/client-portal/";
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
    try {
      await notifyClient(
        email,
        "Keep Geeslane on your phone",
        `Your Geeslane portal is easier to use from your home screen. Updates, invoices, and comments reach you faster, and you will not have to hunt for the website each time.\n\nOpen your portal, enter ${email}, and follow the steps below to add Geeslane to your phone. Allow notifications when your phone asks, so you do not miss a payment or a review request.`,
        [
          ["Sign in email", email],
          project?.name ? ["Project", project.name] : null
        ].filter(Boolean),
        user.name,
        {
          ctaUrl: portalUrl,
          ctaLabel: "Open your portal",
          blocks: installAppBlocks(email),
          sms: false
        }
      );
      toast("Device reminder emailed");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "The reminder could not be sent."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function sendBillingMails(kind, { contact, invoice, receipt, attachment }) {
    const attachments = attachment ? [attachment] : [];
    const paymentsUrl = window.GeeslaneMail?.portalLink("client", "payments", { next: "payments" });
    const adminUrl = window.GeeslaneMail?.portalLink("admin", "invoices");
    const name = contact?.name || "";
    const email = contact?.email || "";
    const project = contact?.project?.name || "";
    if (kind === "invoice") {
      await notifyClient(email, "Your invoice", invoiceClientIntro(false), [
        ["Invoice", invoice?.reference],
        ["Amount due", window.GeeslaneAPI.invoiceBalance(invoice)?.remainingLabel || moneyLabel(invoice)],
        ["Due", invoice?.dueDate ? formatDate(invoice.dueDate) : ""],
        ...bankMailRows()
      ], name, {
        ctaUrl: paymentsUrl,
        ctaLabel: invoiceClientCta(),
        attachments,
        attachmentNote: attachment ? "The invoice PDF is attached." : "",
        sms: false
      });
      await notifyTeam("Invoice sent", `${name || email || "A client"} was sent invoice ${invoice?.reference || ""}.`, [
        ["Client", name],
        ["Email", email],
        ["Invoice", invoice?.reference],
        ["Project", project],
        ["Amount", moneyLabel(invoice)]
      ], { ctaUrl: adminUrl, attachments });
      return;
    }
    await notifyClient(email, "Payment received", "Thank you. We have received your payment, and your receipt is attached.", [
      ["Receipt", receipt?.reference],
      ["Amount", moneyLabel(receipt)],
      ["Date", receipt?.paidOn ? formatDate(receipt.paidOn) : ""],
      ["Method", receipt?.method]
    ], name, {
      ctaUrl: paymentsUrl,
      ctaLabel: "Open your portal",
      attachments
    });
    await notifyTeam("Payment received", `${name || email || "A client"} paid ${moneyLabel(receipt) || "an invoice"}.`, [
      ["Client", name],
      ["Email", email],
      ["Receipt", receipt?.reference],
      ["Invoice", receipt?.invoiceReference],
      ["Amount", moneyLabel(receipt)],
      ["Method", receipt?.method]
    ], { ctaUrl: adminUrl, attachments });
  }

  async function sendPortalReadyMail(contact, invoice, kind = "welcome") {
    const attachment = invoice ? await documentAttachment("invoice", invoiceMailData(invoice, contact)) : null;
    const isProject = kind === "project";
    const portalUrl = window.GeeslaneMail?.portalLink("client") || "https://geeslane.com/client-portal/";
    const paymentsUrl = paymentsLink();
    if (!isProject) {
      const email = String(contact.email || "").trim();
      await notifyClient(
        contact.email,
        "Welcome to your Geeslane portal",
        email
          ? `Your client portal is ready. Bookmark the link below.\n\nOpen it, enter ${email}, and we will send a 6 digit code. There is no password, and this email does not include a sign in code.\n\nAdd Geeslane to your phone so updates and invoices stay close at hand.`
          : "Your client portal is ready. Bookmark the link below.\n\nOpen it, enter your email, and we will send a 6 digit code. There is no password, and this email does not include a sign in code.\n\nAdd Geeslane to your phone so updates and invoices stay close at hand.",
        [
          ["Project", contact.project?.name],
          email ? ["Sign in email", email] : null
        ].filter(Boolean),
        contact.name,
        {
          ctaUrl: portalUrl,
          ctaLabel: "Open your portal",
          blocks: installAppBlocks(email),
          sms: false
        }
      );
    } else {
      const email = String(contact.email || "").trim();
      await notifyClient(
        contact.email,
        "A new project is in your portal",
        email
          ? `We have added a new project for you. Open your portal with ${email}. Your invoice is in a separate email.`
          : "We have added a new project for you. Open your portal with the email you use to sign in. Your invoice is in a separate email.",
        [["Project", contact.project?.name], email ? ["Sign in email", email] : null].filter(Boolean),
        contact.name,
        {
          ctaUrl: portalUrl,
          ctaLabel: "Open your portal",
          sms: false
        }
      );
    }
    if (invoice) {
      await notifyClient(
        contact.email,
        "Your invoice",
        invoiceClientIntro(true),
        [
          ["Project", contact.project?.name],
          ["Invoice", invoice.reference],
          ["Amount due", window.GeeslaneAPI.invoiceBalance(invoice)?.remainingLabel || moneyLabel(invoice)],
          invoice.dueDate ? ["Due", formatDate(invoice.dueDate)] : null,
          ...bankMailRows()
        ].filter(Boolean),
        contact.name,
        {
          ctaUrl: paymentsUrl,
          ctaLabel: invoiceClientCta(),
          attachments: attachment ? [attachment] : [],
          attachmentNote: attachment ? "The invoice PDF is attached." : "",
          sms: false
        }
      );
      await notifyTeam("Invoice sent", `${contact.name || contact.email || "A client"} was invited and sent invoice ${invoice.reference || ""}.`, [
        ["Client", contact.name],
        ["Email", contact.email],
        ["Project", contact.project?.name],
        ["Invoice", invoice.reference],
        ["Amount", moneyLabel(invoice)]
      ], { attachments: attachment ? [attachment] : [] });
    }
  }

  function prettyFirst(name) {
    const value = String(name || "").trim().split(/\s+/)[0];
    if (!value || /^a$/i.test(value) || /^there$/i.test(value)) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function portalName(name, fallback = "") {
    return window.GeeslaneMail?.portalName?.(name) || String(name || "").trim() || fallback;
  }

  function namedHeading(name, heading) {
    const formal = window.GeeslaneMail?.respectfulName(name) || prettyFirst(name);
    return formal ? `${formal}, ${heading}` : heading;
  }

  function showAuthFeedback(message, type = "error") {
    const node = document.getElementById("admin-auth-feedback");
    node.textContent = message;
    node.className = `auth-feedback is-${type}`;
    node.hidden = false;
  }

  const ADMIN_COMMENT_ROUTE_KEY = "geeslane-admin-comment-route";

  function rememberAdminCommentRoute() {
    const route = parseAdminHash();
    if (route.params.get("project") || route.params.get("milestone") || route.params.get("note")) {
      sessionStorage.setItem(ADMIN_COMMENT_ROUTE_KEY, location.hash);
    }
  }

  function restoreAdminCommentRoute() {
    const saved = sessionStorage.getItem(ADMIN_COMMENT_ROUTE_KEY);
    if (saved && !(parseAdminHash().params.get("project") || parseAdminHash().params.get("milestone") || parseAdminHash().params.get("note"))) {
      history.replaceState(null, "", `${location.pathname}${location.search}${saved}`);
    }
    sessionStorage.removeItem(ADMIN_COMMENT_ROUTE_KEY);
  }

  function parseAdminHash() {
    const raw = String(location.hash || "").replace(/^#/, "");
    if (!raw || /access_token|refresh_token|type=magiclink|error_description/.test(raw)) {
      return { page: "", params: new URLSearchParams() };
    }
    const split = raw.indexOf("?");
    const page = (split >= 0 ? raw.slice(0, split) : raw).split("/")[0];
    const params = new URLSearchParams(split >= 0 ? raw.slice(split + 1) : "");
    return { page, params };
  }

  function openAdminSidebar() {
    document.getElementById("admin-sidebar")?.classList.add("is-open");
    document.getElementById("admin-sidebar-scrim")?.classList.add("is-visible");
  }

  function closeAdminSidebar() {
    document.getElementById("admin-sidebar")?.classList.remove("is-open");
    document.getElementById("admin-sidebar-scrim")?.classList.remove("is-visible");
  }

  function writeHash(page, params) {
    const query = params && String(params) ? `?${params}` : "";
    const next = `#${page}${query}`;
    if (`#${String(location.hash || "").replace(/^#/, "")}` !== next) history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }

  function navigate(page, options = {}) {
    if (!pageTitles[page]) return;
    document.querySelectorAll("[data-admin-view]").forEach((view) => view.classList.toggle("is-visible", view.dataset.adminView === page));
    document.querySelectorAll("[data-admin-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminPage === page));
    document.getElementById("admin-page-title").textContent = pageTitles[page];
    closeAdminSidebar();
    if (options.keepHash) writeHash(page, parseAdminHash().params);
    else writeHash(page);
    if (page === "files") loadProjectMaterials();
    if (page === "agreements") loadAgreement();
    if (page === "invoices") loadInvoices();
    if (page === "milestones") renderMilestones();
  }

  function focusAdminComment() {
    const { params } = parseAdminHash();
    const milestoneId = params.get("milestone") || "";
    const noteId = params.get("note") || "";
    const node = (noteId && document.getElementById(`note-${noteId}`))
      || (milestoneId && document.getElementById(`admin-milestone-${milestoneId}`));
    if (!node) return;
    node.classList.add("is-target");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("is-target"), 4000);
  }

  function renderMetrics() {
    document.getElementById("metric-pending").textContent = data.metrics.pending || 0;
    document.getElementById("metric-clients").textContent = data.metrics.clients || 0;
    document.getElementById("metric-projects").textContent = data.metrics.projects || 0;
    document.getElementById("metric-requests").textContent = data.metrics.openRequests || 0;
    document.getElementById("pending-nav-count").textContent = data.metrics.pending || 0;
  }

  function compactRows(items, type) {
    if (!items.length) return '<div class="table-empty">Nothing needs attention here.</div>';
    return items.map((item) => type === "registration"
      ? `<div class="admin-list-row"><div><strong>${escapeHtml(portalName(item.name, item.name))} · ${escapeHtml(item.business)}</strong><small>${escapeHtml(item.service)} · ${formatDate(item.createdAt)}</small></div><button class="button button-secondary" type="button" data-review-registration="${escapeHtml(item.id)}">Review</button></div>`
      : `<div class="admin-list-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([projectName(item.projectId), requestSnippet(item) || formatDate(item.createdAt)].filter(Boolean).join(" · "))}</small></div><span class="status-pill ${statusClass(item.status)}">${escapeHtml(requestStatusLabel(item.status))}</span></div>`).join("");
  }

  function renderOverview() {
    const pending = data.registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").slice(0, 5);
    document.getElementById("overview-registrations").innerHTML = compactRows(pending, "registration");
    document.getElementById("overview-requests").innerHTML = compactRows(data.requests.slice(0, 5), "request");
    wireRegistrationButtons(document.getElementById("overview-registrations"));
  }

  function renderRegistrations() {
    const query = document.getElementById("registration-search").value.trim().toLowerCase();
    const rows = data.registrations.filter((item) => `${item.name} ${item.business} ${item.email} ${item.service} ${item.status}`.toLowerCase().includes(query));
    const slice = pagedRows("registrations", rows);
    document.getElementById("registrations-table").innerHTML = slice.items.length ? slice.items.map((item) => `<tr><td><strong>${escapeHtml(portalName(item.name, item.name))}</strong><small>${escapeHtml(item.business)} · ${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.service)}</td><td>${formatDate(item.createdAt)}</td><td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${String(item.status || "").toLowerCase() === "pending" ? `<button class="button button-secondary" type="button" data-review-registration="${escapeHtml(item.id)}">Review</button>` : ""}</td></tr>`).join("") : '<tr><td class="table-empty" colspan="5">No access requests match this search.</td></tr>';
    drawPager("registrations-pager", "registrations", slice, renderRegistrations);
    wireRegistrationButtons(document.getElementById("registrations-table"));
  }

  function renderClients() {
    const query = document.getElementById("client-search").value.trim().toLowerCase();
    const rows = data.users.filter((item) => `${item.name} ${item.business} ${item.email} ${item.role} ${item.status}`.toLowerCase().includes(query));
    const slice = pagedRows("clients", rows);
    document.getElementById("clients-table").innerHTML = slice.items.length ? slice.items.map((item) => {
      const connected = clientDeviceConnected(item);
      const deviceCell = connected
        ? `<span class="status-pill is-paid">Connected</span>`
        : `<span class="status-pill is-pending">Not connected</span>`;
      const remind = !connected && item.status === "active" && item.role !== "admin"
        ? `<button class="button button-secondary" type="button" data-remind-device="${escapeHtml(item.id)}">Send reminder</button>`
        : "";
      return `<tr><td><strong>${escapeHtml(portalName(item.name, "Unnamed User"))}</strong><small>${escapeHtml(item.business || "—")}</small></td><td>${escapeHtml(item.email)}<small>${escapeHtml(item.phone || "")}</small></td><td>${escapeHtml(item.role)}</td><td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${deviceCell}</td><td>${formatDate(item.lastLoginAt)}</td><td><div class="admin-table-actions">${item.clientId ? `<button class="button button-secondary" type="button" data-add-project-client="${escapeHtml(item.clientId)}">Add Project</button>` : ""}${item.status === "active" ? `<button class="button button-secondary" type="button" data-send-invite="${escapeHtml(item.id)}">Send Code</button>` : ""}${remind}</div></td></tr>`;
    }).join("") : '<tr><td class="table-empty" colspan="7">No clients match this search.</td></tr>';
    drawPager("clients-pager", "clients", slice, renderClients);
    document.querySelectorAll("[data-send-invite]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try { await mutate("adminSendSignIn", { userId: button.dataset.sendInvite }, "Sign-in code emailed"); }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "The sign-in email could not be sent.")); button.disabled = false; }
    }));
    document.querySelectorAll("[data-add-project-client]").forEach((button) => button.addEventListener("click", () => openAddProject(button.dataset.addProjectClient)));
    document.querySelectorAll("[data-remind-device]").forEach((button) => button.addEventListener("click", () => sendDeviceReminder(button.dataset.remindDevice, button)));
  }

  function renderProjects() {
    const query = document.getElementById("project-search").value.trim().toLowerCase();
    const rows = data.projects.filter((item) => `${item.name} ${item.service} ${item.stage} ${item.status}`.toLowerCase().includes(query));
    const slice = pagedRows("projects", rows);
    document.getElementById("projects-table").innerHTML = slice.items.length ? slice.items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.id)}</small></td><td>${escapeHtml(item.service)}</td><td>${escapeHtml(item.stage)}</td><td class="progress-cell"><strong>${item.progress}%</strong><div class="progress-mini"><span style="width:${Math.max(0,Math.min(100,item.progress))}%"></span></div></td><td><span class="status-pill">${escapeHtml(item.status)}</span></td><td><label class="admin-active-toggle"><input type="checkbox" data-project-active="${escapeHtml(item.id)}" ${item.isActive !== false ? "checked" : ""} /><span>${item.isActive !== false ? "Active" : "Paused"}</span></label></td><td><input class="table-date-input" type="date" data-project-start="${escapeHtml(item.id)}" value="${escapeHtml(dateInputValue(item.startDate))}" aria-label="Start date for ${escapeHtml(item.name)}" /></td><td><input class="table-date-input" type="date" data-project-target="${escapeHtml(item.id)}" min="${todayInputValue()}" value="${escapeHtml(dateInputValue(item.targetDate))}" aria-label="Projected completion for ${escapeHtml(item.name)}" /></td><td>${rowActions([{ label: "Brand & Files", attrs: `data-open-files="${escapeHtml(item.id)}"` }, { label: "Agreement", attrs: `data-open-agreement="${escapeHtml(item.id)}"` }, { label: "Payments", attrs: `data-open-invoices="${escapeHtml(item.id)}"` }])}</td></tr>`).join("") : '<tr><td class="table-empty" colspan="9">No projects match this search.</td></tr>';
    drawPager("projects-pager", "projects", slice, renderProjects);
    document.querySelectorAll("[data-open-files]").forEach((button) => button.addEventListener("click", () => openProjectFiles(button.dataset.openFiles)));
    document.querySelectorAll("[data-open-agreement]").forEach((button) => button.addEventListener("click", () => openAgreement(button.dataset.openAgreement)));
    document.querySelectorAll("[data-open-invoices]").forEach((button) => button.addEventListener("click", () => openInvoices(button.dataset.openInvoices)));
    document.querySelectorAll("[data-project-active]").forEach((input) => {
      input.addEventListener("change", () => setProjectActive(input.dataset.projectActive, input.checked));
    });
    document.querySelectorAll("[data-project-start]").forEach((input) => {
      input.addEventListener("change", () => saveProjectDates(input.dataset.projectStart, { startDate: input.value }));
    });
    document.querySelectorAll("[data-project-target]").forEach((input) => {
      const project = data.projects.find((item) => item.id === input.dataset.projectTarget);
      constrainDateInput(input, project?.targetDate);
      input.addEventListener("change", () => saveProjectDates(input.dataset.projectTarget, { targetDate: input.value }));
    });
  }

  function options(values, selected) { return values.map((value) => `<option${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join(""); }
  function requestStatusOptions(selected) {
    return requestStatuses.map((status) => `<option value="${escapeHtml(status)}"${status === selected ? " selected" : ""}>${escapeHtml(requestStatusLabel(status))}</option>`).join("");
  }

  function renderRequests() {
    const query = document.getElementById("admin-request-search").value.trim().toLowerCase();
    const rows = data.requests.filter((item) => `${item.title} ${item.id} ${item.type} ${item.status} ${projectName(item.projectId)} ${requestSnippet(item)}`.toLowerCase().includes(query));
    const slice = pagedRows("requests", rows);
    document.getElementById("admin-requests-table").innerHTML = slice.items.length ? slice.items.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(requestSnippet(item) || item.reference || item.id)}</small></td><td>${escapeHtml(projectName(item.projectId))}</td><td>${escapeHtml(item.type)}</td><td>${formatDate(item.createdAt)}</td><td><select class="table-status-select" data-request-status="${escapeHtml(item.id)}">${requestStatusOptions(item.status)}</select></td><td><button class="button button-secondary" type="button" data-save-request="${escapeHtml(item.id)}">Save</button></td></tr>`).join("") : '<tr><td class="table-empty" colspan="6">No requests match this search.</td></tr>';
    drawPager("requests-pager", "requests", slice, renderRequests);
    document.querySelectorAll("[data-save-request]").forEach((button) => button.addEventListener("click", async () => {
      const select = document.querySelector(`[data-request-status="${CSS.escape(button.dataset.saveRequest)}"]`);
      button.disabled = true;
      try {
        const requestId = button.dataset.saveRequest;
        const status = select.value;
        const result = await mutate("adminUpdateRequest", { requestId, status }, "Request updated");
        const request = data.requests.find((item) => item.id === (result?.requestId || requestId));
        if (request) request.status = result?.status || status;
        (result?.milestones || []).forEach((change) => {
          const milestone = data.milestones.find((item) => item.projectId === request?.projectId && item.id === change.id);
          if (milestone) milestone.status = change.status;
        });
        applyProjectUpdate(result?.projectUpdate);
        const contact = contactForProject(request?.projectId);
        notifyClient(contact.email, "An update on your request", `“${request?.title || "Your request"}” is now ${requestStatusLabel(status)}. You can see the latest status in your portal.`, [
          ["Project", contact.project?.name],
          ["Status", requestStatusLabel(status)]
        ], contact.name, {
          ctaUrl: window.GeeslaneMail?.portalLink("client", "requests"),
          ctaLabel: "View this request"
        });
        refreshLocalMetrics(); renderMetrics(); renderOverview(); renderProjects(); renderRequests(); renderMilestones();
      }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not save that change.")); button.disabled = false; }
    }));
  }

  async function renderMilestones(options = {}) {
    const filter = document.getElementById("milestone-project-filter");
    const hashProject = parseAdminHash().params.get("project");
    const previous = filter.value || (data.projects.some((project) => project.id === hashProject) ? hashProject : "");
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
    const projectId = filter.value;
    if (!options.keepMessages) await loadMilestoneContext(projectId);
    const project = data.projects.find((item) => item.id === projectId) || null;
    syncStageOptions(project);
    syncProjectDates(project);
    const rows = data.milestones.filter((item) => item.projectId === projectId && window.GeeslaneAPI.milestoneIsIncluded(item, project)).sort((a,b) => a.sortOrder - b.sortOrder);
    if (!options.keepMessages) {
      try { milestoneMessages = projectId ? await window.GeeslaneAPI.adminMilestoneMessages(projectId) : []; }
      catch (_) { milestoneMessages = []; }
    }
    const hashMilestone = parseAdminHash().params.get("milestone");
    if (adminOpenProjectId !== projectId) {
      adminOpenProjectId = projectId;
      adminOpenIds = new Set(rows.filter((item) => item.status === "current" || item.status === "review" || item.status === "admin_review" || item.id === hashMilestone).map((item) => item.id));
    }
    if (hashMilestone) adminOpenIds.add(hashMilestone);
    const weights = relativeWeights(rows);
    document.getElementById("admin-milestone-list").innerHTML = rows.length ? rows.map((item,index) => {
      const notes = milestoneMessages.filter((note) => note.milestoneId === item.id);
      const meta = phaseMeta(item);
      const decision = latestDecision(item.id);
      const open = adminOpenIds.has(item.id);
      const noteLabel = notes.length ? `${notes.length} comment${notes.length === 1 ? "" : "s"}` : "No Comments";
      const banner = item.status === "admin_review"
        ? `<p class="admin-decision is-approval">The client replied${decision ? ` (${messageKindLabel(decision.kind).toLowerCase()})` : ""}. Answer here, then set Complete or Awaiting Client Review.</p>`
        : decision && item.status === "review"
        ? `<p class="admin-decision is-${escapeHtml(decision.kind)}">${decision.kind === "approval" ? "The client approved this. Set Complete when you are ready." : "The client asked for changes. Reply here, then set In Progress."}</p>`
        : "";
      const thread = notes.length
        ? notes.map((note) => `<article class="thread-note is-${escapeHtml(note.role)} is-${escapeHtml(note.kind)}" id="note-${escapeHtml(note.id)}"><header><strong>${escapeHtml(portalName(note.name, note.name || (note.role === "admin" ? "Geeslane" : "Client")))}</strong><span>${escapeHtml(messageKindLabel(note.kind))} · ${formatDate(note.createdAt)}</span></header><p>${noteHtml(note.body)}</p></article>`).join("")
        : `<p class="thread-empty">No comments yet.</p>`;
      return `<div class="admin-milestone is-${escapeHtml(item.status)}${decision ? ` has-${escapeHtml(decision.kind)}` : ""}${open ? " is-open" : ""}" id="admin-milestone-${escapeHtml(item.id)}">
        <div class="admin-milestone-top">
          <button class="admin-milestone-toggle" type="button" data-toggle-admin-milestone="${escapeHtml(item.id)}" aria-expanded="${open ? "true" : "false"}">
            <span class="admin-milestone-index">${String(index+1).padStart(2,"0")}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${weights[index]}% · ${noteLabel}</small>
            <span class="admin-milestone-chevron" aria-hidden="true"></span>
          </button>
          <select class="table-status-select" data-milestone-status="${escapeHtml(item.id)}">${milestoneStatuses.map((status) => `<option value="${escapeHtml(status)}"${status === item.status ? " selected" : ""}>${escapeHtml(milestoneLabel(status))}</option>`).join("")}</select>
          <button class="button button-secondary" type="button" data-save-milestone="${escapeHtml(item.id)}">Save Status</button>
        </div>
        ${open ? `<div class="admin-milestone-body">
          ${banner}
          <div class="admin-thread">${thread}</div>
          <form class="thread-compose" data-admin-thread="${escapeHtml(item.id)}"><label class="field"><span>Note to Client</span><textarea name="body" rows="3" maxlength="4000" placeholder="${escapeHtml(meta.placeholder)}"></textarea></label><button class="button button-primary" type="submit">Send Note</button></form>
        </div>` : ""}
      </div>`;
    }).join("") : '<div class="table-empty">Choose a project with milestones.</div>';
    document.querySelectorAll("[data-toggle-admin-milestone]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.toggleAdminMilestone;
      if (adminOpenIds.has(id)) adminOpenIds.delete(id);
      else adminOpenIds.add(id);
      renderMilestones({ keepMessages: true });
    }));
    document.querySelectorAll("[data-save-milestone]").forEach((button) => button.addEventListener("click", async () => {
      const select = document.querySelector(`[data-milestone-status="${CSS.escape(button.dataset.saveMilestone)}"]`);
      button.disabled = true;
      try {
        const milestoneId = button.dataset.saveMilestone;
        const status = select.value;
        const result = await mutate("adminUpdateMilestone", { projectId, milestoneId, status }, "Milestone and progress updated");
        const milestone = data.milestones.find((item) => item.projectId === projectId && item.id === (result?.milestoneId || milestoneId));
        if (milestone) milestone.status = result?.status || status;
        applyProjectUpdate(result?.projectUpdate);
        const contact = contactForProject(projectId);
        const nextStatus = result?.status || status;
        const ready = nextStatus === "review";
        const waitingOnUs = nextStatus === "admin_review";
        const heading = ready
          ? `${milestone?.title || "This stage"} is ready for your review`
          : waitingOnUs
          ? `${milestone?.title || "This stage"} is with Geeslane for review`
          : `${milestone?.title || "This stage"} update`;
        const intro = ready
          ? phaseMeta(milestone).emailIntro
          : waitingOnUs
          ? `Thank you. Geeslane is reading your ${milestone?.title || "project"} notes.`
          : `${milestone?.title || "This stage"} is now ${milestoneLabel(nextStatus).toLowerCase()}.`;
        const note = String(document.querySelector(`[data-admin-thread="${CSS.escape(milestoneId)}"] textarea`)?.value || "").trim();
        let noteId = "";
        if (ready && note.length > 1) {
          try {
            const saved = await window.GeeslaneAPI.adminSubmit("adminAddMilestoneMessage", { milestoneId, body: note, kind: "question" });
            if (saved) {
              milestoneMessages.push(saved);
              noteId = saved.id || "";
            }
          } catch (_) { /* status still saved */ }
        }
        notifyClient(contact.email, heading, intro, [
          ["Project", contact.project?.name],
          ["Status", milestoneLabel(nextStatus)]
        ], contact.name, {
          clientPhone: contact.phone,
          ctaUrl: window.GeeslaneMail?.commentLink({ audience: "client", milestoneId, noteId }),
          ctaLabel: noteId ? "View this comment" : "View this stage"
        });
        renderProjects(); renderMilestones();
      }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not save that change.")); button.disabled = false; }
    }));
    document.querySelectorAll("[data-admin-thread]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = String(new FormData(form).get("body") || "").trim();
      if (body.length < 2) { toast("Write a short note first."); return; }
      const button = form.querySelector("button");
      window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
      try {
        const saved = await mutate("adminAddMilestoneMessage", { milestoneId: form.dataset.adminThread, body, kind: "comment" }, "Note sent to the client");
        if (saved) milestoneMessages.push(saved);
        const milestone = data.milestones.find((item) => item.id === form.dataset.adminThread);
        const contact = contactForProject(projectId);
        notifyClient(
          contact.email,
          `A new comment on ${milestone?.title || "your project"}`,
          `Geeslane left a comment on ${milestone?.title || "your project"}. Open the link to read it.`,
          [["Project", contact.project?.name], ["Stage", milestone?.title], ["Comment", body]],
          contact.name,
          {
            clientPhone: contact.phone,
            ctaUrl: window.GeeslaneMail?.commentLink({ audience: "client", milestoneId: form.dataset.adminThread, noteId: saved?.id || "" }),
            ctaLabel: "View this comment"
          }
        );
        form.reset();
        renderMilestones();
      } catch (error) {
        toast(window.GeeslaneAPI.userFacingError(error, "The note could not be sent."));
      } finally {
        window.GeeslaneAPI.setButtonBusy(button, false);
      }
    }));
    requestAnimationFrame(focusAdminComment);
  }

  function fileSlug(value) {
    return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  }

  function detailList(rows) {
    const filled = rows.filter((row) => row && String(row[1] || "").trim());
    if (!filled.length) return '<p class="table-empty">Nothing saved here yet.</p>';
    return `<dl class="admin-detail-list">${filled.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
  }

  function discoveryRows(discovery, extra = []) {
    const item = discovery || {};
    return [
      ["Service", item.serviceLabel],
      ["Location", item.location],
      ["Industry", item.industry],
      ["Website URL", item.websiteUrl || item.existingUrl || item.supportUrl],
      ["Social Media", item.socialLinks],
      ["Business Description", item.businessDescription],
      ["How they heard", item.heardAbout],
      ["Purpose", item.purpose],
      ["Audience", item.audience],
      ["Features", item.features],
      ["Other features", item.featuresOther],
      ["Visitor details", item.visitorDetails || item.visitorsCanDo],
      ["Domain", item.hasDomain],
      ["Hosting", item.hasHosting],
      ["Assets ready", item.availableAssets],
      ["References", item.references],
      ["Existing site", item.existingUrl],
      ["What is not working", item.notWorking],
      ["Changes wanted", item.changesWanted],
      ["Improvement types", item.improvementTypes],
      ["Admin access", item.adminAccess],
      ["Domain name", item.domainName],
      ["Hosting help", item.hostingHelp],
      ["Issue", item.issue],
      ["Support needed", item.supportNeeds],
      ["Urgent", item.urgent],
      ["Current support", item.currentSupport],
      ["What should be automated", item.automationNeed],
      ["Tools or systems", item.automationTools],
      ["Automation success", item.automationSuccess],
      ["Business problem", item.businessProblem],
      ["Success in 6–12 months", item.successLookLike],
      ["Timing", item.timing],
      ["Anything else", item.anythingElse],
      ...extra
    ];
  }

  function renderFilesFilter() {
    const filter = document.getElementById("files-project-filter");
    if (!filter) return;
    const previous = filter.value || materials.projectId;
    if (!data.projects.length) {
      filter.innerHTML = '<option value="">No Projects Yet</option>';
      return;
    }
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
  }

  function filledCount(source, keys) {
    return keys.filter((key) => String(source?.[key] || "").trim()).length;
  }

  async function loadMilestoneContext(projectId) {
    const node = document.getElementById("admin-milestone-context");
    if (!node) return;
    if (!projectId) {
      node.innerHTML = '<p class="table-empty">Choose a project to see client details, the brief, brand, and files.</p>';
      return;
    }
    const filesFilter = document.getElementById("files-project-filter");
    if (filesFilter) filesFilter.value = projectId;
    if (materials.projectId !== projectId) {
      try { materials = await window.GeeslaneAPI.adminProjectMaterials(projectId); }
      catch (_) { materials = { projectId, brand: null, content: null, brief: null, files: [] }; }
    }
    const contact = contactForProject(projectId);
    const user = contact.user || {};
    const brief = materials.brief || {};
    const brand = materials.brand || {};
    const content = materials.content || {};
    const files = materials.files || [];
    const contentKeys = ["headline", "introduction", "about", "services", "testimonials", "callToAction", "contactDetails", "extraNotes"];
    const contentReady = filledCount(content, contentKeys);
    const fileList = files.length
      ? `<ul class="admin-file-mini">${files.slice(0, 4).map((item) => `<li>${escapeHtml(item.name)}</li>`).join("")}${files.length > 4 ? `<li>+${files.length - 4} more</li>` : ""}</ul>`
      : '<p class="admin-context-empty">No files yet.</p>';
    node.innerHTML = `
      <details class="admin-context-fold"${adminContextOpen ? " open" : ""}>
        <summary class="admin-context-summary">
          <div><p class="eyebrow">Project</p><h2>Client, Brief &amp; Files</h2></div>
          <span class="admin-context-chevron" aria-hidden="true"></span>
        </summary>
        <div class="admin-context-grid">
        <details class="admin-context-panel"${adminContextClosed.has("client") ? "" : " open"} data-context-panel="client">
          <summary class="admin-context-summary">
            <div><p class="eyebrow">Client</p><h2>${escapeHtml(portalName(contact.name, "Client"))}</h2></div>
            <span class="admin-context-chevron" aria-hidden="true"></span>
          </summary>
          ${detailList([
            ["Business", user.business],
            ["Email", contact.email],
            ["Phone", contact.phone],
            ["Contact", user.contact]
          ])}
        </details>
        <details class="admin-context-panel"${adminContextClosed.has("brief") ? "" : " open"} data-context-panel="brief">
          <summary class="admin-context-summary">
            <div><p class="eyebrow">Discovery</p><h2>Project Brief</h2></div>
            <span class="admin-context-chevron" aria-hidden="true"></span>
          </summary>
          ${detailList(discoveryRows(brief, [
            ["What they want to achieve", brief.goal]
          ]))}
        </details>
        <details class="admin-context-panel"${adminContextClosed.has("brand") ? "" : " open"} data-context-panel="brand">
          <summary class="admin-context-summary">
            <div><p class="eyebrow">Brand</p><h2>Brand &amp; Files</h2></div>
            <span class="admin-context-chevron" aria-hidden="true"></span>
          </summary>
          <div class="admin-brand-swatches">
            <span style="background:${escapeHtml(brand.primaryColor || "#0B6B45")}"></span>
            <span style="background:${escapeHtml(brand.secondaryColor || "#FFFFFF")}"></span>
            <span style="background:${escapeHtml(brand.accentColor || "#C83B3B")}"></span>
          </div>
          ${detailList([
            ["Fonts", [brand.headingFont, brand.bodyFont].filter(Boolean).join(" / ")],
            ["Personality", brand.personality],
            ["Website copy", `${contentReady} of ${contentKeys.length} fields`],
            ["Files", `${files.length} uploaded`]
          ])}
          ${fileList}
          <button class="button button-secondary full-button" type="button" data-open-files="${escapeHtml(projectId)}">Open Brand &amp; Files</button>
        </details>
        </div>
      </details>`;
    const fold = node.querySelector(".admin-context-fold");
    fold?.addEventListener("toggle", () => { adminContextOpen = fold.open; });
    node.querySelectorAll("[data-context-panel]").forEach((panel) => {
      panel.addEventListener("toggle", () => {
        if (panel.open) adminContextClosed.delete(panel.dataset.contextPanel);
        else adminContextClosed.add(panel.dataset.contextPanel);
      });
    });
    node.querySelectorAll("[data-open-files]").forEach((button) => button.addEventListener("click", () => openProjectFiles(button.dataset.openFiles)));
  }

  function currentMaterialsProject() {
    return data.projects.find((item) => item.id === (document.getElementById("files-project-filter")?.value || materials.projectId));
  }

  function renderMaterials() {
    const brand = materials.brand || {};
    const content = materials.content || {};
    const brief = materials.brief || {};
    const briefNode = document.getElementById("admin-brief-panel");
    const brandNode = document.getElementById("admin-brand-panel");
    const contentNode = document.getElementById("admin-content-panel");
    const filesNode = document.getElementById("admin-files-panel");
    if (!briefNode || !brandNode || !contentNode || !filesNode) return;
    briefNode.innerHTML = detailList(discoveryRows(brief, [
      ["What they want to achieve", brief.goal]
    ]));
    brandNode.innerHTML = `
      <div class="admin-brand-swatches">
        <span style="background:${escapeHtml(brand.primaryColor || "#0B6B45")}"></span>
        <span style="background:${escapeHtml(brand.secondaryColor || "#FFFFFF")}"></span>
        <span style="background:${escapeHtml(brand.accentColor || "#C83B3B")}"></span>
      </div>
      ${detailList([
        ["Primary colour", brand.primaryColor],
        ["Secondary colour", brand.secondaryColor],
        ["Accent colour", brand.accentColor],
        ["Heading font", brand.headingFont],
        ["Body font", brand.bodyFont],
        ["Personality", brand.personality],
        ["Style notes", brand.styleNotes],
        ["Reference links", brand.referenceLinks]
      ])}`;
    contentNode.innerHTML = detailList([
      ["Headline", content.headline],
      ["Introduction", content.introduction],
      ["About", content.about],
      ["Services", content.services],
      ["Testimonials", content.testimonials],
      ["Call to action", content.callToAction],
      ["Contact details", content.contactDetails],
      ["Additional notes", content.extraNotes]
    ]);
    filesNode.innerHTML = materials.files.length
      ? materials.files.map((item) => {
        const pdf = /\.pdf($|\?)/i.test(item.name || "") || /pdf/i.test(item.type || "");
        return `<div class="admin-file-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type || "File")} · ${formatDate(item.createdAt)}</small></div><div class="admin-file-actions">${item.url ? `<button class="button button-secondary" type="button" data-view-file="${escapeHtml(item.id)}">View</button>` : ""}<button class="button button-secondary" type="button" data-download-file="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>${pdf ? "Download PDF" : "Download"}</button></div></div>`;
      }).join("")
      : '<p class="table-empty">No logos or files have been uploaded for this project yet.</p>';
    filesNode.querySelectorAll("[data-view-file]").forEach((button) => button.addEventListener("click", () => viewProjectFile(button.dataset.viewFile)));
    filesNode.querySelectorAll("[data-download-file]").forEach((button) => button.addEventListener("click", () => downloadProjectFile(button.dataset.downloadFile)));
  }

  async function loadProjectMaterials() {
    const filter = document.getElementById("files-project-filter");
    renderFilesFilter();
    const projectId = filter?.value;
    if (!projectId) {
      materials = { projectId: "", brand: null, content: null, brief: null, files: [] };
      renderMaterials();
      return;
    }
    try {
      materials = await window.GeeslaneAPI.adminProjectMaterials(projectId);
      renderMaterials();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not load brand details and files."));
    }
  }

  function openProjectFiles(projectId) {
    const filter = document.getElementById("files-project-filter");
    if (filter) filter.value = projectId;
    materials.projectId = projectId;
    navigate("files");
  }

  function renderAgreementFilter() {
    const filter = document.getElementById("agreement-project-filter");
    if (!filter) return;
    const previous = filter.value || agreementContext.projectId || parseAdminHash().params.get("project") || "";
    if (!data.projects.length) {
      filter.innerHTML = '<option value="">No Projects Yet</option>';
      return;
    }
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
  }

  function agreementTrack(draft) {
    return window.GeeslaneAgreement.trackFrom(agreementContext.project, draft);
  }

  function renderHandoverFields(handover, track) {
    const resolved = track || agreementTrack();
    const root = document.getElementById("agreement-handover");
    const legend = document.getElementById("agreement-checklist-legend");
    if (legend && window.GeeslaneAgreement?.checklistTitle) legend.textContent = window.GeeslaneAgreement.checklistTitle(resolved);
    if (!root || !window.GeeslaneAgreement) return;
    const flags = handover || {};
    root.innerHTML = window.GeeslaneAgreement.handoverItems(resolved).map((item) =>
      `<label class="agreement-handover-item"><input type="checkbox" name="handover-${item.key}" ${flags[item.key] ? "checked" : ""} /><span>${escapeHtml(item.label)}</span></label>`
    ).join("");
  }

  function readAgreementForm() {
    const form = document.getElementById("agreement-form");
    if (!form) return window.GeeslaneAgreement.blank();
    const track = agreementTrack();
    const handover = {};
    (window.GeeslaneAgreement.handoverItems(track) || []).forEach((item) => {
      handover[item.key] = Boolean(form.elements[`handover-${item.key}`]?.checked);
    });
    const startDate = dateInputValue(form.elements.startDate?.value);
    const completionDate = dateInputValue(form.elements.completionDate?.value);
    return {
      track,
      clientName: String(form.elements.clientName?.value || "").trim(),
      projectTitle: String(form.elements.projectTitle?.value || "").trim(),
      deliverables: String(form.elements.deliverables?.value || "").trim(),
      fee: String(form.elements.fee?.value || "").trim(),
      paymentPlan: String(form.elements.paymentPlan?.value || "").trim(),
      revisionRounds: window.GeeslaneAgreement.hasRevisions(track)
        ? window.GeeslaneAgreement.clampRevisions(form.elements.revisionRounds?.value)
        : 0,
      startDate,
      completionDate,
      timeline: [startDate, completionDate].filter(Boolean).join(" – "),
      handover,
      savedAt: agreementContext.saved?.savedAt || "",
      saved: Boolean(agreementContext.saved)
    };
  }

  function fillAgreementForm(draft) {
    const form = document.getElementById("agreement-form");
    if (!form || !draft) return;
    const track = agreementTrack(draft);
    form.elements.clientName.value = portalName(draft.clientName) || draft.clientName || "";
    form.elements.projectTitle.value = draft.projectTitle || "";
    form.elements.deliverables.value = draft.deliverables || "";
    form.elements.fee.value = draft.fee || "";
    form.elements.paymentPlan.value = draft.paymentPlan || window.GeeslaneAgreement.defaultPayment(track);
    const revisionsField = document.getElementById("agreement-revisions-field");
    if (revisionsField) revisionsField.hidden = !window.GeeslaneAgreement.hasRevisions(track);
    form.elements.revisionRounds.value = window.GeeslaneAgreement.hasRevisions(track)
      ? window.GeeslaneAgreement.clampRevisions(draft.revisionRounds)
      : 0;
    if (form.elements.startDate) form.elements.startDate.value = dateInputValue(draft.startDate || agreementContext.project?.startDate);
    if (form.elements.completionDate) form.elements.completionDate.value = dateInputValue(draft.completionDate || agreementContext.project?.targetDate);
    renderHandoverFields(draft.handover, track);
  }

  function renderAgreementPreview() {
    const node = document.getElementById("admin-agreement-document");
    if (!node || !window.GeeslaneAgreement) return;
    window.GeeslaneAgreement.renderInto(node, readAgreementForm());
  }

  async function loadAgreement() {
    renderAgreementFilter();
    const projectId = document.getElementById("agreement-project-filter")?.value || "";
    if (!projectId) {
      agreementContext = { projectId: "", project: null, profile: null, brief: null, saved: null };
      fillAgreementForm(window.GeeslaneAgreement.blank());
      renderAgreementPreview();
      return;
    }
    try {
      const context = await window.GeeslaneAPI.adminAgreementContext(projectId);
      agreementContext = { projectId, ...context };
      fillAgreementForm(window.GeeslaneAgreement.resolve(context.project, context.profile, context.brief, context.saved));
      renderAgreementPreview();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not load the agreement. Run project_agreements.sql in Supabase if this is the first time."));
    }
  }

  function openAgreement(projectId) {
    const filter = document.getElementById("agreement-project-filter");
    if (filter) filter.value = projectId;
    agreementContext.projectId = projectId;
    navigate("agreements");
  }

  function renderInvoiceFilter() {
    const filter = document.getElementById("invoice-project-filter");
    if (!filter) return;
    const previous = filter.value;
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
  }

  function selectedBillingProject() {
    const projectId = document.getElementById("invoice-project-filter")?.value || "";
    return data.projects.find((item) => item.id === projectId) || null;
  }

  function fillProjectBilling() {
    const form = document.getElementById("project-billing-form");
    const card = document.getElementById("admin-billing-card");
    const project = selectedBillingProject();
    if (card) card.hidden = !project;
    if (!form || !project) return;
    form.elements.contractAmount.value = project.contractAmount || "";
    form.elements.contractCurrency.value = project.contractCurrency || "NGN";
    form.elements.showPaymentSummary.checked = project.showPaymentSummary !== false;
    form.elements.onlinePayments.checked = project.onlinePayments !== false;
  }

  function renderAdminPaymentSummary() {
    const node = document.getElementById("admin-payment-summary");
    const remainingNode = document.getElementById("admin-billing-remaining");
    const totals = window.GeeslaneAPI.projectBalance({
      project: selectedBillingProject(),
      invoices,
      receipts
    });
    if (remainingNode) remainingNode.textContent = totals ? totals.remainingLabel : "";
    if (!node) return;
    if (!totals) {
      node.innerHTML = '<p class="field-help">Set a project total to show payment details.</p>';
      return;
    }
    node.innerHTML = `<div class="billing-strip-stats${totals.remaining <= 0 ? " is-cleared" : ""}"><div><span>Project total</span><strong>${escapeHtml(totals.totalLabel)}</strong></div><div><span>Paid so far</span><strong>${escapeHtml(totals.paidLabel)}</strong></div><div><span>Remaining</span><strong>${escapeHtml(totals.remainingLabel)}</strong></div></div>`;
  }

  async function saveProjectBilling() {
    const project = selectedBillingProject();
    const form = document.getElementById("project-billing-form");
    const button = document.getElementById("save-project-billing");
    if (!project || !form) { toast("Choose a project first."); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Saving…");
    try {
      const saved = await window.GeeslaneAPI.adminSubmit("adminSetProjectBilling", {
        projectId: project.id,
        contractAmount: String(form.elements.contractAmount.value || "").trim(),
        contractCurrency: String(form.elements.contractCurrency.value || "NGN").trim() || "NGN",
        showPaymentSummary: form.elements.showPaymentSummary.checked,
        onlinePayments: form.elements.onlinePayments.checked
      });
      Object.assign(project, {
        contractAmount: saved.contractAmount,
        contractCurrency: saved.contractCurrency,
        showPaymentSummary: saved.showPaymentSummary,
        onlinePayments: saved.onlinePayments
      });
      fillProjectBilling();
      renderAdminPaymentSummary();
      toast("Project totals saved");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save project totals. Run project_payments.sql in Supabase, then try again."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function moneyLabel(invoice) {
    const amount = String(invoice?.amount || "").trim();
    const currency = String(invoice?.currency || "NGN").trim();
    if (!amount) return "Amount to follow";
    return `${currency} ${amount}`.trim();
  }

  function trackPaymentUrl() {
    try { return new URL("./track.html", location.href).href; }
    catch (_) { return "https://geeslane.com/client-portal/track.html"; }
  }

  function updateInvoiceRemaining() {
    const form = document.getElementById("invoice-form");
    const output = document.getElementById("invoice-remaining");
    if (!form || !output) return;
    const balance = window.GeeslaneAPI.invoiceBalance({
      amount: form.elements.amount.value,
      paidAmount: form.elements.paidAmount.value,
      currency: form.elements.currency.value,
      status: form.elements.status.value
    });
    output.value = balance ? balance.remainingLabel : "";
  }

  function setBillingFormTitle(id, editing, noun) {
    const node = document.getElementById(id);
    if (node) node.textContent = editing ? `Edit ${noun}` : noun;
  }

  function focusBillingForm(kind) {
    if (kind === "receipt") {
      openModal("record-payment-modal");
      return;
    }
    const card = document.getElementById("invoice-form-card");
    if (card) card.open = true;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closePaymentModal() {
    closeModal("record-payment-modal");
    resetReceiptForm();
  }

  function resetInvoiceForm() {
    const form = document.getElementById("invoice-form");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.currency.value = "NGN";
    form.elements.status.value = "Draft";
    setBillingFormTitle("invoice-form-title", false, "Invoice");
    constrainDateInput(document.getElementById("invoice-due"));
    updateInvoiceRemaining();
  }

  function fillInvoiceForm(invoice) {
    const form = document.getElementById("invoice-form");
    if (!form || !invoice) { resetInvoiceForm(); return; }
    form.elements.id.value = invoice.id || "";
    form.elements.title.value = invoice.title || "";
    form.elements.description.value = invoice.description || "";
    form.elements.amount.value = invoice.amount || "";
    form.elements.currency.value = invoice.currency || "NGN";
    form.elements.dueDate.value = dateInputValue(invoice.dueDate);
    form.elements.status.value = invoice.status || "Draft";
    form.elements.paidAmount.value = invoice.paidAmount || "";
    form.elements.notes.value = invoice.notes || "";
    setBillingFormTitle("invoice-form-title", Boolean(invoice.id), "Invoice");
    constrainDateInput(document.getElementById("invoice-due"), invoice.dueDate);
    updateInvoiceRemaining();
    focusBillingForm("invoice");
  }

  function readInvoiceForm() {
    const form = document.getElementById("invoice-form");
    return {
      id: String(form.elements.id.value || "").trim(),
      title: String(form.elements.title.value || "").trim(),
      description: String(form.elements.description.value || "").trim(),
      amount: String(form.elements.amount.value || "").trim(),
      currency: String(form.elements.currency.value || "NGN").trim() || "NGN",
      dueDate: dateInputValue(form.elements.dueDate.value),
      status: String(form.elements.status.value || "Draft").trim() || "Draft",
      paidAmount: String(form.elements.paidAmount.value || "").trim(),
      notes: String(form.elements.notes.value || "").trim()
    };
  }

  function canRecordPayment(invoice) {
    const status = String(invoice?.status || "").toLowerCase();
    if (status === "cancelled" || status === "draft" || status === "paid") return false;
    const balance = window.GeeslaneAPI.invoiceBalance(invoice);
    return !balance || Number(balance.remaining) > 0;
  }

  function renderInvoiceList() {
    const node = document.getElementById("admin-invoice-list");
    if (!node) return;
    const query = (document.getElementById("invoice-search")?.value || "").trim().toLowerCase();
    const rows = invoices.filter((invoice) => `${invoice.reference} ${invoice.title} ${invoice.status}`.toLowerCase().includes(query));
    if (!rows.length) {
      node.innerHTML = `<tr><td class="table-empty" colspan="6">${invoices.length ? "No invoices match this search." : "No invoices yet."}</td></tr>`;
      drawPager("invoices-pager", "invoices", pagedRows("invoices", []), renderInvoiceList);
      return;
    }
    const slice = pagedRows("invoices", rows);
    node.innerHTML = slice.items.map((invoice) => {
      const balance = window.GeeslaneAPI.invoiceBalance(invoice);
      const due = invoice.status !== "Paid" && invoice.status !== "Cancelled" && invoice.status !== "Draft" && (!balance || balance.remaining > 0);
      return `<tr class="${due ? "is-due" : invoice.status === "Paid" ? "is-paid" : ""}"><td><strong>${escapeHtml(invoice.reference || "Invoice")}</strong><small>${escapeHtml(invoice.title || "Project invoice")}</small></td><td>${invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</td><td class="num">${escapeHtml(balance?.totalLabel || moneyLabel(invoice))}</td><td class="num">${escapeHtml(balance?.remainingLabel || "—")}</td><td><span class="status-pill ${statusClass(invoice.status)}">${escapeHtml(invoice.status || "Draft")}</span></td><td>${rowActions([{ label: "View", attrs: `data-view-invoice="${escapeHtml(invoice.id)}"` }, { label: "Download PDF", attrs: `data-pdf-invoice="${escapeHtml(invoice.id)}"` }, { label: "Edit", attrs: `data-edit-invoice="${escapeHtml(invoice.id)}"` }, canRecordPayment(invoice) ? { label: "Record payment", attrs: `data-receipt-from="${escapeHtml(invoice.id)}"`, primary: true } : null])}</td></tr>`;
    }).join("");
    drawPager("invoices-pager", "invoices", slice, renderInvoiceList);
    node.querySelectorAll("[data-edit-invoice]").forEach((button) => button.addEventListener("click", () => {
      const invoice = invoices.find((item) => item.id === button.dataset.editInvoice);
      if (!invoice) return;
      showBillingTab("invoices");
      fillInvoiceForm(invoice);
      focusBillingForm("invoice");
    }));
    node.querySelectorAll("[data-view-invoice]").forEach((button) => button.addEventListener("click", () => {
      const invoice = invoices.find((item) => item.id === button.dataset.viewInvoice);
      if (invoice) window.GeeslaneInvoice?.view(invoiceMailData(invoice, contactForProject(invoice.projectId || document.getElementById("invoice-project-filter")?.value)));
    }));
    node.querySelectorAll("[data-pdf-invoice]").forEach((button) => button.addEventListener("click", () => {
      const invoice = invoices.find((item) => item.id === button.dataset.pdfInvoice);
      if (invoice) window.GeeslaneInvoice?.downloadPdf(invoiceMailData(invoice, contactForProject(invoice.projectId || document.getElementById("invoice-project-filter")?.value)));
    }));
    node.querySelectorAll("[data-receipt-from]").forEach((button) => button.addEventListener("click", () => {
      const invoice = invoices.find((item) => item.id === button.dataset.receiptFrom);
      if (invoice) issueReceiptFromInvoice(invoice);
    }));
  }

  function showBillingTab(tab) {
    const next = tab === "receipts" ? "receipts" : "invoices";
    document.querySelectorAll("[data-billing-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.billingTab === next));
    document.querySelectorAll("[data-billing-panel]").forEach((panel) => { panel.hidden = panel.dataset.billingPanel !== next; });
    const history = document.getElementById("payment-history-fold");
    if (history && next === "receipts") history.open = true;
  }

  function fillReceiptInvoiceOptions(selected) {
    const select = document.getElementById("receipt-invoice");
    if (!select) return;
    select.innerHTML = `<option value="">None</option>${invoices.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference || item.title || "Invoice")}</option>`).join("")}`;
    if (selected && invoices.some((item) => item.id === selected)) select.value = selected;
  }

  function receiptContext(receipt) {
    const contact = contactForProject(document.getElementById("invoice-project-filter")?.value || receipt?.projectId || "");
    return {
      ...receipt,
      projectName: contact.project?.name || "",
      business: contact.user?.business || "",
      clientName: portalName(contact.user?.name),
      invoiceReference: receipt?.invoiceReference || invoices.find((item) => item.id === receipt?.invoiceId)?.reference || ""
    };
  }

  function resetReceiptForm() {
    const form = document.getElementById("receipt-form");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.currency.value = "NGN";
    form.elements.status.value = "Issued";
    form.elements.paidOn.value = todayInputValue();
    setBillingFormTitle("record-payment-title", false, "Record Payment");
    fillReceiptInvoiceOptions("");
  }

  function fillReceiptForm(receipt) {
    const form = document.getElementById("receipt-form");
    if (!form || !receipt) { resetReceiptForm(); return; }
    form.elements.id.value = receipt.id || "";
    form.elements.title.value = receipt.title || "";
    form.elements.description.value = receipt.description || "";
    form.elements.amount.value = receipt.amount || "";
    form.elements.currency.value = receipt.currency || "NGN";
    form.elements.paidOn.value = dateInputValue(receipt.paidOn) || todayInputValue();
    form.elements.method.value = receipt.method || "";
    form.elements.status.value = receipt.status || "Draft";
    form.elements.notes.value = receipt.notes || "";
    setBillingFormTitle("record-payment-title", Boolean(receipt.id), "Record Payment");
    fillReceiptInvoiceOptions(receipt.invoiceId || "");
  }

  function readReceiptForm() {
    const form = document.getElementById("receipt-form");
    return {
      id: String(form.elements.id.value || "").trim(),
      title: String(form.elements.title.value || "").trim(),
      description: String(form.elements.description.value || "").trim(),
      amount: String(form.elements.amount.value || "").trim(),
      currency: String(form.elements.currency.value || "NGN").trim() || "NGN",
      paidOn: dateInputValue(form.elements.paidOn.value),
      method: String(form.elements.method.value || "").trim(),
      invoiceId: String(form.elements.invoiceId.value || "").trim(),
      status: String(form.elements.status.value || "Draft").trim() || "Draft",
      notes: String(form.elements.notes.value || "").trim()
    };
  }

  function renderReceiptList() {
    const node = document.getElementById("admin-receipt-list");
    const heading = document.getElementById("payment-history-title");
    if (heading) heading.textContent = receipts.length ? `Payment history (${receipts.length})` : "Payment history";
    if (!node) return;
    const query = (document.getElementById("receipt-search")?.value || "").trim().toLowerCase();
    const rows = receipts.filter((receipt) => `${receipt.reference} ${receipt.title} ${receipt.method} ${receipt.invoiceReference} ${receipt.status}`.toLowerCase().includes(query));
    if (!rows.length) {
      node.innerHTML = `<tr><td class="table-empty" colspan="7">${receipts.length ? "No receipts match this search." : "No receipts yet."}</td></tr>`;
      drawPager("receipts-pager", "receipts", pagedRows("receipts", []), renderReceiptList);
      return;
    }
    const slice = pagedRows("receipts", rows);
    node.innerHTML = slice.items.map((receipt) => `<tr class="${receipt.status === "Issued" ? "is-paid" : ""}"><td><strong>${escapeHtml(receipt.reference || "Receipt")}</strong><small>${escapeHtml(receipt.title || "Payment receipt")}</small></td><td>${receipt.paidOn ? formatDate(receipt.paidOn) : "—"}</td><td>${escapeHtml(receipt.method || "—")}</td><td>${escapeHtml(receipt.invoiceReference || "—")}</td><td class="num">${escapeHtml(moneyLabel(receipt))}</td><td><span class="status-pill ${statusClass(receipt.status)}">${escapeHtml(receipt.status || "Draft")}</span></td><td>${rowActions([{ label: "View", attrs: `data-view-receipt="${escapeHtml(receipt.id)}"` }, { label: "Download PDF", attrs: `data-pdf-receipt="${escapeHtml(receipt.id)}"` }, { label: "Email PDF", attrs: `data-mail-receipt="${escapeHtml(receipt.id)}"` }])}</td></tr>`).join("");
    drawPager("receipts-pager", "receipts", slice, renderReceiptList);
    node.querySelectorAll("[data-mail-receipt]").forEach((button) => button.addEventListener("click", async () => {
      const receipt = receipts.find((item) => item.id === button.dataset.mailReceipt);
      if (!receipt) return;
      const projectId = document.getElementById("invoice-project-filter")?.value || "";
      const contact = contactForProject(projectId);
      const context = receiptContext(receipt);
      window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
      try {
        const attachment = await documentAttachment("receipt", context);
        await sendBillingMails("payment", { contact, receipt: context, attachment });
        toast("Receipt emailed");
      } catch (error) {
        toast(window.GeeslaneAPI.userFacingError(error, "Could not email the receipt."));
      } finally {
        window.GeeslaneAPI.setButtonBusy(button, false);
      }
    }));
    node.querySelectorAll("[data-view-receipt]").forEach((button) => button.addEventListener("click", () => {
      const receipt = receipts.find((item) => item.id === button.dataset.viewReceipt);
      if (receipt) window.GeeslaneReceipt?.view(receiptContext(receipt));
    }));
    node.querySelectorAll("[data-pdf-receipt]").forEach((button) => button.addEventListener("click", () => {
      const receipt = receipts.find((item) => item.id === button.dataset.pdfReceipt);
      if (receipt) window.GeeslaneReceipt?.downloadPdf(receiptContext(receipt));
    }));
  }

  async function loadReceipts() {
    const projectId = document.getElementById("invoice-project-filter")?.value || "";
    fillReceiptInvoiceOptions("");
    if (!projectId) {
      receipts = [];
      resetReceiptForm();
      renderReceiptList();
      return;
    }
    try {
      receipts = await window.GeeslaneAPI.adminReceipts(projectId);
    } catch (error) {
      receipts = [];
      toast(window.GeeslaneAPI.userFacingError(error, "Could not load receipts. Run projects_invoices.sql in Supabase if this is the first time."));
    }
    renderReceiptList();
  }

  function issueReceiptFromInvoice(invoice) {
    const balance = window.GeeslaneAPI.invoiceBalance(invoice);
    const amount = balance && balance.remaining > 0
      ? String(Math.round(balance.remaining).toLocaleString("en-NG"))
      : (invoice.amount || "");
    showBillingTab("receipts");
    fillReceiptForm({
      title: invoice.title ? `Payment · ${invoice.title}` : "Payment received",
      description: invoice.description || "",
      amount,
      currency: invoice.currency || "NGN",
      paidOn: todayInputValue(),
      method: "Bank transfer",
      invoiceId: invoice.id,
      status: "Issued",
      notes: ""
    });
    setBillingFormTitle("record-payment-title", false, "Record Payment");
    focusBillingForm("receipt");
  }

  async function saveReceipt(send) {
    const projectId = document.getElementById("invoice-project-filter")?.value || "";
    if (!projectId) { toast("Choose a project first."); return; }
    const form = document.getElementById("receipt-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const receipt = readReceiptForm();
    if (!receipt.amount) { toast("Add the amount received."); return; }
    if (!receipt.title) receipt.title = receipt.invoiceId ? "Payment received" : "Payment received";
    if (send) receipt.status = "Issued";
    const button = document.getElementById(send ? "send-receipt" : "save-receipt");
    window.GeeslaneAPI.setButtonBusy(button, true, send ? "Sending…" : "Saving…");
    try {
      const saved = await mutate("adminSaveReceipt", { projectId, receipt }, send ? "Receipt sent to the client" : "Receipt saved");
      fillReceiptForm(saved && saved.id ? saved : receipt);
      receipts = await window.GeeslaneAPI.adminReceipts(projectId);
      renderReceiptList();
      try {
        invoices = await window.GeeslaneAPI.adminInvoices(projectId);
        renderInvoiceList();
      } catch (_) { /* invoice remaining still updates on next load */ }
      renderAdminPaymentSummary();
      if (send) {
        const issued = saved && saved.reference ? saved : receipts[0] || receipt;
        const context = receiptContext(issued);
        const contact = contactForProject(projectId);
        const attachment = await documentAttachment("receipt", context);
        await sendBillingMails("payment", { contact, receipt: context, attachment });
        closePaymentModal();
      }
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save the receipt. Run projects_invoices.sql in Supabase if this is the first time."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function loadInvoices() {
    renderInvoiceFilter();
    tablePages.invoices = 1;
    tablePages.receipts = 1;
    const projectId = document.getElementById("invoice-project-filter")?.value || "";
    if (!projectId) {
      invoices = [];
      receipts = [];
      resetInvoiceForm();
      resetReceiptForm();
      fillProjectBilling();
      renderAdminPaymentSummary();
      renderInvoiceList();
      renderReceiptList();
      return;
    }
    try {
      invoices = await window.GeeslaneAPI.adminInvoices(projectId);
    } catch (error) {
      invoices = [];
      toast(window.GeeslaneAPI.userFacingError(error, "Could not load invoices. Run projects_invoices.sql in Supabase if this is the first time."));
    }
    renderInvoiceList();
    await loadReceipts();
    fillProjectBilling();
    renderAdminPaymentSummary();
  }

  function openInvoices(projectId) {
    const filter = document.getElementById("invoice-project-filter");
    if (filter) filter.value = projectId;
    navigate("invoices");
  }

  async function setProjectActive(projectId, isActive) {
    try {
      await mutate("adminSetProjectActive", { projectId, isActive: Boolean(isActive) }, isActive ? "Project marked active" : "Project paused");
      const project = data.projects.find((item) => item.id === projectId);
      if (project) project.isActive = Boolean(isActive);
      renderProjects();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not update the active project. Run projects_invoices.sql in Supabase if this is the first time."));
      renderProjects();
    }
  }

  async function saveInvoice(send) {
    const projectId = document.getElementById("invoice-project-filter")?.value || "";
    if (!projectId) { toast("Choose a project first."); return; }
    const form = document.getElementById("invoice-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const invoice = readInvoiceForm();
    if (!invoice.title || !invoice.amount) { toast("Add a title and amount."); return; }
    if (send && invoice.status === "Draft") invoice.status = "Sent";
    const button = document.getElementById(send ? "send-invoice" : "save-invoice");
    window.GeeslaneAPI.setButtonBusy(button, true, send ? "Sending…" : "Saving…");
    try {
      const saved = await mutate("adminSaveInvoice", { projectId, invoice }, send ? "Invoice sent to the client" : "Invoice saved");
      fillInvoiceForm(saved && saved.id ? saved : invoice);
      invoices = await window.GeeslaneAPI.adminInvoices(projectId);
      renderInvoiceList();
      if (send) {
        const contact = contactForProject(projectId);
        const issued = saved && saved.reference ? saved : invoices[0] || invoice;
        const balance = window.GeeslaneAPI.invoiceBalance(issued);
        const paid = issued.status === "Paid" || (balance && balance.remaining <= 0);
        if (paid) {
          const existing = receipts.find((item) => item.invoiceId === issued.id && item.status === "Issued");
          const recorded = existing || await window.GeeslaneAPI.adminSubmit("adminSaveReceipt", {
            projectId,
            receipt: {
              title: issued.title ? `Payment · ${issued.title}` : "Payment received",
              amount: issued.paidAmount || issued.amount,
              currency: issued.currency || "NGN",
              paidOn: todayInputValue(),
              method: "Recorded by Geeslane",
              invoiceId: issued.id,
              status: "Issued"
            }
          });
          receipts = await window.GeeslaneAPI.adminReceipts(projectId);
          renderReceiptList();
          invoices = await window.GeeslaneAPI.adminInvoices(projectId);
          renderInvoiceList();
          const context = receiptContext(recorded && recorded.id ? recorded : receipts[0]);
          const attachment = await documentAttachment("receipt", context);
          await sendBillingMails("payment", { contact, receipt: context, attachment });
        } else {
          const attachment = await documentAttachment("invoice", invoiceMailData(issued, contact));
          await sendBillingMails("invoice", { contact, invoice: issued, attachment });
        }
      }
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save the invoice. Run projects_invoices.sql in Supabase if this is the first time."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function fillAgreementDefaults() {
    if (!agreementContext.project && !agreementContext.profile) {
      toast("Choose a project first.");
      return;
    }
    fillAgreementForm(window.GeeslaneAgreement.defaultsFrom(agreementContext.project, agreementContext.profile, agreementContext.brief));
    renderAgreementPreview();
    toast("Filled from the current project details");
  }

  async function saveAgreement() {
    const projectId = document.getElementById("agreement-project-filter")?.value || "";
    if (!projectId) { toast("Choose a project first."); return; }
    const track = agreementTrack();
    if (window.GeeslaneAgreement.hasRevisions(track)) {
      const rounds = Number(document.getElementById("agreement-revisions").value);
      if (!Number.isFinite(rounds) || rounds < 1 || rounds > 5) {
        toast("Included revisions must be between 1 and 5.");
        return;
      }
    }
    const button = document.getElementById("save-agreement");
    window.GeeslaneAPI.setButtonBusy(button, true, "Saving…");
    try {
      const draft = readAgreementForm();
      const saved = await window.GeeslaneAPI.adminSubmit("adminSaveAgreement", {
        projectId,
        agreement: draft
      });
      if (agreementContext.project) {
        await window.GeeslaneAPI.adminSubmit("adminUpdateProject", {
          projectId,
          name: agreementContext.project.name,
          service: agreementContext.project.service,
          startDate: draft.startDate || null,
          targetDate: draft.completionDate || null
        });
        agreementContext.project.startDate = draft.startDate || "";
        agreementContext.project.targetDate = draft.completionDate || "";
        const row = data.projects.find((item) => item.id === projectId);
        if (row) {
          row.startDate = draft.startDate || "";
          row.targetDate = draft.completionDate || "";
        }
      }
      agreementContext.saved = {
        clientName: saved.clientName,
        projectTitle: saved.projectTitle,
        deliverables: saved.deliverables,
        fee: saved.fee,
        paymentPlan: saved.paymentPlan,
        revisionRounds: saved.revisionRounds,
        timeline: saved.timeline,
        startDate: draft.startDate,
        completionDate: draft.completionDate,
        handover: saved.handover || {},
        savedAt: saved.savedAt,
        updatedAt: saved.updatedAt,
        saved: true
      };
      fillAgreementForm(window.GeeslaneAgreement.merge(readAgreementForm(), agreementContext.saved));
      renderAgreementPreview();
      toast("Agreement saved");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save the agreement. Run project_agreements.sql in Supabase if this is the first time."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function saveLocalFile(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportBrandAndContent() {
    const project = currentMaterialsProject();
    if (!project) { toast("Choose a project first."); return; }
    const contact = contactForProject(project?.id);
    const brand = materials.brand || {};
    const content = materials.content || {};
    const brief = materials.brief || {};
    const lines = [
      `Geeslane Brand & Content Export`,
      `Project: ${project?.name || "Project"}`,
      `Client: ${portalName(contact.name, "—")}`,
      `Business: ${contact.user?.business || project?.service || "—"}`,
      `Exported: ${new Date().toLocaleString("en-GB")}`,
      "",
      "Project Brief",
      `Goal: ${brief.goal || ""}`,
      `Audience: ${brief.audience || ""}`,
      `Features: ${brief.features || ""}`,
      `Other features: ${brief.featuresOther || ""}`,
      `Visitor details: ${brief.visitorDetails || brief.scope || ""}`,
      "",
      "Brand Identity",
      `Primary colour: ${brand.primaryColor || ""}`,
      `Secondary colour: ${brand.secondaryColor || ""}`,
      `Accent colour: ${brand.accentColor || ""}`,
      `Heading font: ${brand.headingFont || ""}`,
      `Body font: ${brand.bodyFont || ""}`,
      `Personality: ${brand.personality || ""}`,
      `Style notes: ${brand.styleNotes || ""}`,
      `Reference links: ${brand.referenceLinks || ""}`,
      "",
      "Website Content",
      `Headline: ${content.headline || ""}`,
      `Introduction: ${content.introduction || ""}`,
      `About: ${content.about || ""}`,
      `Services: ${content.services || ""}`,
      `Testimonials: ${content.testimonials || ""}`,
      `Call to action: ${content.callToAction || ""}`,
      `Contact details: ${content.contactDetails || ""}`,
      `Additional notes: ${content.extraNotes || ""}`,
      "",
      "Files",
      ...(materials.files.length ? materials.files.map((item) => `- ${item.name} (${item.type || "File"})`) : ["- None uploaded"])
    ];
    saveLocalFile(`${fileSlug(project?.name)}-brand-and-content.txt`, new Blob([lines.join("\n")], { type: "text/plain" }));
    toast("Brand & Content exported");
  }

  function viewProjectFile(id) {
    const item = materials.files.find((file) => file.id === id);
    if (!item?.url) { toast("This file is not available to view yet."); return; }
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  async function downloadProjectFile(id, silent) {
    const item = materials.files.find((file) => file.id === id);
    if (!item?.url) {
      if (!silent) toast("This file is not available to download yet.");
      return false;
    }
    if (!item.storagePath) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return true;
    }
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error("Download failed");
      saveLocalFile(item.name || "project-file", await response.blob());
      return true;
    } catch (error) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      if (!silent) toast(window.GeeslaneAPI.userFacingError(error, "Opened the file in a new tab instead."));
      return true;
    }
  }

  async function downloadAllFiles() {
    const files = materials.files.filter((item) => item.url);
    if (!files.length) { toast("No files are available to download for this project."); return; }
    const button = document.getElementById("download-all-files");
    window.GeeslaneAPI.setButtonBusy(button, true, "Downloading…");
    try {
      const ready = [];
      for (const item of files) {
        if (!item.storagePath) {
          ready.push({ name: item.name, url: item.url, link: true });
          continue;
        }
        try {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error("Download failed");
          ready.push({ name: item.name || "project-file", blob: await response.blob() });
        } catch (_) {
          ready.push({ name: item.name, url: item.url, link: true });
        }
      }
      ready.forEach((item) => {
        if (item.link) window.open(item.url, "_blank", "noopener,noreferrer");
        else saveLocalFile(item.name, item.blob);
      });
      toast(`${ready.length} file${ready.length === 1 ? "" : "s"} ready`);
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function renderAll() { renderMetrics(); renderOverview(); renderRegistrations(); renderClients(); renderProjects(); renderRequests(); renderMilestones(); renderFilesFilter(); renderAgreementFilter(); renderInvoiceFilter(); }

  function refreshLocalMetrics() {
    data.metrics.pending = data.registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
    data.metrics.clients = data.users.filter((item) => item.role === "client").length;
    data.metrics.projects = data.projects.length;
    data.metrics.openRequests = data.requests.filter((item) => !["Completed", "Declined"].includes(item.status)).length;
  }

  function applyProjectUpdate(update) {
    if (!update?.projectId) return;
    const project = data.projects.find((item) => item.id === update.projectId);
    if (!project) return;
    if (update.progress != null) project.progress = Number(update.progress || 0);
    if (update.stage) project.stage = update.stage;
    if (typeof update.hasWireframe === "boolean") project.hasWireframe = update.hasWireframe;
    if (typeof update.hasVisualDesign === "boolean") project.hasVisualDesign = update.hasVisualDesign;
  }

  function stageOptionsMessage(hasWireframe, hasVisualDesign) {
    if (hasWireframe && hasVisualDesign) return "Wireframe and visual design are included";
    if (!hasWireframe && !hasVisualDesign) return "Wireframe and visual design are hidden for this project";
    if (!hasWireframe) return "Wireframe is hidden for this project";
    return "Visual design is hidden for this project";
  }

  function currentMilestoneProject() {
    const filter = document.getElementById("milestone-project-filter");
    return data.projects.find((item) => item.id === filter?.value) || null;
  }

  function syncProjectDates(project) {
    const start = document.getElementById("milestone-start-date");
    const target = document.getElementById("milestone-target-date");
    if (start) {
      start.disabled = !project;
      if (document.activeElement !== start) start.value = dateInputValue(project?.startDate);
    }
    if (target) {
      target.disabled = !project;
      constrainDateInput(target, project?.targetDate);
      if (document.activeElement !== target) target.value = dateInputValue(project?.targetDate);
    }
  }

  async function applyCreatedDates(projectId, startDate, targetDate, projectHint) {
    const start = dateInputValue(startDate);
    const target = dateInputValue(targetDate);
    if (!projectId || (!start && !target)) return;
    const project = data.projects.find((item) => item.id === projectId) || projectHint;
    if (!project) return;
    try {
      await window.GeeslaneAPI.adminSubmit("adminUpdateProject", {
        projectId,
        name: project.name || "",
        service: project.service || "",
        startDate: start || null,
        targetDate: target || null
      });
      const row = data.projects.find((item) => item.id === projectId);
      if (row) {
        row.startDate = start;
        row.targetDate = target;
      }
    } catch (_) { /* dates can be set on the project later */ }
  }

  async function saveProjectDates(projectId, next = {}) {
    const project = data.projects.find((item) => item.id === projectId);
    if (!project) return;
    const start = next.startDate !== undefined ? dateInputValue(next.startDate) : dateInputValue(project.startDate);
    const target = next.targetDate !== undefined ? dateInputValue(next.targetDate) : dateInputValue(project.targetDate);
    if (start === dateInputValue(project.startDate) && target === dateInputValue(project.targetDate)) return;
    try {
      const label = next.startDate !== undefined && next.targetDate === undefined
        ? (start ? "Start date saved" : "Start date cleared")
        : (target ? "Projected completion saved" : "Projected completion cleared");
      await mutate("adminUpdateProject", {
        projectId,
        name: project.name,
        service: project.service,
        startDate: start || null,
        targetDate: target || null
      }, label);
      project.startDate = start;
      project.targetDate = target;
      if (currentMilestoneProject()?.id === project.id) syncProjectDates(project);
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save the date. Run project_dates.sql in Supabase if this is the first time."));
      if (currentMilestoneProject()?.id === project.id) syncProjectDates(project);
      renderProjects();
    }
  }

  function syncStageOptions(project) {
    const wrap = document.querySelector(".admin-stage-options");
    const wire = document.getElementById("stage-include-wireframe");
    const design = document.getElementById("stage-include-design");
    if (!wire || !design || savingStages) return;
    const track = window.GeeslaneAPI?.projectTrack?.(project?.service) || "website";
    const website = track === "website";
    if (wrap) wrap.hidden = !project || !website;
    const exists = Boolean(project) && website;
    wire.disabled = !exists;
    design.disabled = !exists;
    wire.checked = project?.hasWireframe !== false;
    design.checked = project?.hasVisualDesign !== false;
  }

  async function saveStageOptions() {
    const project = currentMilestoneProject();
    const wire = document.getElementById("stage-include-wireframe");
    const design = document.getElementById("stage-include-design");
    if (!project || !wire || !design) return;
    const hasWireframe = wire.checked;
    const hasVisualDesign = design.checked;
    if ((project.hasWireframe !== false) === hasWireframe && (project.hasVisualDesign !== false) === hasVisualDesign) return;
    savingStages = true;
    wire.disabled = true;
    design.disabled = true;
    adminOpenProjectId = "";
    try {
      await mutate("adminSetProjectStages", {
        projectId: project.id,
        hasWireframe,
        hasVisualDesign
      }, stageOptionsMessage(hasWireframe, hasVisualDesign), true);
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save stage options. Run project_stage_options.sql in Supabase if this is the first time."));
      syncStageOptions(project);
    } finally {
      savingStages = false;
      syncStageOptions(currentMilestoneProject());
    }
  }

  function addCreatedWorkspace(result) {
    if (!result) return;
    if (result.registrationId) {
      const registration = data.registrations.find((item) => item.id === result.registrationId);
      if (registration) registration.status = result.status || "Approved";
    }
    if (result.user && !data.users.some((item) => item.id === result.user.id)) data.users.unshift(result.user);
    if (result.project && !data.projects.some((item) => item.id === result.project.id)) data.projects.push(result.project);
    (result.milestones || []).forEach((milestone) => {
      if (!data.milestones.some((item) => item.projectId === milestone.projectId && item.id === milestone.id)) data.milestones.push(milestone);
    });
    refreshLocalMetrics();
    renderAll();
  }

  function wireRegistrationButtons(root) { root.querySelectorAll("[data-review-registration]").forEach((button) => button.addEventListener("click", () => openApproval(button.dataset.reviewRegistration))); }

  function openApproval(id) {
    const item = data.registrations.find((entry) => entry.id === id);
    if (!item) return;
    const form = document.getElementById("approval-form");
    form.reset();
    form.elements.registrationId.value = item.id;
    form.elements.projectName.value = `${item.business} — ${item.service}`;
    form.elements.service.value = item.service;
    form.elements.targetDate.value = item.targetDate || "";
    constrainDateInput(form.elements.targetDate, item.targetDate);
    document.getElementById("approval-summary").innerHTML = `<strong>${escapeHtml(portalName(item.name, item.name))} · ${escapeHtml(item.business)}</strong>${escapeHtml(item.email)}<br>${escapeHtml(item.description)}${detailList(discoveryRows(item.discovery))}`;
    openModal("approval-modal");
  }

  async function mutate(action, payload, message, refresh) {
    const result = await window.GeeslaneAPI.adminSubmit(action, payload);
    toast(message);
    if (refresh) await loadDashboard();
    return result;
  }

  async function approveRegistration() {
    const form = document.getElementById("approval-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const target = dateInputValue(form.elements.targetDate?.value);
    if (target && target < todayInputValue()) { toast("Choose today or a later date."); return; }
    const button = document.getElementById("approve-registration");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const formData = Object.fromEntries(new FormData(form));
      const registration = data.registrations.find((item) => item.id === formData.registrationId);
      formData.email = registration?.email || "";
      formData.name = registration?.name || "";
      formData.business = registration?.business || "";
      const opening = openingPaymentFrom(form);
      const result = await mutate("adminApproveRegistration", formData, "Client created. Portal invite sent.");
      addCreatedWorkspace(result);
      const email = result.user?.email || result.email;
      const projectId = result.project?.id || result.projectId || result.id;
      await applyCreatedDates(projectId, formData.startDate, formData.targetDate, result.project);
      const invoice = await attachOpeningPayment(projectId, {
        email,
        name: result.user?.name,
        project: result.project
      }, opening);
      await sendPortalReadyMail({
        email,
        name: result.user?.name,
        project: result.project || { name: formData.projectName }
      }, invoice);
      closeModal("approval-modal");
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  async function rejectRegistration() {
    const form = document.getElementById("approval-form");
    const id = form.elements.registrationId.value;
    const button = document.getElementById("reject-registration");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const result = await mutate("adminRejectRegistration", { registrationId: id, notes: form.elements.notes.value }, "Access request rejected");
      const registration = data.registrations.find((item) => item.id === (result?.registrationId || id));
      if (registration) registration.status = result?.status || "Rejected";
      notifyClient(registration?.email, "An update on your access request", "We are not able to approve this access request just now. If you expected a different outcome, reply to this email and we will be happy to help.", [
        ["Business", registration?.business],
        ["Service", registration?.service]
      ], registration?.name);
      refreshLocalMetrics(); renderMetrics(); renderOverview(); renderRegistrations();
      closeModal("approval-modal");
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  async function createClient() {
    const form = document.getElementById("create-client-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const target = dateInputValue(form.elements.targetDate?.value);
    if (target && target < todayInputValue()) { toast("Choose today or a later date."); return; }
    const button = document.getElementById("save-create-client");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const formData = Object.fromEntries(new FormData(form));
      formData.name = window.GeeslaneMail?.composePersonName(formData.title, formData.name) || formData.name;
      const opening = openingPaymentFrom(form);
      const result = await mutate("adminCreateClientProject", formData, "Client created. Portal invite sent.");
      addCreatedWorkspace(result);
      await applyCreatedDates(result.project?.id || result.projectId || result.id, formData.startDate, formData.targetDate, result.project);
      const invoice = await attachOpeningPayment(result.project?.id || result.projectId || result.id, {
        email: formData.email,
        name: formData.name,
        project: result.project
      }, opening);
      await sendPortalReadyMail({
        email: formData.email,
        name: formData.name,
        project: result.project || { name: formData.projectName }
      }, invoice);
      closeModal("create-client-modal");
      form.reset();
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  function fillAddProjectClients(selectedId) {
    const select = document.getElementById("add-project-client");
    if (!select) return;
    const clients = data.users.filter((item) => item.role === "client" && item.clientId);
    select.innerHTML = clients.length
      ? clients.map((item) => `<option value="${escapeHtml(item.clientId)}">${escapeHtml(portalName(item.name, item.email))} · ${escapeHtml(item.business || "Client")}</option>`).join("")
      : '<option value="">No clients yet</option>';
    if (selectedId && clients.some((item) => item.clientId === selectedId)) select.value = selectedId;
  }

  function openAddProject(clientId) {
    const form = document.getElementById("add-project-form");
    form.reset();
    form.elements.service.value = "Business Website";
    document.getElementById("add-project-active").checked = true;
    fillAddProjectClients(clientId);
    constrainDateInput(document.getElementById("add-project-target"));
    openModal("add-project-modal");
  }

  async function addProject() {
    const form = document.getElementById("add-project-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const clientId = String(form.elements.clientId.value || "").trim();
    const projectName = String(form.elements.projectName.value || "").trim();
    if (!clientId || !projectName) { toast("Choose a client and project name."); return; }
    const target = dateInputValue(form.elements.targetDate?.value);
    if (target && target < todayInputValue()) { toast("Choose today or a later date."); return; }
    const button = document.getElementById("save-add-project");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const result = await mutate("adminAddProject", {
        clientId,
        projectName,
        service: String(form.elements.service.value || "").trim() || "Website project",
        targetDate: target || null,
        isActive: document.getElementById("add-project-active").checked
      }, "Project created");
      await loadDashboard();
      const projectId = result?.id || result?.project?.id;
      await applyCreatedDates(projectId, form.elements.startDate?.value, target, result);
      const contact = contactForProject(projectId);
      const invoice = await attachOpeningPayment(projectId, contact, openingPaymentFrom(form));
      if (contact.email) {
        await sendPortalReadyMail({
          email: contact.email,
          name: contact.name,
          project: contact.project || { name: projectName }
        }, invoice, "project");
      }
      closeModal("add-project-modal");
      form.reset();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not add the project. Run projects_invoices.sql in Supabase if this is the first time."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  let pendingAdminEmail = "";

  function showAdminAuth(name) {
    document.getElementById("admin-password-panel").classList.toggle("is-visible", name === "password");
    document.getElementById("admin-email-panel").classList.toggle("is-visible", name === "email");
    document.getElementById("admin-code-panel").classList.toggle("is-visible", name === "code");
    const switcher = document.getElementById("admin-auth-switch");
    switcher.hidden = false;
    switcher.textContent = name === "password" ? "Use a 6-Digit Code Instead" : "Use Username and Password Instead";
    const feedback = document.getElementById("admin-auth-feedback");
    if (feedback) feedback.hidden = true;
    if (name === "code") {
      const label = document.getElementById("admin-code-email-label");
      if (label) label.textContent = pendingAdminEmail || "your email";
      window.GeeslaneAPI.clearCodeBoxes(document.getElementById("admin-code-boxes"));
    }
    setTimeout(() => {
      if (name === "code") document.querySelector("#admin-code-boxes .code-box")?.focus();
      else if (name === "email") document.getElementById("admin-signin-email")?.focus();
      else document.getElementById("admin-username")?.focus();
    }, 30);
  }

  async function completeAdminSession() {
    const session = await window.GeeslaneAPI.getSession();
    if (session.user?.role === "admin" && session.user?.status === "active") {
      await enterAdmin();
      setTimeout(() => window.GeeslanePWA?.enableNotifications?.("team"), 1200);
      return true;
    }
    if (session.user?.role === "admin") {
      await window.GeeslaneAPI.logout();
      showAuthFeedback("This administrator account is not active.");
      return false;
    }
    location.replace(window.GeeslaneAPI.clientSignInRedirect());
    return false;
  }

  async function requestAdminPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true, "Signing in…");
    try {
      const result = await window.GeeslaneAPI.adminPasswordLogin(String(data.get("username") || "").trim(), String(data.get("password") || ""));
      if (result?.needsCode) {
        window.GeeslaneAPI.setButtonBusy(button, false);
        pendingAdminEmail = result.email;
        const emailInput = document.getElementById("admin-signin-email");
        if (emailInput) emailInput.value = result.email;
        showAdminAuth("code");
        showAuthFeedback(`Password accepted. Enter the 6-digit code emailed to ${result.email}.`, "success");
        return;
      }
      await completeAdminSession();
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Invalid administrator details."));
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function sendAdminCode(email, button) {
    const address = String(email || "").trim();
    if (!address) { showAuthFeedback("Enter a valid email address."); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending code…");
    try {
      await window.GeeslaneAPI.requestMagicLink(address, "admin");
      pendingAdminEmail = address.toLowerCase();
      const emailInput = document.getElementById("admin-signin-email");
      if (emailInput) emailInput.value = address;
      showAdminAuth("code");
      showAuthFeedback("Check your inbox — and spam if it is not there in a minute.", "success");
      window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      const resend = document.getElementById("admin-resend-code");
      if (resend && resend !== button) window.GeeslaneAPI.startMagicLinkCooldown(resend, 60);
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "The sign-in email could not be sent. Please try again."));
      if (window.GeeslaneAPI.isRateLimitError(error)) window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      else window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function requestAdminMagicLink(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    await sendAdminCode(String(new FormData(form).get("email") || "").trim(), form.querySelector("button[type=submit]"));
  }

  async function submitAdminCode(event) {
    event.preventDefault();
    const code = window.GeeslaneAPI.codeFromBoxes(document.getElementById("admin-code-boxes"));
    const email = pendingAdminEmail || document.getElementById("admin-signin-email")?.value || "";
    const button = event.currentTarget.querySelector("button[type=submit]");
    if (!/^\d{6}$/.test(code)) { showAuthFeedback("Enter the 6-digit code from your email."); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Opening admin portal…");
    try {
      await window.GeeslaneAPI.verifySignInCode(email, code);
      await completeAdminSession();
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "That code could not be verified. Try again, or send a new one."));
      window.GeeslaneAPI.setButtonBusy(button, false);
      document.querySelector("#admin-code-boxes .code-box")?.focus();
    }
  }

  async function enterAdmin() {
    await loadDashboard();
    document.getElementById("admin-auth").hidden = true;
    document.getElementById("admin-shell").hidden = false;
    restoreAdminCommentRoute();
    const route = parseAdminHash();
    navigate(pageTitles[route.page] ? route.page : "overview", { keepHash: true });
  }

  async function loadDashboard() {
    data = await window.GeeslaneAPI.adminDashboard();
    data.pushDevices = data.pushDevices || {};
    document.getElementById("admin-sidebar-name").textContent = data.admin.name || "Administrator";
    document.getElementById("admin-sidebar-email").textContent = data.admin.email || "";
    try { portalSettings = await window.GeeslaneAPI.readPortalSettings() || portalSettings; } catch (_) { /* bank details optional until SQL is run */ }
    fillPortalBankForm();
    renderAll();
  }

  function fillPortalBankForm() {
    const form = document.getElementById("portal-bank-form");
    if (!form) return;
    form.elements.bankName.value = portalSettings.bankName || "";
    form.elements.accountName.value = portalSettings.accountName || "";
    form.elements.accountNumber.value = portalSettings.accountNumber || "";
    form.elements.bankNotes.value = portalSettings.bankNotes || "";
  }

  async function savePortalBank() {
    const form = document.getElementById("portal-bank-form");
    const button = document.getElementById("save-portal-bank");
    if (!form) return;
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const saved = await window.GeeslaneAPI.adminSubmit("adminSavePortalSettings", {
        settings: {
          bankName: String(form.elements.bankName.value || "").trim(),
          accountName: String(form.elements.accountName.value || "").trim(),
          accountNumber: String(form.elements.accountNumber.value || "").trim(),
          bankNotes: String(form.elements.bankNotes.value || "").trim()
        }
      });
      portalSettings = {
        bankName: saved?.bankName || saved?.bank_name || form.elements.bankName.value.trim(),
        accountName: saved?.accountName || saved?.account_name || form.elements.accountName.value.trim(),
        accountNumber: saved?.accountNumber || saved?.account_number || form.elements.accountNumber.value.trim(),
        bankNotes: saved?.bankNotes || saved?.bank_notes || form.elements.bankNotes.value.trim()
      };
      fillPortalBankForm();
      toast("Bank details saved");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not save bank details. Run portal_settings.sql in Supabase, then try again."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function wireEvents() {
    ui.wireRowMenus();
    document.querySelectorAll("[data-admin-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.adminPage)));
    document.querySelectorAll("[data-go-admin-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.goAdminPage)));
    ["registration-search","client-search","project-search","admin-request-search","invoice-search","receipt-search"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener("input", () => {
        const key = { "registration-search": "registrations", "client-search": "clients", "project-search": "projects", "admin-request-search": "requests", "invoice-search": "invoices", "receipt-search": "receipts" }[id];
        if (key) tablePages[key] = 1;
        ({ "registration-search": renderRegistrations, "client-search": renderClients, "project-search": renderProjects, "admin-request-search": renderRequests, "invoice-search": renderInvoiceList, "receipt-search": renderReceiptList })[id]();
      });
    });
    document.getElementById("milestone-project-filter").addEventListener("change", renderMilestones);
    document.getElementById("milestone-start-date")?.addEventListener("change", () => {
      const project = currentMilestoneProject();
      if (project) saveProjectDates(project.id, { startDate: document.getElementById("milestone-start-date").value });
    });
    document.getElementById("milestone-target-date").addEventListener("change", () => {
      const project = currentMilestoneProject();
      if (project) saveProjectDates(project.id, { targetDate: document.getElementById("milestone-target-date").value });
    });
    document.getElementById("stage-include-wireframe").addEventListener("change", saveStageOptions);
    document.getElementById("stage-include-design").addEventListener("change", saveStageOptions);
    constrainDateInput(document.getElementById("milestone-target-date"));
    constrainDateInput(document.getElementById("approval-target"));
    constrainDateInput(document.getElementById("new-project-target"));
    constrainDateInput(document.getElementById("invoice-due"));
    document.getElementById("files-project-filter").addEventListener("change", loadProjectMaterials);
    document.getElementById("export-brand-content").addEventListener("click", exportBrandAndContent);
    document.getElementById("download-all-files").addEventListener("click", downloadAllFiles);
    document.getElementById("agreement-project-filter").addEventListener("change", loadAgreement);
    document.getElementById("invoice-project-filter").addEventListener("change", () => { resetInvoiceForm(); resetReceiptForm(); loadInvoices(); });
    document.getElementById("save-project-billing").addEventListener("click", saveProjectBilling);
    document.getElementById("save-portal-bank")?.addEventListener("click", savePortalBank);
    document.getElementById("invoice-form").addEventListener("input", updateInvoiceRemaining);
    document.getElementById("invoice-form").addEventListener("change", updateInvoiceRemaining);
    document.getElementById("reset-invoice").addEventListener("click", () => {
      resetInvoiceForm();
      focusBillingForm("invoice");
    });
    document.getElementById("open-new-invoice")?.addEventListener("click", () => {
      resetInvoiceForm();
      focusBillingForm("invoice");
    });
    document.getElementById("save-invoice").addEventListener("click", () => saveInvoice(false));
    document.getElementById("send-invoice").addEventListener("click", () => saveInvoice(true));
    document.querySelectorAll("[data-billing-tab]").forEach((button) => button.addEventListener("click", () => showBillingTab(button.dataset.billingTab)));
    document.getElementById("reset-receipt")?.addEventListener("click", resetReceiptForm);
    document.getElementById("save-receipt")?.addEventListener("click", () => saveReceipt(false));
    document.getElementById("send-receipt")?.addEventListener("click", () => saveReceipt(true));
    document.getElementById("close-record-payment")?.addEventListener("click", closePaymentModal);
    document.getElementById("cancel-record-payment")?.addEventListener("click", closePaymentModal);
    document.getElementById("agreement-form").addEventListener("input", renderAgreementPreview);
    document.getElementById("agreement-form").addEventListener("change", () => {
      const input = document.getElementById("agreement-revisions");
      if (input && window.GeeslaneAgreement.hasRevisions(agreementTrack())) {
        input.value = window.GeeslaneAgreement.clampRevisions(input.value);
      }
      renderAgreementPreview();
    });
    document.getElementById("agreement-fill-defaults").addEventListener("click", fillAgreementDefaults);
    document.getElementById("save-agreement").addEventListener("click", saveAgreement);
    document.getElementById("download-admin-agreement-pdf").addEventListener("click", () => window.GeeslaneAgreement.downloadPdf(readAgreementForm()));
    document.getElementById("admin-password-form").addEventListener("submit", requestAdminPassword);
    document.getElementById("admin-signin-form").addEventListener("submit", requestAdminMagicLink);
    document.getElementById("admin-code-form").addEventListener("submit", submitAdminCode);
    window.GeeslaneAPI.bindCodeBoxes(document.getElementById("admin-code-boxes"), () => {
      const submit = document.querySelector("#admin-code-form button[type=submit]");
      if (submit && !submit.disabled) document.getElementById("admin-code-form").requestSubmit();
    });
    document.getElementById("admin-resend-code").addEventListener("click", () => {
      sendAdminCode(pendingAdminEmail || document.getElementById("admin-signin-email")?.value || "", document.getElementById("admin-resend-code"));
    });
    document.getElementById("admin-change-email").addEventListener("click", () => showAdminAuth("email"));
    document.getElementById("admin-auth-switch").addEventListener("click", () => {
      const usingPassword = document.getElementById("admin-password-panel").classList.contains("is-visible");
      showAdminAuth(usingPassword ? "email" : "password");
    });
    document.getElementById("admin-menu-button").addEventListener("click", openAdminSidebar);
    document.getElementById("admin-sidebar-close").addEventListener("click", closeAdminSidebar);
    document.getElementById("admin-sidebar-scrim").addEventListener("click", closeAdminSidebar);
    document.getElementById("admin-signout").addEventListener("click", async () => { await window.GeeslaneAPI.logout(); location.replace("./admin.html"); });
    document.getElementById("open-create-client").addEventListener("click", () => {
      constrainDateInput(document.getElementById("new-project-target"));
      openModal("create-client-modal");
    });
    document.getElementById("close-create-client").addEventListener("click", () => closeModal("create-client-modal"));
    document.getElementById("cancel-create-client").addEventListener("click", () => closeModal("create-client-modal"));
    document.getElementById("save-create-client").addEventListener("click", createClient);
    document.getElementById("open-add-project").addEventListener("click", () => openAddProject(""));
    document.getElementById("close-add-project").addEventListener("click", () => closeModal("add-project-modal"));
    document.getElementById("cancel-add-project").addEventListener("click", () => closeModal("add-project-modal"));
    document.getElementById("save-add-project").addEventListener("click", addProject);
    document.getElementById("close-approval").addEventListener("click", () => closeModal("approval-modal"));
    document.getElementById("cancel-approval").addEventListener("click", () => closeModal("approval-modal"));
    document.getElementById("approve-registration").addEventListener("click", approveRegistration);
    document.getElementById("reject-registration").addEventListener("click", rejectRegistration);
    document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("mousedown", (event) => { if (event.target === modal) closeModal(modal.id); }));
    addEventListener("hashchange", () => {
      const route = parseAdminHash();
      navigate(pageTitles[route.page] ? route.page : "overview", { keepHash: true });
    });
  }

  async function init() {
    rememberAdminCommentRoute();
    wireEvents();
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    const savedUser = window.GEESLANE_CONFIG?.adminUsername || "";
    const usernameInput = document.getElementById("admin-username");
    if (savedUser && usernameInput && !usernameInput.value) usernameInput.value = savedUser;
    if (!window.GeeslaneAPI.backendConfigured()) {
      showAuthFeedback("Administrator sign-in is not connected on this host yet. Publish the latest client-portal/config.js, then refresh.", "notice");
      return;
    }
    const signingIn = window.GeeslaneAPI.hasIncomingMagicLink();
    if (signingIn) window.GeeslaneAPI.showLoader("Signing you in…");
    try {
      const authSession = await window.GeeslaneAPI.consumeMagicLink();
      if (!authSession) return;
      await completeAdminSession();
    } catch (error) {
      try { await window.GeeslaneAPI.logout(); } catch (_) { /* signed-out UI still continues */ }
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Administrator sign-in could not be completed. Enter a new 6-digit code, or use your password."));
    } finally {
      if (signingIn) window.GeeslaneAPI.hideLoader();
    }
  }

  init();
})();
