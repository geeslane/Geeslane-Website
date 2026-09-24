(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function fullHtml(title, bodyHtml, options = {}) {
    const css = options.css || window.GeeslaneAgreement?.documentCss?.() || "";
    const print = options.print ? `
      .agreement-sheet { box-shadow: none; border: 0; border-radius: 0; max-width: none; padding: 0; }
      @page { margin: 16mm; }
      @media print { body { padding: 0; } }` : "";
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title || "Geeslane")}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: ${options.print ? "24px" : "28px 16px 48px"}; color: #17211c; background: ${options.print ? "#fff" : "#f5f8f6"}; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
        ${css}
        ${print}
      </style></head><body>${bodyHtml}</body></html>`;
  }

  function viewHtml(title, bodyHtml) {
    const page = window.open("", "_blank", "noopener,noreferrer");
    if (!page) return false;
    page.document.open();
    page.document.write(fullHtml(title, bodyHtml));
    page.document.close();
    return true;
  }

  function printHtml(title, bodyHtml) {
    const html = fullHtml(title, bodyHtml, { print: true });
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
      setTimeout(() => frame.remove(), 1200);
    }, 350);
  }

  function dataUrlToBase64(value) {
    const text = String(value || "");
    const marker = "base64,";
    const index = text.indexOf(marker);
    return index >= 0 ? text.slice(index + marker.length) : text;
  }

  async function toDataUrl(url) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) return "";
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return "";
    }
  }

  async function inlineImages(html) {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    await Promise.all([...holder.querySelectorAll("img")].map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await toDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
      else img.remove();
    }));
    return holder.innerHTML;
  }

  function waitForImages(root) {
    return Promise.all([...root.querySelectorAll("img")].map((img) => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 2500);
      });
    }));
  }

  function pdfOptions(filename) {
    return {
      margin: 0,
      filename: filename || "document.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
  }

  async function withPdfHost(bodyHtml, fn) {
    const css = window.GeeslaneAgreement?.documentCss?.() || "";
    const html = await inlineImages(bodyHtml);
    const style = document.createElement("style");
    style.setAttribute("data-pdf-style", "1");
    style.textContent = `${css}
      [data-pdf-host] { color: #17211c; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-pdf-host] .agreement-sheet { box-shadow: none; border: 0; border-radius: 0; max-width: none; margin: 0; padding: 0; background: #fff; }
      [data-pdf-host] .agreement-masthead { padding-bottom: 16px; gap: 16px; }
      [data-pdf-host] .agreement-facts { margin: 16px 0 14px; }
      [data-pdf-host] .agreement-fact { padding: 10px 12px; }
      [data-pdf-host] .agreement-lead { margin: 0 0 14px; }
      [data-pdf-host] .agreement-sign-card { min-height: 0; padding: 14px 16px; gap: 10px; }
      [data-pdf-host] img { max-width: 100%; height: auto; display: block; }
      .html2pdf__overlay, .html2pdf__container { left: -12000px !important; top: 0 !important; right: auto !important; bottom: auto !important; }`;
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("data-pdf-host", "1");
    host.style.cssText = "position:absolute;left:-12000px;top:0;width:720px;background:#fff;padding:20px 22px 24px;pointer-events:none;z-index:-1;";
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
      if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
      await waitForImages(host);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return await fn(host);
    } finally {
      host.remove();
      style.remove();
    }
  }

  async function pdfFromHost(host, filename) {
    const canvas = await window.html2pdf().set(pdfOptions(filename)).from(host).toCanvas();
    const seed = document.createElement("div");
    seed.style.cssText = "position:absolute;left:-12000px;top:0;width:8px;height:8px;background:#fff;";
    seed.textContent = ".";
    document.body.appendChild(seed);
    let pdf;
    try {
      pdf = await window.html2pdf().set({
        margin: 0,
        filename,
        html2canvas: { scale: 1, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(seed).toPdf().get("pdf");
    } finally {
      seed.remove();
    }
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = canvas.width / Math.max(canvas.height, 1);
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }
    const pages = pdf.internal.getNumberOfPages();
    for (let page = pages; page > 1; page -= 1) pdf.deletePage(page);
    pdf.setPage(1);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, "F");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", margin, margin, width, height, "", "FAST");
    if (pdf.internal.getNumberOfPages() > 1) {
      for (let page = pdf.internal.getNumberOfPages(); page > 1; page -= 1) pdf.deletePage(page);
    }
    return pdf;
  }

  async function pdfAttachment(title, bodyHtml, filename) {
    if (typeof window.html2pdf !== "function") return null;
    const name = filename || `${String(title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    try {
      const dataUrl = await withPdfHost(bodyHtml, async (host) => (await pdfFromHost(host, name)).output("datauristring"));
      const content = dataUrlToBase64(dataUrl);
      if (!content) return null;
      return { filename: name, content };
    } catch (_) {
      return null;
    }
  }

  async function downloadPdf(title, bodyHtml, filename) {
    if (typeof window.html2pdf !== "function") {
      printHtml(title, bodyHtml);
      return false;
    }
    const name = filename || `${String(title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    try {
      await withPdfHost(bodyHtml, async (host) => { (await pdfFromHost(host, name)).save(name); });
      return true;
    } catch (_) {
      printHtml(title, bodyHtml);
      return false;
    }
  }

  window.GeeslaneDocs = Object.freeze({
    escapeHtml, fullHtml, viewHtml, printHtml, pdfAttachment, downloadPdf
  });
})();
