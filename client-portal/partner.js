(function () {
  "use strict";

  const WHATSAPP = "https://chat.whatsapp.com/FVDHHYw2IVBL2JayqlzUES?s=cl&p=i&mlu=4&ilr=4";
  const TOKEN_KEY = "geeslane-partner-token";
  const KIND = { first: "Initial 50%", second: "Final 50%", project: "Project payment" };
  const STATUS = {
    requested: "Request received",
    qualified: "Initial payment received",
    excluded: "Does not count",
    cancelled: "Cancelled",
    new: "Request received",
    under_review: "Being reviewed",
    contacted: "Geeslane has been in touch",
    quote_sent: "Quotation sent",
    awaiting_initial: "Awaiting initial payment",
    initial_received: "Initial payment received",
    awaiting_balance: "Awaiting balance payment",
    fully_paid: "Fully paid",
    ineligible: "Does not count"
  };

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
    return `NGN ${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    document.getElementById("partner-story")?.setAttribute("hidden", "");
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    const ready = document.getElementById("partner-ready");
    ready.hidden = false;
    document.getElementById("partner-ready-title").textContent = "You're officially a Geeslane Partner!";
    const mailed = Boolean(result.mailed);
    document.getElementById("partner-ready-copy").textContent = mailed
      ? "Your registration was successful. Your personal referral link has been sent to your email address. If you cannot find it, check your spam and promotions folders."
      : "Your registration was successful. We could not confirm that the email was sent, so copy your invite link below. Also check your inbox, spam, and promotions folders.";
    const steps = document.getElementById("partner-ready-steps");
    if (steps) {
      const items = mailed
        ? [
          "Check your email for a message titled “Your Geeslane Partner Link”.",
          "Copy your personal invite link.",
          "Share it with businesses that may need Geeslane’s services."
        ]
        : [
          "Copy your personal invite link below.",
          "Share it with businesses that may need Geeslane’s services.",
          "If the email arrives later, it will have the same link."
        ];
      steps.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }
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
    return window.GeeslaneMail?.notify({
      audience: "both",
      kind: "partner-welcome",
      subject: "Your Geeslane Partner Link",
      heading: "🎉 Your November Partner Link Is Ready!",
      greetingName: result.name,
      rows: [
        ["Invite link", invite],
        ["Partner dashboard", space],
        ["WhatsApp community", WHATSAPP],
        ["Marketing flyers", `${services}\n${help}`]
      ],
      clientEmail: result.email,
      ctaUrl: space,
      ctaLabel: "Open Your Partner Page",
      replyTo: window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com"
    });
  }

  async function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(form.fullName.value || "").trim();
    const accountName = String(form.accountName.value || "").trim();
    const accountNumber = String(form.accountNumber.value || "").replace(/\s/g, "");
    if (name.length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email.value || "").trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if ((window.GeeslaneAPI.readPhoneField("phone") || "").replace(/\D/g, "").length < 7) {
      setError("Enter a phone or WhatsApp number.");
      return;
    }
    if (!String(form.bankName.value || "").trim()) {
      setError("Enter the bank name.");
      return;
    }
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
      let mailed = false;
      try { mailed = Boolean(await sendWelcome(result)); } catch (_) { mailed = false; }
      try {
        const alerted = await window.GeeslaneAPI.sendPortalMail({
          kind: "partner-admin-alert",
          audience: "team",
          clientEmail: result.email,
          subject: "New Geeslane partner registration"
        });
        if (alerted && result.token) await window.GeeslaneAPI.markPartnerAdminNotified(result.token);
      } catch (_) {}
      showReady({ ...result, mailed });
      sessionStorage.removeItem("geeslane.partner.form");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setError(error.userMessage || window.GeeslaneAPI.userFacingError(error, "The form could not be sent. Please try again."));
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function moneyTotal(rows, status) {
    return rows.reduce((sum, earning) => {
      if (earning.payoutStatus === "forfeited") return sum;
      if (status && earning.payoutStatus !== status) return sum;
      return sum + Number(earning.commission || 0);
    }, 0);
  }

  function paymentState(earning) {
    if (!earning) return "Not yet";
    if (earning.payoutStatus === "paid") return `Transferred ${dateLabel(earning.payoutOn)}`;
    if (earning.payoutStatus === "forfeited") return "Not payable";
    return "Awaiting transfer";
  }

  function renderBoard(board) {
    document.getElementById("partner-story")?.setAttribute("hidden", "");
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    document.getElementById("partner-terms").hidden = true;
    const space = document.getElementById("partner-space");
    space.hidden = false;
    const first = String(board.name || "Partner").trim().split(/\s+/)[0];
    document.getElementById("partner-space-title").textContent = first;
    document.getElementById("partner-space-lead").textContent = "Your page stays open after November for projects that qualified during the programme.";
    const invite = inviteUrl(board.code);
    const link = document.getElementById("partner-space-invite");
    link.href = invite;
    link.textContent = invite;
    document.getElementById("partner-space-copy").onclick = () => copyText(invite, document.getElementById("partner-space-copy"));
    const share = document.getElementById("partner-space-share");
    if (share && navigator.share) {
      share.hidden = false;
      share.onclick = () => navigator.share({ title: "Geeslane", text: "Request a service from Geeslane", url: invite }).catch(() => {});
    }
    const referrals = Array.isArray(board.referrals) ? board.referrals : [];
    const rows = referrals.flatMap((item) => (item.earnings || []).map((earning) => ({ ...earning, business: item.business })));
    const metrics = document.getElementById("partner-metrics");
    if (metrics) {
      const figures = [
        ["Referrals", String(referrals.length)],
        ["Commission earned", naira(moneyTotal(rows))],
        ["Awaiting transfer", naira(moneyTotal(rows, "due"))],
        ["Transferred", naira(moneyTotal(rows, "paid"))]
      ];
      metrics.innerHTML = figures.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    }
    const notices = Array.isArray(board.notices) ? board.notices : [];
    document.getElementById("partner-notices").innerHTML = notices.length
      ? notices.map((item) => `<li class="${item.read ? "" : "is-new"}"><span>${escapeHtml(dateLabel(item.createdAt))}</span>${escapeHtml(item.body)}</li>`).join("")
      : "<li>No notifications yet.</li>";
    document.getElementById("partner-referrals").innerHTML = referrals.length
      ? referrals.map((item) => {
        const initial = (item.earnings || []).find((earning) => earning.kind === "first" || earning.kind === "project");
        const balance = (item.earnings || []).find((earning) => earning.kind === "second");
        const earned = moneyTotal(item.earnings || []);
        const progress = STATUS[item.pipeline] || STATUS[item.status] || item.status;
        const update = Array.isArray(item.updates) && item.updates.length ? item.updates[0] : "";
        return `<article class="partner-referral"><strong>${escapeHtml(item.business || "Business")}</strong><span>${escapeHtml(item.service || "Service")}</span><em>${escapeHtml(progress)}</em><small>${escapeHtml(dateLabel(item.createdAt))}</small>${update ? `<small>${escapeHtml(update)}</small>` : ""}<small>Initial 50%: ${escapeHtml(paymentState(initial))}</small><small>Final 50%: ${escapeHtml(paymentState(balance))}</small><small>Commission earned: ${escapeHtml(naira(earned))}</small></article>`;
      }).join("")
      : "<p class=\"partner-copy\">Your invite link is ready. Share it with a business that may need Geeslane. Referrals will appear here after someone sends a request through that link.</p>";
    document.getElementById("partner-payments").innerHTML = rows.length
      ? rows.map((earning) => `<tr><td>${escapeHtml(earning.project)}</td><td>${escapeHtml(earning.business)}</td><td>${escapeHtml(KIND[earning.kind] || "")}</td><td>${escapeHtml(naira(earning.fee))}</td><td>${escapeHtml(dateLabel(earning.clientPaidOn))}</td><td>${escapeHtml(naira(earning.commission))}</td><td>${earning.payoutStatus === "paid" ? receiptCell(earning.receipt) : escapeHtml(paymentState(earning))}</td></tr>`).join("")
      : "<tr><td colspan=\"7\">No payments yet.</td></tr>";
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
  const DRAFT_KEY = "geeslane.partner.form";
  window.GeeslaneAPI?.bindPhoneFields?.(form);
  if (form) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      if (saved && typeof saved === "object") {
        if (saved.fullName) form.fullName.value = saved.fullName;
        if (saved.email) form.email.value = saved.email;
        if (saved.bankName) form.bankName.value = saved.bankName;
        if (saved.accountNumber) form.accountNumber.value = saved.accountNumber;
        if (saved.accountName) form.accountName.value = saved.accountName;
        form.joinedWhatsapp.checked = Boolean(saved.joinedWhatsapp);
        form.agreeTerms.checked = Boolean(saved.agreeTerms);
        if (saved.phone) window.GeeslaneAPI?.fillPhoneField?.("phone", saved.phone);
      }
    } catch (_) {}
    const remember = () => {
      window.GeeslaneAPI?.readPhoneField?.("phone");
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        fullName: form.fullName.value,
        email: form.email.value,
        phone: form.phone.value,
        bankName: form.bankName.value,
        accountNumber: form.accountNumber.value,
        accountName: form.accountName.value,
        joinedWhatsapp: form.joinedWhatsapp.checked,
        agreeTerms: form.agreeTerms.checked
      }));
    };
    form.addEventListener("input", remember);
    form.addEventListener("change", remember);
  }
  const phoneSearch = document.getElementById("partner-phone-search");
  const phoneCode = document.getElementById("partner-phone-code");
  if (phoneSearch && phoneCode) {
    const phoneOptions = [...phoneCode.options].map((option) => ({
      value: option.value,
      text: option.textContent,
      iso: option.dataset.iso || ""
    }));
    phoneSearch.addEventListener("input", () => {
      const query = phoneSearch.value.trim().toLowerCase();
      const current = phoneCode.value;
      const matches = phoneOptions.filter((option) => !query || `${option.text} ${option.value} ${option.iso}`.toLowerCase().includes(query));
      const list = matches.length ? matches : phoneOptions;
      phoneCode.innerHTML = list.map((option) => `<option value="${escapeHtml(option.value)}" data-iso="${escapeHtml(option.iso)}"${option.value === current ? " selected" : ""}>${escapeHtml(option.text)}</option>`).join("");
      if (![...phoneCode.options].some((option) => option.value === current)) phoneCode.selectedIndex = 0;
    });
  }
  form?.addEventListener("submit", submitForm);
  document.querySelectorAll("#partner-ready-kit, #partner-space-kit").forEach((node) => { node.innerHTML = kitHtml(); });

  const params = new URLSearchParams(location.search);
  const token = params.get("token") || sessionStorage.getItem(TOKEN_KEY) || "";
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    document.getElementById("partner-story")?.setAttribute("hidden", "");
    document.getElementById("partner-join").hidden = true;
    document.getElementById("partner-intro").hidden = true;
    const open = () => openBoard(token).catch((error) => {
      sessionStorage.removeItem(TOKEN_KEY);
      setError(error.userMessage || "This partner link is not valid. Open the link in your welcome email.");
      document.getElementById("partner-story")?.removeAttribute("hidden");
      document.getElementById("partner-join").hidden = false;
      document.getElementById("partner-intro").hidden = false;
    });
    if (window.GEESLANE_ENV_READY) window.GEESLANE_ENV_READY.then(open);
    else open();
  }
})();
