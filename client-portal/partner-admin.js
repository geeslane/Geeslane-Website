(function () {
  "use strict";

  const PIPELINE = {
    new: "New request",
    under_review: "Under review",
    contacted: "Contacted",
    quote_sent: "Quote sent",
    awaiting_initial: "Awaiting initial payment",
    initial_received: "Initial payment received",
    awaiting_balance: "Awaiting balance payment",
    fully_paid: "Fully paid",
    cancelled: "Cancelled",
    ineligible: "Ineligible"
  };
  const ELIGIBILITY = { pending: "Pending verification", eligible: "Eligible", ineligible: "Not eligible" };
  const REASONS = {
    existing_client: "Existing Geeslane client",
    prior_conversation: "Active sales conversation before referral",
    outside_window: "Referral submitted outside the programme period",
    initial_not_in_november: "Initial payment did not clear in November",
    other: "Other"
  };
  const KIND = { first: "Initial 50%", second: "Final 50%", project: "Project payment" };
  const FILTERS = [
    ["all", "All"],
    ["no-contact", "No contact yet"],
    ["awaiting-quote", "Awaiting quotation"],
    ["quote-unpaid", "Quotation sent, no initial payment"],
    ["initial-received", "Initial payment received"],
    ["awaiting-balance", "Awaiting balance"],
    ["deadline", "Nearing 30 November"]
  ];

  let board = { stats: null, partners: [], referrals: [], earnings: [], payouts: [], notifications: [] };
  let tab = "overview";
  let referralFilter = "all";
  let partnerQuery = "";
  let partnerStatus = "";
  let referralQuery = "";
  let payoutPartner = "";
  let payoutState = "due";
  let payoutFrom = "";
  let payoutTo = "";
  let detail = null;
  let banks = {};

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function naira(value) {
    return `NGN ${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function dateLabel(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
  }

  function lagosToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  function daysBetween(start, end) {
    const from = Date.parse(`${String(start).slice(0, 10)}T00:00:00Z`);
    const to = Date.parse(`${String(end).slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    return Math.max(0, Math.round((to - from) / 86400000));
  }

  function amount(value) {
    const number = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(number) ? number : NaN;
  }

  function portalBase() {
    const configured = String(window.GEESLANE_CONFIG?.portalUrl || "").trim();
    if (configured) return configured.endsWith("/") ? configured : `${configured}/`;
    return new URL("./", location.href).href;
  }

  function setNote(message, isError) {
    const node = document.getElementById("partner-admin-note");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  function partnerById(id) {
    return board.partners.find((item) => item.id === id) || null;
  }

  function referralById(id) {
    return board.referrals.find((item) => item.id === id) || null;
  }

  function earningFor(referralId, kind) {
    return board.earnings.find((item) => item.referralId === referralId && item.kind === kind) || null;
  }

  function paymentLabel(referral, kind) {
    const row = earningFor(referral.id, kind);
    if (!row) return "Not received";
    if (row.payoutStatus === "forfeited") return "Not payable";
    return `Received ${dateLabel(row.clientPaidOn)}`;
  }

  function pipelineOf(item) {
    if (item.pipeline && PIPELINE[item.pipeline]) return item.pipeline;
    if (item.status === "qualified") return "awaiting_balance";
    if (item.status === "excluded") return "ineligible";
    if (item.status === "cancelled") return "cancelled";
    return "new";
  }

  function figures() {
    if (board.stats && board.stats.partners != null) return board.stats;
    const live = board.earnings.filter((item) => item.payoutStatus === "due" || item.payoutStatus === "paid");
    const sum = (rows) => rows.reduce((total, item) => total + Number(item.commission || 0), 0);
    return {
      partners: board.partners.length,
      referrals: board.referrals.length,
      awaitingReview: board.referrals.filter((item) => (item.eligibility || "pending") === "pending" && !["cancelled", "ineligible"].includes(pipelineOf(item))).length,
      qualified: board.referrals.filter((item) => item.status === "qualified").length,
      initialPayments: board.earnings.filter((item) => item.kind === "first" && item.payoutStatus !== "forfeited").length,
      commissionEarned: sum(live),
      awaitingTransfer: sum(board.earnings.filter((item) => item.payoutStatus === "due")),
      transferred: sum(board.earnings.filter((item) => item.payoutStatus === "paid"))
    };
  }

  function matchesReferral(item) {
    const query = referralQuery.trim().toLowerCase();
    const haystack = `${item.business || ""} ${item.partnerName || ""} ${item.service || ""} ${item.code || ""}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    const pipeline = pipelineOf(item);
    const initial = Boolean(earningFor(item.id, "first") && earningFor(item.id, "first").payoutStatus !== "forfeited");
    const balance = Boolean(earningFor(item.id, "second") && earningFor(item.id, "second").payoutStatus !== "forfeited");
    const today = lagosToday();
    if (referralFilter === "no-contact") return pipeline === "new";
    if (referralFilter === "awaiting-quote") return ["new", "under_review", "contacted"].includes(pipeline);
    if (referralFilter === "quote-unpaid") return ["quote_sent", "awaiting_initial"].includes(pipeline) && !initial;
    if (referralFilter === "initial-received") return initial;
    if (referralFilter === "awaiting-balance") return pipeline === "awaiting_balance" || (initial && !balance && !["cancelled", "ineligible", "fully_paid"].includes(pipeline));
    if (referralFilter === "deadline") return today >= "2026-11-23" && today <= "2026-11-30" && !initial && !["cancelled", "ineligible", "fully_paid"].includes(pipeline);
    return true;
  }

  function maskedAccount(item) {
    const last4 = item.accountLast4 || String(item.accountNumber || "").slice(-4);
    return last4 ? `${escapeHtml(item.bankName || "Bank")} · ****${escapeHtml(last4)} · ${escapeHtml(item.accountName || "")}` : escapeHtml(item.bankName || "");
  }

  async function mailPartner(email, subject, text) {
    if (!email) return false;
    return window.GeeslaneAPI.sendPortalMail({
      kind: "partner-notice",
      audience: "client",
      clientEmail: email,
      subject,
      text
    });
  }

  function mailNote(saved, sent) {
    setNote(sent ? saved : `${saved} The email could not be sent. The update is on their partner page, and you can try the email again.`);
  }

  function panel(html) {
    const node = document.getElementById("partner-admin-panel");
    if (node) node.innerHTML = html;
    document.querySelectorAll("[data-partner-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.partnerTab === tab);
    });
  }

  function overviewHtml() {
    const stats = figures();
    const cards = [
      ["Registered partners", stats.partners],
      ["Referrals received", stats.referrals],
      ["Awaiting review", stats.awaitingReview],
      ["Qualified referrals", stats.qualified],
      ["Initial payments received", stats.initialPayments],
      ["Commission earned", naira(stats.commissionEarned)],
      ["Awaiting transfer", naira(stats.awaitingTransfer)],
      ["Commission transferred", naira(stats.transferred)]
    ];
    return `<section class="partner-admin-metrics">${cards.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</section>
      <section class="card admin-card"><h3>Follow-up queues</h3><p class="partner-copy">These lists come from referral records. Share the matching message from the Community Manager Guide in the existing WhatsApp group. This page does not message prospects.</p><div class="partner-admin-tabs">${FILTERS.filter(([id]) => id !== "all").map(([id, label]) => `<button type="button" data-open-filter="${id}">${escapeHtml(label)}</button>`).join("")}</div></section>`;
  }

  function partnersHtml() {
    const rows = board.partners.filter((item) => {
      const query = partnerQuery.trim().toLowerCase();
      const haystack = `${item.name} ${item.email} ${item.phone} ${item.code}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (partnerStatus && item.status !== partnerStatus) return false;
      return true;
    });
    const table = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th></th><th>Partner</th><th>Phone</th><th>Code</th><th>Registered</th><th>Referrals</th><th>Earned</th><th>Paid</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td><input type="checkbox" data-announce-id="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.name)}" /></td><td><button class="text-button" type="button" data-open-partner="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button><br><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.phone || "")}</td><td>${escapeHtml(item.code)}</td><td>${escapeHtml(dateLabel(item.createdAt))}</td><td>${escapeHtml(item.referralCount || 0)}</td><td>${escapeHtml(naira(item.commissionEarned))}</td><td>${escapeHtml(naira(item.commissionPaid))}</td><td>${escapeHtml(item.status === "suspended" ? "Suspended" : "Active")}<br><small>${escapeHtml(item.accessStatus === "revoked" ? "Dashboard revoked" : "Dashboard active")}</small></td></tr>`).join("") : `<tr><td colspan="9">No partners yet.</td></tr>`}</tbody></table></div>`;
    return `<section class="card admin-card"><div class="admin-toolbar"><label class="search-field"><input id="partner-people-search" type="search" placeholder="Search name, email, phone, or code" value="${escapeHtml(partnerQuery)}" /></label><label class="compact-field"><span>Status</span><select id="partner-people-status"><option value="">All</option><option value="active" ${partnerStatus === "active" ? "selected" : ""}>Active</option><option value="suspended" ${partnerStatus === "suspended" ? "selected" : ""}>Suspended</option></select></label></div>${table}</section>
      <section class="card admin-card"><h3>Announcement</h3><form id="partner-announce-form" class="form-grid"><div class="field field-full"><label for="partner-announce-body">Message</label><textarea id="partner-announce-body" name="body" rows="4" required placeholder="Programme update for partners"></textarea></div><label class="admin-active-toggle field-full"><input name="all" type="checkbox" /><span>Send to every registered partner</span></label><label class="admin-active-toggle field-full"><input name="email" type="checkbox" /><span>Also send by email</span></label><div class="field field-full"><button class="button button-primary" type="submit">Post announcement</button></div></form><p class="partner-copy">Selected partners are the ticked rows above. Leave the ticks unused when sending to everyone.</p></section>${detail && detail.type === "partner" ? partnerDetailHtml() : ""}`;
  }

  function partnerDetailHtml() {
    const item = partnerById(detail.id);
    if (!item) return `<section class="card admin-card"><p>That partner is not on this list.</p></section>`;
    const referrals = board.referrals.filter((row) => row.partnerId === item.id);
    const earnings = board.earnings.filter((row) => row.partnerId === item.id);
    const payouts = board.payouts.filter((row) => row.partnerId === item.id);
    const audit = detail.record?.audit || [];
    const link = detail.freshLink ? `<p><strong>New dashboard link.</strong> Copy it now. It will not be shown again.</p><p><input readonly value="${escapeHtml(detail.freshLink)}" /></p>` : "";
    return `<section class="card admin-card" id="partner-detail"><h3>${escapeHtml(item.name)}</h3>${link}
      <p>${escapeHtml(item.email)} · ${escapeHtml(item.phone || "No phone")} · Code ${escapeHtml(item.code)}</p>
      <p>Registered ${escapeHtml(dateLabel(item.createdAt))}. ${item.adminNotifiedAt ? "Admin registration alert sent." : "Admin registration alert not confirmed."}</p>
      <p>Bank on file: ${maskedAccount(item)}. The full account number is shown only when you record a payout.</p>
      <p>Status: ${escapeHtml(item.status === "suspended" ? "Suspended" : "Active")}. Dashboard: ${escapeHtml(item.accessStatus === "revoked" ? "Revoked" : "Active")}.</p>
      <div class="partner-admin-actions">
        <button class="button button-secondary" type="button" data-copy-invite="${escapeHtml(item.code)}">Copy invite link</button>
        ${item.adminNotifiedAt ? "" : `<button class="button button-secondary" type="button" data-resend-alert="${escapeHtml(item.id)}">Resend registration alert</button>`}
        <button class="button button-secondary" type="button" data-partner-status="${escapeHtml(item.id)}" data-status="${item.status === "suspended" ? "active" : "suspended"}">${item.status === "suspended" ? "Reinstate" : "Suspend"}</button>
        <button class="button button-secondary" type="button" data-revoke-access="${escapeHtml(item.id)}">Revoke dashboard link</button>
        <button class="button button-secondary" type="button" data-regenerate-access="${escapeHtml(item.id)}">Regenerate dashboard link</button>
      </div>
      <h3>Referrals</h3>${miniReferrals(referrals)}
      <h3>Commissions</h3>${miniEarnings(earnings)}
      <h3>Payouts</h3>${miniPayouts(payouts)}
      <h3>History</h3>${auditList(audit)}</section>`;
  }

  function referralsHtml() {
    const rows = board.referrals.filter(matchesReferral);
    const filters = FILTERS.map(([id, label]) => `<button type="button" data-referral-filter="${id}" class="${referralFilter === id ? "is-active" : ""}">${escapeHtml(label)}</button>`).join("");
    const table = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Business</th><th>Service</th><th>Partner</th><th>Code</th><th>Submitted</th><th>Status</th><th>Eligible fee</th><th>Initial</th><th>Balance</th><th>Eligibility</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td><button class="text-button" type="button" data-open-referral="${escapeHtml(item.id)}">${escapeHtml(item.business || "Business")}</button></td><td>${escapeHtml(item.service || "")}</td><td>${escapeHtml(item.partnerName || "")}</td><td>${escapeHtml(item.code || "")}</td><td>${escapeHtml(dateLabel(item.createdAt))}</td><td>${escapeHtml(PIPELINE[pipelineOf(item)] || "")}</td><td>${item.eligibleFee ? escapeHtml(naira(item.eligibleFee)) : ""}</td><td>${escapeHtml(paymentLabel(item, "first"))}</td><td>${escapeHtml(paymentLabel(item, "second"))}</td><td>${escapeHtml(ELIGIBILITY[item.eligibility] || ELIGIBILITY.pending)}</td></tr>`).join("") : `<tr><td colspan="10">No referrals in this view.</td></tr>`}</tbody></table></div>`;
    return `<section class="card admin-card"><div class="admin-toolbar"><label class="search-field"><input id="partner-referral-search" type="search" placeholder="Search business, partner, service, or code" value="${escapeHtml(referralQuery)}" /></label></div><div class="partner-admin-tabs">${filters}</div><p class="partner-copy">Use the Community Manager Guide for the wording, then partners follow up with their own prospects.</p>${table}</section>${detail && detail.type === "referral" ? referralDetailHtml() : ""}`;
  }

  function referralDetailHtml() {
    const item = referralById(detail.id);
    if (!item) return `<section class="card admin-card"><p>That referral is not on this list.</p></section>`;
    const partner = partnerById(item.partnerId);
    const request = detail.record?.request;
    const project = detail.record?.project;
    const audit = detail.record?.audit || [];
    const earnings = board.earnings.filter((row) => row.referralId === item.id);
    const quoteWait = item.quoteSentOn && !earningFor(item.id, "first")
      ? `Quotation sent ${dateLabel(item.quoteSentOn)}. Awaiting initial payment for ${daysBetween(item.quoteSentOn, lagosToday())} days.`
      : "";
    const options = Object.entries(PIPELINE).filter(([id]) => !["cancelled", "ineligible"].includes(id)).map(([id, label]) => `<option value="${id}" ${pipelineOf(item) === id ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    const reasonOptions = Object.entries(REASONS).map(([id, label]) => `<option value="${id}" ${item.ineligibleReason === id ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    return `<section class="card admin-card" id="partner-referral-detail"><h3>${escapeHtml(item.business || "Referral")}</h3>
      <p>${escapeHtml(item.service || "")} · ${escapeHtml(item.partnerName || "")} · ${escapeHtml(item.code || "")}</p>
      <p>Submitted ${escapeHtml(dateLabel(item.createdAt))}. Status: ${escapeHtml(PIPELINE[pipelineOf(item)])}. Eligibility: ${escapeHtml(ELIGIBILITY[item.eligibility] || ELIGIBILITY.pending)}${item.ineligibleReason ? ` (${escapeHtml(REASONS[item.ineligibleReason] || item.ineligibleReason)})` : ""}.</p>
      ${quoteWait ? `<p>${escapeHtml(quoteWait)}</p>` : ""}
      <h3>Original request</h3>
      <p>${request ? `${escapeHtml(request.name || "")} · ${escapeHtml(request.email || item.clientEmail || "")} · ${escapeHtml(request.phone || item.clientPhone || "")}` : `${escapeHtml(item.clientName || "")} · ${escapeHtml(item.clientEmail || item.email || "")} · ${escapeHtml(item.clientPhone || "")}`}</p>
      <p>${escapeHtml(request?.description || item.description || "No request description was stored.")}</p>
      ${project ? `<p>Project: ${escapeHtml(project.name || "")} · ${escapeHtml(project.service || "")} · ${escapeHtml(dateLabel(project.createdAt))}</p>` : ""}
      <form id="partner-referral-form" class="form-grid" data-referral-id="${escapeHtml(item.id)}">
        <div class="field"><label>Status</label><select name="pipeline">${options}</select></div>
        <div class="field"><label>Quote amount</label><input name="quoteAmount" inputmode="decimal" value="${item.quoteAmount ?? ""}" /></div>
        <div class="field"><label>Eligible Geeslane fee</label><input name="eligibleFee" inputmode="decimal" value="${item.eligibleFee ?? ""}" /></div>
        <div class="field"><label>Quote sent</label><input name="quoteSentOn" type="date" value="${String(item.quoteSentOn || "").slice(0, 10)}" /></div>
        <div class="field field-full"><label>Internal notes</label><textarea name="notes" rows="3">${escapeHtml(item.notes || "")}</textarea></div>
        <div class="field field-full"><button class="button button-primary" type="submit">Save referral</button></div>
      </form>
      <form id="partner-eligibility-form" class="form-grid" data-referral-id="${escapeHtml(item.id)}">
        <div class="field"><label>Eligibility</label><select name="eligibility"><option value="pending" ${(item.eligibility || "pending") === "pending" ? "selected" : ""}>Pending verification</option><option value="eligible" ${item.eligibility === "eligible" ? "selected" : ""}>Eligible</option><option value="ineligible" ${item.eligibility === "ineligible" ? "selected" : ""}>Not eligible</option></select></div>
        <div class="field"><label>Reason if not eligible</label><select name="reason">${reasonOptions}</select></div>
        <div class="field field-full"><button class="button button-secondary" type="submit">Save eligibility</button> <button class="button button-secondary" type="button" data-cancel-referral="${escapeHtml(item.id)}">Cancel referral</button></div>
      </form>
      <h3>Record payment</h3>
      <form id="partner-payment-form" class="form-grid" data-referral-id="${escapeHtml(item.id)}">
        <div class="field"><label>Payment type</label><select name="kind"><option value="first">Initial 50%</option><option value="second">Final 50%</option></select></div>
        <div class="field"><label>Total client payment received</label><input name="gross" inputmode="decimal" /></div>
        <div class="field"><label>Eligible Geeslane service fee</label><input name="eligibleFee" inputmode="decimal" required /></div>
        <div class="field"><label>Third-party costs</label><input name="thirdParty" inputmode="decimal" value="0" /></div>
        <div class="field"><label>Date payment cleared</label><input name="paidOn" type="date" required /></div>
        <div class="field"><label>Payment reference</label><input name="reference" required /></div>
        <label class="admin-active-toggle field-full"><input name="verified" type="checkbox" /><span>I confirm this payment has cleared</span></label>
        <div class="field field-full"><button class="button button-primary" type="submit">Save verified payment</button></div>
      </form>
      <h3>Payments and commission</h3>${miniEarnings(earnings)}
      <h3>Update for the partner</h3>
      <form id="partner-update-form" class="form-grid" data-referral-id="${escapeHtml(item.id)}" data-partner-email="${escapeHtml(partner?.email || "")}">
        <div class="field field-full"><textarea name="body" rows="3" placeholder="Your referred business has received a quotation. You may wish to follow up with them."></textarea></div>
        <label class="admin-active-toggle field-full"><input name="email" type="checkbox" /><span>Also send by email</span></label>
        <div class="field field-full"><button class="button button-secondary" type="submit">Save update</button></div>
      </form>
      <h3>History</h3>${auditList(audit)}</section>`;
  }

  function payoutsHtml() {
    const partnerOptions = [`<option value="">All partners</option>`].concat(board.partners.map((item) => `<option value="${escapeHtml(item.id)}" ${payoutPartner === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)).join("");
    const rows = board.earnings.filter((item) => {
      if (payoutPartner && item.partnerId !== payoutPartner) return false;
      if (payoutState === "due" && item.payoutStatus !== "due") return false;
      if (payoutState === "paid" && item.payoutStatus !== "paid") return false;
      const day = String(item.payoutStatus === "paid" ? item.payoutOn : item.clientPaidOn || "").slice(0, 10);
      if (payoutFrom && day && day < payoutFrom) return false;
      if (payoutTo && day && day > payoutTo) return false;
      return true;
    });
    const due = board.earnings.filter((item) => item.payoutStatus === "due" && (!payoutPartner || item.partnerId === payoutPartner));
    const bank = payoutPartner && banks[payoutPartner]
      ? `<p><strong>Pay this account.</strong> ${escapeHtml(banks[payoutPartner].bankName)} · ${escapeHtml(banks[payoutPartner].accountNumber)} · ${escapeHtml(banks[payoutPartner].accountName)}</p>`
      : `<p>Choose one partner to see the account number for the transfer.</p>`;
    const table = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Partner</th><th>Project</th><th>Payment</th><th>Commission</th><th>Status</th><th>Earned</th><th>Transferred</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td>${escapeHtml(item.partnerName)}</td><td>${escapeHtml(item.business)} · ${escapeHtml(item.project || "")}</td><td>${escapeHtml(KIND[item.kind] || item.kind)}</td><td>${escapeHtml(naira(item.commission))}</td><td>${escapeHtml(item.payoutStatus === "paid" ? "Paid" : item.payoutStatus === "forfeited" ? "Not payable" : "Awaiting transfer")}</td><td>${escapeHtml(dateLabel(item.clientPaidOn))}</td><td>${escapeHtml(dateLabel(item.payoutOn))}</td></tr>`).join("") : `<tr><td colspan="7">No commissions in this view.</td></tr>`}</tbody></table></div>`;
    const choices = due.map((item) => `<label class="admin-active-toggle"><input type="checkbox" name="earningId" value="${escapeHtml(item.id)}" data-commission="${escapeHtml(item.commission)}" /><span>${escapeHtml(item.business)} · ${escapeHtml(KIND[item.kind] || "")} · ${escapeHtml(naira(item.commission))}</span></label>`).join("");
    const history = board.payouts.length ? board.payouts.map((item) => `<li><strong>${escapeHtml(naira(item.amount))}</strong> to ${escapeHtml(item.partnerName)} on ${escapeHtml(dateLabel(item.transferredOn))}. ${escapeHtml(item.reference)}. ${(item.earnings || []).map((earning) => `${escapeHtml(earning.business)} ${escapeHtml(KIND[earning.kind] || "")}`).join(", ")}</li>`).join("") : "<li>No payouts recorded yet.</li>";
    const labels = { referral_received: "Referral registered", payout_paid: "Commission paid", partner: "Partner", community_manager: "Community manager" };
    const notes = (board.notifications || []).map((item) => {
      const retry = item.status === "failed" || item.status === "pending" ? ` <button class="text-button" type="button" data-retry-notification="${escapeHtml(item.id)}">Retry</button>` : "";
      return `<li>${escapeHtml(labels[item.eventType] || item.eventType)} · ${escapeHtml(labels[item.role] || item.role)} · ${escapeHtml(item.partnerName || "")} · ${escapeHtml(item.status)}${item.lastError ? ` · ${escapeHtml(item.lastError)}` : ""}${retry}</li>`;
    }).join("");
    return `<section class="card admin-card"><div class="admin-toolbar"><label class="compact-field"><span>Partner</span><select id="partner-payout-partner">${partnerOptions}</select></label><label class="compact-field"><span>Status</span><select id="partner-payout-state"><option value="due" ${payoutState === "due" ? "selected" : ""}>Awaiting transfer</option><option value="paid" ${payoutState === "paid" ? "selected" : ""}>Paid</option><option value="" ${payoutState === "" ? "selected" : ""}>All</option></select></label><label class="compact-field"><span>From</span><input id="partner-payout-from" type="date" value="${escapeHtml(payoutFrom)}" /></label><label class="compact-field"><span>To</span><input id="partner-payout-to" type="date" value="${escapeHtml(payoutTo)}" /></label></div>${table}</section>
      <section class="card admin-card"><h3>Record payout</h3>${bank}<form id="partner-payout-form" class="form-grid">${choices || "<p>No commissions are awaiting transfer for this view.</p>"}<div class="field"><label>Date transferred</label><input name="payoutOn" type="date" required /></div><div class="field"><label>Amount transferred</label><input name="amount" inputmode="decimal" required /></div><div class="field"><label>Transfer reference</label><input name="reference" required /></div><div class="field"><label>Receipt note</label><input name="note" /></div><label class="admin-active-toggle field-full"><input name="confirmed" type="checkbox" /><span>I confirm this transfer has been sent</span></label><div class="field field-full"><button class="button button-primary" type="submit">Record payout</button></div></form></section>
      <section class="card admin-card"><h3>Transfers</h3><ul class="partner-feature-list">${history}</ul></section>
      <section class="card admin-card"><h3>Email notifications</h3><p class="partner-copy">These are sent by the server after a referral is saved or a payout is confirmed. Retry sends a failed email again and leaves a sent email alone.</p><ul class="partner-feature-list">${notes || "<li>No notification records yet.</li>"}</ul></section>`;
  }

  function miniReferrals(rows) {
    if (!rows.length) return "<p>No referrals yet.</p>";
    return `<ul class="partner-feature-list">${rows.map((item) => `<li><button class="text-button" type="button" data-open-referral="${escapeHtml(item.id)}">${escapeHtml(item.business || "Business")}</button> · ${escapeHtml(PIPELINE[pipelineOf(item)])} · ${escapeHtml(ELIGIBILITY[item.eligibility] || ELIGIBILITY.pending)}</li>`).join("")}</ul>`;
  }

  function miniEarnings(rows) {
    if (!rows.length) return "<p>No commission yet.</p>";
    return `<ul class="partner-feature-list">${rows.map((item) => `<li>${escapeHtml(item.business || item.project || "Project")} · ${escapeHtml(KIND[item.kind] || item.kind)} · ${escapeHtml(naira(item.commission))} · ${escapeHtml(item.payoutStatus === "paid" ? `Paid ${dateLabel(item.payoutOn)}` : item.payoutStatus === "forfeited" ? "Not payable" : "Awaiting transfer")} · Verified</li>`).join("")}</ul>`;
  }

  function miniPayouts(rows) {
    if (!rows.length) return "<p>No payouts yet.</p>";
    return `<ul class="partner-feature-list">${rows.map((item) => `<li>${escapeHtml(dateLabel(item.transferredOn))} · ${escapeHtml(naira(item.amount))} · ${escapeHtml(item.reference)}</li>`).join("")}</ul>`;
  }

  function auditList(rows) {
    if (!rows.length) return "<p>No admin history yet.</p>";
    return `<ul class="partner-feature-list">${rows.map((item) => `<li>${escapeHtml(dateLabel(item.createdAt))} · ${escapeHtml(item.action)} · ${escapeHtml(item.actor || "system")}</li>`).join("")}</ul>`;
  }

  function render() {
    if (tab === "partners") panel(partnersHtml());
    else if (tab === "referrals") panel(referralsHtml());
    else if (tab === "payouts") panel(payoutsHtml());
    else panel(overviewHtml());
  }

  async function openPartner(id) {
    tab = "partners";
    detail = { type: "partner", id, record: null, freshLink: detail && detail.id === id ? detail.freshLink : "" };
    render();
    try {
      detail.record = await window.GeeslaneAPI.adminPartnerRecord(id, null);
      render();
    } catch (error) {
      setNote(error.userMessage || "Could not load the partner history.", true);
    }
  }

  async function openReferral(id) {
    tab = "referrals";
    detail = { type: "referral", id, record: null };
    render();
    try {
      detail.record = await window.GeeslaneAPI.adminPartnerRecord(null, id);
      render();
    } catch (error) {
      setNote(error.userMessage || "Could not load the referral.", true);
    }
  }

  async function load() {
    try {
      const next = await window.GeeslaneAPI.adminPartnerBoard();
      board = {
        stats: next.stats || null,
        partners: next.partners || [],
        referrals: next.referrals || [],
        earnings: next.earnings || [],
        payouts: next.payouts || [],
        notifications: board.notifications || []
      };
      try {
        board.notifications = await window.GeeslaneAPI.adminPartnerNotifications() || [];
      } catch (_) {
        board.notifications = [];
      }
      const requested = new URLSearchParams((location.hash.split("?")[1] || "")).get("partner");
      render();
      if (requested && partnerById(requested) && !detail) openPartner(requested);
      setNote("");
    } catch (error) {
      setNote(error.userMessage || "Could not load the partner programme. Run supabase/partner_programme_ops.sql in Supabase, then refresh.", true);
    }
  }

  async function afterChange(message, mailed) {
    const current = detail ? { ...detail } : null;
    await load();
    if (current?.type === "partner") await openPartner(current.id);
    if (current?.type === "referral") await openReferral(current.id);
    if (current?.freshLink && detail) detail.freshLink = current.freshLink;
    mailNote(message, mailed !== false);
    render();
  }

  document.getElementById("admin-partners-page")?.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-partner-tab]");
    if (tabButton) {
      tab = tabButton.dataset.partnerTab;
      detail = null;
      render();
      return;
    }
    const filterButton = event.target.closest("[data-open-filter]");
    if (filterButton) {
      referralFilter = filterButton.dataset.openFilter;
      tab = "referrals";
      detail = null;
      render();
      return;
    }
    const referralFilterButton = event.target.closest("[data-referral-filter]");
    if (referralFilterButton) {
      referralFilter = referralFilterButton.dataset.referralFilter;
      render();
      return;
    }
    const openPartnerButton = event.target.closest("[data-open-partner]");
    if (openPartnerButton) { openPartner(openPartnerButton.dataset.openPartner); return; }
    const openReferralButton = event.target.closest("[data-open-referral]");
    if (openReferralButton) { openReferral(openReferralButton.dataset.openReferral); return; }
    const copy = event.target.closest("[data-copy-invite]");
    if (copy) {
      const url = `${portalBase()}request.html?ref=${encodeURIComponent(copy.dataset.copyInvite)}`;
      try { await navigator.clipboard.writeText(url); copy.textContent = "Copied"; } catch (_) { setNote(url); }
      return;
    }
    const alertButton = event.target.closest("[data-resend-alert]");
    if (alertButton) {
      const partner = partnerById(alertButton.dataset.resendAlert);
      alertButton.disabled = true;
      const sent = partner ? await window.GeeslaneAPI.sendPortalMail({ kind: "partner-admin-alert", audience: "team", clientEmail: partner.email, subject: "New Geeslane partner registration" }) : false;
      if (sent) {
        try { await window.GeeslaneAPI.markPartnerNotified(partner.id); } catch (_) {}
      }
      await load();
      if (partner) await openPartner(partner.id);
      mailNote("Registration alert handled.", sent);
      return;
    }
    const statusButton = event.target.closest("[data-partner-status]");
    if (statusButton) {
      try {
        await window.GeeslaneAPI.setPartnerStatus(statusButton.dataset.partnerStatus, statusButton.dataset.status);
        await afterChange("Partner status saved.", true);
      } catch (error) { setNote(error.userMessage || "Could not update that partner.", true); }
      return;
    }
    const revoke = event.target.closest("[data-revoke-access]");
    if (revoke) {
      if (!window.confirm("Revoke this dashboard link? The partner will need a new one.")) return;
      try {
        await window.GeeslaneAPI.revokePartnerAccess(revoke.dataset.revokeAccess);
        await afterChange("Dashboard link revoked.", true);
      } catch (error) { setNote(error.userMessage || "Could not revoke that link.", true); }
      return;
    }
    const regenerate = event.target.closest("[data-regenerate-access]");
    if (regenerate) {
      try {
        const result = await window.GeeslaneAPI.regeneratePartnerToken(regenerate.dataset.regenerateAccess);
        const freshLink = `https://geeslane.com/partners?token=${encodeURIComponent(result.token || "")}`;
        await load();
        await openPartner(regenerate.dataset.regenerateAccess);
        if (detail) detail.freshLink = freshLink;
        render();
        setNote("New dashboard link created. Copy it from the partner record. The previous link no longer works.");
      } catch (error) { setNote(error.userMessage || "Could not create a new link.", true); }
      return;
    }
    const retry = event.target.closest("[data-retry-notification]");
    if (retry) {
      retry.disabled = true;
      try {
        await window.GeeslaneAPI.retryPartnerNotification(retry.dataset.retryNotification);
        tab = "payouts";
        await load();
        setNote("Retry requested. A notification that was already sent is not sent again.");
      } catch (error) {
        setNote(error.userMessage || "Could not retry that email.", true);
        retry.disabled = false;
      }
      return;
    }
    const cancel = event.target.closest("[data-cancel-referral]");
    if (cancel) {
      if (!window.confirm("Cancel this referral? Paid commission stays. Unpaid commission will not be paid.")) return;
      try {
        await window.GeeslaneAPI.cancelPartnerReferral(cancel.dataset.cancelReferral);
        const item = referralById(cancel.dataset.cancelReferral);
        const partner = item ? partnerById(item.partnerId) : null;
        const sent = await mailPartner(partner?.email, "A Geeslane referral was cancelled", `${item?.business || "A referral"} was cancelled. Commission already transferred stays with you. Any amount not yet transferred will not be paid.`);
        await afterChange("Referral cancelled.", sent);
      } catch (error) { setNote(error.userMessage || "Could not cancel that referral.", true); }
    }
  });

  document.getElementById("admin-partners-page")?.addEventListener("input", (event) => {
    if (event.target.id === "partner-people-search" || event.target.id === "partner-referral-search") {
      if (event.target.id === "partner-people-search") partnerQuery = event.target.value;
      if (event.target.id === "partner-referral-search") referralQuery = event.target.value;
      const id = event.target.id;
      const pos = event.target.selectionStart;
      render();
      const field = document.getElementById(id);
      if (field) {
        field.focus();
        field.selectionStart = field.selectionEnd = pos;
      }
      return;
    }
    if (event.target.id === "partner-payout-from") payoutFrom = event.target.value;
    if (event.target.id === "partner-payout-to") payoutTo = event.target.value;
    const form = document.getElementById("partner-payout-form");
    if (form && event.target.name === "earningId") {
      const total = [...form.querySelectorAll("input[name=earningId]:checked")].reduce((sum, box) => sum + Number(box.dataset.commission || 0), 0);
      if (form.amount) form.amount.value = total ? total.toFixed(2) : "";
    }
  });

  document.getElementById("admin-partners-page")?.addEventListener("change", async (event) => {
    if (event.target.id === "partner-people-status") { partnerStatus = event.target.value; render(); return; }
    if (event.target.id === "partner-payout-state") { payoutState = event.target.value; render(); return; }
    if (event.target.id === "partner-payout-partner") {
      payoutPartner = event.target.value;
      if (payoutPartner && !banks[payoutPartner]) {
        try { banks[payoutPartner] = await window.GeeslaneAPI.adminPartnerBank(payoutPartner); } catch (error) { setNote(error.userMessage || "Could not load the bank details.", true); }
      }
      render();
    }
  });

  document.getElementById("admin-partners-page")?.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true, "Saving…");
    try {
      if (form.id === "partner-announce-form") {
        const selected = [...document.querySelectorAll("[data-announce-id]:checked")].map((box) => box.dataset.announceId);
        const recipients = await window.GeeslaneAPI.announceToPartners({ all: form.all.checked, partnerIds: selected, body: form.body.value });
        let failed = 0;
        if (form.email.checked) {
          for (const person of recipients || []) {
            const sent = await mailPartner(person.email, "A Geeslane partner update", form.body.value);
            if (!sent) failed += 1;
          }
        }
        form.reset();
        await load();
        setNote(failed ? `Announcement posted. ${failed} email${failed === 1 ? "" : "s"} could not be sent.` : "Announcement posted on the partner pages.");
        return;
      }
      if (form.id === "partner-referral-form") {
        await window.GeeslaneAPI.updatePartnerReferral({
          referralId: form.dataset.referralId,
          pipeline: form.pipeline.value,
          notes: form.notes.value,
          quoteAmount: form.quoteAmount.value,
          eligibleFee: form.eligibleFee.value,
          quoteSentOn: form.quoteSentOn.value
        });
        await afterChange("Referral saved.", true);
        return;
      }
      if (form.id === "partner-eligibility-form") {
        await window.GeeslaneAPI.setPartnerEligibility({
          referralId: form.dataset.referralId,
          eligibility: form.eligibility.value,
          reason: form.reason.value
        });
        const item = referralById(form.dataset.referralId);
        const partner = item ? partnerById(item.partnerId) : null;
        const changed = item?.eligibility !== form.eligibility.value;
        let sent = true;
        if (changed && form.eligibility.value === "eligible") sent = await mailPartner(partner?.email, "Your Geeslane referral is eligible", `${item?.business || "Your referral"} is eligible for the November programme.`);
        if (changed && form.eligibility.value === "ineligible") sent = await mailPartner(partner?.email, "A Geeslane referral is not eligible", `${item?.business || "A referral"} does not count for the November programme.`);
        await afterChange("Eligibility saved.", sent);
        return;
      }
      if (form.id === "partner-payment-form") {
        if (!form.verified.checked) { setNote("Confirm that the payment has cleared before saving.", true); return; }
        const eligibleFee = amount(form.eligibleFee.value);
        if (!Number.isFinite(eligibleFee) || eligibleFee <= 0) { setNote("Enter the eligible Geeslane service fee.", true); return; }
        const result = await window.GeeslaneAPI.recordPartnerPayment({
          referralId: form.dataset.referralId,
          kind: form.kind.value,
          gross: amount(form.gross.value) || 0,
          eligibleFee,
          thirdParty: amount(form.thirdParty.value) || 0,
          paidOn: form.paidOn.value,
          reference: form.reference.value,
          verified: true
        });
        const sent = await mailPartner(result.partnerEmail, "Geeslane commission earned", `${result.business}: the ${result.kind === "first" ? "initial 50%" : "final 50%"} cleared. Commission earned: ${naira(result.commission)}.`);
        await afterChange("Verified payment saved. Commission was calculated by the server.", sent);
        return;
      }
      if (form.id === "partner-update-form") {
        await window.GeeslaneAPI.addReferralUpdate(form.dataset.referralId, form.body.value);
        const sent = form.email.checked ? await mailPartner(form.dataset.partnerEmail, "An update on your Geeslane referral", form.body.value) : true;
        form.reset();
        await afterChange("Update saved on the partner page.", sent);
        return;
      }
      if (form.id === "partner-payout-form") {
        if (!form.confirmed.checked) { setNote("Confirm the transfer before recording the payout.", true); return; }
        if (!payoutPartner) { setNote("Choose one partner. A payout covers that partner's commissions.", true); return; }
        const earningIds = [...form.querySelectorAll("input[name=earningId]:checked")].map((box) => box.value);
        const payoutAmount = amount(form.amount.value);
        if (!earningIds.length || !Number.isFinite(payoutAmount)) { setNote("Choose the commissions and enter the amount transferred.", true); return; }
        await window.GeeslaneAPI.recordPartnerPayout({
          partnerId: payoutPartner,
          earningIds,
          amount: payoutAmount,
          payoutOn: form.payoutOn.value,
          reference: form.reference.value,
          note: form.note.value
        });
        form.reset();
        await afterChange("Payout recorded. The confirmation emails are sent by the server. Use Retry below if one did not go out.", true);
      }
    } catch (error) {
      setNote(error.userMessage || "Could not save that.", true);
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  });

  window.GeeslanePartnerAdmin = { load };
})();
