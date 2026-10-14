(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function articleHtml(item) {
    const body = escapeHtml(item.body).replace(/\n/g, "<br />");
    return `<details class="faq-item group rounded-2xl border border-slate-200 bg-white open:border-brand-200 open:bg-brand-50/40">
      <summary class="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
        <span class="text-base font-bold text-brand-900">${escapeHtml(item.title)}</span>
        <svg class="faq-chevron h-5 w-5 shrink-0 text-brand-700 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="space-y-3 px-5 pb-5 text-sm leading-relaxed text-slate-600"><p>${body}</p></div>
    </details>`;
  }

  async function loadGuides() {
    const root = document.getElementById("live-help-guides");
    if (!root) return;
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    const cfg = window.GEESLANE_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || !window.supabase) return;
    try {
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const { data, error } = await client.from("help_guides").select("title, body, sort_order").eq("published", true).in("audience", ["public", "both"]).order("sort_order");
      if (error) throw error;
      const items = Array.isArray(data) ? data : [];
      const limit = Number(root.dataset.limit || 0);
      const shown = limit > 0 ? items.slice(0, limit) : items;
      if (!shown.length) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      root.innerHTML = shown.map(articleHtml).join("");
    } catch (_) {
      root.hidden = true;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadGuides);
  else loadGuides();
})();
