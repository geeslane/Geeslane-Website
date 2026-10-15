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

  function displayMoney(value) {
    const amount = String(value || "").trim();
    if (!amount) return "";
    if (/[₦N]|NGN/i.test(amount) && /[0-9]/.test(amount) && /[.,\s]/.test(amount)) return amount.replace(/^NGN\s*/i, "₦");
    const number = Number(String(amount).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(number)) return amount;
    const formatted = Number.isInteger(number) ? number.toLocaleString("en-NG") : number.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `₦${formatted}`;
  }

  function moneyLabel(data) {
    return displayMoney(data?.amount) || "Amount recorded";
  }

  function partyName(value, fallback = "Client") {
    return window.GeeslaneMail?.portalName?.(value) || String(value || "").trim() || fallback;
  }

  function documentHtml(data, options = {}) {
    const receipt = data || {};
    const paid = formatDate(receipt.paidOn) || formatDate(receipt.createdAt) || formatDate(new Date().toISOString());
    const client = partyName(receipt.clientName, receipt.business || "Client");
    const title = receipt.title || receipt.projectName || "Payment received";
    const description = receipt.description && receipt.description !== title ? receipt.description : "";
    const total = moneyLabel(receipt);
    const meta = [receipt.reference, receipt.projectName ? `Project: ${receipt.projectName}` : ""].filter(Boolean).join(" · ");
    return `
      <article class="quote-sheet" lang="en">
        <header class="quote-top">
          <div>
            <img class="quote-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
            <p class="quote-date">${escapeHtml(paid)}</p>
          </div>
          <h1 class="quote-title">RECEIPT</h1>
        </header>
        <p class="quote-to-label">TO</p>
        <p class="quote-to-name">${escapeHtml(client)}</p>
        <p class="quote-meta">${escapeHtml(meta)}</p>
        <table class="quote-table">
          <thead><tr><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(title)}${description ? `<small>${escapeHtml(description).replace(/\n/g, "<br />")}</small>` : ""}</td><td>${escapeHtml(total)}</td></tr>
            ${receipt.notes ? `<tr><td colspan="2"><small>${escapeHtml(receipt.notes).replace(/\n/g, "<br />")}</small></td></tr>` : ""}
          </tbody>
        </table>
        <div class="quote-total"><div><span>TOTAL</span><strong>${escapeHtml(total)}</strong></div></div>
        ${receipt.method ? `<p class="quote-method"><span>Payment method</span><strong>${escapeHtml(receipt.method)}</strong></p>` : ""}
        <p class="quote-thanks-copy">Thank you for your payment.</p>
        <p class="quote-regards">Kind regards,</p>
        <p class="quote-sign">Lois</p>
        <p class="quote-sign-name">Lois Adegbohungbe</p>
        <p class="quote-sign-role">Founder, Geeslane</p>
        ${window.GeeslaneDocs?.billingFooter?.() || ""}
      </article>
    `;
  }

  function view(data, options) {
    return window.GeeslaneDocs.viewHtml(data?.reference || "Receipt", documentHtml(data, options));
  }

  function printDocument(data, options) {
    if (window.GeeslaneDocs?.printHtml) {
      window.GeeslaneDocs.printHtml(data?.reference || "Receipt", documentHtml(data, options));
      return;
    }
  }

  async function pdfAttachment(data, options) {
    const name = `${String(data?.reference || "receipt").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    return window.GeeslaneDocs?.pdfAttachment?.(data?.reference || "Receipt", documentHtml(data, options), name) || null;
  }

  async function downloadPdf(data, options) {
    const name = `${String(data?.reference || "receipt").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    if (window.GeeslaneDocs?.downloadPdf) {
      return window.GeeslaneDocs.downloadPdf(data?.reference || "Receipt", documentHtml(data, options), name);
    }
    printDocument(data, options);
    return false;
  }

  window.GeeslaneReceipt = Object.freeze({
    documentHtml,
    renderInto(node, data, options) {
      if (!node) return;
      node.innerHTML = documentHtml(data, options);
    },
    view,
    print: printDocument,
    downloadPdf,
    pdfAttachment
  });
})();
