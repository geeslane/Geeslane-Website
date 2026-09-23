(function () {
  "use strict";

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

  function client() {
    if (!backendConfigured()) throw new Error("Supabase is not configured in client-portal/config.js");
    if (!window.supabase?.createClient) throw new Error("The Supabase client library did not load");
    if (!database) {
      database = window.supabase.createClient(normalizeSupabaseUrl(config.supabaseUrl), String(config.supabasePublishableKey).trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: "geeslane-portal-auth"
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
    if (/profile not found|no Geeslane portal profile/i.test(message)) return "This sign-in is valid, but no Geeslane portal profile exists for this email yet.";
    if (/Administrator access is required/i.test(message)) return "Administrator access is required.";
    return fallback;
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

  function clientSignInRedirect() {
    return portalBaseUrl();
  }

  function adminSignInRedirect() {
    return new URL("admin.html", portalBaseUrl()).href;
  }

  function portalRedirect() {
    return clientSignInRedirect();
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
    const idle = button.dataset.idleLabel || button.textContent.trim() || "Send code";
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
      id: row.user_id, email: row.email, name: row.name || "", business: row.business || "", phone: row.phone || "",
      contact: row.contact_preference || "Email", role: row.role || "client", status: row.status || "pending",
      clientId: row.client_id || "", createdAt: row.created_at || "", lastLoginAt: row.last_login_at || ""
    };
  }

  function mapProject(row) {
    return {
      id: row.id, clientId: row.client_id, name: row.name, service: row.service, status: row.status, stage: row.stage,
      progress: Number(row.progress || 0), startDate: row.start_date || "", targetDate: row.target_date || "",
      createdAt: row.created_at || "", updatedAt: row.updated_at || ""
    };
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
      contactDetails: row?.contact_details || "", extraNotes: row?.extra_notes || ""
    };
  }

  async function consumeMagicLink() {
    const run = async () => {
      if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
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

  async function requestMagicLink(email, destination = "client") {
    const redirectTo = destination === "admin" ? adminSignInRedirect() : clientSignInRedirect();
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
      return { user: cachedProfile, projects: (projectRows || []).map(mapProject), session: cachedSession };
    }, "Loading your workspace…");
  }

  async function requestAccess(details) {
    return withLoader(async () => {
      const payload = {
        p_name: details.name, p_business: details.business, p_email: details.email, p_phone: details.phone || "",
        p_contact: details.contact || "Email", p_service: details.service, p_description: details.description
      };
      if (details.targetDate) payload.p_target_date = details.targetDate;
      resultOrThrow(await client().rpc("submit_portal_registration", payload), "Could not submit the access request");
      return { received: true };
    }, "Sending…");
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
      let query = client().from("projects").select("*");
      query = projectId ? query.eq("id", projectId) : query.order("created_at", { ascending: false }).limit(1);
      const projectRow = resultOrThrow(await query.maybeSingle(), "Could not load this project");
      if (!projectRow) throw new Error("No project workspace is available for this account");

      const results = await Promise.all([
        client().from("clients").select("*").eq("id", projectRow.client_id).single(),
        client().from("brand_kits").select("*").eq("project_id", projectRow.id).maybeSingle(),
        client().from("project_content").select("*").eq("project_id", projectRow.id).maybeSingle(),
        client().from("milestones").select("*").eq("project_id", projectRow.id).order("sort_order"),
        client().from("portal_requests").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false }),
        client().from("assets").select("*").eq("project_id", projectRow.id).is("archived_at", null).order("created_at", { ascending: false }),
        client().from("activity").select("*").eq("project_id", projectRow.id).order("created_at", { ascending: false }).limit(30),
        client().from("projects").select("*").order("created_at", { ascending: false })
      ]);
      const clientRow = resultOrThrow(results[0]);
      const brandRow = resultOrThrow(results[1]);
      const contentRow = resultOrThrow(results[2]);
      const milestoneRows = resultOrThrow(results[3]) || [];
      const requestRows = resultOrThrow(results[4]) || [];
      const assetRows = resultOrThrow(results[5]) || [];
      const activityRows = resultOrThrow(results[6]) || [];
      const allProjects = resultOrThrow(results[7]) || [];
      let messageRows = [];
      try {
        messageRows = resultOrThrow(await client().from("milestone_messages").select("*").eq("project_id", projectRow.id).order("created_at")) || [];
      } catch (_) { messageRows = []; }
      const resources = await signedAssetUrls(assetRows);
      const project = mapProject(projectRow);
      project.brandKit = mapBrand(brandRow);
      project.content = mapContent(contentRow);

      return {
        user: cachedProfile,
        projects: allProjects.map(mapProject),
        workspace: {
          initialized: true,
          createdAt: cachedProfile?.createdAt || clientRow.created_at,
          profile: { name: clientRow.name, business: clientRow.business, email: clientRow.email, phone: clientRow.phone || "", contact: clientRow.contact_preference || "Email" },
          project,
          milestones: milestoneRows.map(mapMilestone),
          requests: requestRows.map((row) => mapRequest(row, true)),
          resources,
          activity: activityRows.map((row) => ({ id: row.id, title: row.title, detail: row.detail, type: row.type, createdAt: row.created_at })),
          messages: messageRows.map(mapMessage)
        }
      };
    }, "Loading your workspace…");
  }

  async function submit(action, payload) {
    if (!isConnected()) throw new Error("Private portal access is required");
    return withLoader(async () => {
      const projectId = payload?.projectId;
      if (action === "updateProfile") return resultOrThrow(await client().rpc("update_my_profile", { p_name: payload.profile.name, p_business: payload.profile.business, p_phone: payload.profile.phone || "", p_contact: payload.profile.contact || "Email" }));
      if (action === "updateProject") return resultOrThrow(await client().rpc("update_my_project", { p_project_id: projectId, p_name: payload.project.name, p_service: payload.project.service, p_target_date: payload.project.targetDate || null }));
      if (action === "saveBrandKit") return resultOrThrow(await client().rpc("save_project_brand", { p_project_id: projectId, p_brand: payload.brandKit }));
      if (action === "saveContent") return resultOrThrow(await client().rpc("save_project_content", { p_project_id: projectId, p_content: payload.content }));
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
        client().from("milestones").select("*").order("sort_order")
      ]);
      const registrations = (resultOrThrow(results[0]) || []).map((row) => ({ id: row.id, email: row.email, name: row.name, business: row.business, phone: row.phone, contact: row.contact_preference, service: row.requested_service, description: row.project_description, targetDate: row.target_date || "", status: row.status, notes: row.admin_notes, createdAt: row.created_at }));
      const users = (resultOrThrow(results[1]) || []).map(mapProfile);
      const clients = resultOrThrow(results[2]) || [];
      const projects = (resultOrThrow(results[3]) || []).map(mapProject);
      const requests = (resultOrThrow(results[4]) || []).map((row) => mapRequest(row, false));
      const milestones = (resultOrThrow(results[5]) || []).map(mapMilestone);
      const pending = registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
      return {
        admin: cachedProfile,
        metrics: { pending, clients: clients.length, projects: projects.length, openRequests: requests.filter((item) => !["Completed", "Declined"].includes(item.status)).length },
        registrations, users, projects, requests, milestones
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
        client().from("assets").select("*").eq("project_id", id).is("archived_at", null).order("created_at", { ascending: false })
      ]);
      const brandRow = resultOrThrow(results[0], "Could not load brand details");
      const contentRow = resultOrThrow(results[1], "Could not load website content");
      const assetRows = resultOrThrow(results[2], "Could not load project files") || [];
      return {
        projectId: id,
        brand: mapBrand(brandRow),
        content: mapContent(contentRow),
        files: await signedAssetUrls(assetRows)
      };
    }, "Loading project materials…");
  }

  async function adminSubmit(action, payload) {
    return withLoader(async () => {
      let result;
      if (action === "adminApproveRegistration") {
        result = resultOrThrow(await client().rpc("admin_approve_registration", { p_registration_id: payload.registrationId, p_project_name: payload.projectName, p_service: payload.service, p_target_date: payload.targetDate || null, p_notes: payload.notes || "" }));
        await sendMagicLink(result.email, portalRedirect(), result.profileData);
        result.user = await profileByEmail(result.email);
        return result;
      }
      if (action === "adminRejectRegistration") return resultOrThrow(await client().rpc("admin_reject_registration", { p_registration_id: payload.registrationId, p_notes: payload.notes || "" }));
      if (action === "adminCreateClientProject") {
        result = resultOrThrow(await client().rpc("admin_create_client_project", { p_name: payload.name, p_business: payload.business, p_email: payload.email, p_phone: payload.phone || "", p_contact: payload.contact || "Email", p_project_name: payload.projectName, p_service: payload.service || "Website project", p_target_date: payload.targetDate || null }));
        await sendMagicLink(result.email, portalRedirect(), result.profileData);
        result.user = await profileByEmail(result.email);
        return result;
      }
      if (action === "adminUpdateRequest") return resultOrThrow(await client().rpc("admin_update_request", { p_request_id: payload.requestId, p_status: payload.status }));
      if (action === "adminUpdateMilestone") return resultOrThrow(await client().rpc("admin_update_milestone", { p_project_id: payload.projectId, p_milestone_id: payload.milestoneId, p_status: payload.status }));
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

  async function sendPortalMail(payload) {
    if (!backendConfigured() || !hasAuthSession()) return false;
    try {
      const result = await client().functions.invoke("send-portal-mail", { body: payload || {} });
      if (result.error) throw result.error;
      return Boolean(result.data?.sent || result.data?.sms);
    } catch (error) {
      logPortalError("portal-mail", error);
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
    requestAccess,
    readProject,
    submit,
    notifyTeam: async () => ({ queued: true }),
    uploadFile,
    logout,
    adminDashboard,
    adminSubmit,
    adminProjectMaterials,
    adminMilestoneMessages,
    sendPortalMail,
    uploadUrl: () => ""
  });
})();
