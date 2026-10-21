(function () {
  "use strict";

  function escapeHtml(value) {
    return window.GeeslaneDocs?.escapeHtml ? window.GeeslaneDocs.escapeHtml(value) : String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(String(value).length <= 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  }

  function logoUrl() {
    try { return new URL("../images/logo.png", location.href).href; }
    catch (_) { return "https://geeslane.com/images/logo.png"; }
  }

  function displayMoney(value, currency) {
    const amount = String(value || "").trim();
    if (!amount) return "";
    if (/[₦N]|NGN/i.test(amount) && /[0-9]/.test(amount) && /[.,\s]/.test(amount)) return amount.replace(/^NGN\s*/i, "₦");
    const number = Number(String(amount).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(number)) return amount;
    const formatted = Number.isInteger(number) ? number.toLocaleString("en-NG") : number.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `₦${formatted}`;
  }

  function moneyLabel(data) {
    return displayMoney(data?.amount || data?.totalLabel, data?.currency) || "Amount to follow";
  }

  function partyName(value, fallback = "Client") {
    return window.GeeslaneMail?.portalName?.(value) || String(value || "").trim() || fallback;
  }

  function bankBlock(bank) {
    if (!bank?.accountNumber && !bank?.accountName && !bank?.bankName) return "";
    const details = [bank.bankName, bank.accountName, bank.accountNumber].filter(Boolean).join(" · ");
    return `<div class="quote-bank"><strong>Pay by transfer</strong>${escapeHtml(details)}${bank.bankNotes ? `<br />${escapeHtml(bank.bankNotes)}` : ""}</div>`;
  }

  function documentHtml(data, options = {}) {
    const invoice = data || {};
    const issued = formatDate(invoice.sentAt || invoice.createdAt) || formatDate(new Date().toISOString());
    const remaining = displayMoney(invoice.remainingLabel, invoice.currency);
    const paid = displayMoney(invoice.paidLabel, invoice.currency);
    const total = moneyLabel(invoice);
    const client = partyName(invoice.clientName, invoice.business || "Client");
    const title = invoice.title || invoice.projectName || "Project invoice";
    const description = invoice.description && invoice.description !== title ? invoice.description : "";
    const due = formatDate(invoice.dueDate);
    const meta = [invoice.reference, invoice.projectName ? `Project: ${invoice.projectName}` : "", due ? `Due ${due}` : ""].filter(Boolean).join(" · ");
    const dueTotal = remaining && remaining !== total ? remaining : total;
    const totalLabel = remaining && remaining !== total ? "AMOUNT DUE" : "TOTAL";
    const split = window.GeeslaneDocs?.splitNotes?.(invoice.notes) || { notes: String(invoice.notes || "").replace(/\n*\[\[geeslane-copy\]\][\s\S]*$/, "").trim(), copy: {} };
    const signOff = window.GeeslaneDocs?.billingSignOff?.(split.copy) || "";
    return `
      <article class="quote-sheet" lang="en">
        <header class="quote-top">
          <div>
            <img class="quote-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
            <p class="quote-date">${escapeHtml(issued)}</p>
          </div>
          <h1 class="quote-title">INVOICE</h1>
        </header>
        <p class="quote-to-label">TO</p>
        <p class="quote-to-name">${escapeHtml(client)}</p>
        <p class="quote-meta">${escapeHtml(meta)}</p>
        <table class="quote-table">
          <thead><tr><th>Description</th><th>Price</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(title)}${description ? `<small>${escapeHtml(description).replace(/\n/g, "<br />")}</small>` : ""}</td><td>${escapeHtml(total)}</td></tr>
            ${paid && remaining && remaining !== total ? `<tr><td>Paid so far</td><td>${escapeHtml(paid)}</td></tr>` : ""}
            ${split.notes ? `<tr><td colspan="2"><small>${escapeHtml(split.notes).replace(/\n/g, "<br />")}</small></td></tr>` : ""}
          </tbody>
        </table>
        <div class="quote-total"><div><span>${totalLabel}</span><strong>${escapeHtml(dueTotal)}</strong></div></div>
        ${bankBlock(invoice.bank || options.bank)}
        ${signOff || `<p class="quote-regards">Kind regards,</p><p class="quote-sign">Lois</p><p class="quote-sign-name">Lois Adegbohungbe</p><p class="quote-sign-role">Founder, Geeslane</p>${window.GeeslaneDocs?.billingFooter?.() || ""}`}
      </article>
    `;
  }

  function view(data, options) {
    return window.GeeslaneDocs.viewHtml(data?.reference || "Invoice", documentHtml(data, options));
  }

  function printDocument(data, options) {
    window.GeeslaneDocs.printHtml(data?.reference || "Invoice", documentHtml(data, options));
  }

  async function pdfAttachment(data, options) {
    const name = `${String(data?.reference || "invoice").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    return window.GeeslaneDocs.pdfAttachment(data?.reference || "Invoice", documentHtml(data, options), name);
  }

  async function downloadPdf(data, options) {
    const name = `${String(data?.reference || "invoice").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    if (window.GeeslaneDocs?.downloadPdf) {
      return window.GeeslaneDocs.downloadPdf(data?.reference || "Invoice", documentHtml(data, options), name);
    }
    printDocument(data, options);
    return false;
  }

  window.GeeslaneInvoice = Object.freeze({
    documentHtml,
    view,
    print: printDocument,
    downloadPdf,
    pdfAttachment
  });
})();
