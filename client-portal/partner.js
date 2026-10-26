(function () {
  "use strict";

  const WHATSAPP = "https://chat.whatsapp.com/FVDHHYw2IVBL2JayqlzUES?s=cl&p=i&mlu=4&ilr=4";
  const TOKEN_KEY = "geeslane-partner-token";
  const KIND = { first: "First payment", second: "Second payment", project: "Project payment" };
  const STATUS = { requested: "Request received", qualified: "Offer accepted", excluded: "Does not count" };

  function portalBase() {
    const configured = String(window.GEESLANE_CONFIG?.portalUrl || "").trim();
    if (configured) return configured.endsWith("/") ? configured : `${configured}/`;
    return new URL("./", location.href).href;
  }

  function inviteUrl(code) {
    return `${portalBase()}request.html?ref=${encodeURIComponent(code)}`;
  }

  function spaceUrl(token) {
    return `https://geeslane.com/partners?token=${encodeURIComponent(token)}`;
  }

  function flyerUrl(file) {
    return new URL(`../images/partner-kit/${file}`, location.href).href;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function naira(value) {
    return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function dateLabel(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
  }

  function sameName(left, right) {
    return String(left || "").trim().replace(/\s+/g, " ").toLowerCase() === String(right || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function setError(message) {
    const node = document.getElementById("partner-error");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
  }

  function kitHtml() {
    return `<a href="${escapeHtml(flyerUrl("flyer-services.jpg"))}" target="_blank" rel="noopener"><img src="${escapeHtml(flyerUrl("flyer-services.jpg"))}" alt="Geeslane services flyer" /></a><a href="${escapeHtml(flyerUrl("flyer-help.jpg"))}" target="_blank" rel="noopener"><img src="${escapeHtml(flyerUrl("flyer-help.jpg"))}" alt="How Geeslane can help flyer" /></a>`;
  }

  function receiptCell(note) {
    const text = String(note || "").trim();
    if (!text) return "Waiting for transfer";
    if (/^https?:\/\//i.test(text)) return `<a href="${escapeHtml(text)}">Receipt</a>`;
    return escapeHtml(text);
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      const previous = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = previous; }, 1600);
    } catch (_) {
      button.textContent = "Copy the link above";
    }
  }

  function showReady(result) {
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    const ready = document.getElementById("partner-ready");
    ready.hidden = false;
    document.getElementById("partner-ready-title").textContent = `Welcome, ${result.name.split(" ")[0]}`;
    document.getElementById("partner-ready-copy").textContent = "Your welcome email has your invite link, your flyer kit, and the WhatsApp group. The link works from 1 November through 30 November 2026. Share only that link.";
    const invite = inviteUrl(result.code);
    const space = spaceUrl(result.token);
    const inviteLink = document.getElementById("partner-invite-link");
    inviteLink.href = invite;
    inviteLink.textContent = invite;
    const spaceLink = document.getElementById("partner-space-link");
    spaceLink.href = space;
    document.getElementById("partner-ready-kit").innerHTML = kitHtml();
    document.getElementById("partner-copy-invite").onclick = () => copyText(invite, document.getElementById("partner-copy-invite"));
    sessionStorage.setItem(TOKEN_KEY, result.token);
  }

  async function sendWelcome(result) {
    const invite = inviteUrl(result.code);
    const space = spaceUrl(result.token);
    const services = "https://geeslane.com/images/partner-kit/flyer-services.jpg";
    const help = "https://geeslane.com/images/partner-kit/flyer-help.jpg";
    const intro = "You are in the November Partner Programme. Share only your invite link. It works from 1 November through 30 November 2026, and the request form fills your code from it.\n\nA new client counts after they accept the quote and the first payment clears in November. You earn 20% of the Geeslane fee on that payment, and 20% of the second payment when it clears. A one-off fee is a project payment. Third-party prices are not included. The most on one project is ₦100,000.\n\nJoin the WhatsApp group for updates, marketing kits, and tips.";
    await window.GeeslaneMail?.notify({
      audience: "both",
      kind: "partner-welcome",
      subject: "Your Geeslane partner link",
      heading: "Your November partner link",
      greetingName: result.name,
      intro,
      rows: [
        ["Invite link", invite],
        ["Partner page", space],
        ["WhatsApp group", WHATSAPP],
        ["Services flyer", services],
        ["Help flyer", help]
      ],
      clientEmail: result.email,
      ctaUrl: invite,
      ctaLabel: "Open your invite link",
      replyTo: window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com"
    });
  }

  async function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(form.fullName.value || "").trim();
    const accountName = String(form.accountName.value || "").trim();
    const accountNumber = String(form.accountNumber.value || "").replace(/\s/g, "");
    if (!sameName(name, accountName)) {
      setError("The account name must match the name on this form.");
      return;
    }
    if (!/^[0-9]{10}$/.test(accountNumber)) {
      setError("Enter the 10-digit account number.");
      return;
    }
    if (!form.joinedWhatsapp.checked) {
      setError("Join the WhatsApp group, then tick the box.");
      return;
    }
    if (!form.agreeTerms.checked) {
      setError("Read the terms and tick the box before sending.");
      return;
    }
    const button = document.getElementById("partner-submit");
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
    setError("");
    try {
      const result = await window.GeeslaneAPI.registerPartner({
        name,
        email: form.email.value,
        phone: window.GeeslaneAPI.readPhoneField("phone"),
        bankName: form.bankName.value,
        accountNumber,
        accountName,
        whatsapp: true,
        terms: true
      });
      try { await sendWelcome(result); } catch (_) { /* the page still shows the link */ }
      showReady(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setError(error.userMessage || window.GeeslaneAPI.userFacingError(error, "The form could not be sent. Please try again."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function renderBoard(board) {
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    document.getElementById("partner-terms").hidden = true;
    const space = document.getElementById("partner-space");
    space.hidden = false;
    document.getElementById("partner-space-title").textContent = board.name;
    document.getElementById("partner-space-lead").textContent = "Your link works from 1 November through 30 November 2026. You earn 20% of the Geeslane fee when each counted payment clears, up to ₦100,000 on a project.";
    const invite = inviteUrl(board.code);
    const link = document.getElementById("partner-space-invite");
    link.href = invite;
    link.textContent = invite;
    document.getElementById("partner-space-copy").onclick = () => copyText(invite, document.getElementById("partner-space-copy"));
    const notices = Array.isArray(board.notices) ? board.notices : [];
    document.getElementById("partner-notices").innerHTML = notices.length
      ? notices.map((item) => `<li class="${item.read ? "" : "is-new"}"><span>${escapeHtml(dateLabel(item.createdAt))}</span>${escapeHtml(item.body)}</li>`).join("")
      : "<li>No notifications yet.</li>";
    const referrals = Array.isArray(board.referrals) ? board.referrals : [];
    document.getElementById("partner-referrals").innerHTML = referrals.length
      ? referrals.map((item) => {
        const payments = (item.earnings || []).map((earning) => `${KIND[earning.kind] || "Payment"} ${naira(earning.commission)}`).join(" · ");
        return `<article class="partner-referral"><strong>${escapeHtml(item.business || "Business")}</strong><span>${escapeHtml(item.service || "Service")}</span><em>${escapeHtml(STATUS[item.status] || item.status)}</em>${payments ? `<small>${escapeHtml(payments)}</small>` : ""}</article>`;
      }).join("")
      : "<p class=\"partner-copy\">No one has used your link yet.</p>";
    const rows = referrals.flatMap((item) => (item.earnings || []).map((earning) => ({ ...earning, business: item.business })));
    document.getElementById("partner-payments").innerHTML = rows.length
      ? rows.map((earning) => `<tr><td>${escapeHtml(earning.project)}</td><td>${escapeHtml(earning.business)}</td><td>${escapeHtml(KIND[earning.kind] || "")}</td><td>${escapeHtml(dateLabel(earning.clientPaidOn))}</td><td>${escapeHtml(naira(earning.commission))}</td><td>${earning.payoutStatus === "paid" ? receiptCell(earning.receipt) : "Waiting for transfer"}</td></tr>`).join("")
      : "<tr><td colspan=\"6\">No payments yet.</td></tr>";
    document.getElementById("partner-space-kit").innerHTML = kitHtml();
  }

  async function openBoard(token) {
    const board = await window.GeeslaneAPI.partnerBoard(token);
    renderBoard(board);
    window.GeeslaneAPI.markPartnerNoticesRead(token);
    const url = new URL(location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  const form = document.getElementById("partner-form");
  window.GeeslaneAPI?.bindPhoneFields?.(form);
  form?.addEventListener("submit", submitForm);
  document.querySelectorAll("#partner-ready-kit, #partner-space-kit").forEach((node) => { node.innerHTML = kitHtml(); });

  const params = new URLSearchParams(location.search);
  const token = params.get("token") || sessionStorage.getItem(TOKEN_KEY) || "";
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    const open = () => openBoard(token).catch((error) => {
      setError(error.userMessage || "This partner link is not valid. Open the link in your welcome email.");
      document.getElementById("partner-join").hidden = false;
      document.getElementById("partner-intro").hidden = false;
    });
    if (window.GEESLANE_ENV_READY) window.GEESLANE_ENV_READY.then(open);
    else open();
  }
})();
