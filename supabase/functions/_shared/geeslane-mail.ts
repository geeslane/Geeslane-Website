import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export const LOGO_URL = "https://geeslane.com/images/logo.png";

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" } as Record<string, string>
  )[char] || char);
}

function cellText(value: unknown) {
  return escapeHtml(value).replace(/\r\n|\n|\r/g, "<br>");
}

export function brandedHtml(options: {
  greeting?: string;
  heading: string;
  intro: string;
  rows?: Array<[string, unknown]>;
  ctaLabel?: string;
  ctaUrl?: string;
  attachmentNote?: string;
  signoff?: string;
}) {
  const hello = options.greeting
    ? `<p style="margin:0 0 6px;font-size:14px;color:#0b6b45;font-weight:600;text-align:center;">${escapeHtml(options.greeting)}</p>`
    : "";
  const note = options.attachmentNote
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#697870;text-align:center;">${escapeHtml(options.attachmentNote)}</p>`
    : "";
  const filled = (options.rows || []).filter((row) => row && String(row[1] || "").trim());
  const rows = filled.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">${filled.map(([label, value]) => `
      <tr>
        <td valign="top" style="padding:10px 12px 10px 0;border-bottom:1px solid #edf2ef;font-size:12px;color:#697870;width:34%;">${escapeHtml(label)}</td>
        <td valign="top" style="padding:10px 0;border-bottom:1px solid #edf2ef;font-size:14px;line-height:1.55;color:#17211c;">${cellText(value)}</td>
      </tr>`).join("")}</table>`
    : "";
  const button = options.ctaLabel && options.ctaUrl ? `
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:8px auto 0;">
        <tr>
          <td align="center" style="border-radius:999px;background:#0b6b45;">
            <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(options.ctaLabel)}</a>
          </td>
        </tr>
      </table>` : "";
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#eef6f1;font-family:'DM Sans',Arial,sans-serif;color:#17211c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef6f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d7ebe0;border-radius:20px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:22px 36px 10px;background:#063b29;">
                <img src="${LOGO_URL}" alt="Geeslane" width="132" style="display:block;margin:0 auto;border:0;height:auto;max-width:132px;background:#ffffff;padding:10px 14px;border-radius:12px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 36px 36px;">
                ${hello}
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;letter-spacing:-.02em;color:#063b29;text-align:center;">${escapeHtml(options.heading)}</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#2a3931;text-align:center;">${escapeHtml(options.intro)}</p>
                ${note}
                ${rows}
                ${button}
                <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#2a3931;text-align:center;">${escapeHtml(options.signoff || "Kind regards,")}<br><strong style="color:#063b29;">Geeslane</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function brandedText(options: {
  greeting?: string;
  heading: string;
  intro: string;
  rows?: Array<[string, unknown]>;
  ctaUrl?: string;
  attachmentNote?: string;
}) {
  const lines = [options.greeting, options.heading, options.intro, options.attachmentNote, ""].filter(Boolean);
  (options.rows || []).filter((row) => row && row[1]).forEach(([label, value]) => lines.push(`${label}: ${value}`));
  if (options.ctaUrl) lines.push("", String(options.ctaUrl));
  lines.push("", "Kind regards,", "Geeslane");
  return lines.join("\n").trim();
}

function utf8(text: string) {
  return String(text || "").replace(/[^\x20-\x7E]/g, " ").slice(0, 180);
}

export async function documentPdf(options: {
  kicker: string;
  title: string;
  facts: Array<[string, unknown]>;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.024, 0.231, 0.161);
  const muted = rgb(0.412, 0.471, 0.439);
  const ink = rgb(0.09, 0.129, 0.11);
  page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: green });
  page.drawText("GEESLANE", { x: 48, y: 804, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(utf8(options.kicker), { x: 48, y: 742, size: 11, font, color: muted });
  page.drawText(utf8(options.title), { x: 48, y: 716, size: 22, font: bold, color: green });
  let y = 670;
  (options.facts || []).filter((row) => row && String(row[1] || "").trim()).forEach(([label, value]) => {
    if (y < 80) return;
    page.drawText(utf8(String(label)), { x: 48, y, size: 10, font, color: muted });
    page.drawText(utf8(String(value)), { x: 210, y, size: 11, font: bold, color: ink });
    y -= 26;
  });
  page.drawText("Keep this copy with your project records.", { x: 48, y: 56, size: 9, font, color: muted });
  return await pdf.saveAsBase64();
}

export async function sendResend(options: {
  apiKey: string;
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  filename?: string;
  pdf?: string;
}) {
  if (!options.apiKey || !options.to) return false;
  const attachments = options.pdf && options.filename
    ? [{ filename: options.filename, content: options.pdf, content_type: "application/pdf" }]
    : undefined;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      reply_to: options.replyTo || undefined,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments
    })
  });
  return response.ok;
}

