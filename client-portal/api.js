(function () {
  "use strict";

  /* Backend client: auth, project load, admin mutations, Paystack helpers. */

  const config = window.GEESLANE_CONFIG || {};
  let database = null;
  let cachedSession = null;
  let cachedProfile = null;
  let loaderCount = 0;

  function normalizeSupabaseUrl(url) {
    const match = String(url || "").trim().match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)(?:\/.*)?$/i);
    return match ? match[1] : "";
  }

  function backendConfigured() {
    const url = normalizeSupabaseUrl(config.supabaseUrl);
    const key = String(config.supabasePublishableKey || "").trim();
    return Boolean(url && /^(sb_publishable_|eyJ)/.test(key));
  }

  const AUTH_STORAGE_KEY = "geeslane-portal-auth";
  const AUTH_IDB_NAME = "geeslane-portal";
  const AUTH_IDB_STORE = "auth";
  const authMemory = {};
  let authHydratePromise = null;

  function idbRequest(mode, run) {
    return new Promise((resolve) => {
      if (!window.indexedDB) { resolve(undefined); return; }
      const open = indexedDB.open(AUTH_IDB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(AUTH_IDB_STORE)) open.result.createObjectStore(AUTH_IDB_STORE);
      };
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(AUTH_IDB_STORE, mode);
          const request = run(tx.objectStore(AUTH_IDB_STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        } catch (_) {
          resolve(undefined);
        }
      };
    });
  }

  function hydrateAuthStorage() {
    if (!authHydratePromise) {
      authHydratePromise = (async () => {
        const saved = await idbRequest("readonly", (store) => store.get(AUTH_STORAGE_KEY));
        if (!saved) return;
        authMemory[AUTH_STORAGE_KEY] = saved;
        try {
          if (!localStorage.getItem(AUTH_STORAGE_KEY)) localStorage.setItem(AUTH_STORAGE_KEY, saved);
        } catch (_) { /* iOS storage can be blocked; memory plus IndexedDB still keep the session */ }
      })();
    }
    return authHydratePromise;
  }

  const authStorage = {
    getItem(key) {
      try {
        const value = localStorage.getItem(key);
        if (value != null) return value;
      } catch (_) { /* fall through */ }
      return Object.prototype.hasOwnProperty.call(authMemory, key) ? authMemory[key] : null;
    },
    setItem(key, value) {
      authMemory[key] = value;
      try { localStorage.setItem(key, value); } catch (_) { /* keep memory and IndexedDB */ }
      idbRequest("readwrite", (store) => store.put(value, key));
    },
    removeItem(key) {
      delete authMemory[key];
      try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
      idbRequest("readwrite", (store) => store.delete(key));
    }
  };

  function client() {
    if (!backendConfigured()) throw new Error("Supabase is not configured in client-portal/config.js");
    if (!window.supabase?.createClient) throw new Error("The Supabase client library did not load");
    if (!database) {
      database = window.supabase.createClient(normalizeSupabaseUrl(config.supabaseUrl), String(config.supabasePublishableKey).trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorage,
          storageKey: AUTH_STORAGE_KEY
        }
      });
    }
    return database;
  }

  function logPortalError(context, error) {
    const detail = error && typeof error === "object"
      ? { message: error.message, status: error.status, code: error.code || error.error, name: error.name }
      : { message: String(error || "") };
    console.error(`[Geeslane portal] ${context}`, detail);
  }

  function isRateLimitError(error) {
    const message = String(error?.message || error || "");
    return Number(error?.status) === 429 || /rate limit|over_email_send_rate_limit|\b429\b/i.test(message);
  }

  function userFacingError(error, fallback = "Something went wrong. Please try again.") {
    logPortalError("request", error);
    if (error?.userMessage) return error.userMessage;
    const message = String(error?.cause?.message || error?.message || error || "");
    if (isRateLimitError(error) || isRateLimitError(error?.cause)) return "Too many sign-in emails were requested. Please wait a minute, then try again.";
    if (/already has a Geeslane portal account|sign in instead/i.test(message)) return "This email already has a Geeslane account. Sign in with that email instead of requesting access again.";
    if (/write a short note/i.test(message)) return "Write a short note before sending.";
    if (/required access-request fields/i.test(message)) return "Please complete your name, business, email, what you need, and a short project summary.";
    if (/invalid email|valid email/i.test(message) && /enter a valid/i.test(message)) return "Enter a valid email address.";
    if (/expired|otp_expired|access_denied|invalid.*(link|otp|token)/i.test(message)) return "That sign-in code or link is no longer valid. Request a new code.";
    if (/redirect|not allowed|whitelist|allow list/i.test(message)) return "This sign-in could not be completed. Confirm the portal address is listed in Supabase Auth redirect URLs.";
    if (/failed to fetch|network|load failed/i.test(message)) return "The portal could not reach Supabase. Check your connection and try again.";
    if (/could not find the function|schema cache|pgrst202/i.test(message) && /receipt/i.test(message)) return "Could not save the receipt. Run projects_invoices.sql in Supabase if this is the first time.";
    if (/could not find the function|schema cache|pgrst202/i.test(message) && /billing|online_payment|contract_amount/i.test(message)) return "Could not save project totals. Run project_payments.sql in Supabase, then try again.";
    if (/could not find the function|schema cache|pgrst202/i.test(message) && /portal_settings|bank/i.test(message)) return "Could not save bank details. Run portal_settings.sql in Supabase, then try again.";
    if (/could not find the function|schema cache|pgrst202/i.test(message) && /client_add_project/i.test(message)) return "Could not add another project. Run client_add_project.sql in Supabase, then try again.";
    if (/column .*goal.*does not exist|42703/i.test(message)) return "Run portal_settings.sql in Supabase so project briefs can be saved, then try again.";
    if (/profile not found|no Geeslane portal profile/i.test(message)) return "This sign-in is valid, but no Geeslane portal profile exists for this email yet.";
    if (/Administrator access is required/i.test(message)) return "Administrator access is required.";
    return fallback;
  }

  const PHONE_COUNTRIES = [
    ["NG", "Nigeria", "+234"], ["GH", "Ghana", "+233"], ["KE", "Kenya", "+254"], ["ZA", "South Africa", "+27"],
    ["CM", "Cameroon", "+237"], ["CI", "Côte d’Ivoire", "+225"], ["SN", "Senegal", "+221"], ["TG", "Togo", "+228"],
    ["BJ", "Benin", "+229"], ["NE", "Niger", "+227"], ["EG", "Egypt", "+20"], ["RW", "Rwanda", "+250"],
    ["UG", "Uganda", "+256"], ["TZ", "Tanzania", "+255"], ["GB", "United Kingdom", "+44"], ["US", "United States", "+1"],
    ["CA", "Canada", "+1"], ["AE", "United Arab Emirates", "+971"], ["IN", "India", "+91"], ["IE", "Ireland", "+353"],
    ["FR", "France", "+33"], ["DE", "Germany", "+49"], ["AU", "Australia", "+61"]
  ];

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function splitPhone(value) {
    const raw = String(value || "").trim();
    const compact = raw.replace(/[^\d+]/g, "");
    const ranked = PHONE_COUNTRIES.slice().sort((a, b) => b[2].length - a[2].length);
    for (const [iso, , dial] of ranked) {
      const code = phoneDigits(dial);
      if (compact.startsWith(dial) || compact.replace(/^\+/, "").startsWith(code)) {
        return { iso, dial, local: compact.replace(/^\+/, "").slice(code.length).replace(/^0+/, "") };
      }
    }
    return { iso: "NG", dial: "+234", local: phoneDigits(compact.replace(/^\+?234/, "")).replace(/^0+/, "") };
  }

  function composePhone(dial, local) {
    const rest = phoneDigits(local).replace(/^0+/, "");
    if (!rest) return "";
    return `${dial || "+234"}${rest}`;
  }

  function phoneSelectOptions(selectedDial) {
    return PHONE_COUNTRIES.map(([iso, name, dial]) => {
      const chosen = dial === selectedDial ? " selected" : "";
      return `<option value="${dial}" data-iso="${iso}"${chosen}>${iso} ${dial}</option>`;
    }).join("");
  }

  function fillPhoneField(root, value) {
    const combo = typeof root === "string" ? document.querySelector(`[data-phone-combo="${root}"]`) : root;
    if (!combo) return;
    const select = combo.querySelector("select");
    const local = combo.querySelector('input[type="tel"]');
    const hidden = combo.querySelector('input[type="hidden"]');
    const parts = splitPhone(value);
    if (select && !select.options.length) select.innerHTML = phoneSelectOptions(parts.dial);
    if (select) {
      if (![...select.options].some((option) => option.value === parts.dial)) {
        select.insertAdjacentHTML("afterbegin", `<option value="${parts.dial}">${parts.dial}</option>`);
      }
      select.value = parts.dial;
    }
    if (local) local.value = parts.local;
    if (hidden) hidden.value = composePhone(parts.dial, parts.local);
  }

  function syncPhoneField(combo) {
    if (!combo) return "";
    const select = combo.querySelector("select");
    const local = combo.querySelector('input[type="tel"]');
    const hidden = combo.querySelector('input[type="hidden"]');
    const value = composePhone(select?.value, local?.value);
    if (hidden) hidden.value = value;
    if (local) local.setAttribute("aria-invalid", local.value.trim() && !phoneDigits(local.value) ? "true" : "false");
    return value;
  }

  function readPhoneField(name) {
    const combo = document.querySelector(`[data-phone-combo="${name}"]`);
    if (combo) return syncPhoneField(combo);
    const node = document.querySelector(`[name="${name}"]`);
    return String(node?.value || "").trim();
  }

  function bindPhoneFields(scope = document) {
    scope.querySelectorAll("[data-phone-combo]").forEach((combo) => {
      const select = combo.querySelector("select");
      const local = combo.querySelector('input[type="tel"]');
      if (select && !select.options.length) select.innerHTML = phoneSelectOptions("+234");
      if (combo.dataset.phoneBound) return;
      combo.dataset.phoneBound = "1";
      const sync = () => syncPhoneField(combo);
      select?.addEventListener("change", sync);
      local?.addEventListener("input", sync);
      combo.closest("form")?.addEventListener("submit", sync);
      sync();
    });
  }

  function resultOrThrow(result, fallback = "The portal request failed") {
    if (result?.error) {
      logPortalError("supabase", result.error);
      const error = new Error(result.error.message || fallback);
      error.status = result.error.status;
      error.code = result.error.code;
      error.cause = result.error;
      error.userMessage = userFacingError({ cause: result.error, message: result.error.message }, fallback);
      throw error;
    }
    return result?.data;
  }

  function portalBaseUrl() {
    const origin = location.origin;
    const path = String(location.pathname || "/").replace(/\\/g, "/");
    const nested = path.match(/^(.*?\/client-portal)(?:\/|$)/i);
    if (nested) return `${origin}${nested[1]}/`;
    const directory = path.replace(/[^/]*$/, "") || "/";
    return `${origin}${directory.endsWith("/") ? directory : `${directory}/`}`;
  }

  function clientSignInRedirect(nextPage) {
    const url = new URL(portalBaseUrl());
    if (nextPage) url.searchParams.set("next", nextPage);
    return url.href;
  }

  function adminSignInRedirect() {
    return new URL("admin.html", portalBaseUrl()).href;
  }

  function portalRedirect(nextPage) {
    return clientSignInRedirect(nextPage);
  }

  function hasIncomingMagicLink() {
    const params = new URLSearchParams(location.search);
    const hash = location.hash || "";
    return Boolean(params.get("code") || params.get("token_hash") || params.get("error_description") || params.get("error") || /access_token|refresh_token|type=magiclink|error_description/.test(hash));
  }

  function authCallbackError() {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    return search.get("error_description") || search.get("error") || hash.get("error_description") || hash.get("error") || "";
  }

  function clearAuthParamsFromUrl() {
    const url = new URL(location.href);
    ["code", "error", "error_code", "error_description", "token_hash", "type"].forEach((key) => url.searchParams.delete(key));
    if (/access_token|refresh_token|type=magiclink|error_description|error=/.test(url.hash)) url.hash = "";
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function loaderMessageFor(action) {
    const name = String(action || "");
    if (/magic|consume|login|getSession|getCurrentUser/i.test(name)) return "Signing you in…";
    if (/Dashboard|Workspace|getProject|getMy|readProject/i.test(name)) return "Loading your workspace…";
    if (/requestMagicLink|requestAccess/i.test(name)) return "Sending…";
    if (/upload/i.test(name)) return "Uploading…";
    if (/logout/i.test(name)) return "Signing out…";
    return "Please wait…";
  }

  function ensureLoader() {
    let el = document.getElementById("page-loader");
    if (el) return el;
    el = document.createElement("div");
    el.id = "page-loader";
    el.className = "page-loader";
    el.hidden = true;
    el.innerHTML = '<div class="page-loader-card" role="status" aria-live="polite" aria-busy="true"><span class="page-spinner" aria-hidden="true"></span><p class="page-loader-copy">Loading…</p></div>';
    document.body.appendChild(el);
    return el;
  }

  function showLoader(message) {
    loaderCount += 1;
    const el = ensureLoader();
    const copy = el.querySelector(".page-loader-copy");
    if (copy && message) copy.textContent = message;
    el.hidden = false;
    document.body.classList.add("is-page-loading");
  }

  function hideLoader() {
    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount > 0) return;
    const el = document.getElementById("page-loader");
    if (el) el.hidden = true;
    document.body.classList.remove("is-page-loading");
  }

  function withLoader(task, message) {
    showLoader(message);
    return Promise.resolve().then(task).finally(hideLoader);
  }

  function codeFromBoxes(root) {
    return [...(root?.querySelectorAll(".code-box") || [])].map((box) => String(box.value || "").replace(/\D/g, "")).join("").slice(0, 6);
  }

  function clearCodeBoxes(root) {
    if (!root) return;
    root.querySelectorAll(".code-box").forEach((box) => { box.value = ""; });
    root.querySelector(".code-box")?.focus();
  }

  function bindCodeBoxes(root, onComplete) {
    if (!root || root.dataset.codeBound === "1") return;
    const boxes = [...root.querySelectorAll(".code-box")];
    if (boxes.length !== 6) return;
    root.dataset.codeBound = "1";
    const finish = () => {
      const code = codeFromBoxes(root);
      if (code.length === 6) onComplete?.(code);
    };
    boxes.forEach((box, index) => {
      box.addEventListener("input", (event) => {
        const digits = String(event.target.value || "").replace(/\D/g, "");
        if (!digits) { event.target.value = ""; return; }
        const chunk = digits.slice(0, 6 - index);
        chunk.split("").forEach((digit, offset) => {
          if (boxes[index + offset]) boxes[index + offset].value = digit;
        });
        const nextIndex = Math.min(index + chunk.length, 5);
        boxes[nextIndex].focus();
        boxes[nextIndex].select();
        finish();
      });
      box.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !box.value && index > 0) {
          event.preventDefault();
          boxes[index - 1].value = "";
          boxes[index - 1].focus();
        }
        if (event.key === "ArrowLeft" && index > 0) boxes[index - 1].focus();
        if (event.key === "ArrowRight" && index < 5) boxes[index + 1].focus();
      });
      box.addEventListener("paste", (event) => {
        const text = String(event.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        event.preventDefault();
        boxes.forEach((item, offset) => { item.value = text[offset] || ""; });
        boxes[Math.min(text.length, 5)].focus();
        finish();
      });
    });
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent.trim();
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.classList.remove("is-cooldown");
      if (label) {
        button.classList.remove("is-loading");
        button.textContent = label;
      } else {
        button.classList.add("is-loading");
      }
      return;
    }
    button.classList.remove("is-loading");
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
  }

  function startMagicLinkCooldown(button, seconds = 60) {
    if (!button) return;
    const idle = button.dataset.idleLabel || button.textContent.trim() || "Send Code";
    button.dataset.idleLabel = idle;
    if (button.dataset.cooldownTimer) clearInterval(Number(button.dataset.cooldownTimer));
    button.classList.remove("is-loading");
    button.classList.add("is-cooldown");
    button.disabled = true;
    button.setAttribute("aria-busy", "false");
    let remaining = Math.max(1, Number(seconds) || 60);
    const render = () => {
      button.textContent = `Send again in ${remaining}s`;
    };
    render();
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        delete button.dataset.cooldownTimer;
        button.classList.remove("is-cooldown");
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = idle;
        return;
      }
      render();
    }, 1000);
    button.dataset.cooldownTimer = String(timer);
  }

  function mapProfile(row) {
    if (!row) return null;
    return {
      id: row.user_id || row.id, email: row.email, name: row.name || "", business: row.business || "", phone: row.phone || "",
      contact: row.contact_preference || "Email", role: row.role || "client", status: row.status || "pending",
      clientId: row.client_id || "", createdAt: row.created_at || "", lastLoginAt: row.last_login_at || ""
    };
  }

  function mapProject(row) {
    return {
      id: row.id, clientId: row.client_id, name: row.name, service: row.service, status: row.status, stage: row.stage,
      progress: Number(row.progress || 0), startDate: row.start_date || "", targetDate: row.target_date || "",
      createdAt: row.created_at || "", updatedAt: row.updated_at || "",
      hasWireframe: row.has_wireframe !== false && row.hasWireframe !== false,
      hasVisualDesign: row.has_visual_design !== false && row.hasVisualDesign !== false,
      isActive: row.is_active !== false && row.isActive !== false,
      contractAmount: row.contract_amount || row.contractAmount || "",
      contractCurrency: row.contract_currency || row.contractCurrency || "NGN",
      showPaymentSummary: row.show_payment_summary !== false && row.showPaymentSummary !== false,
      onlinePayments: row.online_payments !== false && row.onlinePayments !== false
    };
  }

  function projectTrack(service) {
    const value = String(service || "").toLowerCase();
    if (/automat|chatbot|workflow|n8n|zapier|make\.com|(^|[^a-z])ai([^a-z]|$)/.test(value)) return "automation";
    if (/consult|strateg|advice/.test(value)) return "consultation";
    if (/(host|domain|dns|ssl|monitor|maintenance)/.test(value) || (/\bsupport\b/.test(value) && !/(website|revamp|landing|portfolio)/.test(value))) return "support";
    if (/website|revamp|landing|portfolio|web\s*app|\bweb\b/.test(value)) return "website";
    return "other";
  }

  function milestoneTemplates(service) {
    const packs = {
      automation: [
        ["A1", "Discovery", "What to automate, the tools in use, and what success looks like.", 25],
        ["A2", "Build & Connect", "Design and connect the workflow, then test it with real cases.", 50],
        ["A3", "Review & Handover", "Confirm it works, then hand over access and how to use it.", 25]
      ],
      support: [
        ["S1", "Discovery", "What is needed, access details, and the current setup.", 25],
        ["S2", "Setup & Fix", "Complete the setup, change, or repair.", 50],
        ["S3", "Review & Handover", "Confirm it is working and hand over what you need.", 25]
      ],
      consultation: [
        ["C1", "Discovery", "The business problem and what success should look like.", 30],
        ["C2", "Recommendation", "Practical options and a recommended next step.", 45],
        ["C3", "Review & Next Steps", "Agree the advice and what happens next.", 25]
      ],
      other: [
        ["O1", "Discovery", "What is needed and what success looks like.", 30],
        ["O2", "Delivery", "Complete the agreed work.", 45],
        ["O3", "Review & Close", "Confirm the work and close the project.", 25]
      ],
      website: [
        ["M1", "Discovery", "What the project needs, and who it is for.", 10],
        ["M2", "Brand Assets & Content", "Logos, colours, photos, and copy.", 15],
        ["M3", "Wireframe", "How the pages are laid out.", 15],
        ["M4", "Visual Design", "How the site looks.", 20],
        ["M5", "Development", "Building the site.", 25],
        ["M6", "QA & Testing", "Final check before launch.", 10],
        ["M7", "Launch & Handover", "Go live and hand over.", 5]
      ]
    };
    return packs[projectTrack(service)] || packs.website;
  }

  function progressStageLabels(service) {
    return {
      automation: ["Discovery", "Build", "Handover"],
      support: ["Discovery", "Setup", "Handover"],
      consultation: ["Discovery", "Advice", "Next Steps"],
      other: ["Discovery", "Delivery", "Close"],
      website: ["Discovery", "Design", "Development", "Launch"]
    }[projectTrack(service)] || ["Discovery", "Design", "Development", "Launch"];
  }

  function milestoneIsIncluded(item, project) {
    if (projectTrack(project?.service) !== "website") return true;
    const code = String(item?.code || item?.id || "").toUpperCase();
    const title = String(item?.title || "");
    if ((code === "M3" || /wireframe/i.test(title)) && project && project.hasWireframe === false) return false;
    if ((code === "M4" || /visual\s*design/i.test(title)) && project && project.hasVisualDesign === false) return false;
    return true;
  }

  function mapMilestone(row) {
    return {
      projectId: row.project_id, id: row.id, code: row.code, title: row.title, description: row.description || "",
      weight: Number(row.weight || 0), status: row.status, sortOrder: Number(row.sort_order || 0)
    };
  }

  function mapMessage(row) {
    return {
      id: row.id, projectId: row.project_id || row.projectId, milestoneId: row.milestone_id || row.milestoneId,
      role: row.author_role || row.role, name: row.author_name || row.name || "", body: row.body || "",
      kind: row.kind || "comment", createdAt: row.created_at || row.createdAt || "",
      requestId: row.requestId || row.request_id || "",
      milestoneStatus: row.milestoneStatus || row.milestone_status || ""
    };
  }

  function mapRequest(row, clientView = false) {
    return {
      id: clientView ? row.reference : row.id, databaseId: row.id, reference: row.reference, projectId: row.project_id,
      type: row.type, title: row.title, status: row.status, values: row.payload || {},
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  function mapBrand(row) {
    return {
      primaryColor: row?.primary_color || "#0B6B45", secondaryColor: row?.secondary_color || "#FFFFFF",
      accentColor: row?.accent_color || "#C83B3B", headingFont: row?.heading_font || "", bodyFont: row?.body_font || "",
      personality: row?.personality || "", styleNotes: row?.style_notes || "", referenceLinks: row?.reference_links || ""
    };
  }

  function mapContent(row) {
    return {
      headline: row?.headline || "", introduction: row?.introduction || "", about: row?.about || "",
      services: row?.services || "", testimonials: row?.testimonials || "", callToAction: row?.call_to_action || "",
      contactDetails: row?.contact_details || "", extraNotes: row?.extra_notes || "",
      goal: row?.goal || "", audience: row?.audience || "", scope: row?.scope || ""
    };
  }

  function mapInvoice(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id || row.projectId, reference: row.reference || "",
      title: row.title || "", description: row.description || "", amount: row.amount || "",
      currency: row.currency || "NGN", dueDate: row.due_date || row.dueDate || "",
      status: row.status || "Draft", paidAmount: row.paid_amount || row.paidAmount || "",
      notes: row.notes || "", sentAt: row.sent_at || row.sentAt || "",
      paidAt: row.paid_at || row.paidAt || "", createdAt: row.created_at || row.createdAt || "",
      updatedAt: row.updated_at || row.updatedAt || "",
      projectName: row.projectName || "", business: row.business || "",
      kind: row.kind || "invoice"
    };
  }

  function mapReceipt(row) {
    if (!row) return null;
    return {
      id: row.id, projectId: row.project_id || row.projectId,
      invoiceId: row.invoice_id || row.invoiceId || "",
      invoiceReference: row.invoiceReference || row.invoice_reference || "",
      reference: row.reference || "", title: row.title || "", description: row.description || "",
      amount: row.amount || "", currency: row.currency || "NGN",
      paidOn: row.paid_on || row.paidOn || "", method: row.method || "",
      notes: row.notes || "", status: row.status || "Draft",
      sentAt: row.sent_at || row.sentAt || "",
      createdAt: row.created_at || row.createdAt || "",
      updatedAt: row.updated_at || row.updatedAt || "",
      projectName: row.projectName || "", business: row.business || "",
      clientName: row.clientName || row.client_name || "",
      kind: "receipt"
    };
  }

  function parseMoney(value) {
    const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : null;
  }

  function formatMoney(amount, currency) {
    if (amount == null || !Number.isFinite(amount)) return "";
    const rounded = Math.round(amount * 100) / 100;
    const formatted = Number.isInteger(rounded)
      ? rounded.toLocaleString("en-NG")
      : rounded.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [String(currency || "NGN").trim() || "NGN", formatted].join(" ");
  }

  function invoiceBalance(invoice) {
    const total = parseMoney(invoice?.amount);
    if (total == null) return null;
    const status = String(invoice?.status || "").trim();
    const paid = status === "Paid" ? total : Math.min(total, Math.max(0, parseMoney(invoice?.paidAmount) ?? 0));
    const remaining = status === "Paid" || status === "Cancelled" ? 0 : Math.max(0, total - paid);
    const currency = String(invoice?.currency || "NGN").trim() || "NGN";
    return {
      currency,
      total,
      paid,
      remaining,
      totalLabel: formatMoney(total, currency),
      paidLabel: formatMoney(paid, currency),
      remainingLabel: formatMoney(remaining, currency)
    };
  }

  function invoiceBalanceSum(invoices) {
    const balances = (invoices || [])
      .filter((invoice) => {
        const status = String(invoice?.status || "").trim();
        return status && status !== "Draft" && status !== "Cancelled";
      })
      .map(invoiceBalance)
      .filter(Boolean);
    if (!balances.length) return null;
    const currency = balances[0].currency;
    if (balances.some((item) => item.currency !== currency)) return null;
    const total = balances.reduce((sum, item) => sum + item.total, 0);
    const paid = balances.reduce((sum, item) => sum + item.paid, 0);
    const remaining = balances.reduce((sum, item) => sum + item.remaining, 0);
    return {
      currency,
      total,
      paid,
      remaining,
      totalLabel: formatMoney(total, currency),
      paidLabel: formatMoney(paid, currency),
      remainingLabel: formatMoney(remaining, currency)
    };
  }

  function projectBalance({ project, invoices, receipts, agreement } = {}) {
    const currency = String(project?.contractCurrency || "NGN").trim() || "NGN";
    const receiptPaid = (receipts || [])
      .filter((item) => item && item.status !== "Draft" && item.status !== "Cancelled")
      .reduce((sum, item) => sum + (parseMoney(item.amount) || 0), 0);
    const invoicePaid = (invoices || [])
      .filter((item) => {
        const status = String(item?.status || "").trim();
        return status && status !== "Draft" && status !== "Cancelled";
      })
      .reduce((sum, item) => sum + (parseMoney(item.paidAmount) || 0), 0);
    const paid = Math.max(receiptPaid, invoicePaid);
    const contract = parseMoney(project?.contractAmount);
    const fee = parseMoney(agreement?.fee);
    const invoiced = invoiceBalanceSum(invoices);
    const total = contract ?? fee ?? invoiced?.total ?? null;
    if (total == null && paid <= 0) return null;
    const due = total == null ? 0 : Math.max(0, total - paid);
    return {
      currency,
      total: total == null ? paid : total,
      paid,
      remaining: due,
      totalLabel: formatMoney(total == null ? paid : total, currency),
      paidLabel: formatMoney(paid, currency),
      remainingLabel: formatMoney(due, currency),
      showSummary: project?.showPaymentSummary !== false
    };
  }

  function paystackEnabled() {
    const config = window.GEESLANE_CONFIG || {};
    if (config.paystackReady === false) return false;
    return Boolean(String(config.paystackPublicKey || "").trim());
  }

  function paymentReturnReference() {
    try {
      const params = new URLSearchParams(location.search);
      return String(params.get("reference") || params.get("trxref") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function clearPaymentReturn() {
    if (!paymentReturnReference()) return;
    try {
      const url = new URL(location.href);
      url.searchParams.delete("reference");
      url.searchParams.delete("trxref");
      history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    } catch (_) { /* ignore */ }
  }

  async function invokePayment(name, body, fallback) {
    const result = await client().functions.invoke(name, { body: body || {} });
    const payload = result.data || {};
    if (result.error || payload.error) {
      const message = payload.error || result.error?.message || fallback;
      throw Object.assign(new Error(message), { userMessage: message });
    }
    return payload;
  }

  async function startPayment(details) {
    if (!backendConfigured()) {
      throw Object.assign(new Error("Online payments are not configured"), { userMessage: "Online payments are not available right now." });
    }
    return withLoader(() => invokePayment("start-payment", details, "Could not start online payment."), "Opening payment…");
  }

  async function verifyPayment(reference) {
    if (!backendConfigured()) {
      throw Object.assign(new Error("Online payments are not configured"), { userMessage: "Online payments are not available right now." });
    }
    return withLoader(() => invokePayment("verify-payment", { reference }, "Could not confirm this payment."), "Confirming payment…");
  }

  function mapAgreement(row) {
    if (!row) return null;
    return {
      clientName: row.client_name || row.clientName || "",
      projectTitle: row.project_title || row.projectTitle || "",
      deliverables: row.deliverables || "",
      fee: row.fee || "",
      paymentPlan: row.payment_plan || row.paymentPlan || "",
      revisionRounds: Number(row.revision_rounds ?? row.revisionRounds ?? 0),
      timeline: row.timeline || "",
      handover: row.handover && typeof row.handover === "object" ? row.handover : {},
      savedAt: row.saved_at || row.savedAt || row.updated_at || "",
      updatedAt: row.updated_at || row.updatedAt || "",
      saved: true
    };
  }

  function mapBrief(row, requests = []) {
    const discovery = row?.discovery && typeof row.discovery === "object" ? row.discovery : {};
    const fromRow = {
      goal: String(row?.goal || discovery.purpose || discovery.goal || "").trim(),
      audience: String(row?.audience || discovery.audience || "").trim(),
      scope: String(row?.scope || discovery.visitorDetails || discovery.visitorsCanDo || discovery.scope || "").trim(),
      businessDescription: String(discovery.businessDescription || row?.about || row?.introduction || "").trim(),
      socialLinks: String(discovery.socialLinks || "").trim(),
      websiteUrl: String(discovery.websiteUrl || discovery.existingUrl || discovery.supportUrl || "").trim(),
      visitorDetails: String(discovery.visitorDetails || discovery.visitorsCanDo || row?.scope || discovery.scope || "").trim(),
      features: String(discovery.features || "").trim(),
      featuresOther: String(discovery.featuresOther || "").trim(),
      hasDomain: String(discovery.hasDomain || "").trim(),
      hasHosting: String(discovery.hasHosting || "").trim(),
      availableAssets: String(discovery.availableAssets || "").trim(),
      location: String(discovery.location || "").trim(),
      industry: String(discovery.industry || "").trim(),
      serviceLabel: String(discovery.serviceLabel || "").trim()
    };
    if (fromRow.goal || fromRow.audience || fromRow.scope || fromRow.businessDescription) return fromRow;
    const request = (requests || []).find((item) => item.type === "discovery");
    return {
      ...fromRow,
      goal: String(request?.values?.goal || request?.payload?.goal || "").trim(),
      audience: String(request?.values?.audience || request?.payload?.audience || "").trim(),
      scope: String(request?.values?.scope || request?.values?.mustHaves || request?.payload?.scope || request?.payload?.mustHaves || "").trim()
    };
  }

  async function consumeMagicLink() {
    const run = async () => {
      if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
      await hydrateAuthStorage();
      cachedSession = null;
      cachedProfile = null;

      const callbackError = authCallbackError();
      if (callbackError) {
        logPortalError("magic-link-callback", callbackError);
        clearAuthParamsFromUrl();
        const error = new Error("That sign-in code or link is no longer valid. Request a new code.");
        error.userMessage = /rate limit/i.test(callbackError)
          ? "Too many sign-in emails were requested. Please wait a minute, then try again."
          : "That sign-in code or link is no longer valid. Request a new code.";
        throw error;
      }

      const supabase = client();
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const otpType = params.get("type") || "magiclink";

      let session = (await supabase.auth.getSession())?.data?.session || null;
      if (!session && code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (exchanged.error) logPortalError("exchangeCodeForSession", exchanged.error);
        else session = exchanged.data?.session || null;
      } else if (!session && tokenHash) {
        const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
        if (verified.error) logPortalError("verifyOtp", verified.error);
        else session = verified.data?.session || null;
      }
      if (!session && hasIncomingMagicLink()) {
        session = await new Promise((resolve) => {
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            subscription.unsubscribe();
            resolve(value);
          };
          const timer = setTimeout(() => finish(null), 12000);
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (nextSession) finish(nextSession);
            if (event === "SIGNED_OUT") finish(null);
          });
          supabase.auth.getSession().then((result) => {
            if (result?.data?.session) finish(result.data.session);
          }).catch((error) => logPortalError("getSession-wait", error));
        });
      }

      cachedSession = session;
      if ((code || tokenHash) && !session) {
        clearAuthParamsFromUrl();
        const error = new Error("Could not complete sign-in");
        error.userMessage = "That sign-in could not be completed. Enter the code from your email, or request a new one.";
        throw error;
      }
      if (hasIncomingMagicLink()) clearAuthParamsFromUrl();
      return cachedSession;
    };
    return hasIncomingMagicLink() ? withLoader(run, "Signing you in…") : run();
  }

  function hasLegacyAccess() { return false; }
  function hasAuthSession() { return Boolean(cachedSession); }
  function isConnected() { return backendConfigured() && hasAuthSession(); }
  function isLocalAdminSession() { return false; }
  function currentUser() { return cachedProfile; }

  function prettyFirstName(name) {
    if (window.GeeslaneMail?.givenName) return window.GeeslaneMail.givenName(name);
    const value = String(name || "").trim().split(/\s+/)[0];
    if (!value || /^a$/i.test(value) || /^there$/i.test(value)) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  async function sendMagicLink(email, redirectTo, metadata) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      const error = new Error("Enter a valid email address");
      error.userMessage = "Enter a valid email address.";
      throw error;
    }
    const data = { ...(metadata || {}) };
    const fullName = data.name || data.full_name || "";
    const formal = window.GeeslaneMail?.respectfulName(fullName) || prettyFirstName(fullName);
    if (fullName) data.full_name = fullName;
    if (formal) data.name = formal;
    const result = await client().auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo, data }
    });
    if (result.error) {
      logPortalError("signInWithOtp", result.error);
      const error = new Error(result.error.message || "Could not send the sign-in email");
      error.status = result.error.status;
      error.code = result.error.code;
      error.userMessage = userFacingError(error, "The sign-in email could not be sent. Please try again.");
      throw error;
    }
    return { sent: true, redirectTo };
  }

  function envAdminCredentials() {
    return {
      username: String(config.adminUsername || "").trim(),
      password: String(config.adminPassword || ""),
      email: String(config.adminEmail || "").trim()
    };
  }

  function resolveAdminEmail(username) {
    const user = String(username || "").trim();
    const env = envAdminCredentials();
    if (user.includes("@")) return user.toLowerCase();
    if (env.username && user && user.toLowerCase() === env.username.toLowerCase()) {
      if (env.email.includes("@")) return env.email.toLowerCase();
      if (env.username.includes("@")) return env.username.toLowerCase();
    }
    return "";
  }

  async function adminPasswordLogin(username, password) {
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    const user = String(username || "").trim();
    const pass = String(password || "");
    if (!user || !pass) {
      throw Object.assign(new Error("Enter your administrator username and password"), { userMessage: "Enter your administrator username and password." });
    }
    const env = envAdminCredentials();
    const envMatch = Boolean(env.username && env.password && user.toLowerCase() === env.username.toLowerCase() && pass === env.password);
    const email = resolveAdminEmail(user);
    if (!email) {
      throw Object.assign(new Error("Administrator email missing"), {
        userMessage: envMatch
          ? "That username matches the local shortcut, but ADMIN_EMAIL is missing. Add it in client-portal/.env and try again."
          : "Enter the administrator email used in Supabase Auth."
      });
    }
    if (!backendConfigured()) {
      throw Object.assign(new Error("Supabase is not configured"), { userMessage: "Administrator sign-in is not connected on this host yet. Publish the latest client-portal/config.js, then refresh." });
    }
    return withLoader(async () => {
      cachedSession = null;
      cachedProfile = null;
      const result = await client().auth.signInWithPassword({ email, password: pass });
      if (!result.error && result.data?.session) {
        cachedSession = result.data.session;
        return { session: cachedSession };
      }
      if (result.error) logPortalError("adminPasswordLogin", result.error);
      if (envMatch) {
        await sendMagicLink(email, adminSignInRedirect());
        return { needsCode: true, email };
      }
      throw Object.assign(new Error(result.error?.message || "Invalid administrator details"), {
        userMessage: "Invalid administrator details."
      });
    }, "Signing you in…");
  }

  async function requestMagicLink(email, destination = "client", nextPage) {
    const redirectTo = destination === "admin" ? adminSignInRedirect() : clientSignInRedirect(nextPage);
    return sendMagicLink(email, redirectTo);
  }

  async function verifySignInCode(email, token) {
    const normalized = String(email || "").trim().toLowerCase();
    const code = String(token || "").replace(/\D/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Object.assign(new Error("Enter a valid email address"), { userMessage: "Enter a valid email address." });
    }
    if (!/^\d{6}$/.test(code)) {
      throw Object.assign(new Error("Enter the 6-digit code"), { userMessage: "Enter the 6-digit code from your email." });
    }
    return withLoader(async () => {
      cachedSession = null;
      cachedProfile = null;
      const supabase = client();
      let result = await supabase.auth.verifyOtp({ email: normalized, token: code, type: "email" });
      if (result.error) result = await supabase.auth.verifyOtp({ email: normalized, token: code, type: "magiclink" });
      if (result.error) {
        logPortalError("verifySignInCode", result.error);
        const expired = /expired|otp_expired|invalid/i.test(result.error.message || "");
        throw Object.assign(new Error(result.error.message || "Could not verify the sign-in code"), {
          status: result.error.status,
          code: result.error.code,
          userMessage: expired
            ? "That code is incorrect or has expired. Try again, or send a new one."
            : userFacingError(result.error, "That code could not be verified. Try again, or send a new one.")
        });
      }
      cachedSession = result.data?.session || null;
      if (!cachedSession) {
        throw Object.assign(new Error("Could not complete sign-in"), { userMessage: "That code could not be verified. Send a new one and try again." });
      }
      return cachedSession;
    }, "Opening your portal…");
  }

  async function getSession() {
    return withLoader(async () => {
      if (!cachedSession) {
        await hydrateAuthStorage();
        const auth = await client().auth.getSession();
        if (auth.error) {
          logPortalError("getSession", auth.error);
          throw Object.assign(new Error("Could not read the sign-in session"), { userMessage: userFacingError(auth.error, "Your sign-in session could not be read. Request a new link.") });
        }
        cachedSession = auth.data?.session || null;
      }
      if (!cachedSession?.user) {
        const error = new Error("Your sign-in session has expired");
        error.userMessage = "Your sign-in session has expired. Enter a new code from your email.";
        throw error;
      }
      const profileResult = await client().from("profiles").select("*").eq("user_id", cachedSession.user.id).maybeSingle();
      if (profileResult.error) {
        logPortalError("profile", profileResult.error);
        throw Object.assign(new Error("Portal profile not found"), { userMessage: "This sign-in is valid, but no Geeslane portal profile exists for this email yet." });
      }
      if (!profileResult.data) {
        throw Object.assign(new Error("Portal profile not found"), { userMessage: "This sign-in is valid, but no Geeslane portal profile exists for this email yet." });
      }
      cachedProfile = mapProfile(profileResult.data);
      await client().rpc("touch_portal_login");
      const projectRows = resultOrThrow(await client().from("projects").select("*").order("created_at", { ascending: false }));
      return { user: cachedProfile, projects: await loadProjectSummaries(projectRows || []), session: cachedSession };
    }, "Loading your workspace…");
  }

  async function requestAccess(details) {
    return withLoader(async () => {
      const payload = {
        p_name: details.name, p_business: details.business, p_email: details.email, p_phone: details.phone || "",
        p_contact: details.contact || "Email", p_service: details.service, p_description: details.description
      };
      try {
        resultOrThrow(await client().rpc("submit_portal_registration", { ...payload, p_discovery: details.discovery || {} }), "Could not submit the service request");
      } catch (error) {
        if (details.discovery) {
          try {
            resultOrThrow(await client().rpc("submit_portal_registration", payload), "Could not submit the service request");
          } catch (_) {
            throw error;
          }
        } else {
          throw error;
        }
      }
      return { received: true };
    }, "Sending…");
  }

  async function loadProjectSummaries(projectRows) {
    const projects = (projectRows || []).map(mapProject);
    const ids = projects.map((item) => item.id).filter(Boolean);
    if (!ids.length) return projects;
    let invoiceRows = [];
    let receiptRows = [];
    let milestoneRows = [];
    let requestRows = [];
    try { invoiceRows = resultOrThrow(await client().from("project_invoices").select("*").in("project_id", ids)) || []; } catch (_) { invoiceRows = []; }
    try { receiptRows = resultOrThrow(await client().from("project_receipts").select("*").in("project_id", ids)) || []; } catch (_) { receiptRows = []; }
    try { milestoneRows = resultOrThrow(await client().from("milestones").select("id, project_id, code, title, status, weight, sort_order").in("project_id", ids).order("sort_order")) || []; } catch (_) { milestoneRows = []; }
    try { requestRows = resultOrThrow(await client().from("portal_requests").select("id, project_id, type, title, status, created_at").in("project_id", ids).order("created_at", { ascending: false })) || []; } catch (_) { requestRows = []; }
    return projects.map((project) => {
      const invoices = invoiceRows.filter((row) => row.project_id === project.id).map(mapInvoice);
      const receipts = receiptRows.filter((row) => row.project_id === project.id).map(mapReceipt);
      const milestones = milestoneRows.filter((row) => row.project_id === project.id).map(mapMilestone).filter((item) => milestoneIsIncluded(item, project));
      const requests = requestRows.filter((row) => row.project_id === project.id);
      const balance = projectBalance({ project, invoices, receipts });
      const review = milestones.find((item) => item.status === "review");
      const unpaid = invoices.filter((item) => ["Sent", "Part paid", "Overdue"].includes(item.status));
      return {
        ...project,
        summary: {
          milestoneComplete: milestones.filter((item) => item.status === "complete").length,
          milestoneTotal: milestones.length,
          remaining: balance?.showSummary ? Number(balance.remaining || 0) : 0,
          remainingLabel: balance?.showSummary ? balance.remainingLabel : "",
          paidLabel: balance?.showSummary ? balance.paidLabel : "",
          unpaidCount: unpaid.length,
          reviewTitle: review?.title || "",
          requestCount: requests.length
        }
      };
    });
  }

  async function signedAssetUrls(rows) {
    const stored = rows.filter((item) => item.storage_path);
    const urls = new Map();
    if (stored.length) {
      const signed = resultOrThrow(await client().storage.from("project-files").createSignedUrls(stored.map((item) => item.storage_path), 86400), "Could not prepare file links");
      (signed || []).forEach((item) => { if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl); });
    }
    return rows.map((row) => ({
      id: row.id, name: row.name, type: row.type, url: row.external_url || urls.get(row.storage_path) || "",
      storagePath: row.storage_path || "", createdAt: row.created_at
    }));
  }

  async function readProject(projectId) {
    if (!isConnected()) throw new Error("Private portal access is required");
    return withLoader(async () => {
      let projectRow = null;
      if (projectId) {
        projectRow = resultOrThrow(await client().from("projects").select("*").eq("id", projectId).maybeSingle(), "Could not load this project");
      } else {
        try {
          projectRow = resultOrThrow(await client().from("projects").select("*").order("is_active", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(), "Could not load this project");
        } catch (_) {
          projectRow = resultOrThrow(await client().from("projects").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(), "Could not load this project");
        }
      }
      if (!projectRow) throw new Error("No project workspace is available for this account");

      const results = await Promise.all([
        client().from("clients").select("*").eq("id", projectRow.client_id).single(),
        client().from("brand_kits").select("*").eq("project_id", projectRow.id).maybeSingle(),
        client().from("project_content").select("*").eq("project_id", projectRow.id).maybeSingle(),
        client().from("milestones").select("*").eq("project_id", projectRow.id).order("sort_order"),
        client().from("portal_requests").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false }),
        client().from("assets").select("*").eq("project_id", projectRow.id).is("archived_at", null).order("created_at", { ascending: false }),
        client().from("activity").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false }).limit(30),
        client().from("projects").select("*").eq("client_id", projectRow.client_id).order("created_at", { ascending: false })
      ]);
      const clientRow = resultOrThrow(results[0]);
      const brandRow = resultOrThrow(results[1]);
      const contentRow = resultOrThrow(results[2]);
      const milestoneRows = resultOrThrow(results[3]) || [];
      const requestRows = resultOrThrow(results[4]) || [];
      const assetRows = resultOrThrow(results[5]) || [];
      const activityRows = resultOrThrow(results[6]) || [];
      const allProjects = await loadProjectSummaries(resultOrThrow(results[7]) || []);
      let agreementRow = null;
      try {
        agreementRow = resultOrThrow(await client().from("project_agreements").select("*").eq("project_id", projectRow.id).maybeSingle());
      } catch (_) { agreementRow = null; }
      let invoiceRows = [];
      try {
        invoiceRows = resultOrThrow(await client().from("project_invoices").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false })) || [];
      } catch (_) { invoiceRows = []; }
      let receiptRows = [];
      try {
        receiptRows = resultOrThrow(await client().from("project_receipts").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false })) || [];
      } catch (_) { receiptRows = []; }
      let messageRows = [];
      try {
        messageRows = resultOrThrow(await client().from("milestone_messages").select("*").eq("project_id", projectRow.id).order("created_at")) || [];
      } catch (_) { messageRows = []; }
      const resources = await signedAssetUrls(assetRows);
      const project = mapProject(projectRow);
      project.brandKit = mapBrand(brandRow);
      project.content = mapContent(contentRow);
      project.brief = mapBrief(contentRow, requestRows.map((row) => mapRequest(row, true)));

      return {
        user: cachedProfile,
        projects: allProjects,
        workspace: {
          initialized: true,
          createdAt: cachedProfile?.createdAt || clientRow.created_at,
          profile: { name: clientRow.name, business: clientRow.business, email: clientRow.email, phone: clientRow.phone || "", contact: clientRow.contact_preference || "Email" },
          project,
          milestones: milestoneRows.map(mapMilestone).filter((item) => milestoneIsIncluded(item, project)),
          requests: requestRows.map((row) => mapRequest(row, true)),
          resources,
          activity: activityRows.map((row) => ({ id: row.id, title: row.title, detail: row.detail, type: row.type, createdAt: row.created_at })),
          messages: messageRows.map(mapMessage),
          agreement: mapAgreement(agreementRow),
          invoices: invoiceRows.map(mapInvoice),
          receipts: receiptRows.map((row) => {
            const receipt = mapReceipt(row);
            const linked = invoiceRows.find((item) => item.id === row.invoice_id);
            receipt.invoiceReference = receipt.invoiceReference || linked?.reference || "";
            return receipt;
          })
        }
      };
    }, "Loading your workspace…");
  }

  async function submit(action, payload) {
    if (!isConnected()) throw new Error("Private portal access is required");
    return withLoader(async () => {
      const projectId = payload?.projectId;
      if (action === "updateProfile") return resultOrThrow(await client().rpc("update_my_profile", { p_name: payload.profile.name, p_business: payload.profile.business, p_phone: payload.profile.phone || "", p_contact: payload.profile.contact || "Email" }));
      if (action === "updateProject") return resultOrThrow(await client().rpc("update_my_project", { p_project_id: projectId, p_name: payload.project.name, p_service: payload.project.service }));
      if (action === "saveBrandKit") return resultOrThrow(await client().rpc("save_project_brand", { p_project_id: projectId, p_brand: payload.brandKit }));
      if (action === "saveContent") return resultOrThrow(await client().rpc("save_project_content", { p_project_id: projectId, p_content: payload.content }));
      if (action === "saveBrief") {
        try {
          return resultOrThrow(await client().rpc("save_project_brief", { p_project_id: projectId, p_brief: payload.brief }));
        } catch (_) {
          return resultOrThrow(await client().rpc("create_portal_request", {
            p_project_id: projectId,
            p_reference: "PROJECT-BRIEF",
            p_type: "discovery",
            p_title: "Project brief",
            p_values: payload.brief
          }));
        }
      }
      if (action === "createProject") {
        const created = resultOrThrow(await client().rpc("client_add_project", {
          p_name: payload.projectName || payload.request?.values?.projectName || "New project",
          p_service: payload.service || payload.request?.values?.projectType || "Website project",
          p_values: payload.request?.values || payload.values || {}
        }), "Could not add another project. Run client_add_project.sql in Supabase, then try again.");
        return created;
      }
      if (action === "createRequest") return resultOrThrow(await client().rpc("create_portal_request", { p_project_id: projectId, p_reference: payload.request.id, p_type: payload.request.type, p_title: payload.request.title, p_values: payload.request.values || {} }));
      if (action === "addResource") {
        const id = resultOrThrow(await client().rpc("add_project_resource", { p_project_id: projectId, p_name: payload.resource.name, p_type: payload.resource.type, p_url: payload.resource.url }));
        return { id };
      }
      if (action === "removeResource") {
        const storagePath = resultOrThrow(await client().rpc("archive_project_resource", { p_asset_id: payload.resourceId }));
        if (storagePath) await client().storage.from("project-files").remove([storagePath]);
        return { removed: true };
      }
      if (action === "addMilestoneMessage") {
        const result = resultOrThrow(await client().rpc("add_milestone_message", {
          p_milestone_id: payload.milestoneId, p_body: payload.body, p_kind: payload.kind || "comment"
        }), "The note could not be sent.");
        return mapMessage(result);
      }
      if (action === "notifyTeam") return { queued: true };
      throw new Error("Unknown portal action");
    }, "Saving…");
  }

  async function uploadFile(projectId, file) {
    if (!isConnected()) throw new Error("Private portal access is required");
    if (!file || file.size > 20 * 1024 * 1024) throw new Error("Files must be 20 MB or smaller");
    return withLoader(async () => {
      const extension = String(file.name || "file").includes(".") ? `.${String(file.name).split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
      const storagePath = `${projectId}/${crypto.randomUUID()}${extension}`;
      resultOrThrow(await client().storage.from("project-files").upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false }), "File upload failed");
      try {
        const id = resultOrThrow(await client().rpc("add_uploaded_asset", {
          p_project_id: projectId, p_name: file.name, p_type: file.type.startsWith("image/") ? "Image" : "Document",
          p_storage_path: storagePath, p_mime_type: file.type || "application/octet-stream", p_size_bytes: file.size
        }));
        const signed = resultOrThrow(await client().storage.from("project-files").createSignedUrl(storagePath, 86400));
        return { id, name: file.name, type: file.type.startsWith("image/") ? "Image" : "Document", url: signed?.signedUrl || "", storagePath, createdAt: new Date().toISOString() };
      } catch (error) {
        await client().storage.from("project-files").remove([storagePath]);
        throw error;
      }
    }, "Uploading…");
  }

  async function logout() {
    if (backendConfigured()) {
      try { await client().auth.signOut(); } catch (_) { /* local sign-out still proceeds */ }
    }
    cachedSession = null;
    cachedProfile = null;
    authStorage.removeItem(AUTH_STORAGE_KEY);
  }

  async function adminDashboard() {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    return withLoader(async () => {
      const results = await Promise.all([
        client().from("registrations").select("*").order("created_at", { ascending: false }),
        client().from("profiles").select("*").order("created_at", { ascending: false }),
        client().from("clients").select("id"),
        client().from("projects").select("*").order("created_at", { ascending: false }),
        client().from("portal_requests").select("*").order("created_at", { ascending: false }),
        client().from("milestones").select("*").order("sort_order"),
        client().rpc("admin_list_push_devices")
      ]);
      const registrations = (resultOrThrow(results[0]) || []).map((row) => ({ id: row.id, email: row.email, name: row.name, business: row.business, phone: row.phone, contact: row.contact_preference, service: row.requested_service, description: row.project_description, targetDate: row.target_date || "", status: row.status, notes: row.admin_notes, createdAt: row.created_at, discovery: row.discovery || {} }));
      const users = (resultOrThrow(results[1]) || []).map(mapProfile);
      const clients = resultOrThrow(results[2]) || [];
      const projects = (resultOrThrow(results[3]) || []).map(mapProject);
      const requests = (resultOrThrow(results[4]) || []).map((row) => mapRequest(row, false));
      const milestones = (resultOrThrow(results[5]) || []).map(mapMilestone);
      const pushRows = results[6]?.error ? [] : (results[6]?.data || []);
      const pushDevices = {};
      (pushRows || []).forEach((row) => {
        const id = String(row.user_id || "");
        if (!id) return;
        const current = pushDevices[id] || { client: false, team: false, updatedAt: "" };
        if (row.audience === "team") current.team = true;
        else current.client = true;
        if (row.updated_at && (!current.updatedAt || row.updated_at > current.updatedAt)) current.updatedAt = row.updated_at;
        pushDevices[id] = current;
      });
      const pending = registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
      return {
        admin: cachedProfile,
        metrics: { pending, clients: clients.length, projects: projects.length, openRequests: requests.filter((item) => !["Completed", "Declined"].includes(item.status)).length },
        registrations, users, projects, requests, milestones, pushDevices
      };
    }, "Loading…");
  }

  async function profileByEmail(email) {
    return mapProfile(resultOrThrow(await client().from("profiles").select("*").eq("email", String(email).toLowerCase()).maybeSingle()));
  }

  async function adminProjectMaterials(projectId) {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    const id = String(projectId || "").trim();
    if (!id) throw Object.assign(new Error("Choose a project"), { userMessage: "Choose a project to view brand details and files." });
    return withLoader(async () => {
      const results = await Promise.all([
        client().from("brand_kits").select("*").eq("project_id", id).maybeSingle(),
        client().from("project_content").select("*").eq("project_id", id).maybeSingle(),
        client().from("assets").select("*").eq("project_id", id).is("archived_at", null).order("created_at", { ascending: false }),
        client().from("portal_requests").select("*").eq("project_id", id).eq("type", "discovery").order("updated_at", { ascending: false })
      ]);
      const brandRow = resultOrThrow(results[0], "Could not load brand details");
      const contentRow = resultOrThrow(results[1], "Could not load website content");
      const assetRows = resultOrThrow(results[2], "Could not load project files") || [];
      const requestRows = resultOrThrow(results[3]) || [];
      return {
        projectId: id,
        brand: mapBrand(brandRow),
        content: mapContent(contentRow),
        brief: mapBrief(contentRow, requestRows.map((row) => mapRequest(row, false))),
        files: await signedAssetUrls(assetRows)
      };
    }, "Loading project materials…");
  }

  async function adminAgreementContext(projectId) {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    const id = String(projectId || "").trim();
    if (!id) throw Object.assign(new Error("Choose a project"), { userMessage: "Choose a project to edit the agreement." });
    return withLoader(async () => {
      const projectRow = resultOrThrow(await client().from("projects").select("*").eq("id", id).maybeSingle(), "Could not load this project");
      if (!projectRow) throw Object.assign(new Error("Project not found"), { userMessage: "That project could not be found." });
      const results = await Promise.all([
        client().from("clients").select("*").eq("id", projectRow.client_id).maybeSingle(),
        client().from("project_content").select("*").eq("project_id", id).maybeSingle(),
        client().from("portal_requests").select("*").eq("project_id", id).eq("type", "discovery").order("updated_at", { ascending: false })
      ]);
      const clientRow = resultOrThrow(results[0]) || {};
      const contentRow = resultOrThrow(results[1]);
      const requestRows = resultOrThrow(results[2]) || [];
      let agreementRow = null;
      try {
        agreementRow = resultOrThrow(await client().from("project_agreements").select("*").eq("project_id", id).maybeSingle());
      } catch (_) { agreementRow = null; }
      return {
        project: mapProject(projectRow),
        profile: {
          name: clientRow.name || "",
          business: clientRow.business || "",
          email: clientRow.email || ""
        },
        brief: mapBrief(contentRow, requestRows.map((row) => mapRequest(row, false))),
        saved: mapAgreement(agreementRow)
      };
    }, "Loading agreement…");
  }

  async function adminSubmit(action, payload) {
    return withLoader(async () => {
      let result;
      if (action === "adminApproveRegistration") {
        if (payload.email) await ensurePortalAuthUser(payload.email, payload);
        result = resultOrThrow(await client().rpc("admin_approve_registration", { p_registration_id: payload.registrationId, p_project_name: payload.projectName, p_service: payload.service, p_target_date: payload.targetDate || null, p_notes: payload.notes || "" }));
        result.user = await profileByEmail(result.email);
        return result;
      }
      if (action === "adminRejectRegistration") return resultOrThrow(await client().rpc("admin_reject_registration", { p_registration_id: payload.registrationId, p_notes: payload.notes || "" }));
      if (action === "adminCreateClientProject") {
        await ensurePortalAuthUser(payload.email, payload);
        result = resultOrThrow(await client().rpc("admin_create_client_project", { p_name: payload.name, p_business: payload.business, p_email: payload.email, p_phone: payload.phone || "", p_contact: payload.contact || "Email", p_project_name: payload.projectName, p_service: payload.service || "Website project", p_target_date: payload.targetDate || null }));
        result.user = await profileByEmail(result.email);
        return result;
      }
      if (action === "adminUpdateRequest") return resultOrThrow(await client().rpc("admin_update_request", { p_request_id: payload.requestId, p_status: payload.status }));
      if (action === "adminUpdateMilestone") return resultOrThrow(await client().rpc("admin_update_milestone", { p_project_id: payload.projectId, p_milestone_id: payload.milestoneId, p_status: payload.status }));
      if (action === "adminUpdateProject") {
        return resultOrThrow(await client().rpc("update_my_project", {
          p_project_id: payload.projectId,
          p_name: payload.name || "",
          p_service: payload.service || "",
          p_target_date: payload.targetDate || null,
          p_start_date: payload.startDate || null
        }));
      }
      if (action === "adminSetProjectStages") {
        return resultOrThrow(await client().rpc("admin_set_project_stages", {
          p_project_id: payload.projectId,
          p_has_wireframe: payload.hasWireframe !== false,
          p_has_visual_design: payload.hasVisualDesign !== false
        }), "Could not save which stages this project includes.");
      }
      if (action === "adminAddMilestoneMessage") {
        const message = resultOrThrow(await client().rpc("add_milestone_message", {
          p_milestone_id: payload.milestoneId, p_body: payload.body, p_kind: payload.kind || "comment"
        }), "The note could not be sent.");
        return mapMessage(message);
      }
      if (action === "adminSendSignIn") {
        const profile = resultOrThrow(await client().from("profiles").select("*").eq("user_id", payload.userId).single());
        await sendMagicLink(profile.email, portalRedirect(), { name: profile.name, business: profile.business, phone: profile.phone, contact: profile.contact_preference });
        return { sent: true };
      }
      if (action === "adminSaveAgreement") {
        return resultOrThrow(await client().rpc("save_project_agreement", {
          p_project_id: payload.projectId,
          p_agreement: payload.agreement || {}
        }), "Could not save the project agreement. Run project_agreements.sql in Supabase if this is the first time.");
      }
      if (action === "adminAddProject") {
        return resultOrThrow(await client().rpc("admin_add_project", {
          p_client_id: payload.clientId,
          p_name: payload.projectName,
          p_service: payload.service || "Website project",
          p_target_date: payload.targetDate || null,
          p_is_active: payload.isActive !== false
        }), "Could not add the project. Run projects_invoices.sql in Supabase if this is the first time.");
      }
      if (action === "adminSetProjectActive") {
        return resultOrThrow(await client().rpc("admin_set_project_active", {
          p_project_id: payload.projectId,
          p_is_active: payload.isActive !== false
        }), "Could not update the active project. Run projects_invoices.sql in Supabase if this is the first time.");
      }
      if (action === "adminSaveInvoice") {
        return resultOrThrow(await client().rpc("admin_save_invoice", {
          p_project_id: payload.projectId,
          p_invoice: payload.invoice || {}
        }), "Could not save the invoice. Run projects_invoices.sql in Supabase if this is the first time.");
      }
      if (action === "adminSaveReceipt") {
        return resultOrThrow(await client().rpc("admin_save_receipt", {
          p_project_id: payload.projectId,
          p_receipt: {
            id: payload.receipt?.id || "",
            title: payload.receipt?.title || "",
            description: payload.receipt?.description || "",
            amount: payload.receipt?.amount || "",
            currency: payload.receipt?.currency || "NGN",
            paidOn: String(payload.receipt?.paidOn || "").slice(0, 10),
            method: payload.receipt?.method || "",
            invoiceId: payload.receipt?.invoiceId || "",
            status: payload.receipt?.status || "Draft",
            notes: payload.receipt?.notes || ""
          }
        }), "Could not save the receipt. Run projects_invoices.sql in Supabase if this is the first time.");
      }
      if (action === "adminSetProjectBilling") {
        return resultOrThrow(await client().rpc("admin_set_project_billing", {
          p_project_id: payload.projectId,
          p_contract_amount: payload.contractAmount || "",
          p_contract_currency: payload.contractCurrency || "NGN",
          p_show_payment_summary: payload.showPaymentSummary !== false,
          p_online_payments: payload.onlinePayments !== false
        }), "Could not save project totals. Run project_payments.sql in Supabase, then try again.");
      }
      if (action === "adminSavePortalSettings") {
        return resultOrThrow(await client().rpc("admin_save_portal_settings", {
          p_settings: payload.settings || {}
        }), "Could not save bank details. Run portal_settings.sql in Supabase, then try again.");
      }
      throw new Error("Unknown administrator action");
    }, "Saving…");
  }

  async function adminMilestoneMessages(projectId) {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    const id = String(projectId || "").trim();
    if (!id) return [];
    try {
      return (resultOrThrow(await client().from("milestone_messages").select("*").eq("project_id", id).order("created_at")) || []).map(mapMessage);
    } catch (_) {
      return [];
    }
  }

  async function adminInvoices(projectId) {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    const id = String(projectId || "").trim();
    if (!id) return [];
    try {
      return (resultOrThrow(await client().from("project_invoices").select("*").eq("project_id", id).order("created_at", { ascending: false })) || []).map(mapInvoice);
    } catch (error) {
      throw Object.assign(error, { userMessage: "Could not load invoices. Run projects_invoices.sql in Supabase if this is the first time." });
    }
  }

  async function adminReceipts(projectId) {
    if (!cachedProfile || cachedProfile.role !== "admin" || cachedProfile.status !== "active") throw new Error("Administrator access is required");
    const id = String(projectId || "").trim();
    if (!id) return [];
    try {
      const rows = resultOrThrow(await client().from("project_receipts").select("*").eq("project_id", id).order("created_at", { ascending: false })) || [];
      const invoices = (resultOrThrow(await client().from("project_invoices").select("id, reference").eq("project_id", id)) || []);
      const refs = new Map(invoices.map((row) => [row.id, row.reference]));
      return rows.map((row) => {
        const receipt = mapReceipt(row);
        receipt.invoiceReference = receipt.invoiceReference || refs.get(row.invoice_id) || "";
        return receipt;
      });
    } catch (error) {
      throw Object.assign(error, { userMessage: "Could not load receipts. Run projects_invoices.sql in Supabase if this is the first time." });
    }
  }

  async function trackInvoice(reference, email) {
    if (!backendConfigured()) {
      throw Object.assign(new Error("Tracking is not configured"), { userMessage: "Payment tracking is not available right now." });
    }
    return withLoader(async () => {
      const row = resultOrThrow(await client().rpc("track_project_invoice", {
        p_reference: String(reference || "").trim(),
        p_email: String(email || "").trim()
      }), "No payment matches those details");
      if (row?.kind === "receipt") return mapReceipt(row);
      return mapInvoice(row) || row;
    }, "Checking…");
  }

  function mapPortalSettings(row) {
    return {
      bankName: row?.bank_name || row?.bankName || "",
      accountName: row?.account_name || row?.accountName || "",
      accountNumber: row?.account_number || row?.accountNumber || "",
      bankNotes: row?.bank_notes || row?.bankNotes || ""
    };
  }

  async function readPortalSettings() {
    try {
      const row = resultOrThrow(await client().from("portal_settings").select("*").eq("id", 1).maybeSingle());
      return mapPortalSettings(row);
    } catch (_) {
      return mapPortalSettings(null);
    }
  }

  async function ensurePortalAuthUser(email, metadata = {}) {
    if (!backendConfigured() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) return false;
    try {
      const result = await client().functions.invoke("send-portal-mail", {
        body: {
          kind: "ensure-user",
          audience: "team",
          clientEmail: String(email).trim().toLowerCase(),
          name: metadata.name || metadata.full_name || "",
          business: metadata.business || ""
        }
      });
      if (result.error) throw result.error;
      return Boolean(result.data?.sent || result.data?.user);
    } catch (error) {
      logPortalError("ensure-user", error);
      return false;
    }
  }

  async function sendPortalMail(payload) {
    if (!backendConfigured()) return false;
    try {
      const result = await client().functions.invoke("send-portal-mail", { body: payload || {} });
      if (result.error) throw result.error;
      if (result.data?.sms === false && result.data?.smsError) {
        logPortalError("portal-sms", result.data.smsError);
      }
      return Boolean(result.data?.sent || result.data?.sms || result.data?.push);
    } catch (error) {
      logPortalError("portal-mail", error);
      return false;
    }
  }

  async function savePushSubscription(subscription) {
    if (!backendConfigured() || !subscription?.endpoint || !subscription?.p256dh || !subscription?.auth) return false;
    try {
      resultOrThrow(await client().rpc("save_my_push_subscription", {
        p_endpoint: subscription.endpoint,
        p_p256dh: subscription.p256dh,
        p_auth: subscription.auth,
        p_audience: subscription.audience === "team" ? "team" : "client"
      }));
      return true;
    } catch (error) {
      logPortalError("portal-push", error);
      return false;
    }
  }

  window.GeeslaneAPI = Object.freeze({
    backendConfigured,
    hasLegacyAccess,
    hasAuthSession,
    isConnected,
    isLocalAdminSession,
    currentUser,
    consumeMagicLink,
    hasIncomingMagicLink,
    showLoader,
    hideLoader,
    setButtonBusy,
    startMagicLinkCooldown,
    bindCodeBoxes,
    clearCodeBoxes,
    codeFromBoxes,
    userFacingError,
    isRateLimitError,
    clientSignInRedirect,
    adminSignInRedirect,
    getSession,
    requestMagicLink,
    verifySignInCode,
    adminPasswordLogin,
    bindPhoneFields,
    fillPhoneField,
    readPhoneField,
    requestAccess,
    readProject,
    readPortalSettings,
    submit,
    notifyTeam: async () => ({ queued: true }),
    uploadFile,
    logout,
    milestoneIsIncluded,
    projectTrack,
    milestoneTemplates,
    progressStageLabels,
    adminDashboard,
    adminSubmit,
    adminProjectMaterials,
    adminAgreementContext,
    adminMilestoneMessages,
    adminInvoices,
    adminReceipts,
    trackInvoice,
    invoiceBalance,
    invoiceBalanceSum,
    projectBalance,
    paystackEnabled,
    paymentReturnReference,
    clearPaymentReturn,
    startPayment,
    verifyPayment,
    sendPortalMail,
    savePushSubscription,
    uploadUrl: () => ""
  });
})();
