(function () {
  "use strict";

  const pageTitles = { overview: "Overview", registrations: "Access Requests", clients: "Clients", projects: "Projects", files: "Brand & Files", requests: "Requests & Approvals", milestones: "Milestones" };
  const requestStatuses = ["Received", "In review", "Approved", "Changes requested", "Completed", "Declined"];
  const milestoneStatuses = ["upcoming", "current", "review", "admin_review", "complete"];
  let data = { metrics: {}, registrations: [], users: [], projects: [], requests: [], milestones: [] };
  let milestoneMessages = [];
  let adminOpenIds = new Set();
  let adminOpenProjectId = "";
  let materials = { projectId: "", brand: null, content: null, files: [] };
  let toastTimer = null;

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
  function formatDate(value) { if (!value) return "—"; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    return value === "pending" ? "is-pending"
      : value === "rejected" || value === "declined" ? "is-rejected"
      : value === "in review" || value === "review" ? "is-review"
      : value === "admin_review" ? "is-admin-review"
      : "";
  }
  function projectName(projectId) { return data.projects.find((item) => item.id === projectId)?.name || projectId || "—"; }
  function toast(message) { clearTimeout(toastTimer); document.getElementById("admin-toast-message").textContent = message; document.getElementById("admin-toast").classList.add("is-visible"); toastTimer = setTimeout(() => document.getElementById("admin-toast").classList.remove("is-visible"), 2800); }
  function openModal(id) { document.getElementById(id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(id) { document.getElementById(id).hidden = true; document.body.style.overflow = ""; }

  function milestoneLabel(status) {
    return {
      upcoming: "Upcoming",
      current: "In progress",
      review: "Awaiting client review",
      admin_review: "Awaiting Geeslane review",
      complete: "Complete"
    }[status] || status;
  }

  function requestStatusLabel(status) {
    return status === "In review" ? "Geeslane reviewing" : status;
  }

  function phaseMeta(item) {
    const title = String(item?.title || "").toLowerCase();
    if (/discover/.test(title)) return { hint: "Write questions here, then set Awaiting client review. After they reply, it becomes Awaiting Geeslane review. Mark Complete only when the brief is final.", placeholder: "Ask about goals, audience, pages, or scope…", emailIntro: "Please reply to the Discovery questions in your portal so we can finalise the brief." };
    if (/brand/.test(title)) return { hint: "Discuss colours, logos, and copy here. Set Awaiting client review when you need their sign-off.", placeholder: "Ask about assets, or confirm the direction…", emailIntro: "Please review Brand & Content in your portal and leave a note if anything should change." };
    if (/wire/.test(title)) return { hint: "Paste the wireframe link, then set Awaiting client review. Their structure notes stay in this thread.", placeholder: "Paste the wireframe URL and what to review…", emailIntro: "Wireframes are ready for review. Please check the structure and leave focused feedback." };
    if (/visual|design/.test(title)) return { hint: "Paste design previews, then set Awaiting client review. Comments stay here; formal decisions also appear under Requests.", placeholder: "Paste the Figma or preview URL…", emailIntro: "Visual design is ready for review. Please leave specific notes in your portal." };
    if (/develop/.test(title)) return { hint: "Paste the staging URL, then set Awaiting client review. Bugs and approvals stay in this thread.", placeholder: "Paste the preview URL and what to test…", emailIntro: "A development preview is ready for review. Please test it and note any issues in your portal." };
    if (/qa|test/.test(title)) return { hint: "Final check before launch. Set Awaiting client review when you want their approval.", placeholder: "Note what to verify before launch…", emailIntro: "QA is ready for review. Approve to proceed to launch, or list remaining issues." };
    if (/launch/.test(title)) return { hint: "Confirm handover materials. Client sign-off appears here.", placeholder: "Note handover items or access details…", emailIntro: "Handover materials are ready. Please confirm you have what you need." };
    return { hint: "Set Awaiting client review when this stage needs the client. After they reply, it switches to Awaiting Geeslane review.", placeholder: "Ask a question or paste a preview link…", emailIntro: `${item?.title || "This stage"} is ready for your review.` };
  }

  function messageKindLabel(kind) {
    return { approval: "Approved", changes: "Changes requested", question: "Question", comment: "Note" }[kind] || "Note";
  }

  function noteHtml(body) {
    return escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const clean = url.replace(/[),.;]+$/, "");
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${url.slice(clean.length)}`;
    });
  }

  function requestSnippet(item) {
    const values = item.values || {};
    const bits = [values.decision, values.feedback, values.details, values.goal].map((value) => String(value || "").trim()).filter(Boolean);
    return bits.length ? bits.join(" · ").slice(0, 160) : "";
  }

  function latestDecision(milestoneId) {
    return milestoneMessages.filter((note) => note.milestoneId === milestoneId && (note.kind === "approval" || note.kind === "changes")).at(-1);
  }

  function contactForProject(projectId) {
    const project = data.projects.find((item) => item.id === projectId);
    const user = data.users.find((item) => item.clientId && item.clientId === project?.clientId) || data.users.find((item) => item.email && item.role === "client");
    return { project, user, email: user?.email || "", name: user?.name || "", phone: user?.phone || "" };
  }

  function prettyFirst(name) {
    const value = String(name || "").trim().split(/\s+/)[0];
    if (!value || /^a$/i.test(value) || /^there$/i.test(value)) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function namedHeading(name, heading) {
    const formal = window.GeeslaneMail?.respectfulName(name) || prettyFirst(name);
    return formal ? `${formal}, ${heading}` : heading;
  }

  function notifyClient(email, heading, intro, rows, greetingName, extras = {}) {
    const phone = extras.sms === false ? "" : (extras.clientPhone || "");
    if (!email && !phone) return;
    window.GeeslaneMail?.notify({
      audience: "client",
      subject: heading,
      heading,
      intro,
      rows: rows || [],
      greetingName,
      clientEmail: email,
      clientPhone: phone,
      replyTo: window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com",
      ctaPage: extras.ctaPage || "client",
      ctaUrl: extras.ctaUrl,
      ctaLabel: extras.ctaLabel || "Open Your Portal"
    });
  }

  function showAuthFeedback(message, type = "error") {
    const node = document.getElementById("admin-auth-feedback");
    node.textContent = message;
    node.className = `auth-feedback is-${type}`;
    node.hidden = false;
  }

  const ADMIN_COMMENT_ROUTE_KEY = "geeslane-admin-comment-route";

  function rememberAdminCommentRoute() {
    const route = parseAdminHash();
    if (route.params.get("project") || route.params.get("milestone") || route.params.get("note")) {
      sessionStorage.setItem(ADMIN_COMMENT_ROUTE_KEY, location.hash);
    }
  }

  function restoreAdminCommentRoute() {
    const saved = sessionStorage.getItem(ADMIN_COMMENT_ROUTE_KEY);
    if (saved && !(parseAdminHash().params.get("project") || parseAdminHash().params.get("milestone") || parseAdminHash().params.get("note"))) {
      history.replaceState(null, "", `${location.pathname}${location.search}${saved}`);
    }
    sessionStorage.removeItem(ADMIN_COMMENT_ROUTE_KEY);
  }

  function parseAdminHash() {
    const raw = String(location.hash || "").replace(/^#/, "");
    if (!raw || /access_token|refresh_token|type=magiclink|error_description/.test(raw)) {
      return { page: "", params: new URLSearchParams() };
    }
    const split = raw.indexOf("?");
    const page = (split >= 0 ? raw.slice(0, split) : raw).split("/")[0];
    const params = new URLSearchParams(split >= 0 ? raw.slice(split + 1) : "");
    return { page, params };
  }

  function writeHash(page, params) {
    const query = params && String(params) ? `?${params}` : "";
    const next = `#${page}${query}`;
    if (`#${String(location.hash || "").replace(/^#/, "")}` !== next) history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }

  function navigate(page, options = {}) {
    if (!pageTitles[page]) return;
    document.querySelectorAll("[data-admin-view]").forEach((view) => view.classList.toggle("is-visible", view.dataset.adminView === page));
    document.querySelectorAll("[data-admin-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminPage === page));
    document.getElementById("admin-page-title").textContent = pageTitles[page];
    if (options.keepHash) writeHash(page, parseAdminHash().params);
    else writeHash(page);
    if (page === "files") loadProjectMaterials();
    if (page === "milestones") renderMilestones();
  }

  function focusAdminComment() {
    const { params } = parseAdminHash();
    const milestoneId = params.get("milestone") || "";
    const noteId = params.get("note") || "";
    const node = (noteId && document.getElementById(`note-${noteId}`))
      || (milestoneId && document.getElementById(`admin-milestone-${milestoneId}`));
    if (!node) return;
    node.classList.add("is-target");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("is-target"), 4000);
  }

  function renderMetrics() {
    document.getElementById("metric-pending").textContent = data.metrics.pending || 0;
    document.getElementById("metric-clients").textContent = data.metrics.clients || 0;
    document.getElementById("metric-projects").textContent = data.metrics.projects || 0;
    document.getElementById("metric-requests").textContent = data.metrics.openRequests || 0;
    document.getElementById("pending-nav-count").textContent = data.metrics.pending || 0;
  }

  function compactRows(items, type) {
    if (!items.length) return '<div class="table-empty">Nothing needs attention here.</div>';
    return items.map((item) => type === "registration"
      ? `<div class="admin-list-row"><div><strong>${escapeHtml(item.name)} · ${escapeHtml(item.business)}</strong><small>${escapeHtml(item.service)} · ${formatDate(item.createdAt)}</small></div><button class="button button-secondary" type="button" data-review-registration="${escapeHtml(item.id)}">Review</button></div>`
      : `<div class="admin-list-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([projectName(item.projectId), requestSnippet(item) || formatDate(item.createdAt)].filter(Boolean).join(" · "))}</small></div><span class="status-pill ${statusClass(item.status)}">${escapeHtml(requestStatusLabel(item.status))}</span></div>`).join("");
  }

  function renderOverview() {
    const pending = data.registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").slice(0, 5);
    document.getElementById("overview-registrations").innerHTML = compactRows(pending, "registration");
    document.getElementById("overview-requests").innerHTML = compactRows(data.requests.slice(0, 5), "request");
    wireRegistrationButtons(document.getElementById("overview-registrations"));
  }

  function renderRegistrations() {
    const query = document.getElementById("registration-search").value.trim().toLowerCase();
    const rows = data.registrations.filter((item) => `${item.name} ${item.business} ${item.email} ${item.service} ${item.status}`.toLowerCase().includes(query));
    document.getElementById("registrations-table").innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.business)} · ${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.service)}</td><td>${formatDate(item.createdAt)}</td><td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${String(item.status || "").toLowerCase() === "pending" ? `<button class="button button-secondary" type="button" data-review-registration="${escapeHtml(item.id)}">Review</button>` : ""}</td></tr>`).join("") : '<tr><td class="table-empty" colspan="5">No access requests match this search.</td></tr>';
    wireRegistrationButtons(document.getElementById("registrations-table"));
  }

  function renderClients() {
    const query = document.getElementById("client-search").value.trim().toLowerCase();
    const rows = data.users.filter((item) => `${item.name} ${item.business} ${item.email} ${item.role} ${item.status}`.toLowerCase().includes(query));
    document.getElementById("clients-table").innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHtml(item.name || "Unnamed user")}</strong><small>${escapeHtml(item.business || "—")}</small></td><td>${escapeHtml(item.email)}<small>${escapeHtml(item.phone || "")}</small></td><td>${escapeHtml(item.role)}</td><td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td><td>${formatDate(item.lastLoginAt)}</td><td>${item.status === "active" ? `<button class="button button-secondary" type="button" data-send-invite="${escapeHtml(item.id)}">Send code</button>` : ""}</td></tr>`).join("") : '<tr><td class="table-empty" colspan="6">No clients match this search.</td></tr>';
    document.querySelectorAll("[data-send-invite]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try { await mutate("adminSendSignIn", { userId: button.dataset.sendInvite }, "Sign-in code emailed"); }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "The sign-in email could not be sent.")); button.disabled = false; }
    }));
  }

  function renderProjects() {
    const query = document.getElementById("project-search").value.trim().toLowerCase();
    const rows = data.projects.filter((item) => `${item.name} ${item.service} ${item.stage} ${item.status}`.toLowerCase().includes(query));
    document.getElementById("projects-table").innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.id)}</small></td><td>${escapeHtml(item.service)}</td><td>${escapeHtml(item.stage)}</td><td class="progress-cell"><strong>${item.progress}%</strong><div class="progress-mini"><span style="width:${Math.max(0,Math.min(100,item.progress))}%"></span></div></td><td><span class="status-pill">${escapeHtml(item.status)}</span></td><td>${formatDate(item.targetDate)}</td><td><button class="button button-secondary" type="button" data-open-files="${escapeHtml(item.id)}">Brand & files</button></td></tr>`).join("") : '<tr><td class="table-empty" colspan="7">No projects match this search.</td></tr>';
    document.querySelectorAll("[data-open-files]").forEach((button) => button.addEventListener("click", () => openProjectFiles(button.dataset.openFiles)));
  }

  function options(values, selected) { return values.map((value) => `<option${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join(""); }
  function requestStatusOptions(selected) {
    return requestStatuses.map((status) => `<option value="${escapeHtml(status)}"${status === selected ? " selected" : ""}>${escapeHtml(requestStatusLabel(status))}</option>`).join("");
  }

  function renderRequests() {
    const query = document.getElementById("admin-request-search").value.trim().toLowerCase();
    const rows = data.requests.filter((item) => `${item.title} ${item.id} ${item.type} ${item.status} ${projectName(item.projectId)} ${requestSnippet(item)}`.toLowerCase().includes(query));
    document.getElementById("admin-requests-table").innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(requestSnippet(item) || item.reference || item.id)}</small></td><td>${escapeHtml(projectName(item.projectId))}</td><td>${escapeHtml(item.type)}</td><td>${formatDate(item.createdAt)}</td><td><select class="table-status-select" data-request-status="${escapeHtml(item.id)}">${requestStatusOptions(item.status)}</select></td><td><button class="button button-secondary" type="button" data-save-request="${escapeHtml(item.id)}">Save</button></td></tr>`).join("") : '<tr><td class="table-empty" colspan="6">No requests match this search.</td></tr>';
    document.querySelectorAll("[data-save-request]").forEach((button) => button.addEventListener("click", async () => {
      const select = document.querySelector(`[data-request-status="${CSS.escape(button.dataset.saveRequest)}"]`);
      button.disabled = true;
      try {
        const requestId = button.dataset.saveRequest;
        const status = select.value;
        const result = await mutate("adminUpdateRequest", { requestId, status }, "Request updated");
        const request = data.requests.find((item) => item.id === (result?.requestId || requestId));
        if (request) request.status = result?.status || status;
        (result?.milestones || []).forEach((change) => {
          const milestone = data.milestones.find((item) => item.projectId === request?.projectId && item.id === change.id);
          if (milestone) milestone.status = change.status;
        });
        applyProjectUpdate(result?.projectUpdate);
        const contact = contactForProject(request?.projectId);
        notifyClient(contact.email, "Update on Your Request", `“${request?.title || "Your Request"}” is now ${requestStatusLabel(status)}. The latest status is available in your portal.`, [
          ["Project", contact.project?.name],
          ["Status", requestStatusLabel(status)]
        ], contact.name, {
          ctaUrl: window.GeeslaneMail?.portalLink("client", "requests"),
          ctaLabel: "View This Request"
        });
        refreshLocalMetrics(); renderMetrics(); renderOverview(); renderProjects(); renderRequests(); renderMilestones();
      }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not save that change.")); button.disabled = false; }
    }));
  }

  async function renderMilestones(options = {}) {
    const filter = document.getElementById("milestone-project-filter");
    const hashProject = parseAdminHash().params.get("project");
    const previous = filter.value || (data.projects.some((project) => project.id === hashProject) ? hashProject : "");
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
    const projectId = filter.value;
    const rows = data.milestones.filter((item) => item.projectId === projectId).sort((a,b) => a.sortOrder - b.sortOrder);
    if (!options.keepMessages) {
      try { milestoneMessages = projectId ? await window.GeeslaneAPI.adminMilestoneMessages(projectId) : []; }
      catch (_) { milestoneMessages = []; }
    }
    const hashMilestone = parseAdminHash().params.get("milestone");
    if (adminOpenProjectId !== projectId) {
      adminOpenProjectId = projectId;
      adminOpenIds = new Set(rows.filter((item) => item.status === "current" || item.status === "review" || item.status === "admin_review" || item.id === hashMilestone).map((item) => item.id));
    }
    if (hashMilestone) adminOpenIds.add(hashMilestone);
    document.getElementById("admin-milestone-list").innerHTML = rows.length ? rows.map((item,index) => {
      const notes = milestoneMessages.filter((note) => note.milestoneId === item.id);
      const meta = phaseMeta(item);
      const decision = latestDecision(item.id);
      const open = adminOpenIds.has(item.id);
      const noteLabel = notes.length ? `${notes.length} comment${notes.length === 1 ? "" : "s"}` : "No comments";
      const banner = item.status === "admin_review"
        ? `<p class="admin-decision is-approval">The client has replied${decision ? ` (${messageKindLabel(decision.kind).toLowerCase()})` : ""}. Respond here, then set Complete or Awaiting client review.</p>`
        : decision && item.status === "review"
        ? `<p class="admin-decision is-${escapeHtml(decision.kind)}">${decision.kind === "approval" ? "The client approved this stage. Set Complete when you are ready to proceed." : "The client requested changes. Reply here, then set In progress until the next review."}</p>`
        : "";
      const thread = notes.length
        ? notes.map((note) => `<article class="thread-note is-${escapeHtml(note.role)} is-${escapeHtml(note.kind)}" id="note-${escapeHtml(note.id)}"><header><strong>${escapeHtml(note.name || (note.role === "admin" ? "Geeslane" : "Client"))}</strong><span>${escapeHtml(messageKindLabel(note.kind))} · ${formatDate(note.createdAt)}</span></header><p>${noteHtml(note.body)}</p></article>`).join("")
        : `<p class="thread-empty">No comments yet.</p>`;
      return `<div class="admin-milestone is-${escapeHtml(item.status)}${decision ? ` has-${escapeHtml(decision.kind)}` : ""}${open ? " is-open" : ""}" id="admin-milestone-${escapeHtml(item.id)}">
        <div class="admin-milestone-top">
          <button class="admin-milestone-toggle" type="button" data-toggle-admin-milestone="${escapeHtml(item.id)}" aria-expanded="${open ? "true" : "false"}">
            <span class="admin-milestone-index">${String(index+1).padStart(2,"0")}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${item.weight}% · ${noteLabel}</small>
            <span class="admin-milestone-chevron" aria-hidden="true"></span>
          </button>
          <select class="table-status-select" data-milestone-status="${escapeHtml(item.id)}">${milestoneStatuses.map((status) => `<option value="${escapeHtml(status)}"${status === item.status ? " selected" : ""}>${escapeHtml(milestoneLabel(status))}</option>`).join("")}</select>
          <button class="button button-secondary" type="button" data-save-milestone="${escapeHtml(item.id)}">Save status</button>
        </div>
        ${open ? `<div class="admin-milestone-body">
          <p class="admin-phase-hint">${escapeHtml(meta.hint)}</p>
          ${banner}
          <div class="admin-thread">${thread}</div>
          <form class="thread-compose" data-admin-thread="${escapeHtml(item.id)}"><label class="field"><span>Note to client</span><textarea name="body" rows="3" maxlength="4000" placeholder="${escapeHtml(meta.placeholder)}"></textarea></label><button class="button button-primary" type="submit">Send note</button></form>
        </div>` : ""}
      </div>`;
    }).join("") : '<div class="table-empty">Choose a project with milestones.</div>';
    document.querySelectorAll("[data-toggle-admin-milestone]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.toggleAdminMilestone;
      if (adminOpenIds.has(id)) adminOpenIds.delete(id);
      else adminOpenIds.add(id);
      renderMilestones({ keepMessages: true });
    }));
    document.querySelectorAll("[data-save-milestone]").forEach((button) => button.addEventListener("click", async () => {
      const select = document.querySelector(`[data-milestone-status="${CSS.escape(button.dataset.saveMilestone)}"]`);
      button.disabled = true;
      try {
        const milestoneId = button.dataset.saveMilestone;
        const status = select.value;
        const result = await mutate("adminUpdateMilestone", { projectId, milestoneId, status }, "Milestone and progress updated");
        const milestone = data.milestones.find((item) => item.projectId === projectId && item.id === (result?.milestoneId || milestoneId));
        if (milestone) milestone.status = result?.status || status;
        applyProjectUpdate(result?.projectUpdate);
        const contact = contactForProject(projectId);
        const nextStatus = result?.status || status;
        const ready = nextStatus === "review";
        const waitingOnUs = nextStatus === "admin_review";
        const heading = ready
          ? `${milestone?.title || "This Stage"} Is Ready for Your Review`
          : waitingOnUs
          ? `${milestone?.title || "This Stage"} Is with Geeslane for Review`
          : `${milestone?.title || "This Stage"} Update`;
        const intro = ready
          ? phaseMeta(milestone).emailIntro
          : waitingOnUs
          ? `Thank you. Geeslane is reviewing your ${milestone?.title || "project"} notes and will follow up in the portal.`
          : `${milestone?.title || "This stage"} is now ${milestoneLabel(nextStatus).toLowerCase()}.`;
        const note = String(document.querySelector(`[data-admin-thread="${CSS.escape(milestoneId)}"] textarea`)?.value || "").trim();
        let noteId = "";
        if (ready && note.length > 1) {
          try {
            const saved = await window.GeeslaneAPI.adminSubmit("adminAddMilestoneMessage", { milestoneId, body: note, kind: "question" });
            if (saved) {
              milestoneMessages.push(saved);
              noteId = saved.id || "";
            }
          } catch (_) { /* status still saved */ }
        }
        notifyClient(contact.email, heading, intro, [
          ["Project", contact.project?.name],
          ["Status", milestoneLabel(nextStatus)]
        ], contact.name, {
          clientPhone: contact.phone,
          ctaUrl: window.GeeslaneMail?.commentLink({ audience: "client", milestoneId, noteId }),
          ctaLabel: noteId ? "View This Comment" : "View This Stage"
        });
        renderProjects(); renderMilestones();
      }
      catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not save that change.")); button.disabled = false; }
    }));
    document.querySelectorAll("[data-admin-thread]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = String(new FormData(form).get("body") || "").trim();
      if (body.length < 2) { toast("Write a short note first."); return; }
      const button = form.querySelector("button");
      window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
      try {
        const saved = await mutate("adminAddMilestoneMessage", { milestoneId: form.dataset.adminThread, body, kind: "comment" }, "Note sent to the client");
        if (saved) milestoneMessages.push(saved);
        const milestone = data.milestones.find((item) => item.id === form.dataset.adminThread);
        const contact = contactForProject(projectId);
        notifyClient(
          contact.email,
          `New Comment on ${milestone?.title || "Your Project"}`,
          `Geeslane added a comment on ${milestone?.title || "your project"}. Use the button below to open that thread.`,
          [["Project", contact.project?.name], ["Stage", milestone?.title], ["Comment", body]],
          contact.name,
          {
            clientPhone: contact.phone,
            ctaUrl: window.GeeslaneMail?.commentLink({ audience: "client", milestoneId: form.dataset.adminThread, noteId: saved?.id || "" }),
            ctaLabel: "View This Comment"
          }
        );
        form.reset();
        renderMilestones();
      } catch (error) {
        toast(window.GeeslaneAPI.userFacingError(error, "The note could not be sent."));
      } finally {
        window.GeeslaneAPI.setButtonBusy(button, false);
      }
    }));
    requestAnimationFrame(focusAdminComment);
  }

  function fileSlug(value) {
    return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  }

  function detailList(rows) {
    const filled = rows.filter((row) => row && String(row[1] || "").trim());
    if (!filled.length) return '<p class="table-empty">Nothing saved here yet.</p>';
    return `<dl class="admin-detail-list">${filled.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
  }

  function renderFilesFilter() {
    const filter = document.getElementById("files-project-filter");
    if (!filter) return;
    const previous = filter.value || materials.projectId;
    if (!data.projects.length) {
      filter.innerHTML = '<option value="">No projects yet</option>';
      return;
    }
    filter.innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("");
    if (data.projects.some((project) => project.id === previous)) filter.value = previous;
  }

  function currentMaterialsProject() {
    return data.projects.find((item) => item.id === (document.getElementById("files-project-filter")?.value || materials.projectId));
  }

  function renderMaterials() {
    const brand = materials.brand || {};
    const content = materials.content || {};
    const brandNode = document.getElementById("admin-brand-panel");
    const contentNode = document.getElementById("admin-content-panel");
    const filesNode = document.getElementById("admin-files-panel");
    if (!brandNode || !contentNode || !filesNode) return;
    brandNode.innerHTML = `
      <div class="admin-brand-swatches">
        <span style="background:${escapeHtml(brand.primaryColor || "#0B6B45")}"></span>
        <span style="background:${escapeHtml(brand.secondaryColor || "#FFFFFF")}"></span>
        <span style="background:${escapeHtml(brand.accentColor || "#C83B3B")}"></span>
      </div>
      ${detailList([
        ["Primary colour", brand.primaryColor],
        ["Secondary colour", brand.secondaryColor],
        ["Accent colour", brand.accentColor],
        ["Heading font", brand.headingFont],
        ["Body font", brand.bodyFont],
        ["Personality", brand.personality],
        ["Style notes", brand.styleNotes],
        ["Reference links", brand.referenceLinks]
      ])}`;
    contentNode.innerHTML = detailList([
      ["Headline", content.headline],
      ["Introduction", content.introduction],
      ["About", content.about],
      ["Services", content.services],
      ["Testimonials", content.testimonials],
      ["Call to action", content.callToAction],
      ["Contact details", content.contactDetails],
      ["Additional notes", content.extraNotes]
    ]);
    filesNode.innerHTML = materials.files.length
      ? materials.files.map((item) => `<div class="admin-file-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type || "File")} · ${formatDate(item.createdAt)}</small></div><div class="admin-file-actions">${item.url && !item.storagePath ? `<a class="button button-secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ""}<button class="button button-primary" type="button" data-download-file="${escapeHtml(item.id)}" ${item.url ? "" : "disabled"}>Download</button></div></div>`).join("")
      : '<p class="table-empty">No logos or files have been uploaded for this project yet.</p>';
    filesNode.querySelectorAll("[data-download-file]").forEach((button) => button.addEventListener("click", () => downloadProjectFile(button.dataset.downloadFile)));
  }

  async function loadProjectMaterials() {
    const filter = document.getElementById("files-project-filter");
    renderFilesFilter();
    const projectId = filter?.value;
    if (!projectId) {
      materials = { projectId: "", brand: null, content: null, files: [] };
      renderMaterials();
      return;
    }
    try {
      materials = await window.GeeslaneAPI.adminProjectMaterials(projectId);
      renderMaterials();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not load brand details and files."));
    }
  }

  function openProjectFiles(projectId) {
    const filter = document.getElementById("files-project-filter");
    if (filter) filter.value = projectId;
    materials.projectId = projectId;
    navigate("files");
  }

  function saveLocalFile(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportBrandAndContent() {
    const project = currentMaterialsProject();
    if (!project) { toast("Choose a project first."); return; }
    const contact = contactForProject(project?.id);
    const brand = materials.brand || {};
    const content = materials.content || {};
    const lines = [
      `Geeslane Brand & Content Export`,
      `Project: ${project?.name || "Project"}`,
      `Client: ${contact.name || "—"}`,
      `Business: ${contact.user?.business || project?.service || "—"}`,
      `Exported: ${new Date().toLocaleString("en-GB")}`,
      "",
      "Brand Identity",
      `Primary colour: ${brand.primaryColor || ""}`,
      `Secondary colour: ${brand.secondaryColor || ""}`,
      `Accent colour: ${brand.accentColor || ""}`,
      `Heading font: ${brand.headingFont || ""}`,
      `Body font: ${brand.bodyFont || ""}`,
      `Personality: ${brand.personality || ""}`,
      `Style notes: ${brand.styleNotes || ""}`,
      `Reference links: ${brand.referenceLinks || ""}`,
      "",
      "Website Content",
      `Headline: ${content.headline || ""}`,
      `Introduction: ${content.introduction || ""}`,
      `About: ${content.about || ""}`,
      `Services: ${content.services || ""}`,
      `Testimonials: ${content.testimonials || ""}`,
      `Call to action: ${content.callToAction || ""}`,
      `Contact details: ${content.contactDetails || ""}`,
      `Additional notes: ${content.extraNotes || ""}`,
      "",
      "Files",
      ...(materials.files.length ? materials.files.map((item) => `- ${item.name} (${item.type || "File"})`) : ["- None uploaded"])
    ];
    saveLocalFile(`${fileSlug(project?.name)}-brand-and-content.txt`, new Blob([lines.join("\n")], { type: "text/plain" }));
    toast("Brand & Content exported");
  }

  async function downloadProjectFile(id, silent) {
    const item = materials.files.find((file) => file.id === id);
    if (!item?.url) {
      if (!silent) toast("This file is not available to download yet.");
      return false;
    }
    if (!item.storagePath) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return true;
    }
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error("Download failed");
      saveLocalFile(item.name || "project-file", await response.blob());
      return true;
    } catch (error) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      if (!silent) toast(window.GeeslaneAPI.userFacingError(error, "Opened the file in a new tab instead."));
      return true;
    }
  }

  async function downloadAllFiles() {
    const files = materials.files.filter((item) => item.url);
    if (!files.length) { toast("No files are available to download for this project."); return; }
    const button = document.getElementById("download-all-files");
    window.GeeslaneAPI.setButtonBusy(button, true, "Downloading…");
    try {
      const ready = [];
      for (const item of files) {
        if (!item.storagePath) {
          ready.push({ name: item.name, url: item.url, link: true });
          continue;
        }
        try {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error("Download failed");
          ready.push({ name: item.name || "project-file", blob: await response.blob() });
        } catch (_) {
          ready.push({ name: item.name, url: item.url, link: true });
        }
      }
      ready.forEach((item) => {
        if (item.link) window.open(item.url, "_blank", "noopener,noreferrer");
        else saveLocalFile(item.name, item.blob);
      });
      toast(`${ready.length} file${ready.length === 1 ? "" : "s"} ready`);
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function renderAll() { renderMetrics(); renderOverview(); renderRegistrations(); renderClients(); renderProjects(); renderRequests(); renderMilestones(); renderFilesFilter(); }

  function refreshLocalMetrics() {
    data.metrics.pending = data.registrations.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
    data.metrics.clients = data.users.filter((item) => item.role === "client").length;
    data.metrics.projects = data.projects.length;
    data.metrics.openRequests = data.requests.filter((item) => !["Completed", "Declined"].includes(item.status)).length;
  }

  function applyProjectUpdate(update) {
    if (!update?.projectId) return;
    const project = data.projects.find((item) => item.id === update.projectId);
    if (project) Object.assign(project, { progress: Number(update.progress || 0), stage: update.stage || project.stage });
  }

  function addCreatedWorkspace(result) {
    if (!result) return;
    if (result.registrationId) {
      const registration = data.registrations.find((item) => item.id === result.registrationId);
      if (registration) registration.status = result.status || "Approved";
    }
    if (result.user && !data.users.some((item) => item.id === result.user.id)) data.users.unshift(result.user);
    if (result.project && !data.projects.some((item) => item.id === result.project.id)) data.projects.push(result.project);
    (result.milestones || []).forEach((milestone) => {
      if (!data.milestones.some((item) => item.projectId === milestone.projectId && item.id === milestone.id)) data.milestones.push(milestone);
    });
    refreshLocalMetrics();
    renderAll();
  }

  function wireRegistrationButtons(root) { root.querySelectorAll("[data-review-registration]").forEach((button) => button.addEventListener("click", () => openApproval(button.dataset.reviewRegistration))); }

  function openApproval(id) {
    const item = data.registrations.find((entry) => entry.id === id);
    if (!item) return;
    const form = document.getElementById("approval-form");
    form.reset();
    form.elements.registrationId.value = item.id;
    form.elements.projectName.value = `${item.business} — ${item.service}`;
    form.elements.service.value = item.service;
    form.elements.targetDate.value = item.targetDate || "";
    document.getElementById("approval-summary").innerHTML = `<strong>${escapeHtml(item.name)} · ${escapeHtml(item.business)}</strong>${escapeHtml(item.email)}<br>${escapeHtml(item.description)}`;
    openModal("approval-modal");
  }

  async function mutate(action, payload, message, refresh) {
    const result = await window.GeeslaneAPI.adminSubmit(action, payload);
    toast(message);
    if (refresh) await loadDashboard();
    return result;
  }

  async function approveRegistration() {
    const form = document.getElementById("approval-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const button = document.getElementById("approve-registration");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const formData = Object.fromEntries(new FormData(form));
      const result = await mutate("adminApproveRegistration", formData, "Client created and invitation queued");
      addCreatedWorkspace(result);
      const email = result.user?.email || result.email;
      notifyClient(email, "Your Geeslane Workspace Is Ready", "Your client portal is ready. Open it from the email we sent, or go to the portal and enter the 6-digit code.", [
        ["Project", formData.projectName],
        ["Service", formData.service]
      ], result.user?.name);
      closeModal("approval-modal");
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  async function rejectRegistration() {
    const form = document.getElementById("approval-form");
    const id = form.elements.registrationId.value;
    const button = document.getElementById("reject-registration");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const result = await mutate("adminRejectRegistration", { registrationId: id, notes: form.elements.notes.value }, "Access request rejected");
      const registration = data.registrations.find((item) => item.id === (result?.registrationId || id));
      if (registration) registration.status = result?.status || "Rejected";
      notifyClient(registration?.email, "Update on Your Access Request", "We are unable to approve this access request at this time. If you expected a different outcome, reply to this email.", [
        ["Business", registration?.business],
        ["Service", registration?.service]
      ], registration?.name);
      refreshLocalMetrics(); renderMetrics(); renderOverview(); renderRegistrations();
      closeModal("approval-modal");
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  async function createClient() {
    const form = document.getElementById("create-client-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const button = document.getElementById("save-create-client");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      const formData = Object.fromEntries(new FormData(form));
      formData.name = window.GeeslaneMail?.composePersonName(formData.title, formData.name) || formData.name;
      const result = await mutate("adminCreateClientProject", formData, "Client, project, and invitation created");
      addCreatedWorkspace(result);
      notifyClient(formData.email, "Your Geeslane Workspace Is Ready", "Your client portal is ready. Open it from the email we sent, or go to the portal and enter the 6-digit code.", [
        ["Project", formData.projectName],
        ["Service", formData.service]
      ], formData.name);
      closeModal("create-client-modal");
      form.reset();
    }
    catch (error) { toast(window.GeeslaneAPI.userFacingError(error, "Could not complete that action.")); }
    finally { window.GeeslaneAPI.setButtonBusy(button, false); }
  }

  let pendingAdminEmail = "";

  function showAdminAuth(name) {
    document.getElementById("admin-password-panel").classList.toggle("is-visible", name === "password");
    document.getElementById("admin-email-panel").classList.toggle("is-visible", name === "email");
    document.getElementById("admin-code-panel").classList.toggle("is-visible", name === "code");
    const switcher = document.getElementById("admin-auth-switch");
    switcher.hidden = false;
    switcher.textContent = name === "password" ? "Use a 6-digit code instead" : "Use username and password instead";
    const feedback = document.getElementById("admin-auth-feedback");
    if (feedback) feedback.hidden = true;
    if (name === "code") {
      const label = document.getElementById("admin-code-email-label");
      if (label) label.textContent = pendingAdminEmail || "your email";
      window.GeeslaneAPI.clearCodeBoxes(document.getElementById("admin-code-boxes"));
    }
    setTimeout(() => {
      if (name === "code") document.querySelector("#admin-code-boxes .code-box")?.focus();
      else if (name === "email") document.getElementById("admin-signin-email")?.focus();
      else document.getElementById("admin-username")?.focus();
    }, 30);
  }

  async function completeAdminSession() {
    const session = await window.GeeslaneAPI.getSession();
    if (session.user?.role === "admin" && session.user?.status === "active") {
      await enterAdmin();
      return true;
    }
    if (session.user?.role === "admin") {
      await window.GeeslaneAPI.logout();
      showAuthFeedback("This administrator account is not active.");
      return false;
    }
    location.replace(window.GeeslaneAPI.clientSignInRedirect());
    return false;
  }

  async function requestAdminPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true, "Signing in…");
    try {
      const result = await window.GeeslaneAPI.adminPasswordLogin(String(data.get("username") || "").trim(), String(data.get("password") || ""));
      if (result?.needsCode) {
        window.GeeslaneAPI.setButtonBusy(button, false);
        pendingAdminEmail = result.email;
        const emailInput = document.getElementById("admin-signin-email");
        if (emailInput) emailInput.value = result.email;
        showAdminAuth("code");
        showAuthFeedback(`Password accepted. Enter the 6-digit code emailed to ${result.email}.`, "success");
        return;
      }
      await completeAdminSession();
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Invalid administrator details."));
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function sendAdminCode(email, button) {
    const address = String(email || "").trim();
    if (!address) { showAuthFeedback("Enter a valid email address."); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending code…");
    try {
      await window.GeeslaneAPI.requestMagicLink(address, "admin");
      pendingAdminEmail = address.toLowerCase();
      const emailInput = document.getElementById("admin-signin-email");
      if (emailInput) emailInput.value = address;
      showAdminAuth("code");
      showAuthFeedback("Check your inbox — and spam if it is not there in a minute.", "success");
      window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      const resend = document.getElementById("admin-resend-code");
      if (resend && resend !== button) window.GeeslaneAPI.startMagicLinkCooldown(resend, 60);
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "The sign-in email could not be sent. Please try again."));
      if (window.GeeslaneAPI.isRateLimitError(error)) window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      else window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function requestAdminMagicLink(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    await sendAdminCode(String(new FormData(form).get("email") || "").trim(), form.querySelector("button[type=submit]"));
  }

  async function submitAdminCode(event) {
    event.preventDefault();
    const code = window.GeeslaneAPI.codeFromBoxes(document.getElementById("admin-code-boxes"));
    const email = pendingAdminEmail || document.getElementById("admin-signin-email")?.value || "";
    const button = event.currentTarget.querySelector("button[type=submit]");
    if (!/^\d{6}$/.test(code)) { showAuthFeedback("Enter the 6-digit code from your email."); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Opening admin portal…");
    try {
      await window.GeeslaneAPI.verifySignInCode(email, code);
      await completeAdminSession();
    } catch (error) {
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "That code could not be verified. Try again, or send a new one."));
      window.GeeslaneAPI.setButtonBusy(button, false);
      document.querySelector("#admin-code-boxes .code-box")?.focus();
    }
  }

  async function enterAdmin() {
    await loadDashboard();
    document.getElementById("admin-auth").hidden = true;
    document.getElementById("admin-shell").hidden = false;
    restoreAdminCommentRoute();
    const route = parseAdminHash();
    navigate(pageTitles[route.page] ? route.page : "overview", { keepHash: true });
  }

  async function loadDashboard() {
    data = await window.GeeslaneAPI.adminDashboard();
    document.getElementById("admin-sidebar-name").textContent = data.admin.name || "Administrator";
    document.getElementById("admin-sidebar-email").textContent = data.admin.email || "";
    renderAll();
  }

  function wireEvents() {
    document.querySelectorAll("[data-admin-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.adminPage)));
    document.querySelectorAll("[data-go-admin-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.goAdminPage)));
    ["registration-search","client-search","project-search","admin-request-search"].forEach((id) => document.getElementById(id).addEventListener("input", () => ({ "registration-search": renderRegistrations, "client-search": renderClients, "project-search": renderProjects, "admin-request-search": renderRequests })[id]()));
    document.getElementById("milestone-project-filter").addEventListener("change", renderMilestones);
    document.getElementById("files-project-filter").addEventListener("change", loadProjectMaterials);
    document.getElementById("export-brand-content").addEventListener("click", exportBrandAndContent);
    document.getElementById("download-all-files").addEventListener("click", downloadAllFiles);
    document.getElementById("admin-password-form").addEventListener("submit", requestAdminPassword);
    document.getElementById("admin-signin-form").addEventListener("submit", requestAdminMagicLink);
    document.getElementById("admin-code-form").addEventListener("submit", submitAdminCode);
    window.GeeslaneAPI.bindCodeBoxes(document.getElementById("admin-code-boxes"), () => {
      const submit = document.querySelector("#admin-code-form button[type=submit]");
      if (submit && !submit.disabled) document.getElementById("admin-code-form").requestSubmit();
    });
    document.getElementById("admin-resend-code").addEventListener("click", () => {
      sendAdminCode(pendingAdminEmail || document.getElementById("admin-signin-email")?.value || "", document.getElementById("admin-resend-code"));
    });
    document.getElementById("admin-change-email").addEventListener("click", () => showAdminAuth("email"));
    document.getElementById("admin-auth-switch").addEventListener("click", () => {
      const usingPassword = document.getElementById("admin-password-panel").classList.contains("is-visible");
      showAdminAuth(usingPassword ? "email" : "password");
    });
    document.getElementById("admin-signout").addEventListener("click", async () => { await window.GeeslaneAPI.logout(); location.replace("./admin.html"); });
    document.getElementById("open-create-client").addEventListener("click", () => openModal("create-client-modal"));
    document.getElementById("close-create-client").addEventListener("click", () => closeModal("create-client-modal"));
    document.getElementById("cancel-create-client").addEventListener("click", () => closeModal("create-client-modal"));
    document.getElementById("save-create-client").addEventListener("click", createClient);
    document.getElementById("close-approval").addEventListener("click", () => closeModal("approval-modal"));
    document.getElementById("cancel-approval").addEventListener("click", () => closeModal("approval-modal"));
    document.getElementById("approve-registration").addEventListener("click", approveRegistration);
    document.getElementById("reject-registration").addEventListener("click", rejectRegistration);
    document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("mousedown", (event) => { if (event.target === modal) closeModal(modal.id); }));
    addEventListener("hashchange", () => {
      const route = parseAdminHash();
      navigate(pageTitles[route.page] ? route.page : "overview", { keepHash: true });
    });
  }

  async function init() {
    rememberAdminCommentRoute();
    wireEvents();
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    const savedUser = window.GEESLANE_CONFIG?.adminUsername || "";
    const usernameInput = document.getElementById("admin-username");
    if (savedUser && usernameInput && !usernameInput.value) usernameInput.value = savedUser;
    if (!window.GeeslaneAPI.backendConfigured()) {
      showAuthFeedback("Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env before administrator sign-in can work.", "notice");
      return;
    }
    const signingIn = window.GeeslaneAPI.hasIncomingMagicLink();
    if (signingIn) window.GeeslaneAPI.showLoader("Signing you in…");
    try {
      const authSession = await window.GeeslaneAPI.consumeMagicLink();
      if (!authSession) return;
      await completeAdminSession();
    } catch (error) {
      try { await window.GeeslaneAPI.logout(); } catch (_) { /* signed-out UI still continues */ }
      showAuthFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Administrator sign-in could not be completed. Enter a new 6-digit code, or use your password."));
    } finally {
      if (signingIn) window.GeeslaneAPI.hideLoader();
    }
  }

  init();
})();
