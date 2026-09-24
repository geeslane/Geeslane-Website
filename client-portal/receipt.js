(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
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
    const amount = String(data?.amount || "").trim();
    const currency = String(data?.currency || "NGN").trim();
    if (!amount) return "Amount recorded";
    return `${currency} ${amount}`.trim();
  }

  function partyName(value, fallback = "Client") {
    return window.GeeslaneMail?.portalName?.(value) || String(value || "").trim() || fallback;
  }

  function fact(label, value) {
    if (!value) return "";
    return `<div class="agreement-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function documentHtml(data, options = {}) {
    const receipt = data || {};
    const paid = formatDate(receipt.paidOn) || formatDate(receipt.createdAt) || formatDate(new Date().toISOString());
    const client = partyName(receipt.clientName, receipt.business || "Client");
    return `
      <article class="agreement-sheet receipt-sheet" lang="en">
        <header class="agreement-masthead">
          <img class="agreement-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
          <div>
            <p class="agreement-kicker">Payment Receipt</p>
            <h1>${escapeHtml(receipt.reference || "Receipt")}</h1>
          </div>
        </header>
        <p class="agreement-lead">Geeslane confirms receipt of the payment below. Keep this copy with your project records.</p>
        <section class="agreement-facts" aria-label="Receipt details">
          ${fact("Received from", client)}
          ${fact("Business", receipt.business)}
          ${fact("Project", receipt.projectName)}
          ${fact("Amount received", moneyLabel(receipt))}
          ${fact("Date received", paid)}
          ${fact("Payment method", receipt.method)}
          ${fact("Related invoice", receipt.invoiceReference)}
          ${fact("Status", receipt.status || "Issued")}
          ${receipt.title || receipt.description ? `<div class="agreement-fact agreement-fact-wide"><span>${escapeHtml(receipt.title || "Details")}</span><strong>${escapeHtml(receipt.description || receipt.title || "").replace(/\n/g, "<br />")}</strong></div>` : ""}
          ${receipt.notes ? `<div class="agreement-fact agreement-fact-wide"><span>Notes</span><strong>${escapeHtml(receipt.notes).replace(/\n/g, "<br />")}</strong></div>` : ""}
        </section>
        <section class="agreement-sign">
          <div class="agreement-sign-grid">
            <div class="agreement-sign-card">
              <span>Issued by</span>
              <img class="agreement-sign-logo" src="${escapeHtml(options.logoUrl || logoUrl())}" alt="Geeslane Technologies" />
              <small>Date: ${escapeHtml(paid)}</small>
            </div>
            <div class="agreement-sign-card">
              <span>Received from</span>
              <strong class="agreement-client-mark">${escapeHtml(client)}</strong>
              <small>${escapeHtml(receipt.business || "")}</small>
            </div>
          </div>
        </section>
      </article>
    `;
  }

  function documentCss() {
    return window.GeeslaneAgreement?.documentCss ? window.GeeslaneAgreement.documentCss() : "";
  }

  function view(data, options) {
    return window.GeeslaneDocs.viewHtml(data?.reference || "Receipt", documentHtml(data, options));
  }

  function printDocument(data, options) {
    if (window.GeeslaneDocs?.printHtml) {
      window.GeeslaneDocs.printHtml(data?.reference || "Receipt", documentHtml(data, options));
      return;
    }
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>${escapeHtml(data?.reference || "Receipt")}</title>
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
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (_) {}
      setTimeout(() => frame.remove(), 1000);
    }, 350);
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
