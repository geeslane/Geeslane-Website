(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function billingCss() {
    return `
      .quote-sheet { position: relative; min-height: 980px; max-width: 820px; margin: 0 auto; padding: 42px 48px 32px 70px; color: #17211c; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
      .quote-sheet::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: #063b29; }
      .quote-sheet::after { content: ""; position: absolute; left: 16px; top: 0; bottom: 0; width: 10px; background: #d8eee3; }
      .quote-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 8px; }
      .quote-logo { height: 42px; width: auto; }
      .quote-date { margin: 14px 0 0; color: #8a9690; font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .quote-title { margin: 0; color: #111; font-size: 2.35rem; font-weight: 800; letter-spacing: .08em; line-height: 1; }
      .quote-to-label { margin: 22px 0 0; color: #8a9690; text-align: right; font-size: .7rem; font-weight: 800; letter-spacing: .16em; }
      .quote-to-name { margin: 4px 0 0; color: #17211c; text-align: right; font-size: 1.05rem; font-weight: 700; }
      .quote-meta { margin: 6px 0 22px; color: #697870; text-align: right; font-size: .82rem; line-height: 1.5; }
      .quote-table { width: 100%; border-collapse: collapse; margin: 8px 0 0; }
      .quote-table th { padding: 12px 16px; color: #fff; background: #0b6b45; font-size: .78rem; font-weight: 800; letter-spacing: .04em; text-align: left; }
      .quote-table th:last-child, .quote-table td:last-child { text-align: right; white-space: nowrap; }
      .quote-table td { padding: 16px; color: #2a3931; border-bottom: 1px solid #e6eee9; font-size: .95rem; vertical-align: top; }
      .quote-table td small { display: block; margin-top: 4px; color: #697870; font-size: .8rem; line-height: 1.45; }
      .quote-total { display: flex; justify-content: flex-end; margin: 18px 0 8px; }
      .quote-total div { display: flex; align-items: center; justify-content: space-between; gap: 48px; min-width: 240px; padding: 14px 22px; color: #063b29; background: #eef7f2; font-weight: 800; letter-spacing: .08em; }
      .quote-total strong { font-size: 1.05rem; }
      .quote-bank { margin: 18px 0 8px; padding: 14px 16px; color: #2a3931; background: #f7fbf8; border-radius: 10px; font-size: .88rem; line-height: 1.55; }
      .quote-bank strong { display: block; margin-bottom: 4px; color: #063b29; }
      .quote-method { display: flex; justify-content: flex-end; align-items: baseline; gap: 18px; margin: 0 0 22px; color: #2a3931; font-size: .9rem; }
      .quote-method span { color: #697870; font-weight: 650; }
      .quote-thanks-copy { margin: 28px 0 18px; max-width: 520px; color: #4b5c54; font-size: .92rem; line-height: 1.65; }
      .quote-regards { margin: 28px 0 2px; color: #2a3931; font-size: .92rem; }
      .quote-sign { margin: 0; color: #0b6b45; font-family: "Great Vibes", "Segoe Script", cursive; font-size: 2.1rem; line-height: 1.2; }
      .quote-sign-name { margin: 6px 0 0; padding-top: 8px; border-top: 1px solid #dfe7e2; width: max-content; color: #17211c; font-size: .92rem; font-weight: 700; }
      .quote-sign-role { margin: 2px 0 0; color: #697870; font-size: .82rem; }
      .quote-footer { margin-top: auto; padding-top: 40px; }
      .quote-footer-links { display: flex; flex-wrap: wrap; gap: 18px 22px; color: #0b6b45; font-size: .78rem; font-weight: 650; }
      .quote-footer-links span { display: inline-flex; align-items: center; gap: 8px; }
      .quote-footer-links svg { width: 22px; height: 22px; flex: 0 0 22px; }
      .quote-footer-tag { margin: 14px 0 0; color: #8a9690; font-size: .68rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    `;
  }

  const COPY_MARK = "[[geeslane-copy]]";
  const BILLING_COPY = {
    thanks: "Thank you for your payment.",
    regards: "Kind regards,",
    sign: "Lois",
    signName: "Lois Adegbohungbe",
    role: "Founder, Geeslane",
    email: "contact@geeslane.com",
    site: "www.geeslane.com",
    social: "@gees.lane",
    tag: "Websites | AI Solutions | Digital Growth"
  };

  function resolveBillingCopy(saved) {
    const source = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    const copy = { ...BILLING_COPY };
    Object.keys(BILLING_COPY).forEach((key) => {
      const value = source[key] != null ? String(source[key]).trim() : "";
      if (value) copy[key] = value;
    });
    return copy;
  }

  function splitNotes(notes) {
    const text = String(notes || "");
    const index = text.indexOf(COPY_MARK);
    if (index < 0) return { notes: text.trim(), copy: {} };
    let copy = {};
    try {
      const parsed = JSON.parse(text.slice(index + COPY_MARK.length).trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) copy = parsed;
    } catch (_) { copy = {}; }
    return { notes: text.slice(0, index).trim(), copy };
  }

  function joinNotes(notes, copy) {
    const visible = String(notes || "").trim();
    const saved = {};
    const source = copy && typeof copy === "object" ? copy : {};
    Object.keys(BILLING_COPY).forEach((key) => {
      const value = source[key] != null ? String(source[key]).trim() : "";
      if (value && value !== BILLING_COPY[key]) saved[key] = value;
    });
    if (!Object.keys(saved).length) return visible;
    return `${visible}${visible ? "\n\n" : ""}${COPY_MARK}\n${JSON.stringify(saved)}`;
  }

  function billingFooter(copy) {
    const resolved = resolveBillingCopy(copy);
    const icon = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0b6b45"/>${inner}</svg>`;
    const mail = icon('<path fill="#fff" d="M6.2 8h11.6v8H6.2V8zm1.1.9 4.7 3.1 4.7-3.1V8.6L12 11.6 7.3 8.6v.3z"/>');
    const web = icon('<path fill="none" stroke="#fff" stroke-width="1.5" d="M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z"/><path fill="none" stroke="#fff" stroke-width="1.4" d="M6.6 12h10.8M12 6.6c1.5 1.5 2.3 3.3 2.3 5.4s-.8 3.9-2.3 5.4c-1.5-1.5-2.3-3.3-2.3-5.4s.8-3.9 2.3-5.4Z"/>');
    const social = icon('<path fill="#fff" d="M9.2 8.2h5.6c.9 0 1.6.7 1.6 1.6v5.6c0 .9-.7 1.6-1.6 1.6H9.2c-.9 0-1.6-.7-1.6-1.6V9.8c0-.9.7-1.6 1.6-1.6zm2.8 1.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zm0 1.1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm2.8-.6a.55.55 0 1 0 0 1.1.55.55 0 0 0 0-1.1z"/>');
    return `<footer class="quote-footer">
      <div class="quote-footer-links">
        <span>${mail} ${escapeHtml(resolved.email)}</span>
        <span>${web} ${escapeHtml(resolved.site)}</span>
        <span>${social} ${escapeHtml(resolved.social)}</span>
      </div>
      <p class="quote-footer-tag">${escapeHtml(resolved.tag)}</p>
    </footer>`;
  }

  function billingSignOff(copy, options = {}) {
    const resolved = resolveBillingCopy(copy);
    const thanks = options.thanks ? `<p class="quote-thanks-copy">${escapeHtml(resolved.thanks)}</p>` : "";
    return `${thanks}
      <p class="quote-regards">${escapeHtml(resolved.regards)}</p>
      <p class="quote-sign">${escapeHtml(resolved.sign)}</p>
      <p class="quote-sign-name">${escapeHtml(resolved.signName)}</p>
      <p class="quote-sign-role">${escapeHtml(resolved.role)}</p>
      ${billingFooter(resolved)}`;
  }

  function fullHtml(title, bodyHtml, options = {}) {
    const quote = /quote-sheet/.test(String(bodyHtml || ""));
    const css = `${options.css || window.GeeslaneAgreement?.documentCss?.() || ""}\n${billingCss()}`;
    const print = options.print ? `
      .agreement-sheet { box-shadow: none; border: 0; border-radius: 0; max-width: none; }
      .quote-sheet { max-width: none; min-height: 0; }
      @page { margin: 10mm; }
      @media print { body { padding: 0; } }` : "";
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title || "Geeslane")}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Great+Vibes&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: ${options.print || quote ? "24px" : "28px 16px 48px"}; color: #17211c; background: ${options.print ? "#fff" : "#f5f8f6"}; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
        ${css}
        ${print}
      </style></head><body>${bodyHtml}</body></html>`;
  }

  function viewHtml(title, bodyHtml) {
    const html = fullHtml(title, bodyHtml);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const page = window.open(url, "_blank");
    if (!page) {
      URL.revokeObjectURL(url);
      return false;
    }
    try { page.opener = null; } catch (_) { /* older browsers */ }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  function printHtml(title, bodyHtml) {
    const html = fullHtml(title, bodyHtml, { print: true });
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:200px;border:0;";
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
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        windowWidth: 1024
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
  }

  async function withPdfHost(bodyHtml, fn) {
    const quote = /quote-sheet/.test(String(bodyHtml || ""));
    const css = `${window.GeeslaneAgreement?.documentCss?.() || ""}\n${billingCss()}`;
    if (!document.querySelector("link[data-pdf-fonts]")) {
      const fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.setAttribute("data-pdf-fonts", "1");
      fontLink.href = "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap";
      document.head.appendChild(fontLink);
    }
    const html = await inlineImages(bodyHtml);
    const style = document.createElement("style");
    style.setAttribute("data-pdf-style", "1");
    style.textContent = `${css}
      [data-pdf-host] { color: #17211c; font-family: "DM Sans", Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-pdf-host] .agreement-sheet { box-sizing: border-box; box-shadow: none; border: 0; border-radius: 0; max-width: none; width: 794px; margin: 0; padding: 28px 22px 32px 40px !important; background: #fff; overflow: visible !important; }
      [data-pdf-host] .agreement-sheet::before { content: "" !important; position: absolute; left: 0; top: 0; bottom: 0; width: 14px; background: #063b29; }
      [data-pdf-host] .agreement-sheet::after { content: none !important; }
      [data-pdf-host] .quote-sheet { max-width: none; margin: 0; min-height: 1040px; }
      [data-pdf-host] .agreement-masthead { display: flex !important; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; gap: 16px; }
      [data-pdf-host] .agreement-masthead-title { text-align: right !important; }
      [data-pdf-host] .agreement-facts { display: grid !important; grid-template-columns: 1fr 1fr !important; margin: 14px 0 12px; overflow: visible !important; }
      [data-pdf-host] .agreement-fact { min-width: 0 !important; }
      [data-pdf-host] .agreement-fact strong,
      [data-pdf-host] .agreement-lead,
      [data-pdf-host] .handover-closing,
      [data-pdf-host] .agreement-checklist li { overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
      [data-pdf-host] .agreement-fact strong a { color: #0b6b45; text-decoration: underline; }
      [data-pdf-host] .agreement-fact-wide { grid-column: 1 / -1 !important; }
      [data-pdf-host] .agreement-sign-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; }
      [data-pdf-host] .agreement-lead { margin: 0 0 14px; }
      [data-pdf-host] .agreement-sign-card { min-height: 0; padding: 0; }
      [data-pdf-host] img { max-width: 100%; height: auto; display: block; }
      [data-pdf-host] .handover-logo { height: 40px !important; width: auto !important; max-width: 190px !important; }
      .html2pdf__overlay, .html2pdf__container { left: -12000px !important; top: 0 !important; right: auto !important; bottom: auto !important; }`;
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("data-pdf-host", "1");
    host.style.cssText = "position:fixed;left:0;top:0;width:794px;background:#fff;padding:0;opacity:0.01;pointer-events:none;z-index:2147483000;";
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
      if (document.fonts?.load) {
        await Promise.all([
          document.fonts.load('400 42px "Great Vibes"').catch(() => {}),
          document.fonts.ready.catch(() => {})
        ]);
      } else if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => {});
      }
      await waitForImages(host);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return await fn(host);
    } finally {
      host.remove();
      style.remove();
    }
  }

  function blankPdf() {
    if (window.jspdf?.jsPDF) return new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    return null;
  }

  function ensureHtml2Canvas() {
    if (typeof window.html2canvas === "function") return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = () => {
        if (typeof window.html2canvas === "function") resolve(window.html2canvas);
        else reject(new Error("Could not load the PDF capture library."));
      };
      script.onerror = () => reject(new Error("Could not load the PDF capture library."));
      document.head.appendChild(script);
    });
  }

  function captureScale(host) {
    const width = Math.max(host.scrollWidth || 794, 1);
    const height = Math.max(host.scrollHeight || 1, 1);
    let scale = 2;
    const maxDim = 16384;
    if (width * scale > maxDim) scale = maxDim / width;
    if (height * scale > maxDim) scale = Math.min(scale, maxDim / height);
    return Math.max(1.5, Math.min(2, Math.round(scale * 100) / 100));
  }

  function lineBreaks(host, canvas) {
    const hostBox = host.getBoundingClientRect();
    const height = hostBox.height || host.scrollHeight || 1;
    const scaleY = canvas.height / height;
    const cuts = [];
    host.querySelectorAll("h1, h2, h3, p, li, .agreement-fact, .agreement-lead, .handover-closing, .agreement-masthead").forEach((node) => {
      const rects = node.getClientRects();
      for (let i = 0; i < rects.length; i += 1) {
        const bottom = (rects[i].bottom - hostBox.top) * scaleY + 10;
        if (bottom > 12 && bottom < canvas.height - 1) cuts.push(Math.ceil(bottom));
      }
    });
    return [...new Set(cuts)].sort((a, b) => a - b);
  }

  async function captureHost(host) {
    const html2canvas = await ensureHtml2Canvas();
    const width = Math.max(host.scrollWidth, host.offsetWidth, 794);
    const height = Math.max(host.scrollHeight, host.offsetHeight, 1);
    const canvas = await html2canvas(host, {
      scale: captureScale(host),
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      onclone(clonedDoc) {
        clonedDoc.querySelectorAll("[data-pdf-host]").forEach((node) => {
          node.style.opacity = "1";
          node.style.position = "absolute";
          node.style.left = "0";
          node.style.top = "0";
        });
      }
    });
    if (!canvas) throw new Error("Could not capture the document.");
    return canvas;
  }

  async function pdfFromHost(host, filename) {
    const canvas = await captureHost(host);
    const pdf = blankPdf() || await window.html2pdf().set({
      margin: 0,
      filename,
      html2canvas: { scale: 1, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(host).toPdf().get("pdf");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const pagePx = Math.max(1, Math.floor(canvas.width * (maxH / maxW)));
    const cuts = lineBreaks(host, canvas);
    const quality = canvas.height > 9000 ? 0.86 : 0.92;
    const slices = [];
    let offsetY = 0;
    while (offsetY < canvas.height - 2) {
      let sliceH = Math.min(pagePx, canvas.height - offsetY);
      if (canvas.height - offsetY > pagePx + 2) {
        const limit = offsetY + pagePx;
        let safe = 0;
        for (let i = 0; i < cuts.length; i += 1) {
          if (cuts[i] <= offsetY + 48) continue;
          if (cuts[i] > limit) break;
          safe = cuts[i];
        }
        if (safe) sliceH = safe - offsetY;
      }
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const context = slice.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (slices.length) pdf.addPage();
      pdf.setPage(slices.length + 1);
      pdf.addImage(slice.toDataURL("image/jpeg", quality), "JPEG", margin, margin, maxW, sliceH * (maxW / canvas.width), undefined, "NONE");
      slices.push({ y: offsetY, h: sliceH });
      offsetY += sliceH;
    }
    stampPdfLinks(pdf, host, canvas, margin, maxW, slices);
    return pdf;
  }

  function stampPdfLinks(pdf, host, canvas, margin, maxW, slices) {
    if (typeof pdf?.link !== "function" || !host || !slices?.length) return;
    const hostBox = host.getBoundingClientRect();
    const width = hostBox.width || host.scrollWidth || 1;
    const height = hostBox.height || host.scrollHeight || 1;
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const mm = maxW / canvas.width;
    host.querySelectorAll("a[href]").forEach((link) => {
      const href = link.href || link.getAttribute("href");
      if (!href) return;
      const box = link.getBoundingClientRect();
      const x = (box.left - hostBox.left) * scaleX;
      const y = (box.top - hostBox.top) * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      if (w < 1 || h < 1) return;
      const page = slices.findIndex((slice) => y >= slice.y && y + h <= slice.y + slice.h + 4);
      if (page < 0) return;
      const yOnPage = y - slices[page].y;
      try {
        pdf.setPage(page + 1);
        pdf.link(margin + x * mm, margin + yOnPage * mm, Math.max(w * mm, 1), Math.max(h * mm, 1), { url: href });
      } catch (_) { /* the address is still printed on the page */ }
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(dataUrlToBase64(String(reader.result || "")));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function pdfAttachment(title, bodyHtml, filename) {
    if (typeof window.html2pdf !== "function") return null;
    const name = filename || `${String(title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    try {
      const dataUrl = await withPdfHost(bodyHtml, async (host) => (await pdfFromHost(host, name)).output("datauristring"));
      const content = dataUrlToBase64(dataUrl);
      if (content) return { filename: name, content };
    } catch (_) { /* try blob output next */ }
    try {
      const blob = await withPdfHost(bodyHtml, async (host) => (await pdfFromHost(host, name)).output("blob"));
      const content = blob ? await blobToBase64(blob) : "";
      if (content) return { filename: name, content };
    } catch (_) { /* caller decides how to warn */ }
    return null;
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
    escapeHtml, billingCss, billingFooter, billingSignOff, resolveBillingCopy, splitNotes, joinNotes, fullHtml, viewHtml, printHtml, pdfAttachment, downloadPdf
  });
})();