export function moneyLabel(amount: unknown, currency = "NGN") {
  const raw = String(amount || "").trim();
  if (!raw) return "";
  if (/[A-Z]{3}\s/.test(raw)) return raw;
  return `${currency} ${raw}`.trim();
}

export function givenName(name: unknown) {
  const given = String(name || "").trim().split(/\s+/)[0];
  if (!given || /^(a|there)$/i.test(given)) return "";
  return given.charAt(0).toUpperCase() + given.slice(1);
}

function envMail() {
  return {
    apiKey: Deno.env.get("RESEND_API_KEY") || "",
    from: Deno.env.get("MAIL_FROM") || "Geeslane <no-reply@auth.geeslane.com>",
    teamTo: (Deno.env.get("NOTIFY_TEAM_EMAIL") || "contact@geeslane.com").toLowerCase(),
    portal: String(Deno.env.get("PORTAL_URL") || "https://geeslane.com/client-portal/").replace(/\/?$/, "/")
  };
}

function fileName(prefix: string, reference: unknown) {
  const slug = String(reference || prefix).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || prefix}.pdf`;
}

export async function sendPaymentEmails(context: {
  clientEmail?: string;
  clientName?: string;
  business?: string;
  projectName?: string;
  receipt: Record<string, unknown>;
}) {
  const env = envMail();
  if (!env.apiKey) return;
  const receipt = context.receipt || {};
  const amount = moneyLabel(receipt.amount, String(receipt.currency || "NGN"));
  const name = givenName(context.clientName);
  const paidOn = receipt.paidOn || receipt.paid_on;
  const method = receipt.method;
  const invoiceRef = receipt.invoiceReference || receipt.invoice_reference;
  const facts: Array<[string, unknown]> = [
    ["Receipt", receipt.reference],
    ["Client", context.clientName],
    ["Business", context.business],
    ["Project", context.projectName],
    ["Amount", amount],
    ["Date", paidOn],
    ["Method", method],
    ["Invoice", invoiceRef]
  ];
  const pdf = await documentPdf({
    kicker: "Payment receipt",
    title: String(receipt.reference || "Receipt"),
    facts
  });
  const filename = fileName("receipt", receipt.reference);
  const clientEmail = String(context.clientEmail || "").trim().toLowerCase();
  if (clientEmail) {
    const payload = {
      greeting: name ? `Hi ${name},` : "Hi there,",
      heading: "Payment received",
      intro: "Thank you. Your receipt is attached.",
      rows: [
        ["Receipt", receipt.reference],
        ["Amount", amount],
        ["Date", paidOn],
        ["Method", method]
      ].filter((row) => row[1]),
      ctaLabel: "Open your portal",
      ctaUrl: `${env.portal}#payments`
    };
    await sendResend({
      apiKey: env.apiKey,
      from: env.from,
      to: clientEmail,
      subject: `Payment received · ${receipt.reference || "Receipt"}`,
      html: brandedHtml(payload),
      text: brandedText(payload),
      filename,
      pdf
    });
  }
  if (env.teamTo && env.teamTo !== clientEmail) {
    const payload = {
      greeting: "Hi team,",
      heading: "Payment received",
      intro: `${context.clientName || "A client"} paid ${amount || "an invoice"}.`,
      rows: [
        ["Client", context.clientName],
        ["Receipt", receipt.reference],
        ["Invoice", invoiceRef],
        ["Amount", amount],
        ["Method", method]
      ].filter((row) => row[1]),
      ctaLabel: "Open Invoices",
      ctaUrl: `${env.portal}admin.html#invoices`
    };
    await sendResend({
      apiKey: env.apiKey,
      from: env.from,
      to: env.teamTo,
      subject: `Payment received from ${context.clientName || clientEmail || "client"}`,
      html: brandedHtml(payload),
      text: brandedText(payload),
      filename,
      pdf
    });
  }
}
