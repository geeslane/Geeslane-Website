(function () {
  "use strict";

  const STORAGE_KEY = "geeslane-client-hub-v3-session";
  const LAST_EMAIL_KEY = "geeslane-portal-email";
  let pendingSignInEmail = "";
  const pageNames = { overview: "Overview", project: "My Project", brand: "Brand & Content", requests: "Requests", files: "Files & Links", profile: "Profile" };
  const icons = {
    request: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H5V4a1 1 0 0 1 1-1Zm1 2v14h10V8h-3V5H7Z"/></svg>',
    milestone: '<svg viewBox="0 0 24 24"><path d="m9.2 16.6-4.4-4.4 1.4-1.4 3 3 8.6-8.6 1.4 1.4-10 10Z"/></svg>',
    change: '<svg viewBox="0 0 24 24"><path d="M17.6 2.6 21.4 6.4l-9.9 9.9-4.2.9.9-4.2 9.4-10.4Z"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H5V3a1 1 0 0 1 1-1Zm1 2v16h10V8h-4V4H7Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5Z"/></svg>',
    external: '<svg viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H6v11h11v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm2.2 2 .7 8h6.2l.7-8H8.2Z"/></svg>'
  };

  const requestConfigs = {
    discovery: {
      label: "New Project Brief",
      shortLabel: "Project Brief",
      title: "Tell us about the work",
      copy: "Share the outcome, audience, and essentials for this project.",
      fields: [
        { name: "projectName", label: "Project name", type: "text", placeholder: "e.g. Product landing page", required: true },
        { name: "projectType", label: "What do you need?", type: "select", required: true, options: ["Landing page", "Portfolio website", "Business website", "Website revamp", "AI automation", "Consultation", "Something else"] },
        { name: "goal", label: "What should this help you achieve?", type: "textarea", placeholder: "Describe the main outcome...", required: true, full: true },
        { name: "audience", label: "Who is it for?", type: "text", placeholder: "Ideal customers or users", required: true, full: true },
        { name: "mustHaves", label: "What must be included?", type: "textarea", placeholder: "Pages, features, content, integrations...", required: true, full: true },
        { name: "brandColours", label: "Brand colours", type: "text", placeholder: "e.g. #0B6B45, white, restrained red" },
        { name: "brandStyle", label: "Brand style", type: "text", placeholder: "e.g. Professional, simple, confident" },
        { name: "contentStatus", label: "Content readiness", type: "select", options: ["Ready to add", "Partly ready", "Need help creating it", "Not started"] },
        { name: "assetFolder", label: "Existing logo or media folder", type: "url", placeholder: "https://...", full: true },
        { name: "targetDate", label: "Preferred completion", type: "date" },
        { name: "reference", label: "Reference link", type: "url", placeholder: "https://..." }
      ]
    },
    milestone: {
      label: "Milestone Review",
      shortLabel: "Approval",
      title: "Review the latest milestone",
      copy: "Record a clear decision so the project can move forward.",
      fields: [
        { name: "milestone", label: "Milestone", type: "select", required: true, options: ["Discovery", "Brand Assets & Content", "Wireframe", "Visual Design", "Development", "QA & Testing", "Launch & Handover", "Other"] },
        { name: "decision", label: "Your decision", type: "radio", required: true, full: true, options: ["Approved", "Approved with notes", "Changes requested"] },
        { name: "feedback", label: "Feedback or notes", type: "textarea", placeholder: "What works well, and what needs attention?", full: true, conditional: true },
        { name: "reviewLink", label: "Reviewed work link", type: "url", placeholder: "https://...", full: true }
      ]
    },
    change: {
      label: "Change Request",
      shortLabel: "Change",
      title: "Describe the change",
      copy: "A focused request helps Geeslane assess timing and effort.",
      fields: [
        { name: "changeTitle", label: "Short change title", type: "text", placeholder: "e.g. Update the pricing section", required: true },
        { name: "priority", label: "Priority", type: "radio", required: true, full: true, options: ["Standard", "Time-sensitive", "Blocking progress"] },
        { name: "details", label: "What should change?", type: "textarea", placeholder: "Describe the current state and the exact change...", required: true, full: true },
        { name: "reason", label: "Why is it needed?", type: "textarea", placeholder: "Add useful business context.", full: true },
        { name: "targetDate", label: "Preferred completion", type: "date" },
        { name: "reference", label: "Reference link", type: "url", placeholder: "https://..." }
      ]
    }
  };

  let state = createEmptyState();
  let currentPage = "overview";
  let currentFilter = "all";
  let requestFlow = { step: 1, type: "", values: {} };
  let accountProjects = [];
  let toastTimer = null;
  let openMilestoneId = "";

  function createEmptyState() {
    return {
      initialized: false,
      createdAt: "",
      profile: { name: "", business: "", email: "", phone: "", contact: "Email" },
      project: {
        id: "", name: "", service: "", stage: "Discovery", progress: 0,
        startDate: "", targetDate: "", status: "Not started",
        brandKit: defaultBrandKit(), content: defaultContent()
      },
      milestones: defaultMilestones(0),
      requests: [],
      resources: [],
      activity: [],
      messages: []
    };
  }

  function defaultMilestones(completedCount) {
    const items = [
      ["Discovery", "Goals, audience, scope, and project requirements.", 10],
      ["Brand Assets & Content", "Logos, colours, photography, copy, and source material.", 15],
      ["Wireframe", "Page structure, information flow, and experience plan.", 15],
      ["Visual Design", "Layout, styling, and responsive design review.", 20],
      ["Development", "Build, interactions, integrations, and quality checks.", 25],
      ["QA & Testing", "Quality checks, staging tests, and approval before launch.", 10],
      ["Launch & Handover", "Release, documentation, and project handover.", 5]
    ];
    return items.map((item, index) => ({ id: `M${index + 1}`, title: item[0], description: item[1], weight: item[2], status: index < completedCount ? "complete" : index === completedCount ? "current" : "upcoming" }));
  }

  function phaseMeta(item) {
    const title = String(item?.title || "").toLowerCase();
    if (/discover/.test(title)) return {
      reviewTitle: "Discovery needs your answers",
      reviewCopy: "Geeslane has questions about goals, audience, or scope. Reply here so we can finalise the brief.",
      adminCopy: "Thank you. Geeslane is reviewing your Discovery notes and will follow up here.",
      currentCopy: "Discovery is in progress. Use this thread if anything in the brief is unclear.",
      emailIntro: "Please reply to the Discovery questions in your portal so we can finalise the brief.",
      approveLabel: "Confirm the brief",
      changesLabel: "Need to clarify"
    };
    if (/brand/.test(title)) return {
      reviewTitle: "Brand & Content is ready for review",
      reviewCopy: "Review colours, logos, and copy. Approve the direction, or note what should change.",
      adminCopy: "Geeslane is reviewing your Brand & Content notes.",
      currentCopy: "Add logos and copy in Brand & Content, and use this thread to message Geeslane.",
      emailIntro: "Please review Brand & Content in your portal and leave a note if anything should change.",
      approveLabel: "Approve brand direction",
      changesLabel: "Request brand changes"
    };
    if (/wire/.test(title)) return {
      reviewTitle: "Wireframes are ready for review",
      reviewCopy: "Check structure and page flow. Approve the layout, or list what should move, be added, or be removed.",
      adminCopy: "Geeslane is reviewing your wireframe feedback.",
      currentCopy: "Wireframes are being prepared. Questions about structure can go in this thread.",
      emailIntro: "Wireframes are ready for review. Please check the structure and leave focused feedback.",
      approveLabel: "Approve wireframes",
      changesLabel: "Request wireframe changes"
    };
    if (/visual|design/.test(title)) return {
      reviewTitle: "Visual design is ready for review",
      reviewCopy: "Review layout, colour, type, and the overall feel. Approve the look, or note specific changes.",
      adminCopy: "Geeslane is reviewing your design feedback.",
      currentCopy: "Visual design is underway. Use this thread for design questions.",
      emailIntro: "Visual design is ready for review. Please leave specific notes in your portal.",
      approveLabel: "Approve visual design",
      changesLabel: "Request design changes"
    };
    if (/develop/.test(title)) return {
      reviewTitle: "A development preview is ready for review",
      reviewCopy: "Open the preview link in this thread, work through the site, then report issues or approve the build.",
      adminCopy: "Geeslane is reviewing your development feedback.",
      currentCopy: "Development is underway. Use this thread if you notice something early.",
      emailIntro: "A development preview is ready for review. Please test it and note any issues in your portal.",
      approveLabel: "Approve the build",
      changesLabel: "Report issues"
    };
    if (/qa|test/.test(title)) return {
      reviewTitle: "QA is ready for review",
      reviewCopy: "This is the last check before launch. Approve to go live, or list remaining issues.",
      adminCopy: "Geeslane is reviewing your QA notes.",
      currentCopy: "Quality testing is in progress. Note anything that still needs attention.",
      emailIntro: "QA is ready for review. Approve to proceed to launch, or list remaining issues.",
      approveLabel: "Approve for launch",
      changesLabel: "List remaining issues"
    };
    if (/launch/.test(title)) return {
      reviewTitle: "Handover is ready for review",
      reviewCopy: "Confirm you have what you need for launch and handover.",
      adminCopy: "Geeslane is reviewing your handover notes.",
      currentCopy: "Launch and handover are being prepared.",
      emailIntro: "Handover materials are ready. Please confirm you have what you need.",
      approveLabel: "Confirm handover",
      changesLabel: "Need something else"
    };
    return {
      reviewTitle: `${item?.title || "This stage"} is ready for review`,
      reviewCopy: "Approve this stage or leave focused feedback so the project can move forward.",
      adminCopy: "Geeslane is reviewing your notes for this stage.",
      currentCopy: "This stage is in progress. Use this thread for questions and notes.",
      emailIntro: `${item?.title || "This stage"} is ready for your review.`,
      approveLabel: "Approve this stage",
      changesLabel: "Request changes"
    };
  }

  function defaultBrandKit() {
    return { primaryColor: "#0B6B45", secondaryColor: "#FFFFFF", accentColor: "#C83B3B", headingFont: "", bodyFont: "", personality: "", styleNotes: "", referenceLinks: "" };
  }

  function defaultContent() {
    return { headline: "", introduction: "", about: "", services: "", testimonials: "", callToAction: "", contactDetails: "", extraNotes: "" };
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
  function firstName(name) {
    return window.GeeslaneMail?.givenName(name) || "there";
  }
  function displayFirst(name, fallback = "") {
    return window.GeeslaneMail?.givenName(name) || fallback;
  }
  function clientFirst(fallback = "A client") {
    return displayFirst(state.profile?.name, fallback) || fallback;
  }
  function clientFormal() {
    return window.GeeslaneMail?.respectfulName(state.profile?.name) || clientFirst();
  }
  function initials(name) {
    const person = window.GeeslaneMail?.parsePersonName(name);
    const source = person?.bareName || String(name || "Client").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : parts[0]?.slice(0, 2) || "CL").toUpperCase();
  }
  function projectInitial(name) { return String(name || "P").trim().charAt(0).toUpperCase(); }
  function formatDate(value, short = false) {
    if (!value) return "Not set";
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", short ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  }
  function relativeDate(value) {
    const days = Math.round((Date.now() - new Date(value).getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return formatDate(value, true);
  }

  function saveState(remoteAction, payload) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (remoteAction && window.GeeslaneAPI?.isConnected()) {
      window.GeeslaneAPI.submit(remoteAction, { projectId: state.project.id, ...payload }).catch(() => toast("Online sync failed. Refresh before making more changes."));
    }
  }

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") state = normalizeState({ ...createEmptyState(), ...saved });
    } catch (_) {
      state = createEmptyState();
    }
  }

  function isPlaceholderName(name) {
    return !String(name || "").trim() || /^(your project|untitled project)$/i.test(String(name).trim());
  }

  function isPlaceholderService(service) {
    return !String(service || "").trim() || /^website project$/i.test(String(service).trim());
  }

  function displayProjectName(project = state.project) {
    return isPlaceholderName(project?.name) ? "Project" : String(project.name).trim();
  }

  function displayProjectService(project = state.project) {
    return isPlaceholderService(project?.service) ? "Not set" : String(project.service).trim();
  }

  function displayProjectStatus() {
    const hasWork = state.project.progress > 0
      || state.requests.length
      || state.milestones.some((item) => item.status === "review" || item.status === "admin_review" || item.status === "complete");
    if (!hasWork) return "Not started";
    return state.project.status || "In progress";
  }

  function hasCustomBrand(brand = state.project.brandKit) {
    const value = brand || {};
    const defaults = defaultBrandKit();
    if (value.headingFont || value.bodyFont || value.personality || value.styleNotes || value.referenceLinks) return true;
    return ["primaryColor", "secondaryColor", "accentColor"].some((key) => validColour(value[key], defaults[key]) !== defaults[key]);
  }

  function hasCustomContent(content = state.project.content) {
    return Object.values(content || {}).some((value) => String(value || "").trim());
  }

  function isBootstrapActivity(item, workspace) {
    const title = String(item?.title || "").trim().toLowerCase();
    if (title === "project workspace created" || title === "workspace created") return true;
    if (title === "brand identity updated" && !hasCustomBrand(workspace?.project?.brandKit)) return true;
    if (title === "website content updated" && !hasCustomContent(workspace?.project?.content)) return true;
    if (title === "project details updated" && isPlaceholderName(workspace?.project?.name)) return true;
    return false;
  }

  function normalizeState(candidate) {
    const base = createEmptyState();
    candidate.profile = { ...base.profile, ...(candidate.profile || {}) };
    candidate.project = { ...base.project, ...(candidate.project || {}) };
    candidate.project.brandKit = { ...defaultBrandKit(), ...(candidate.project.brandKit || {}) };
    candidate.project.content = { ...defaultContent(), ...(candidate.project.content || {}) };
    if (isPlaceholderName(candidate.project.name)) candidate.project.name = "";
    if (isPlaceholderService(candidate.project.service)) candidate.project.service = "";
    if (!Array.isArray(candidate.milestones) || candidate.milestones.length !== 7) {
      const completed = Array.isArray(candidate.milestones) ? candidate.milestones.filter((item) => item.status === "complete").length : 0;
      candidate.milestones = defaultMilestones(Math.min(completed, 6));
    }
    candidate.requests = Array.isArray(candidate.requests) ? candidate.requests : [];
    candidate.resources = Array.isArray(candidate.resources) ? candidate.resources : [];
    candidate.activity = (Array.isArray(candidate.activity) ? candidate.activity : []).filter((item) => !isBootstrapActivity(item, candidate));
    candidate.messages = Array.isArray(candidate.messages) ? candidate.messages : [];
    candidate.project.progress = calculateProgress(candidate.milestones, candidate);
    candidate.project.stage = candidate.milestones.find((item) => item.status === "current" || item.status === "review" || item.status === "admin_review")?.title || candidate.project.stage || "Discovery";
    return candidate;
  }

  function clientContribution(milestones, workspace = state) {
    const project = workspace?.project || {};
    const resources = Array.isArray(workspace?.resources) ? workspace.resources : [];
    const brandDone = hasCustomBrand(project.brandKit);
    const contentDone = hasCustomContent(project.content);
    const filesDone = resources.some((item) => item && !item.archivedAt);
    if (!brandDone && !contentDone && !filesDone) return 0;

    let extra = 0;
    const discovery = milestones.find((item) => /discovery/i.test(item.title || ""));
    const brandStage = milestones.find((item) => /brand/i.test(item.title || ""));
    if (discovery && (discovery.status === "current" || discovery.status === "upcoming")) {
      extra += Number(discovery.weight || 0) * 0.4;
    }
    if (brandStage && (brandStage.status === "current" || brandStage.status === "upcoming")) {
      let part = 0;
      if (brandDone) part += 0.3;
      if (contentDone) part += 0.3;
      if (filesDone) part += 0.2;
      extra += Number(brandStage.weight || 0) * Math.min(part, 0.6);
    }
    return extra;
  }

  function calculateProgress(milestones = state.milestones, workspace = state) {
    const factor = { upcoming: 0, current: 0, review: 0.8, admin_review: 0.8, complete: 1 };
    const weighted = milestones.reduce((total, item) => total + Number(item.weight || 0) * (factor[item.status] ?? 0), 0);
    return Math.max(0, Math.min(100, Math.round(weighted + clientContribution(milestones, workspace))));
  }

  function addActivity(title, detail, type) {
    state.activity.unshift({ id: uid("A"), title, detail, type, createdAt: new Date().toISOString() });
    state.activity = state.activity.slice(0, 30);
  }

  const COMMENT_ROUTE_KEY = "geeslane-comment-route";

  function rememberCommentRoute() {
    const route = parsePortalHash();
    if (route.params.get("milestone") || route.params.get("note")) sessionStorage.setItem(COMMENT_ROUTE_KEY, location.hash);
  }

  function restoreCommentRoute() {
    const saved = sessionStorage.getItem(COMMENT_ROUTE_KEY);
    if (saved && !(parsePortalHash().params.get("milestone") || parsePortalHash().params.get("note"))) {
      history.replaceState(null, "", `${location.pathname}${location.search}${saved}`);
    }
    sessionStorage.removeItem(COMMENT_ROUTE_KEY);
  }

  function parsePortalHash() {
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

  function scrollToComment(milestoneId, noteId) {
    const node = (noteId && document.getElementById(`note-${noteId}`))
      || (milestoneId && document.getElementById(`milestone-${milestoneId}`));
    if (!node) return;
    node.classList.add("is-target");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("is-target"), 4000);
  }

  function applyCommentLink() {
    const route = parsePortalHash();
    const milestoneId = route.params.get("milestone") || "";
    const noteId = route.params.get("note") || "";
    if (!milestoneId && !noteId) return;
    openMilestoneId = milestoneId || openMilestoneId;
    const page = route.page === "brand" ? "brand" : "project";
    navigate(page, { keepHash: true, silent: true });
    renderMilestones();
    renderBrandWorkspace();
    requestAnimationFrame(() => scrollToComment(milestoneId, noteId));
  }

  function navigate(page, options = {}) {
    if (!pageNames[page]) return;
    currentPage = page;
    document.querySelectorAll("[data-page-view]").forEach((view) => view.classList.toggle("is-visible", view.dataset.pageView === page));
    document.querySelectorAll(".nav-item[data-page], .mobile-nav [data-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.page === page));
    document.getElementById("page-title").textContent = pageNames[page];
    closeSidebar();
    if (options.keepHash) writeHash(page, parsePortalHash().params);
    else writeHash(page);
    if (!options.silent) window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "requests") renderRequests();
    if (page === "files") renderResources();
    if (page === "brand") renderBrandWorkspace();
    if (page === "profile") renderProfile();
    if (page === "project") renderMilestones();
  }

  function openSidebar() { document.getElementById("sidebar").classList.add("is-open"); document.getElementById("sidebar-scrim").classList.add("is-visible"); }
  function closeSidebar() { document.getElementById("sidebar").classList.remove("is-open"); document.getElementById("sidebar-scrim").classList.remove("is-visible"); }
  function openModal(name) { const modal = document.getElementById(`${name}-modal`); modal.hidden = false; document.body.style.overflow = "hidden"; setTimeout(() => modal.querySelector("button, input, select")?.focus(), 60); }
  function closeModal(name) { document.getElementById(`${name}-modal`).hidden = true; document.body.style.overflow = ""; }
  function toast(message) { clearTimeout(toastTimer); document.getElementById("toast-message").textContent = message; document.getElementById("toast").classList.add("is-visible"); toastTimer = setTimeout(() => document.getElementById("toast").classList.remove("is-visible"), 2600); }

  function renderAll() {
    const completed = state.milestones.filter((item) => item.status === "complete").length;
    state.project.progress = calculateProgress();
    const initialsText = initials(state.profile.name);
    const projectLetter = projectInitial(displayProjectName());
    const statusLabel = displayProjectStatus();
    setText("sidebar-account-avatar", initialsText);
    setText("profile-avatar-large", initialsText);
    setText("sidebar-account-name", window.GeeslaneMail?.parsePersonName(state.profile.name)?.bareName || state.profile.name || "Client account");
    setText("sidebar-account-business", state.profile.business || "Geeslane client");
    setText("sidebar-project-initial", projectLetter);
    setText("project-large-icon", projectLetter);
    setText("sidebar-project-name", displayProjectName());
    setText("welcome-name", firstName(state.profile.name));
    setText("hero-project-name", displayProjectName());
    setText("hero-service", displayProjectService());
    setText("hero-project-status", statusLabel);
    setText("project-page-status", statusLabel);
    setText("progress-value", `${state.project.progress}%`);
    document.getElementById("progress-bar").style.width = `${state.project.progress}%`;
    setText("target-date", formatDate(state.project.targetDate, true));
    setText("current-stage", state.project.stage || "Discovery");
    setText("milestone-ratio", `${completed} of ${state.milestones.length}`);
    setText("project-page-name", displayProjectName());
    setText("milestone-percent", `${state.project.progress}% complete`);
    setText("request-nav-count", state.requests.length);
    renderProjectSwitcher();
    renderMilestones();
    renderProjectDetails();
    renderActivity();
    renderNextAction();
    renderRequests();
    renderResources();
    renderBrandWorkspace();
    renderProfile();
    renderNotifications();
  }

  function setText(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }

  function messagesFor(milestoneId) {
    return (state.messages || []).filter((item) => item.milestoneId === milestoneId);
  }

  function messageKindLabel(kind) {
    return { approval: "Approved", changes: "Changes requested", question: "Question", comment: "Note" }[kind] || "Note";
  }

  function canTalkOn(milestone) {
    const status = milestone?.status;
    if (status === "current" || status === "review" || status === "admin_review") return true;
    return status !== "complete" && /brand/i.test(milestone?.title || "");
  }

  function threadPlaceholder(milestone) {
    const title = String(milestone?.title || "").toLowerCase();
    if (/discover/.test(title)) return "Answer the question, or add goals, audience, and scope notes…";
    if (/brand/.test(title)) return "Ask about colours, logos, fonts, or copy…";
    if (/wire/.test(title)) return "Note structure changes, missing pages, or questions about flow…";
    if (/visual|design/.test(title)) return "Name the page or section and what should change…";
    if (/develop/.test(title)) return "Report a bug, missing content, or what you tested…";
    if (/test/.test(title)) return "List remaining issues, or confirm it is ready to launch…";
    return "Write a clear note…";
  }

  function noteHtml(body) {
    return escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const clean = url.replace(/[),.;]+$/, "");
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${url.slice(clean.length)}`;
    });
  }

  function threadMarkup(milestone) {
    const notes = messagesFor(milestone.id);
    const meta = phaseMeta(milestone);
    const inReview = milestone.status === "review";
    const isDiscovery = /discover/i.test(milestone.title || "");
    const canTalk = canTalkOn(milestone);
    const list = notes.length
      ? notes.map((note) => `<article class="thread-note is-${escapeHtml(note.role)} is-${escapeHtml(note.kind)}" id="note-${escapeHtml(note.id)}"><header><strong>${escapeHtml(note.name || (note.role === "admin" ? "Geeslane" : "You"))}</strong><span>${escapeHtml(messageKindLabel(note.kind))} · ${relativeDate(note.createdAt)}</span></header><p>${noteHtml(note.body)}</p></article>`).join("")
      : `<p class="thread-empty">No comments yet.</p>`;
    const actions = !canTalk ? "" : `
      <form class="thread-compose" data-thread-form="${escapeHtml(milestone.id)}">
        <label class="field"><span>${inReview && isDiscovery ? "Your reply" : "Your note"}</span><textarea name="body" rows="3" maxlength="4000" placeholder="${escapeHtml(threadPlaceholder(milestone))}"></textarea></label>
        <div class="thread-actions">
          <button class="button ${inReview && !isDiscovery ? "button-secondary" : "button-primary"}" type="submit" data-thread-kind="comment">${inReview && isDiscovery ? "Send reply" : "Send note"}</button>
          ${inReview ? `<button class="button button-secondary" type="submit" data-thread-kind="changes">${escapeHtml(meta.changesLabel)}</button><button class="button ${isDiscovery ? "button-secondary" : "button-primary"}" type="submit" data-thread-kind="approval">${escapeHtml(meta.approveLabel)}</button>` : ""}
        </div>
      </form>`;
    return `<div class="milestone-thread">${list}${actions}</div>`;
  }

  function bindThreadForms(root, sender) {
    root.querySelectorAll("[data-thread-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const kind = event.submitter?.dataset.threadKind || "comment";
        sender(form.dataset.threadForm, String(new FormData(form).get("body") || ""), kind, event.submitter);
      });
    });
  }

  function renderMilestones() {
    const list = document.getElementById("milestone-list");
    if (!list) return;
    const focusId = openMilestoneId || state.milestones.find((item) => item.status === "review")?.id || "";
    list.innerHTML = state.milestones.map((item, index) => {
      const mark = item.status === "complete" ? icons.milestone : String(index + 1).padStart(2, "0");
      const status = item.status === "complete" ? "Completed" : item.status === "review" ? "Your review needed" : item.status === "admin_review" ? "Geeslane is reviewing" : item.status === "current" ? "In progress" : "Upcoming";
      const open = item.id === focusId || item.status === "review" || item.status === "admin_review" || (canTalkOn(item) && messagesFor(item.id).length);
      return `<div class="milestone-item is-${escapeHtml(item.status)}${open ? " is-open" : ""}" id="milestone-${escapeHtml(item.id)}">
        <span class="milestone-mark">${mark}</span>
        <div class="milestone-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div>
        <button class="milestone-state" type="button" data-toggle-milestone="${escapeHtml(item.id)}">${status}</button>
        ${open ? threadMarkup(item) : ""}
      </div>`;
    }).join("");
    list.querySelectorAll("[data-toggle-milestone]").forEach((button) => button.addEventListener("click", () => {
      openMilestoneId = openMilestoneId === button.dataset.toggleMilestone ? "" : button.dataset.toggleMilestone;
      renderMilestones();
    }));
    bindThreadForms(list, sendClientMilestoneNote);
  }

  async function sendClientMilestoneNote(milestoneId, body, kind, button) {
    const milestone = state.milestones.find((item) => item.id === milestoneId);
    const text = String(body || "").trim() || (kind === "approval" ? "Approved this stage." : "");
    if (kind !== "approval" && text.length < 2) { toast("Write a short note first."); return; }
    if (button) window.GeeslaneAPI.setButtonBusy(button, true, "Sending…");
    try {
      const saved = await window.GeeslaneAPI.submit("addMilestoneMessage", { projectId: state.project.id, milestoneId, body: text, kind });
      if (saved?.id) state.messages.push(saved);
      else state.messages.push({ id: uid("N"), milestoneId, role: "client", name: state.profile.name, body: text, kind, createdAt: new Date().toISOString() });
      if (saved?.milestoneStatus && milestone) milestone.status = saved.milestoneStatus;
      else if (milestone?.status === "review") milestone.status = "admin_review";
      if (kind === "approval" || kind === "changes") {
        const requestId = saved?.requestId || uid("GL-M");
        if (!state.requests.some((item) => item.databaseId === requestId || item.id === requestId)) {
          state.requests.unshift({
            id: requestId, databaseId: requestId, type: "milestone",
            title: `${milestone?.title || "Milestone"} review`, status: "Received",
            values: { milestone: milestone?.title, decision: kind === "approval" ? "Approved" : "Changes requested", feedback: text },
            createdAt: new Date().toISOString()
          });
        }
      }
      const savedNote = saved?.id ? saved : state.messages[state.messages.length - 1];
      const heading = kind === "approval"
        ? `${milestone?.title || "A Stage"} Approved`
        : kind === "changes"
        ? `${milestone?.title || "A Stage"} — Changes Requested`
        : `New Comment on ${milestone?.title || "Your Project"}`;
      notifyTeam(
        heading,
        `${clientFormal()} added a comment on ${milestone?.title || "the project"}. Open the link to view it in the stage thread.`,
        [["Stage", milestone?.title], ["Comment", text]],
        {
          subject: heading,
          ctaUrl: window.GeeslaneMail?.commentLink({
            audience: "team",
            projectId: state.project.id,
            milestoneId,
            noteId: savedNote?.id || ""
          }),
          ctaLabel: "View This Comment"
        }
      );
      addActivity(`${milestone?.title || "Milestone"} update`, text, "milestone");
      renderMilestones();
      renderBrandWorkspace();
      renderRequests();
      renderNextAction();
      renderNotifications();
      toast(kind === "approval" ? `${phaseMeta(milestone).approveLabel} sent` : kind === "changes" ? "Change request sent" : "Note sent");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "The note could not be sent."));
    } finally {
      if (button) window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function renderProjectDetails() {
    const details = [
      ["Project type", displayProjectService()], ["Status", displayProjectStatus()], ["Current stage", state.project.stage || "Discovery"],
      ["Started", formatDate(state.project.startDate, true)], ["Target", formatDate(state.project.targetDate, true)]
    ];
    document.getElementById("project-details").innerHTML = details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  }

  function activityMarkup(items) {
    if (!items.length) return '<div class="request-empty">Nothing here yet. Updates will appear as Geeslane works on your project.</div>';
    return items.map((item) => `<div class="activity-item"><span class="activity-icon">${item.type === "milestone" ? icons.milestone : item.type === "change" ? icons.change : icons.request}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)} · ${relativeDate(item.createdAt)}</p></div></div>`).join("");
  }

  function visibleActivity() {
    return state.activity.filter((item) => !isBootstrapActivity(item, state));
  }

  function renderActivity() {
    const items = visibleActivity();
    document.getElementById("overview-activity").innerHTML = activityMarkup(items.slice(0, 4));
    const link = document.getElementById("overview-activity-link");
    if (link) link.hidden = items.length < 1;
  }

  function setNextActionChrome(needed) {
    const badge = document.getElementById("next-action-badge");
    const eyebrow = document.getElementById("next-action-eyebrow");
    if (badge) badge.hidden = !needed;
    if (eyebrow) eyebrow.textContent = needed ? "Needs your attention" : "Where things stand";
  }

  function renderNextAction() {
    const reviewItem = state.milestones.find((item) => item.status === "review");
    const adminReview = state.milestones.find((item) => item.status === "admin_review");
    const current = state.milestones.find((item) => item.status === "current");
    const body = document.getElementById("next-action-body");

    if (reviewItem) {
      const meta = phaseMeta(reviewItem);
      setNextActionChrome(true);
      body.innerHTML = `<span class="action-icon is-alert">${icons.milestone}</span><h3>${escapeHtml(meta.reviewTitle)}</h3><p>${escapeHtml(meta.reviewCopy)}</p><button class="button button-secondary" type="button">Open ${escapeHtml(reviewItem.title)}</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = reviewItem.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    if (adminReview) {
      const meta = phaseMeta(adminReview);
      setNextActionChrome(false);
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>Geeslane is reviewing ${escapeHtml(adminReview.title)}</h3><p>${escapeHtml(meta.adminCopy)}</p><button class="button button-secondary" type="button">Open ${escapeHtml(adminReview.title)}</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = adminReview.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    if (current && /discover/i.test(current.title)) {
      const meta = phaseMeta(current);
      setNextActionChrome(false);
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>Discovery is in progress</h3><p>${escapeHtml(meta.currentCopy)}</p><button class="button button-secondary" type="button">Open Discovery</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = current.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    if (!hasCustomBrand() || !hasCustomContent()) {
      setNextActionChrome(true);
      body.innerHTML = `<span class="action-icon">${icons.file}</span><h3>Share your Brand &amp; Content</h3><p>Add colours, logos, and copy so Geeslane can begin design work. You can save a draft and return later.</p><button class="button button-secondary" type="button">Open Brand &amp; Content</button>`;
      body.querySelector("button").addEventListener("click", () => navigate("brand"));
      return;
    }

    if (current) {
      const meta = phaseMeta(current);
      setNextActionChrome(false);
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>${escapeHtml(current.title)} is in progress</h3><p>${escapeHtml(meta.currentCopy)}</p><button class="button button-secondary" type="button">Open ${escapeHtml(current.title)}</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = current.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    setNextActionChrome(false);
    body.innerHTML = '<p class="empty-action">Your milestones are complete. Start a new request if you need more work.</p><button class="button button-secondary" type="button" data-open-request>Start a request</button>';
    body.querySelector("button").addEventListener("click", openRequestModal);
  }

  function requestStatusClass(status) { return status === "In review" ? "is-review" : status === "Completed" ? "is-complete" : ""; }
  function requestStatusLabel(status) { return status === "In review" ? "Geeslane reviewing" : status; }
  function requestIcon(type) { return type === "milestone" ? icons.milestone : type === "change" ? icons.change : icons.request; }
  function requestTypeClass(type) { return type === "milestone" ? "is-milestone" : type === "change" ? "is-change" : ""; }

  function requestSnippet(item) {
    const values = item.values || {};
    if (item.type === "milestone") {
      const bits = [values.decision, values.feedback].map((value) => String(value || "").trim()).filter(Boolean);
      return bits.length ? bits.join(" · ") : "Stage review";
    }
    return requestConfigs[item.type]?.shortLabel || "Request";
  }

  function requestRows(items) {
    if (!items.length) return '<div class="request-empty">No requests match this view. Use “New request” to add one.</div>';
    return items.map((item) => `<div class="request-row" role="button" tabindex="0" data-request-id="${escapeHtml(item.id)}"><span class="request-kind-icon ${requestTypeClass(item.type)}">${requestIcon(item.type)}</span><span class="request-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(requestSnippet(item))}</small></span><span class="request-id">${escapeHtml(item.id)}</span><span class="request-date">${formatDate(item.createdAt, true)}</span><span class="request-status ${requestStatusClass(item.status)}">${escapeHtml(requestStatusLabel(item.status))}</span></div>`).join("");
  }

  function renderRequests() {
    const query = (document.getElementById("request-search")?.value || "").toLowerCase();
    const filtered = state.requests.filter((item) => (currentFilter === "all" || item.type === currentFilter) && `${item.title} ${item.id} ${item.status} ${requestSnippet(item)}`.toLowerCase().includes(query));
    document.getElementById("request-history").innerHTML = requestRows(filtered);
    document.getElementById("overview-requests").innerHTML = requestRows(state.requests.slice(0, 3));
    document.querySelectorAll("[data-request-id]").forEach((row) => {
      const open = () => openRequestDetail(row.dataset.requestId);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
  }

  function renderResources() {
    const markup = state.resources.length
      ? state.resources.map((item) => `<div class="resource-row"><div class="resource-name"><span class="resource-icon">${icons.file}</span><strong>${escapeHtml(item.name)}</strong></div><span class="resource-type">${escapeHtml(item.type)}</span><span class="resource-date">${formatDate(item.createdAt, true)}</span><div class="resource-actions">${item.url ? `<a class="icon-button" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(item.name)}">${icons.external}</a>` : ""}<button class="icon-button" type="button" data-delete-resource="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">${icons.trash}</button></div></div>`).join("")
      : '<div class="resource-empty">No resources yet. Add links to documents, designs, previews, or shared folders.</div>';
    ["resource-list", "brand-resource-list"].forEach((id) => {
      const root = document.getElementById(id);
      if (!root) return;
      root.innerHTML = markup;
      root.querySelectorAll("[data-delete-resource]").forEach((button) => button.addEventListener("click", () => {
        const removedId = button.dataset.deleteResource;
        const removed = state.resources.find((item) => item.id === removedId);
        state.resources = state.resources.filter((item) => item.id !== removedId);
        saveState("removeResource", { resourceId: removedId });
        notifyTeam("File removed", `${clientFormal()} removed ${removed?.name || "a file"} from project files.`, [["Item", removed?.name]]);
        renderResources();
        toast("Resource removed");
      }));
    });
  }

  let colourProbe = null;
  function parseColour(value) {
    const raw = String(value || "").trim();
    if (!raw || /^(transparent|currentcolor|inherit|initial|unset|none)$/i.test(raw)) return "";
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      const hex = raw.slice(1);
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
    }
    try {
      colourProbe = colourProbe || document.createElement("canvas").getContext("2d");
      colourProbe.fillStyle = "#123456";
      colourProbe.fillStyle = raw;
      const parsed = String(colourProbe.fillStyle);
      if (parsed === "#123456") return "";
      if (/^#[0-9a-f]{6}$/i.test(parsed)) return parsed.toUpperCase();
      const rgb = parsed.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (!rgb) return "";
      return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    } catch (_) {
      return "";
    }
  }

  function validColour(value, fallback) {
    return parseColour(value) || fallback;
  }

  function renderBrandWorkspace() {
    const brand = state.project.brandKit;
    const content = state.project.content;
    const brandForm = document.getElementById("brand-form");
    const contentForm = document.getElementById("content-form");
    if (!brandForm || !contentForm) return;
    Object.keys(defaultBrandKit()).forEach((key) => { if (brandForm.elements[key]) brandForm.elements[key].value = brand[key] || ""; });
    Object.keys(defaultContent()).forEach((key) => { if (contentForm.elements[key]) contentForm.elements[key].value = content[key] || ""; });
    const colours = {
      primaryColor: validColour(brand.primaryColor, "#0B6B45"),
      secondaryColor: validColour(brand.secondaryColor, "#FFFFFF"),
      accentColor: validColour(brand.accentColor, "#C83B3B")
    };
    document.getElementById("brand-primary-picker").value = colours.primaryColor;
    document.getElementById("brand-secondary-picker").value = colours.secondaryColor;
    document.getElementById("brand-accent-picker").value = colours.accentColor;
    document.getElementById("preview-primary").style.background = colours.primaryColor;
    document.getElementById("preview-secondary").style.background = colours.secondaryColor;
    document.getElementById("preview-accent").style.background = colours.accentColor;
    document.getElementById("brand-preview").style.borderColor = colours.primaryColor;
    document.getElementById("brand-preview-initial").style.background = colours.primaryColor;
    setText("brand-preview-initial", projectInitial(state.profile.business || state.project.name));
    setText("brand-preview-name", state.profile.business || state.project.name || "Your brand");
    setText("brand-preview-personality", brand.personality || "Add your brand personality.");
    const values = Object.values(content);
    const completion = Math.round((values.filter((value) => String(value).trim()).length / values.length) * 100);
    setText("content-completion-value", `${completion}% complete`);
    document.getElementById("content-completion-bar").style.width = `${completion}%`;
    setText("brand-save-status", window.GeeslaneAPI?.isConnected() ? "Synced with project storage" : "Not connected");
    const talk = document.getElementById("brand-conversation");
    const brandStage = state.milestones.find((item) => /brand/i.test(item.title || ""));
    if (talk && brandStage) {
      talk.hidden = false;
      talk.innerHTML = `<p class="eyebrow">Conversation</p><h2>Talk with Geeslane</h2><p class="thread-lead">Questions about colours, logos, and copy stay on this stage. Replies from Geeslane appear here as well.</p>${threadMarkup(brandStage)}`;
      bindThreadForms(talk, sendClientMilestoneNote);
    } else if (talk) talk.hidden = true;
  }

  function renderProjectSwitcher() {
    const select = document.getElementById("project-select");
    if (!select) return;
    const projects = accountProjects.length ? accountProjects : [{ id: state.project.id, name: displayProjectName() }];
    select.innerHTML = projects.map((project) => `<option value="${escapeHtml(project.id)}"${project.id === state.project.id ? " selected" : ""}>${escapeHtml(displayProjectName(project))}</option>`).join("");
    select.hidden = projects.length < 2;
    document.getElementById("sidebar-project-name").hidden = projects.length > 1;
  }

  function safeUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#"; } catch (_) { return "#"; } }

  function renderProfile() {
    setText("profile-display-name", state.profile.name || "Client account");
    setText("profile-display-business", state.profile.business || "Geeslane client");
    setText("member-since", formatDate(state.createdAt, true));
    setText("profile-request-count", state.requests.length);
    const form = document.getElementById("profile-form");
    const person = window.GeeslaneMail?.parsePersonName(state.profile.name) || {};
    if (form.elements.title) form.elements.title.value = person.titleKey || "";
    if (form.elements.name) form.elements.name.value = person.bareName || state.profile.name || "";
    ["business", "email", "phone", "contact"].forEach((key) => { if (form.elements[key]) form.elements[key].value = state.profile[key] || ""; });
  }

  function renderNotifications() {
    const reviewItem = state.milestones.find((item) => item.status === "review");
    const reviewCount = state.requests.filter((item) => item.status === "In review").length;
    const notes = [];
    if (reviewItem) notes.push({ title: phaseMeta(reviewItem).reviewTitle, detail: "Open My Project to reply, approve, or request changes in that stage’s thread." });
    if (reviewCount) notes.push({ title: `${reviewCount} request${reviewCount === 1 ? " is" : "s are"} being reviewed by Geeslane`, detail: "Open Requests to see the full history." });
    if (!notes.length) notes.push({ title: "You’re up to date", detail: "New project updates will appear here." });
    document.getElementById("notification-list").innerHTML = notes.map((note) => `<div class="notification-item"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.detail)}</p></div>`).join("");
    document.getElementById("notification-dot").hidden = !reviewItem && !reviewCount;
  }

  function fieldHtml(field) {
    const required = field.required ? " required" : "";
    const requiredMark = field.required ? " <span>*</span>" : "";
    const wrap = `field${field.full ? " field-full" : ""}`;
    if (field.type === "textarea") return `<div class="${wrap}"><label for="req-${field.name}">${field.label}${requiredMark}</label><textarea id="req-${field.name}" name="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}"${required}></textarea></div>`;
    if (field.type === "select") return `<div class="${wrap}"><label for="req-${field.name}">${field.label}${requiredMark}</label><select id="req-${field.name}" name="${field.name}"${required}><option value="">Choose one</option>${field.options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></div>`;
    if (field.type === "radio") return `<fieldset class="${wrap}"><legend>${field.label}${requiredMark}</legend><div class="choice-group">${field.options.map((option, index) => `<label class="choice-option"><input type="radio" name="${field.name}" value="${escapeHtml(option)}"${field.required && index === 0 ? " required" : ""}><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`;
    return `<div class="${wrap}"><label for="req-${field.name}">${field.label}${requiredMark}</label><input id="req-${field.name}" type="${field.type}" name="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}"${required} /></div>`;
  }

  function openRequestModal(preselect = "") {
    requestFlow = { step: 1, type: "", values: {} };
    document.querySelectorAll("[data-request-type]").forEach((button) => button.classList.remove("is-selected"));
    document.getElementById("request-confirm").checked = false;
    showRequestStep(1);
    openModal("request");
    if (preselect && requestConfigs[preselect]) chooseRequestType(preselect, true);
  }

  function chooseRequestType(type, advance) {
    requestFlow.type = type;
    document.querySelectorAll("[data-request-type]").forEach((button) => button.classList.toggle("is-selected", button.dataset.requestType === type));
    document.getElementById("request-next-button").disabled = false;
    if (advance) { renderRequestForm(); showRequestStep(2); }
  }

  function showRequestStep(step) {
    requestFlow.step = step;
    document.querySelectorAll("[data-request-step]").forEach((view) => view.classList.toggle("is-visible", Number(view.dataset.requestStep) === step));
    document.querySelectorAll("[data-request-step-indicator]").forEach((indicator) => indicator.classList.toggle("is-active", Number(indicator.dataset.requestStepIndicator) <= step));
    const next = document.getElementById("request-next-button");
    next.textContent = step === 3 ? "Add to portal history" : "Continue →";
    next.disabled = step === 1 ? !requestFlow.type : step === 3 ? !document.getElementById("request-confirm").checked : false;
  }

  function renderRequestForm() {
    const config = requestConfigs[requestFlow.type];
    setText("request-details-title", config.title);
    setText("request-details-copy", config.copy);
    document.getElementById("request-fields").innerHTML = config.fields.map(fieldHtml).join("");
    const form = document.getElementById("request-form");
    Object.entries(requestFlow.values).forEach(([key, value]) => {
      const controls = form.querySelectorAll(`[name="${key}"]`);
      if (controls.length > 1) controls.forEach((control) => { control.checked = control.value === value; });
      else if (controls[0]) controls[0].value = value;
    });
    form.addEventListener("change", updateConditionalRequirement);
    updateConditionalRequirement();
  }

  function updateConditionalRequirement() {
    if (requestFlow.type !== "milestone") return;
    const form = document.getElementById("request-form");
    const decision = form.querySelector('[name="decision"]:checked')?.value || "";
    const feedback = form.elements.feedback;
    if (feedback) feedback.required = decision !== "" && decision !== "Approved";
  }

  function collectRequestValues() {
    const data = new FormData(document.getElementById("request-form"));
    const result = {};
    requestConfigs[requestFlow.type].fields.forEach((field) => { result[field.name] = String(data.get(field.name) || "").trim(); });
    return result;
  }

  function validateRequestForm() {
    updateConditionalRequirement();
    const form = document.getElementById("request-form");
    const valid = form.checkValidity();
    form.querySelectorAll("input, select, textarea").forEach((control) => control.setAttribute("aria-invalid", control.checkValidity() ? "false" : "true"));
    document.getElementById("request-form-error").hidden = valid;
    if (!valid) form.querySelector(":invalid")?.focus();
    return valid;
  }

  function requestTitle(type, values) {
    if (type === "discovery") return values.projectName || "New project brief";
    if (type === "milestone") return `${values.milestone || "Milestone"} review`;
    return values.changeTitle || "Change request";
  }

  function formatFieldValue(field, value) { return field.type === "date" ? formatDate(value) : value; }

  function renderRequestReview() {
    const config = requestConfigs[requestFlow.type];
    setText("review-request-label", config.label);
    setText("review-request-title", requestTitle(requestFlow.type, requestFlow.values));
    document.getElementById("request-review-list").innerHTML = config.fields.filter((field) => requestFlow.values[field.name]).map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(formatFieldValue(field, requestFlow.values[field.name]))}</dd></div>`).join("");
    document.getElementById("request-confirm").checked = false;
  }

  function submitRequest() {
    const nextNumber = state.requests.reduce((max, item) => Math.max(max, Number(String(item.id).replace(/\D/g, "")) || 100), 100) + 1;
    const request = { id: `GL-${nextNumber}`, type: requestFlow.type, title: requestTitle(requestFlow.type, requestFlow.values), status: "Received", createdAt: new Date().toISOString(), values: { ...requestFlow.values } };
    state.requests.unshift(request);
    addActivity(`${requestConfigs[request.type].shortLabel} added`, request.title, request.type);
    if (request.type === "discovery") {
      state.project.name = request.values.projectName || state.project.name;
      state.project.service = request.values.projectType || state.project.service;
      state.project.targetDate = request.values.targetDate || state.project.targetDate;
      state.project.brandKit.personality = request.values.brandStyle || state.project.brandKit.personality;
      const colours = String(request.values.brandColours || "").match(/#[0-9a-f]{6}/ig) || [];
      if (colours[0]) state.project.brandKit.primaryColor = colours[0].toUpperCase();
      if (colours[1]) state.project.brandKit.secondaryColor = colours[1].toUpperCase();
      if (colours[2]) state.project.brandKit.accentColor = colours[2].toUpperCase();
      if (request.values.assetFolder) state.resources.unshift({ id: uid("R"), name: "Existing brand assets", url: request.values.assetFolder, type: "Shared folder", createdAt: request.createdAt });
    }
    saveState("createRequest", { request });
    notifyTeam("New request received", `${clientFormal()} submitted a ${requestConfigs[request.type].shortLabel}. It is in Requests & Approvals.`, [
      ["Request", request.title],
      ["Type", requestConfigs[request.type].label]
    ]);
    closeModal("request");
    renderAll();
    navigate("requests");
    toast(`${request.id} added to portal history`);
  }

  function advanceMilestone(name) {
    let index = state.milestones.findIndex((item) => item.status === "current" || item.title.toLowerCase() === String(name).toLowerCase());
    if (index < 0) return;
    state.milestones[index].status = "complete";
    if (state.milestones[index + 1]) state.milestones[index + 1].status = "current";
    state.project.progress = calculateProgress();
    state.project.stage = state.milestones.find((item) => item.status === "current")?.title || "Launch";
  }

  function openRequestDetail(id) {
    const item = state.requests.find((request) => request.id === id);
    if (!item) return;
    const config = requestConfigs[item.type] || { label: "Request", fields: [] };
    const values = item.values || {};
    setText("detail-kicker", config.label);
    setText("detail-title", item.title);
    setText("detail-status", requestStatusLabel(item.status));
    setText("detail-date", formatDate(item.createdAt));
    document.getElementById("detail-status").className = `request-status ${requestStatusClass(item.status)}`;
    const known = new Set((config.fields || []).map((field) => field.name));
    const rows = (config.fields || []).filter((field) => values[field.name]).map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(formatFieldValue(field, values[field.name]))}</dd></div>`);
    Object.entries(values).forEach(([key, value]) => {
      if (known.has(key) || !String(value || "").trim()) return;
      rows.push(`<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`);
    });
    document.getElementById("detail-list").innerHTML = rows.join("") || '<p class="table-empty">No extra details were saved with this request.</p>';
    openModal("detail");
  }

  function handleRequestNext() {
    if (requestFlow.step === 1) { if (!requestFlow.type) return; renderRequestForm(); showRequestStep(2); return; }
    if (requestFlow.step === 2) { if (!validateRequestForm()) return; requestFlow.values = collectRequestValues(); renderRequestReview(); showRequestStep(3); return; }
    if (requestFlow.step === 3 && document.getElementById("request-confirm").checked) submitRequest();
  }

  function openResourceModal() { const form = document.getElementById("resource-form"); form.reset(); document.getElementById("resource-error").hidden = true; openModal("resource"); }

  function saveResource() {
    const form = document.getElementById("resource-form");
    const valid = form.checkValidity();
    form.querySelectorAll("input, select").forEach((control) => control.setAttribute("aria-invalid", control.checkValidity() ? "false" : "true"));
    document.getElementById("resource-error").hidden = valid;
    if (!valid) return;
    const data = new FormData(form);
    const resource = { id: uid("R"), name: String(data.get("name")).trim(), url: String(data.get("url")).trim(), type: String(data.get("type")), createdAt: new Date().toISOString() };
    state.resources.unshift(resource);
    addActivity("Resource added", String(data.get("name")).trim(), "request");
    saveState("addResource", { resource }); closeModal("resource"); renderAll(); toast("Resource added");
    notifyTeam("File added", `${clientFormal()} added ${resource.name} to project files.`, [["Item", resource.name], ["Type", resource.type]]);
  }

  function openProjectModal() {
    const form = document.getElementById("project-form");
    form.elements.name.value = state.project.name;
    form.elements.service.value = state.project.service;
    form.elements.stage.value = state.project.stage;
    form.elements.progress.value = state.project.progress;
    form.elements.targetDate.value = state.project.targetDate || "";
    setText("project-progress-output", `${state.project.progress}%`);
    openModal("project");
  }

  function saveProject() {
    const form = document.getElementById("project-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    state.project = { ...state.project, name: String(data.get("name")).trim(), service: String(data.get("service")).trim(), targetDate: String(data.get("targetDate")) };
    addActivity("Project details updated", `${state.project.stage} · ${state.project.progress}% complete`, "milestone");
    saveState("updateProject", { project: state.project }); closeModal("project"); renderAll(); toast("Project updated");
    notifyTeam("Project details updated", `${clientFormal()} updated the project details.`, [
      ["Name", state.project.name],
      ["Type", state.project.service],
      ["Target", formatDate(state.project.targetDate)]
    ]);
  }

  function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    state.profile = {
      name: window.GeeslaneMail?.composePersonName(data.get("title"), data.get("name")) || String(data.get("name")).trim(),
      business: String(data.get("business")).trim(),
      email: state.profile.email,
      phone: String(data.get("phone")).trim(),
      contact: String(data.get("contact"))
    };
    addActivity("Profile updated", "Contact details were updated.", "request");
    saveState("updateProfile", { profile: state.profile }); renderAll(); setText("profile-save-status", "Saved"); toast("Profile changes saved");
    notifyTeam("Contact details updated", `${clientFormal()} updated their contact details.`, [
      ["Phone", state.profile.phone],
      ["Contact", state.profile.contact]
    ]);
    setTimeout(() => setText("profile-save-status", ""), 2500);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `geeslane-client-data-${todayISO()}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast("Portal data exported");
  }

  function notifyTeam(heading, intro, rows, extras = {}) {
    window.GeeslaneMail?.notify({
      audience: "team",
      subject: extras.subject || `${heading} · ${extras.business || state.profile.business || displayProjectName()}`,
      heading,
      intro,
      rows: extras.skipIdentity ? (rows || []) : [
        ["Client", extras.client || state.profile.name || clientFirst()],
        ["Business", extras.business || state.profile.business],
        ["Project", extras.project || displayProjectName()],
        ...(rows || [])
      ],
      fromName: extras.client || clientFormal(),
      replyTo: extras.email || state.profile.email || window.GEESLANE_CONFIG?.supportEmail,
      ctaPage: extras.ctaPage || "admin",
      ctaUrl: extras.ctaUrl,
      ctaLabel: extras.ctaLabel || "Open Admin Portal"
    });
  }

  function saveBrand(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const brand = { ...defaultBrandKit() };
    Object.keys(brand).forEach((key) => { brand[key] = String(data.get(key) || "").trim(); });
    brand.primaryColor = parseColour(brand.primaryColor) || document.getElementById("brand-primary-picker").value.toUpperCase() || "#0B6B45";
    brand.secondaryColor = parseColour(brand.secondaryColor) || document.getElementById("brand-secondary-picker").value.toUpperCase() || "#FFFFFF";
    brand.accentColor = parseColour(brand.accentColor) || document.getElementById("brand-accent-picker").value.toUpperCase() || "#C83B3B";
    state.project.brandKit = brand;
    if (hasCustomBrand(brand)) addActivity("Brand Identity updated", "Colours, type, or style guidance changed.", "request");
    saveState("saveBrandKit", { brandKit: brand });
    notifyTeam("Brand identity saved", `${clientFormal()} saved brand identity details.`, [
      ["Colours", [brand.primaryColor, brand.secondaryColor, brand.accentColor].filter(Boolean).join(" · ")],
      ["Fonts", [brand.headingFont, brand.bodyFont].filter(Boolean).join(" / ")]
    ]);
    renderAll();
    toast("Brand Identity saved. Geeslane has been notified.");
  }

  function saveContent(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const content = { ...defaultContent() };
    Object.keys(content).forEach((key) => { content[key] = String(data.get(key) || "").trim(); });
    state.project.content = content;
    if (hasCustomContent(content)) addActivity("Website Content updated", "Project copy and content notes changed.", "request");
    saveState("saveContent", { content });
    notifyTeam("Website content saved", `${clientFormal()} saved website content.`, [
      ["Headline", content.headline],
      ["Call to action", content.callToAction]
    ]);
    renderAll();
    toast("Website Content saved. Geeslane has been notified.");
  }

  function showBrandTab(tab) {
    document.querySelectorAll("[data-brand-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.brandTab === tab));
    document.querySelectorAll("[data-brand-section]").forEach((section) => section.classList.toggle("is-visible", section.dataset.brandSection === tab));
  }

  function connectColourPair(pickerId, textId, fallback) {
    const picker = document.getElementById(pickerId);
    const textInput = document.getElementById(textId);
    const commitName = () => {
      const hex = parseColour(textInput.value) || picker.value.toUpperCase() || fallback;
      picker.value = hex;
      textInput.value = hex;
      previewBrandForm();
    };
    picker.addEventListener("input", () => { textInput.value = picker.value.toUpperCase(); previewBrandForm(); });
    textInput.addEventListener("input", () => {
      const hex = parseColour(textInput.value);
      if (hex) picker.value = hex;
      previewBrandForm();
    });
    textInput.addEventListener("blur", commitName);
    textInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); commitName(); }
    });
  }

  function previewBrandForm() {
    const form = document.getElementById("brand-form");
    const primary = parseColour(form.elements.primaryColor.value) || document.getElementById("brand-primary-picker").value || "#0B6B45";
    const secondary = parseColour(form.elements.secondaryColor.value) || document.getElementById("brand-secondary-picker").value || "#FFFFFF";
    const accent = parseColour(form.elements.accentColor.value) || document.getElementById("brand-accent-picker").value || "#C83B3B";
    document.getElementById("preview-primary").style.background = primary;
    document.getElementById("preview-secondary").style.background = secondary;
    document.getElementById("preview-accent").style.background = accent;
    document.getElementById("brand-preview").style.borderColor = primary;
    document.getElementById("brand-preview-initial").style.background = primary;
    setText("brand-preview-personality", form.elements.personality.value.trim() || "Add your brand personality.");
  }

  function openUploadForm() {
    if (window.GeeslaneAPI?.isConnected()) { document.getElementById("brand-file-input").click(); return; }
    toast("File uploads will activate after Supabase is connected");
  }

  async function uploadSelectedFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const oversized = files.find((file) => file.size > 20 * 1024 * 1024);
    if (oversized) { toast(`${oversized.name} is larger than the 20 MB portal limit`); return; }
    toast(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);
    try {
      for (const file of files) {
        const resource = await window.GeeslaneAPI.uploadFile(state.project.id, file);
        state.resources.unshift(resource);
      }
      addActivity("Project files uploaded", `${files.length} file${files.length === 1 ? "" : "s"} added to project storage.`, "request");
      saveState();
      notifyTeam("Files uploaded", `${clientFormal()} uploaded ${files.length} file${files.length === 1 ? "" : "s"} to project files.`, [
        ["Files", files.map((file) => file.name).slice(0, 4).join(", ")]
      ]);
      renderAll(); toast("Project files uploaded");
    } catch (_) {
      toast("Upload failed; no files were removed from your device");
    }
  }

  function isAccessRoute() {
    return new URLSearchParams(location.search).get("access") === "1";
  }

  function rememberedEmail() {
    try { return String(localStorage.getItem(LAST_EMAIL_KEY) || "").trim(); }
    catch (_) { return ""; }
  }

  function rememberEmail(email) {
    pendingSignInEmail = String(email || "").trim().toLowerCase();
    try { if (pendingSignInEmail) localStorage.setItem(LAST_EMAIL_KEY, pendingSignInEmail); }
    catch (_) { /* private mode */ }
  }

  function showAuthPanel(name, { updateUrl = true } = {}) {
    document.getElementById("signin-panel").classList.toggle("is-visible", name === "signin");
    document.getElementById("code-panel").classList.toggle("is-visible", name === "code");
    document.getElementById("access-panel").classList.toggle("is-visible", name === "access");
    document.getElementById("auth-card").classList.toggle("is-access", name === "access");
    document.getElementById("auth-feedback").hidden = true;
    if (name === "code") {
      const email = pendingSignInEmail || rememberedEmail() || "your email";
      const label = document.getElementById("code-email-label");
      if (label) label.textContent = email;
    }
    if (updateUrl) {
      const url = new URL(location.href);
      if (name === "access") url.searchParams.set("access", "1");
      else url.searchParams.delete("access");
      history.pushState({ auth: name }, "", url);
    }
    const focusId = name === "access" ? "access-title" : "signin-email";
    setTimeout(() => {
      if (name === "code") document.querySelector("#signin-code-boxes .code-box")?.focus();
      else document.getElementById(focusId)?.focus();
    }, 30);
  }

  function authFeedback(message, type = "success") {
    const feedback = document.getElementById("auth-feedback");
    feedback.textContent = message;
    feedback.className = `auth-feedback is-${type}`;
    feedback.hidden = false;
  }

  function showPortal() {
    document.getElementById("auth-screen").hidden = true;
    document.getElementById("portal-app").hidden = false;
    document.getElementById("mobile-nav").hidden = false;
    const identity = window.GeeslaneAPI.currentUser();
    document.getElementById("admin-link").hidden = identity?.role !== "admin";
  }

  function showSignedOut() {
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("portal-app").hidden = true;
    document.getElementById("mobile-nav").hidden = true;
  }

  async function hydrateRemoteProject(projectId = "") {
    if (!window.GeeslaneAPI?.isConnected()) throw new Error("Private portal access is required");
    const response = await window.GeeslaneAPI.readProject(projectId);
    const remote = response?.workspace || response;
    if (!remote?.project) throw new Error("No project workspace is available for this account");
    accountProjects = Array.isArray(response?.projects) ? response.projects : accountProjects;
    state = normalizeState({ ...createEmptyState(), ...remote });
    state.initialized = true;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    return response;
  }

  async function completeClientSignIn() {
    const session = await window.GeeslaneAPI.getSession();
    accountProjects = Array.isArray(session.projects) ? session.projects : [];
    const clientView = new URLSearchParams(location.search).get("clientView") === "1";
    if (session.user?.role === "admin" && session.user?.status === "active" && !clientView) {
      location.replace(window.GeeslaneAPI.adminSignInRedirect());
      return false;
    }
    if (session.user?.role !== "admin" && !accountProjects.length) {
      await window.GeeslaneAPI.logout();
      showSignedOut();
      showAuthPanel("signin", { updateUrl: false });
      authFeedback("Your account is awaiting Geeslane approval. You will receive an email when your project workspace is ready.", "notice");
      return false;
    }
    await hydrateRemoteProject();
    showPortal();
    restoreCommentRoute();
    const route = parsePortalHash();
    navigate(pageNames[route.page] ? route.page : "overview", { keepHash: true });
    applyCommentLink();
    return true;
  }

  async function sendClientCode(email, button) {
    const address = String(email || "").trim();
    if (!address) { authFeedback("Enter a valid email address.", "error"); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending code…");
    try {
      await window.GeeslaneAPI.requestMagicLink(address, "client");
      rememberEmail(address);
      const emailInput = document.getElementById("signin-email");
      if (emailInput) emailInput.value = address;
      showAuthPanel("code");
      window.GeeslaneAPI.clearCodeBoxes(document.getElementById("signin-code-boxes"));
      authFeedback("Check your inbox — and spam if it is not there in a minute.");
      window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      const resend = document.getElementById("resend-code");
      if (resend && resend !== button) window.GeeslaneAPI.startMagicLinkCooldown(resend, 60);
    } catch (error) {
      authFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "The sign-in email could not be sent. Please try again."), "error");
      if (window.GeeslaneAPI.isRateLimitError(error)) window.GeeslaneAPI.startMagicLinkCooldown(button, 60);
      else window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function requestSignIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    await sendClientCode(String(new FormData(form).get("email") || "").trim(), form.querySelector("button[type=submit]"));
  }

  async function submitSignInCode(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = window.GeeslaneAPI.codeFromBoxes(document.getElementById("signin-code-boxes"));
    const email = pendingSignInEmail || document.getElementById("signin-email")?.value || rememberedEmail();
    const button = form.querySelector("button[type=submit]");
    if (!/^\d{6}$/.test(code)) { authFeedback("Enter the 6-digit code from your email.", "error"); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Opening your portal…");
    try {
      await window.GeeslaneAPI.verifySignInCode(email, code);
      await completeClientSignIn();
    } catch (error) {
      authFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "That code could not be verified. Try again, or send a new one."), "error");
      window.GeeslaneAPI.setButtonBusy(button, false);
      document.querySelector("#signin-code-boxes .code-box")?.focus();
    }
  }

  async function requestAccess(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const details = {
      name: window.GeeslaneMail?.composePersonName(data.get("title"), data.get("name")) || String(data.get("name") || "").trim(),
      business: String(data.get("business") || "").trim(),
      email: String(data.get("email") || "").trim(), phone: String(data.get("phone") || "").trim(),
      contact: String(data.get("contact") || "Email"), service: String(data.get("service") || "").trim(),
      description: String(data.get("description") || "").trim()
    };
    const missing = String(details.name || "").trim().length < 2 ? "Enter your full name."
      : String(details.business || "").trim().length < 2 ? "Enter your business or brand name."
      : String(details.email || "").trim().indexOf("@") < 1 ? "Enter a valid email address."
      : String(details.service || "").trim().length < 2 ? "Choose what you need."
      : String(details.description || "").trim().length < 5 ? "Write a short project summary (at least a few words)."
      : "";
    if (missing) { authFeedback(missing, "error"); return; }
    const button = form.querySelector("button[type=submit]");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      await window.GeeslaneAPI.requestAccess(details);
      const who = window.GeeslaneMail?.respectfulName(details.name) || details.name || "Someone";
      notifyTeam("Access request received", `${who} from ${details.business} requested portal access.`, [
        ["Service", details.service],
        ["Summary", details.description.slice(0, 180)]
      ], { client: details.name, business: details.business, email: details.email, project: details.business, subject: `Access Request · ${details.business}` });
      form.reset();
      authFeedback("Your request has been sent for review. Geeslane will email you after your client workspace is approved.");
    } catch (error) {
      const message = error.userMessage || window.GeeslaneAPI.userFacingError(error, "The access request could not be sent. Please try again.");
      const existingAccount = /already has a Geeslane|sign in instead/i.test(`${message} ${error?.message || ""} ${error?.cause?.message || ""}`);
      if (existingAccount) {
        const emailInput = document.getElementById("signin-email");
        if (emailInput) emailInput.value = details.email;
        showAuthPanel("signin");
        authFeedback("This email already has a Geeslane account. Sign in with it instead of requesting access again.", "notice");
      } else {
        authFeedback(message, "error");
      }
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function signOut() {
    await window.GeeslaneAPI.logout();
    sessionStorage.removeItem(STORAGE_KEY);
    state = createEmptyState();
    accountProjects = [];
    showSignedOut();
    showAuthPanel("signin");
    authFeedback("You have signed out.");
  }

  async function switchProject(event) {
    const projectId = event.target.value;
    if (!projectId || projectId === state.project.id) return;
    event.target.disabled = true;
    try {
      await hydrateRemoteProject(projectId);
      navigate("overview");
      toast("Project switched");
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not switch project."));
      renderProjectSwitcher();
    } finally {
      event.target.disabled = false;
    }
  }

  function wireEvents() {
    document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
    document.querySelectorAll("[data-go-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.goPage)));
    document.querySelectorAll("[data-open-request]").forEach((button) => button.addEventListener("click", () => openRequestModal()));
    document.getElementById("top-new-request").addEventListener("click", () => openRequestModal());
    document.getElementById("menu-button").addEventListener("click", openSidebar);
    document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
    document.getElementById("sidebar-scrim").addEventListener("click", closeSidebar);
    document.getElementById("notification-button").addEventListener("click", () => { const popover = document.getElementById("notification-popover"); popover.hidden = !popover.hidden; });
    document.getElementById("notification-close").addEventListener("click", () => { document.getElementById("notification-popover").hidden = true; });
    document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) closeModal(backdrop.id.replace("-modal", "")); }));
    document.querySelectorAll("[data-request-type]").forEach((button) => button.addEventListener("click", () => chooseRequestType(button.dataset.requestType, true)));
    document.querySelectorAll("[data-request-back]").forEach((button) => button.addEventListener("click", () => showRequestStep(Number(button.dataset.requestBack))));
    document.getElementById("request-next-button").addEventListener("click", handleRequestNext);
    document.getElementById("request-confirm").addEventListener("change", (event) => { document.getElementById("request-next-button").disabled = !event.target.checked; });
    document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { currentFilter = button.dataset.filter; document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("is-active", tab === button)); renderRequests(); }));
    document.getElementById("request-search").addEventListener("input", renderRequests);
    document.getElementById("add-resource-button").addEventListener("click", openResourceModal);
    document.getElementById("brand-add-resource").addEventListener("click", openResourceModal);
    document.getElementById("save-resource-button").addEventListener("click", saveResource);
    document.getElementById("edit-project-button").addEventListener("click", openProjectModal);
    document.getElementById("manage-brand-button").addEventListener("click", () => navigate("brand"));
    document.getElementById("project-edit-progress").addEventListener("input", (event) => setText("project-progress-output", `${event.target.value}%`));
    document.getElementById("save-project-button").addEventListener("click", saveProject);
    document.getElementById("profile-form").addEventListener("submit", saveProfile);
    document.getElementById("brand-form").addEventListener("submit", saveBrand);
    document.getElementById("content-form").addEventListener("submit", saveContent);
    document.getElementById("brand-form").addEventListener("input", previewBrandForm);
    document.querySelectorAll("[data-brand-tab]").forEach((button) => button.addEventListener("click", () => showBrandTab(button.dataset.brandTab)));
    connectColourPair("brand-primary-picker", "brand-primary", "#0B6B45");
    connectColourPair("brand-secondary-picker", "brand-secondary", "#FFFFFF");
    connectColourPair("brand-accent-picker", "brand-accent", "#C83B3B");
    document.getElementById("open-upload-form").addEventListener("click", openUploadForm);
    document.getElementById("brand-file-input").addEventListener("change", uploadSelectedFiles);
    document.getElementById("export-data-button").addEventListener("click", exportData);
    document.getElementById("show-access-button").addEventListener("click", (event) => {
      event.preventDefault();
      showAuthPanel("access");
    });
    document.getElementById("back-to-signin").addEventListener("click", (event) => {
      event.preventDefault();
      showAuthPanel("signin");
    });
    document.getElementById("signin-form").addEventListener("submit", requestSignIn);
    document.getElementById("code-form").addEventListener("submit", submitSignInCode);
    window.GeeslaneAPI.bindCodeBoxes(document.getElementById("signin-code-boxes"), () => {
      const submit = document.querySelector("#code-form button[type=submit]");
      if (submit && !submit.disabled) document.getElementById("code-form").requestSubmit();
    });
    document.getElementById("resend-code").addEventListener("click", () => {
      sendClientCode(pendingSignInEmail || document.getElementById("signin-email")?.value || rememberedEmail(), document.getElementById("resend-code"));
    });
    document.getElementById("change-signin-email").addEventListener("click", () => showAuthPanel("signin"));
    document.getElementById("access-form").addEventListener("submit", requestAccess);
    document.getElementById("signout-button").addEventListener("click", signOut);
    document.getElementById("project-select").addEventListener("change", switchProject);
    window.addEventListener("hashchange", () => {
      const route = parsePortalHash();
      navigate(pageNames[route.page] ? route.page : "overview", { keepHash: true, silent: true });
      applyCommentLink();
    });
    window.addEventListener("popstate", () => {
      if (document.getElementById("auth-screen").hidden) return;
      showAuthPanel(isAccessRoute() ? "access" : "signin", { updateUrl: false });
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { document.querySelectorAll(".modal-backdrop:not([hidden])").forEach((modal) => closeModal(modal.id.replace("-modal", ""))); document.getElementById("notification-popover").hidden = true; closeSidebar(); } });
  }

  async function init() {
    rememberCommentRoute();
    loadState();
    wireEvents();
    const supportEmail = window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com";
    document.getElementById("support-link").href = `mailto:${supportEmail}`;
    showSignedOut();
    const savedEmail = rememberedEmail();
    if (savedEmail) {
      pendingSignInEmail = savedEmail.toLowerCase();
      const emailInput = document.getElementById("signin-email");
      if (emailInput) emailInput.value = savedEmail;
    }
    showAuthPanel(isAccessRoute() ? "access" : "signin", { updateUrl: false });
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    if (!window.GeeslaneAPI.backendConfigured()) {
      authFeedback("Portal sign-in will activate after SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are added to .env.", "notice");
      return;
    }
    const signingIn = window.GeeslaneAPI.hasIncomingMagicLink();
    if (signingIn) window.GeeslaneAPI.showLoader("Signing you in…");
    try {
      const authSession = await window.GeeslaneAPI.consumeMagicLink();
      if (authSession) await completeClientSignIn();
    } catch (error) {
      try { await window.GeeslaneAPI.logout(); } catch (_) { /* signed-out UI still continues */ }
      sessionStorage.removeItem(STORAGE_KEY);
      showSignedOut();
      showAuthPanel(isAccessRoute() ? "access" : "signin", { updateUrl: false });
      authFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Sign-in could not be completed. Enter a new code from your email."), "error");
    } finally {
      if (signingIn) window.GeeslaneAPI.hideLoader();
    }
  }

  init();
})();
