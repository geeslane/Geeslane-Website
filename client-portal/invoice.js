(function () {
  "use strict";

  function escapeHtml(value) {
    return window.GeeslaneDocs?.escapeHtml ? window.GeeslaneDocs.escapeHtml(value) : String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(String(value).length <= 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function logoUrl() {
    try { return new URL("../images/logo.png", location.href).href; }
    catch (_) { return "https://geeslane.com/images/logo.png"; }
  }

  function moneyLabel(data) {
    const amount = String(data?.amount || data?.totalLabel || "").trim();
    const currency = String(data?.currency || "NGN").trim();
    if (!amount) return "Amount to follow";
    if (/[A-Z]{3}\s/.test(amount)) return amount;
    return `${currency} ${amount}`.trim();
  }

  function partyName(value, fallback = "Client") {
    return window.GeeslaneMail?.portalName?.(value) || String(value || "").trim() || fallback;
  }

  function fact(label, value) {
    if (!value) return "";
    return `<div class="agreement-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function bankBlock(bank) {
    if (!bank?.accountNumber && !bank?.accountName && !bank?.bankName) return "";
    return `
      <section class="agreement-facts" aria-label="Bank transfer">
        <div class="agreement-fact agreement-fact-wide"><span>Pay by transfer if online payment is not available</span><strong>
          ${escapeHtml([bank.bankName, bank.accountName, bank.accountNumber].filter(Boolean).join(" · "))}
          ${bank.bankNotes ? `<br />${escapeHtml(bank.bankNotes)}` : ""}
        </strong></div>
      </section>`;
  }

  function documentHtml(data, options = {}) {
    const invoice = data || {};
    const issued = formatDate(invoice.sentAt || invoice.createdAt) || formatDate(new Date().toISOString());
    const remaining = invoice.remainingLabel || "";
    const client = partyName(invoice.clientName, invoice.business || "Client");
    return `
      <article class="agreement-sheet receipt-sheet" lang="en">
        <header class="agreement-masthead">
          <img class="agreement-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
          <div>
            <p class="agreement-kicker">Invoice</p>
            <h1>${escapeHtml(invoice.reference || "Invoice")}</h1>
          </div>
        </header>
        <p class="agreement-lead">Please pay this invoice in your Geeslane portal. Use bank transfer only if online payment is not available.</p>
        <section class="agreement-facts" aria-label="Invoice details">
          ${fact("Bill to", client)}
          ${fact("Business", invoice.business)}
          ${fact("Project", invoice.projectName)}
          ${fact("Amount due", remaining || moneyLabel(invoice))}
          ${fact("Invoice total", moneyLabel(invoice))}
          ${fact("Paid so far", invoice.paidLabel)}
          ${fact("Date issued", issued)}
          ${fact("Due date", formatDate(invoice.dueDate))}
          ${fact("Status", invoice.status || "Sent")}
          ${invoice.title || invoice.description ? `<div class="agreement-fact agreement-fact-wide"><span>${escapeHtml(invoice.title || "Details")}</span><strong>${escapeHtml(invoice.description || invoice.title || "").replace(/\n/g, "<br />")}</strong></div>` : ""}
          ${invoice.notes ? `<div class="agreement-fact agreement-fact-wide"><span>Notes</span><strong>${escapeHtml(invoice.notes).replace(/\n/g, "<br />")}</strong></div>` : ""}
        </section>
        ${bankBlock(invoice.bank || options.bank)}
        <section class="agreement-sign">
          <div class="agreement-sign-grid">
            <div class="agreement-sign-card">
              <span>Issued by</span>
              <img class="agreement-sign-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
              <small>Date: ${escapeHtml(issued)}</small>
            </div>
            <div class="agreement-sign-card">
              <span>Bill to</span>
              <strong class="agreement-client-mark">${escapeHtml(client)}</strong>
              <small>${escapeHtml(invoice.business || "")}</small>
            </div>
          </div>
        </section>
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
