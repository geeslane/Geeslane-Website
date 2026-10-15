(function () {
  "use strict";

  const PAGE_SIZE = 10;
  let menuSeq = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function parkSubmenu(list) {
    if (!list) return;
    list.hidden = true;
    const owner = document.querySelector(`.row-menu[data-menu-id="${list.dataset.menuId || ""}"]`);
    if (owner) owner.appendChild(list);
    else list.remove();
  }

  function closeSubmenus(root = document) {
    const menus = root === document
      ? [...document.querySelectorAll(".row-menu")]
      : (root.matches?.(".row-menu") ? [root] : [...root.querySelectorAll(".row-menu")]);
    menus.forEach((menu) => {
      menu.querySelectorAll(".row-submenu-toggle").forEach((toggle) => {
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
      document.querySelectorAll(`.row-submenu-list[data-menu-id="${menu.dataset.menuId || ""}"]`).forEach(parkSubmenu);
    });
  }

  function closeRowMenus() {
    document.querySelectorAll(".row-menu.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.querySelector(".row-menu-toggle")?.setAttribute("aria-expanded", "false");
      const list = menu.querySelector(".row-menu-list");
      if (list) list.hidden = true;
      closeSubmenus(menu);
    });
    document.querySelectorAll(".row-submenu-list").forEach((list) => {
      if (list.hidden) return;
      parkSubmenu(list);
    });
  }

  function placeFixedMenu(list, toggle, align) {
    const rect = toggle.getBoundingClientRect();
    const width = Math.max(176, list.offsetWidth);
    let left = align === "start"
      ? rect.left - width - 6
      : rect.right - width;
    if (left < 8) left = Math.min(window.innerWidth - width - 8, rect.right + 6);
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    let top = align === "start" ? rect.top : rect.bottom + 4;
    if (top + list.offsetHeight > window.innerHeight - 8) {
      top = align === "start"
        ? Math.max(8, window.innerHeight - list.offsetHeight - 8)
        : Math.max(8, rect.top - list.offsetHeight - 4);
    }
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.right = "auto";
  }

  function openRowMenu(menu) {
    const toggle = menu.querySelector(".row-menu-toggle");
    const list = menu.querySelector(".row-menu-list");
    if (!toggle || !list) return;
    menu.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    list.hidden = false;
    placeFixedMenu(list, toggle, "end");
  }

  function openSubmenu(toggle) {
    const menu = toggle.closest(".row-menu");
    if (!menu) return;
    const list = menu.querySelector(`.row-submenu-list[data-submenu="${toggle.dataset.submenuOpen}"]`)
      || document.querySelector(`.row-submenu-list[data-menu-id="${menu.dataset.menuId}"][data-submenu="${toggle.dataset.submenuOpen}"]`);
    if (!list) return;
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.appendChild(list);
    list.hidden = false;
    placeFixedMenu(list, toggle, "start");
  }

  function rowActionButton(item, inMenu) {
    const cls = inMenu
      ? `row-menu-item${item.danger ? " is-danger" : ""}`
      : item.danger ? "button button-danger" : (item.primary ? "button button-primary" : "button button-secondary");
    return `<button class="${cls}" type="button" ${item.attrs || ""}>${escapeHtml(item.label)}</button>`;
  }

  function rowMenuEntry(item) {
    if (!item) return "";
    if (item.divider) return '<div class="row-menu-divider" role="separator"></div>';
    return rowActionButton(item, true);
  }

  function rowActions(items) {
    const filled = (items || []).filter(Boolean);
    if (!filled.length) return "";
    const nested = filled.some((item) => item.divider || Array.isArray(item.items));
    if (!nested && filled.length <= 2) return `<div class="billing-row-actions">${filled.map((item) => rowActionButton(item, false)).join("")}</div>`;
    const primary = filled.find((item) => item.primary && !item.items && !item.divider);
    const rest = primary ? filled.filter((item) => item !== primary) : filled;
    const menuId = `rm-${++menuSeq}`;
    const flyouts = [];
    const entries = rest.map((item, index) => {
      if (!item || item.divider || !Array.isArray(item.items)) return rowMenuEntry(item);
      const children = item.items.filter(Boolean);
      if (!children.length) return "";
      const id = `sub-${index}`;
      flyouts.push(`<div class="row-submenu-list" data-submenu="${id}" data-menu-id="${menuId}" hidden>${children.map((child) => rowActionButton(child, true)).join("")}</div>`);
      return `<button class="row-menu-item row-submenu-toggle" type="button" data-submenu-open="${id}" aria-expanded="false">${escapeHtml(item.label)}<span class="row-submenu-caret" aria-hidden="true">›</span></button>`;
    }).join("");
    const menu = `<div class="row-menu" data-menu-id="${menuId}"><button class="icon-button row-menu-toggle" type="button" aria-label="Actions" aria-expanded="false">⋯</button><div class="row-menu-list" hidden>${entries}</div>${flyouts.join("")}</div>`;
    if (!primary) return menu;
    return `<div class="billing-row-actions">${rowActionButton(primary, false)}${menu}</div>`;
  }

  function wireRowMenus() {
    if (document.documentElement.dataset.rowMenus === "1") return;
    document.documentElement.dataset.rowMenus = "1";
    document.addEventListener("click", (event) => {
      const subToggle = event.target.closest(".row-submenu-toggle");
      if (subToggle) {
        event.preventDefault();
        event.stopPropagation();
        const wasOpen = subToggle.classList.contains("is-open");
        const menu = subToggle.closest(".row-menu");
        closeSubmenus(menu || document);
        if (!wasOpen) openSubmenu(subToggle);
        return;
      }
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
      if (!event.target.closest(".row-menu-list") && !event.target.closest(".row-submenu-list")) closeRowMenus();
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
    closeRowMenus,
    wireRowMenus,
    pageSlice,
    pagerHtml,
    bindPager
  };
})();
