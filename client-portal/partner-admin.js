(function () {
  "use strict";

  const KIND = { first: "First payment", second: "Second payment", project: "Project payment" };
  const STATUS = { requested: "Request received", qualified: "Offer accepted", excluded: "Does not count" };
  let board = { partners: [], referrals: [], earnings: [] };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function naira(value) {
    return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function dateLabel(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
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

  function render() {
    const partners = document.getElementById("partner-admin-people");
    const referrals = document.getElementById("partner-admin-referrals");
    const earnings = document.getElementById("partner-admin-earnings");
    const paymentReferral = document.getElementById("partner-payment-referral");
    const payoutEarning = document.getElementById("partner-payout-earning");
    if (!partners) return;
    partners.innerHTML = board.partners.length ? board.partners.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.bankName)}<br>${escapeHtml(item.accountNumber)}<br>${escapeHtml(item.accountName)}</td><td>${escapeHtml(item.code)}</td><td><button class="text-button" type="button" data-copy-invite="${escapeHtml(item.code)}">Copy invite link</button></td></tr>`).join("") : "<tr><td colspan=\"5\">No partners yet.</td></tr>";
    referrals.innerHTML = board.referrals.length ? board.referrals.map((item) => `<tr><td>${escapeHtml(item.business)}</td><td>${escapeHtml(item.partnerName)}</td><td>${escapeHtml(item.service)}</td><td>${escapeHtml(STATUS[item.status] || item.status)}</td><td>${escapeHtml(dateLabel(item.createdAt))}</td><td>${item.status === "requested" ? `<button class="text-button" type="button" data-exclude-referral="${escapeHtml(item.id)}">Already speaking</button>` : ""}</td></tr>`).join("") : "<tr><td colspan=\"6\">No referrals yet.</td></tr>";
    earnings.innerHTML = board.earnings.length ? board.earnings.map((item) => `<tr><td>${escapeHtml(item.project)}</td><td>${escapeHtml(item.business)}</td><td>${escapeHtml(item.partnerName)}</td><td>${escapeHtml(KIND[item.kind] || "")}</td><td>${escapeHtml(naira(item.fee))}</td><td>${escapeHtml(naira(item.commission))}</td><td>${escapeHtml(item.payoutStatus === "paid" ? `Paid ${dateLabel(item.payoutOn)}` : "Due")}</td></tr>`).join("") : "<tr><td colspan=\"7\">No earnings yet.</td></tr>";
    const openReferrals = board.referrals.filter((item) => item.status === "requested" || item.status === "qualified");
    if (paymentReferral) {
      paymentReferral.innerHTML = `<option value="">Choose a referral</option>${openReferrals.map((item) => `<option value="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}">${escapeHtml(item.business)} · ${escapeHtml(item.partnerName)} · ${escapeHtml(STATUS[item.status] || "")}</option>`).join("")}`;
    }
    const due = board.earnings.filter((item) => item.payoutStatus !== "paid");
    if (payoutEarning) {
      payoutEarning.innerHTML = `<option value="">Choose an amount due</option>${due.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.partnerName)} · ${escapeHtml(item.business)} · ${escapeHtml(KIND[item.kind] || "")} · ${escapeHtml(naira(item.commission))}</option>`).join("")}`;
    }
  }

  async function load() {
    try {
      board = await window.GeeslaneAPI.adminPartnerBoard();
      board.partners = board.partners || [];
      board.referrals = board.referrals || [];
      board.earnings = board.earnings || [];
      render();
      setNote("");
    } catch (error) {
      setNote(error.userMessage || "Could not load partners. Run partner_programme.sql in Supabase, then refresh.", true);
    }
  }

  async function copyInvite(code, button) {
    const url = `${portalBase()}request.html?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied";
    } catch (_) {
      setNote(url, false);
    }
  }

  document.getElementById("admin-partners-page")?.addEventListener("click", async (event) => {
    const copy = event.target.closest("[data-copy-invite]");
    if (copy) { copyInvite(copy.dataset.copyInvite, copy); return; }
    const exclude = event.target.closest("[data-exclude-referral]");
    if (!exclude) return;
    exclude.disabled = true;
    try {
      await window.GeeslaneAPI.excludePartnerReferral(exclude.dataset.excludeReferral);
      await load();
    } catch (error) {
      setNote(error.userMessage || "Could not update that referral.", true);
      exclude.disabled = false;
    }
  });

  document.getElementById("partner-payment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const referral = board.referrals.find((item) => item.id === form.referralId.value);
    if (!referral) { setNote("Choose a referral.", true); return; }
    const kind = form.kind.value;
    if (referral.status === "requested" && kind === "second") {
      setNote("Record the first payment or the project payment before a second payment.", true);
      return;
    }
    if (referral.status === "qualified" && kind !== "second") {
      setNote("This offer is already accepted. Record the second payment.", true);
      return;
    }
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true, "Saving…");
    try {
      await window.GeeslaneAPI.recordPartnerEarning({
        referralId: referral.id,
        projectName: form.projectName.value,
        kind,
        fee: form.fee.value,
        paidOn: form.paidOn.value
      });
      form.reset();
      await load();
      setNote("Payment recorded. The partner can see it on their page.");
    } catch (error) {
      setNote(error.userMessage || "Could not record that payment.", true);
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  });

  document.getElementById("partner-payout-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true, "Saving…");
    try {
      await window.GeeslaneAPI.markPartnerPayout({
        earningId: form.earningId.value,
        payoutOn: form.payoutOn.value,
        receipt: form.receipt.value
      });
      form.reset();
      await load();
      setNote("Transfer recorded.");
    } catch (error) {
      setNote(error.userMessage || "Could not record that transfer.", true);
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  });

  window.GeeslanePartnerAdmin = { load };
})();
