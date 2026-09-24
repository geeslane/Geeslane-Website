(function () {
  "use strict";

  const PAGE_SIZE = 10;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function closeRowMenus() {
    document.querySelectorAll(".row-menu.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.querySelector(".row-menu-toggle")?.setAttribute("aria-expanded", "false");
      const list = menu.querySelector(".row-menu-list");
      if (list) list.hidden = true;
    });
  }

  function openRowMenu(menu) {
    const toggle = menu.querySelector(".row-menu-toggle");
    const list = menu.querySelector(".row-menu-list");
    if (!toggle || !list) return;
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    list.hidden = false;
    const rect = toggle.getBoundingClientRect();
    const width = Math.max(176, list.offsetWidth);
    let left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    let top = rect.bottom + 4;
    if (top + list.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - list.offsetHeight - 4);
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.right = "auto";
  }

  function rowActionButton(item, inMenu) {
    const cls = inMenu ? "row-menu-item" : (item.primary ? "button button-primary" : "button button-secondary");
    return `<button class="${cls}" type="button" ${item.attrs || ""}>${escapeHtml(item.label)}</button>`;
  }

  function rowActions(items) {
    const filled = (items || []).filter(Boolean);
    if (!filled.length) return "";
    if (filled.length <= 2) return `<div class="billing-row-actions">${filled.map((item) => rowActionButton(item, false)).join("")}</div>`;
    const primary = filled.find((item) => item.primary);
    const rest = primary ? filled.filter((item) => item !== primary) : filled;
    const menu = `<div class="row-menu"><button class="icon-button row-menu-toggle" type="button" aria-label="Actions" aria-expanded="false">⋯</button><div class="row-menu-list" hidden>${rest.map((item) => rowActionButton(item, true)).join("")}</div></div>`;
    if (!primary) return menu;
    return `<div class="billing-row-actions">${rowActionButton(primary, false)}${menu}</div>`;
  }

  function wireRowMenus() {
    if (document.documentElement.dataset.rowMenus === "1") return;
    document.documentElement.dataset.rowMenus = "1";
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest(".row-menu-toggle");
      if (toggle) {
        event.preventDefault();
        const menu = toggle.closest(".row-menu");
        const wasOpen = menu.classList.contains("is-open");
        closeRowMenus();
        if (!wasOpen) openRowMenu(menu);
        return;
      }
      if (event.target.closest(".row-menu-item")) {
        closeRowMenus();
        return;
      }
      if (!event.target.closest(".row-menu-list")) closeRowMenus();
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeRowMenus(); });
    window.addEventListener("scroll", closeRowMenus, true);
    window.addEventListener("resize", closeRowMenus);
  }

  function pageSlice(items, page, size) {
    const list = Array.isArray(items) ? items : [];
    const per = Number(size) > 0 ? Number(size) : PAGE_SIZE;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (current - 1) * per;
    return { items: list.slice(start, start + per), page: current, pages, total, from: total ? start + 1 : 0, to: Math.min(start + per, total), per };
  }

  function pagerHtml(slice) {
    if (!slice || slice.total <= slice.per) return "";
    return `<span class="table-pager-meta">${slice.from}–${slice.to} of ${slice.total}</span><div class="table-pager-nav"><button type="button" class="button button-secondary" data-pager-page="${slice.page - 1}" ${slice.page <= 1 ? "disabled" : ""}>Previous</button><span>${slice.page} / ${slice.pages}</span><button type="button" class="button button-secondary" data-pager-page="${slice.page + 1}" ${slice.page >= slice.pages ? "disabled" : ""}>Next</button></div>`;
  }

  function bindPager(root, onPage) {
    if (!root) return;
    root.querySelectorAll("[data-pager-page]").forEach((button) => {
      button.addEventListener("click", () => onPage(Number(button.dataset.pagerPage)));
    });
  }

  window.GeeslaneUI = {
    PAGE_SIZE,
    escapeHtml,
    rowActions,
    wireRowMenus,
    pageSlice,
    pagerHtml,
    bindPager
  };
})();
