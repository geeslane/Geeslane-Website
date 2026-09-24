(function () {
  "use strict";

  /* Client portal: sign-in, project workspace, payments, requests. Shared table UI lives in ui.js. */

  const STORAGE_KEY = "geeslane-client-hub-v3-session";
  const LAST_EMAIL_KEY = "geeslane-portal-email";
  const LAST_PROJECT_KEY = "geeslane-open-project-id";
  const TOUR_KEY = "geeslane-portal-tour";
  let pendingSignInEmail = "";
  let tourIndex = 0;
  let tourActive = false;
  const pageNames = { chooser: "Your Projects", overview: "Overview", project: "My Project", brand: "Brief & Brand", agreement: "Agreement", payments: "Payments", requests: "Requests", profile: "Profile" };
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
      label: "New Project",
      shortLabel: "New Project",
      title: "Start Another Project",
      copy: "This opens a separate project. The one you have now stays in your list.",
      fields: [
        { name: "projectName", label: "Project Name", type: "text", placeholder: "e.g. Product landing page", required: true },
        { name: "projectType", label: "What do you need?", type: "select", required: true, options: ["Landing Page", "Portfolio Website", "Business Website", "Website Revamp", "AI Automation", "Consultation", "Something Else"] },
        { name: "goal", label: "What should this help you achieve?", type: "textarea", placeholder: "Describe the main outcome...", required: true, full: true },
        { name: "audience", label: "Who is it for?", type: "text", placeholder: "Ideal customers or users", required: true, full: true },
        { name: "mustHaves", label: "What must be included?", type: "textarea", placeholder: "Pages, features, content, integrations...", required: true, full: true },
        { name: "brandColours", label: "Brand Colours", type: "text", placeholder: "e.g. #0B6B45, white, restrained red" },
        { name: "brandStyle", label: "Brand Style", type: "text", placeholder: "e.g. Professional, simple, confident" },
        { name: "contentStatus", label: "Content Readiness", type: "select", options: ["Ready to Add", "Partly Ready", "Need Help Creating It", "Not Started"] },
        { name: "assetFolder", label: "Existing Logo or Media Folder", type: "url", placeholder: "https://...", full: true },
        { name: "reference", label: "Reference Link", type: "url", placeholder: "https://..." }
      ]
    },
    milestone: {
      label: "Milestone Review",
      shortLabel: "Approval",
      title: "Review This Stage",
      copy: "Approve it, or say what should change.",
      fields: [
        { name: "milestone", label: "Milestone", type: "select", required: true, options: ["Discovery", "Brand Assets & Content", "Wireframe", "Visual Design", "Development", "QA & Testing", "Launch & Handover", "Other"] },
        { name: "decision", label: "Your Decision", type: "radio", required: true, full: true, options: ["Approved", "Approved with Notes", "Changes Requested"] },
        { name: "feedback", label: "Feedback or Notes", type: "textarea", placeholder: "What works well, and what needs attention?", full: true, conditional: true },
        { name: "reviewLink", label: "Reviewed Work Link", type: "url", placeholder: "https://...", full: true }
      ]
    },
    change: {
      label: "Change Request",
      shortLabel: "Change",
      title: "Describe the Change",
      copy: "Say what should change, and why.",
      fields: [
        { name: "changeTitle", label: "Short Change Title", type: "text", placeholder: "e.g. Update the pricing section", required: true },
        { name: "priority", label: "Priority", type: "radio", required: true, full: true, options: ["Standard", "Time-Sensitive", "Blocking Progress"] },
        { name: "details", label: "What should change?", type: "textarea", placeholder: "Describe the current state and the exact change...", required: true, full: true },
        { name: "reason", label: "Why is it needed?", type: "textarea", placeholder: "Add useful business context.", full: true },
        { name: "reference", label: "Reference Link", type: "url", placeholder: "https://..." }
      ]
    }
  };

  let state = createEmptyState();
  let currentPage = "overview";
  let currentFilter = "all";
  let requestFlow = { step: 1, type: "", values: {} };
  let accountProjects = [];
  let pendingWorkspacePage = "";
  let portalSettings = { bankName: "", accountName: "", accountNumber: "", bankNotes: "" };
  let toastTimer = null;
  let openMilestoneId = "";

  function createEmptyState() {
    return {
      initialized: false,
      createdAt: "",
      profile: { name: "", business: "", email: "", phone: "", contact: "Email" },
      project: {
        id: "", name: "", service: "", stage: "Discovery", progress: 0,
        startDate: "", targetDate: "", status: "Not Started",
        hasWireframe: true, hasVisualDesign: true, isActive: true,
        brandKit: defaultBrandKit(), content: defaultContent(), brief: defaultBrief()
      },
      milestones: defaultMilestones(0),
      requests: [],
      resources: [],
      activity: [],
      messages: [],
      invoices: [],
      receipts: []
    };
  }

  function defaultMilestones(completedCount, service) {
    const items = window.GeeslaneAPI?.milestoneTemplates?.(service) || [
      ["M1", "Discovery", "What the project needs, and who it is for.", 10],
      ["M2", "Brand Assets & Content", "Logos, colours, photos, and copy.", 15],
      ["M3", "Wireframe", "How the pages are laid out.", 15],
      ["M4", "Visual Design", "How the site looks.", 20],
      ["M5", "Development", "Building the site.", 25],
      ["M6", "QA & Testing", "Final check before launch.", 10],
      ["M7", "Launch & Handover", "Go live and hand over.", 5]
    ];
    return items.map((item, index) => ({
      id: item[0],
      title: item[1],
      description: item[2],
      weight: item[3],
      status: index < completedCount ? "complete" : index === completedCount ? "current" : "upcoming"
    }));
  }

  function phaseMeta(item) {
    const title = String(item?.title || "").toLowerCase();
    if (/discover/.test(title)) return {
      reviewTitle: "Discovery Needs Your Answers",
      reviewCopy: "Geeslane has questions. Reply here.",
      adminCopy: "Geeslane is reading your Discovery notes.",
      currentCopy: "Fill in the short brief under Brief & Brand. Extra questions stay here.",
      emailIntro: "Please answer the Discovery questions in Brief & Brand in your portal.",
      approveLabel: "Confirm the Brief",
      changesLabel: "Need to Clarify"
    };
    if (/brand/.test(title)) return {
      reviewTitle: "Brand & Content Is Ready to Check",
      reviewCopy: "Check colours, logos, and copy. Approve, or say what to change.",
      adminCopy: "Geeslane is reading your Brand & Content notes.",
      currentCopy: "Add logos and copy in Brief & Brand. Message Geeslane here.",
      emailIntro: "Please check Brief & Brand in your portal.",
      approveLabel: "Approve Brand",
      changesLabel: "Ask for Brand Changes"
    };
    if (/wire/.test(title)) return {
      reviewTitle: "Wireframes Are Ready to Check",
      reviewCopy: "Check the page layout. Approve, or say what to change.",
      adminCopy: "Geeslane is reading your wireframe notes.",
      currentCopy: "Wireframes are being prepared. Ask layout questions here.",
      emailIntro: "Wireframes are ready. Please check the layout in your portal.",
      approveLabel: "Approve Wireframes",
      changesLabel: "Ask for Wireframe Changes"
    };
    if (/visual|design/.test(title) && !/build|connect/.test(title)) return {
      reviewTitle: "The Design Is Ready to Check",
      reviewCopy: "Check how it looks. Approve, or say what to change.",
      adminCopy: "Geeslane is reading your design notes.",
      currentCopy: "Design is underway. Ask design questions here.",
      emailIntro: "The design is ready. Please leave notes in your portal.",
      approveLabel: "Approve Design",
      changesLabel: "Ask for Design Changes"
    };
    if (/build|connect/.test(title)) return {
      reviewTitle: "The Workflow Is Ready to Check",
      reviewCopy: "Try the automation with a real example, then approve or note what to change.",
      adminCopy: "Geeslane is reading your build notes.",
      currentCopy: "The workflow is being built and connected. Ask questions here.",
      emailIntro: "The workflow is ready to try. Please check it in your portal.",
      approveLabel: "Approve the Workflow",
      changesLabel: "Ask for Changes"
    };
    if (/setup|fix/.test(title)) return {
      reviewTitle: "Setup Is Ready to Check",
      reviewCopy: "Confirm the setup or repair is working, or say what is still wrong.",
      adminCopy: "Geeslane is reading your setup notes.",
      currentCopy: "Setup is in progress. Note anything that still needs work.",
      emailIntro: "Please check that the setup is working, then approve or list what is left.",
      approveLabel: "Approve Setup",
      changesLabel: "List Remaining Issues"
    };
    if (/recommend/.test(title)) return {
      reviewTitle: "The Recommendation Is Ready",
      reviewCopy: "Read the advice and say if you want to go ahead, or ask a question.",
      adminCopy: "Geeslane is reading your notes on the recommendation.",
      currentCopy: "Geeslane is preparing the recommendation. Questions stay here.",
      emailIntro: "The recommendation is ready. Please review it in your portal.",
      approveLabel: "Accept the Advice",
      changesLabel: "Ask a Question"
    };
    if (/develop/.test(title)) return {
      reviewTitle: "A Preview Is Ready to Check",
      reviewCopy: "Open the preview, try the site, then approve or report issues.",
      adminCopy: "Geeslane is reading your development notes.",
      currentCopy: "The site is being built. Tell us if you notice something.",
      emailIntro: "A preview is ready. Please try it and note any issues in your portal.",
      approveLabel: "Approve the Build",
      changesLabel: "Report Issues"
    };
    if (/qa|test/.test(title)) return {
      reviewTitle: "Final Check Before Launch",
      reviewCopy: "Approve to go live, or list what is still wrong.",
      adminCopy: "Geeslane is reading your QA notes.",
      currentCopy: "Testing is in progress. Note anything that still needs work.",
      emailIntro: "Please do a final check. Approve to launch, or list what is left.",
      approveLabel: "Approve for Launch",
      changesLabel: "List Remaining Issues"
    };
    if (/launch/.test(title)) return {
      reviewTitle: "Handover Is Ready",
      reviewCopy: "Confirm you have what you need.",
      adminCopy: "Geeslane is reading your handover notes.",
      currentCopy: "Launch and handover are being prepared.",
      emailIntro: "Handover is ready. Please confirm you have what you need.",
      approveLabel: "Confirm Handover",
      changesLabel: "Need Something Else"
    };
    if (/handover|next step/.test(title)) return {
      reviewTitle: "Handover Is Ready",
      reviewCopy: "Confirm you have what you need, or ask for one more thing.",
      adminCopy: "Geeslane is reading your handover notes.",
      currentCopy: "Review and handover are being prepared.",
      emailIntro: "Handover is ready. Please confirm you have what you need.",
      approveLabel: "Confirm Handover",
      changesLabel: "Need Something Else"
    };
    return {
      reviewTitle: `${item?.title || "This Stage"} Is Ready to Check`,
      reviewCopy: "Approve this stage, or say what should change.",
      adminCopy: "Geeslane is reading your notes for this stage.",
      currentCopy: "This stage is in progress. Ask questions here.",
      emailIntro: `${item?.title || "This stage"} is ready for your review.`,
      approveLabel: "Approve This Stage",
      changesLabel: "Request Changes"
    };
  }

  function defaultBrief() {
    return {
      goal: "", audience: "", scope: "",
      businessDescription: "", socialLinks: "", websiteUrl: "",
      visitorDetails: "", features: "", featuresOther: "", hasDomain: "", hasHosting: "", availableAssets: ""
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
  const ui = window.GeeslaneUI;
  const escapeHtml = (value) => ui.escapeHtml(value);
  const rowActions = (items) => ui.rowActions(items);
  const tablePages = { invoices: 1, receipts: 1, requests: 1, resources: 1 };

  function pagedRows(key, rows) {
    const slice = ui.pageSlice(rows, tablePages[key]);
    tablePages[key] = slice.page;
    return slice;
  }

  function drawPager(id, key, slice, render) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = ui.pagerHtml(slice);
    ui.bindPager(node, (page) => {
      tablePages[key] = page;
      render();
    });
  }

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
  function clientPortalName(fallback = "") {
    return window.GeeslaneMail?.portalName?.(state.profile?.name) || fallback;
  }
  function initials(name) {
    const person = window.GeeslaneMail?.parsePersonName(name);
    const source = person?.bareName || String(name || "Client").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : parts[0]?.slice(0, 2) || "CL").toUpperCase();
  }
  function projectInitial(name) { return String(name || "P").trim().charAt(0).toUpperCase(); }
  function formatDate(value, short = false) {
    if (!value) return "Not Set";
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

  function fillPageProjectNames() {
    const name = currentPage === "chooser" ? "" : displayProjectName();
    ["brand-project-name", "agreement-project-name", "payments-project-name"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.textContent = name;
      node.hidden = !name;
    });
  }

  function displayProjectName(project = state.project) {
    return isPlaceholderName(project?.name) ? "Project" : String(project.name).trim();
  }

  function displayProjectService(project = state.project) {
    return isPlaceholderService(project?.service) ? "Not Set" : String(project.service).trim();
  }

  function displayProjectStatus(project = state.project) {
    if (project === state.project) {
      const hasWork = state.project.progress > 0
        || state.requests.length
        || state.milestones.some((item) => item.status === "review" || item.status === "admin_review" || item.status === "complete");
      if (!hasWork) return "Not Started";
    }
    return project?.status || "In Progress";
  }

  function listedProjects() {
    const projects = Array.isArray(accountProjects) ? accountProjects.slice() : [];
    if (state.project?.id && !projects.some((item) => item.id === state.project.id)) {
      projects.unshift(state.project);
    }
    return projects.filter((item) => item?.id);
  }

  function isProjectActive(project) {
    return project?.isActive !== false;
  }

  function currentTrack(project = state.project) {
    return window.GeeslaneAPI?.projectTrack?.(project?.service) || "website";
  }

  function trackFeatures(project = state.project) {
    const track = currentTrack(project);
    if (track === "automation") return { brand: true, identity: false, content: false, media: true, agreement: true, websiteBrief: false };
    if (track === "consultation") return { brand: true, identity: false, content: false, media: false, agreement: true, websiteBrief: false };
    if (track === "support") return { brand: true, identity: false, content: false, media: true, agreement: true, websiteBrief: false };
    if (track === "other") return { brand: true, identity: false, content: false, media: true, agreement: true, websiteBrief: false };
    return { brand: true, identity: true, content: true, media: true, agreement: true, websiteBrief: true };
  }

  function brandPageLabel(project = state.project) {
    return trackFeatures(project).identity ? "Brief & Brand" : "Project Brief";
  }

  function allowedPages(project = state.project) {
    const features = trackFeatures(project);
    const pages = ["chooser", "overview", "project", "payments", "requests", "profile"];
    if (features.brand) pages.push("brand");
    if (features.agreement) pages.push("agreement");
    return pages;
  }

  function resolvePage(page, project = state.project) {
    if (page === "files") page = "brand";
    if (page && allowedPages(project).includes(page) && pageNames[page]) return page;
    return "overview";
  }

  function closeProjectSwitcher() {
    const button = document.getElementById("project-switcher-button");
    const menu = document.getElementById("project-switcher-menu");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function applyTrackUi() {
    const features = trackFeatures();
    const choosing = currentPage === "chooser";
    document.getElementById("portal-app")?.classList.toggle("is-choosing-project", choosing);
    document.body.classList.toggle("is-choosing-project", choosing);
    document.querySelectorAll(".nav-item[data-page], .mobile-nav [data-page]").forEach((button) => {
      const page = button.dataset.page;
      button.hidden = choosing ? page !== "profile" : !allowedPages().includes(page) || page === "chooser";
    });
    const brandLabel = brandPageLabel();
    pageNames.brand = brandLabel;
    setText("nav-brand-label", brandLabel);
    setText("brand-page-title", brandLabel);
    const brandButton = document.getElementById("manage-brand-button");
    if (brandButton) {
      brandButton.hidden = !features.brand;
      brandButton.textContent = features.identity ? "Open Brief & Brand" : "Open Project Brief";
    }
    const agreementButton = document.getElementById("project-agreement-button");
    if (agreementButton) agreementButton.hidden = !features.agreement;
    document.querySelectorAll("[data-track-feature]").forEach((node) => {
      node.hidden = !features[node.dataset.trackFeature];
    });
    document.querySelectorAll("[data-website-brief]").forEach((node) => {
      node.hidden = !features.websiteBrief;
    });
    const goalLabel = document.getElementById("brief-goal-label");
    const audienceLabel = document.getElementById("brief-audience-label");
    if (goalLabel) goalLabel.innerHTML = features.websiteBrief
      ? "What do you want this website to help you achieve? <span>*</span>"
      : "What should this project help you achieve? <span>*</span>";
    if (audienceLabel) audienceLabel.innerHTML = features.websiteBrief
      ? "Who is this website mainly for? <span>*</span>"
      : "Who is this for? <span>*</span>";
    const goalInput = document.getElementById("brief-goal");
    const audienceInput = document.getElementById("brief-audience");
    if (goalInput) goalInput.placeholder = features.websiteBrief
      ? "More customers, clearer information, bookings, or something else?"
      : "The main outcome you want from this work.";
    if (audienceInput) audienceInput.placeholder = features.websiteBrief
      ? "New visitors, existing customers, a specific group, or mixed?"
      : "The people or team this work is for.";
    const tablist = document.querySelector("#page-brand .section-tabs");
    if (tablist) {
      const visible = [...tablist.querySelectorAll("[data-brand-tab]")].filter((tab) => !tab.hidden);
      tablist.hidden = visible.length < 2;
    }
    updateBrandStepNav();
  }

  function moneyLabel(invoice) {
    const amount = String(invoice?.amount || "").trim();
    const currency = String(invoice?.currency || "NGN").trim();
    if (!amount) return "Amount to follow";
    return `${currency} ${amount}`.trim();
  }

  function hasCustomBrand(brand = state.project.brandKit) {
    const value = brand || {};
    const defaults = defaultBrandKit();
    if (value.headingFont || value.bodyFont || value.personality || value.styleNotes || value.referenceLinks) return true;
    return ["primaryColor", "secondaryColor", "accentColor"].some((key) => validColour(value[key], defaults[key]) !== defaults[key]);
  }

  function hasCustomBrief(brief = state.project.brief) {
    return Object.values(brief || {}).some((value) => String(value || "").trim());
  }

  function currentBrief(workspace = state) {
    return { ...defaultBrief(), ...(workspace?.project?.brief || {}) };
  }

  function hasCustomContent(content = state.project.content) {
    return Object.keys(defaultContent()).some((key) => String(content?.[key] || "").trim());
  }

  function isBootstrapActivity(item, workspace) {
    const title = String(item?.title || "").trim().toLowerCase();
    if (title === "project workspace created" || title === "workspace created") return true;
    if (title === "brand identity updated" && !hasCustomBrand(workspace?.project?.brandKit)) return true;
    if (title === "website content updated" && !hasCustomContent(workspace?.project?.content)) return true;
    if (title === "project brief updated" && !hasCustomBrief(workspace?.project?.brief)) return true;
    if (title === "project details updated" && isPlaceholderName(workspace?.project?.name)) return true;
    return false;
  }

  function normalizeState(candidate) {
    const base = createEmptyState();
    candidate.profile = { ...base.profile, ...(candidate.profile || {}) };
    candidate.project = { ...base.project, ...(candidate.project || {}) };
    candidate.project.brandKit = { ...defaultBrandKit(), ...(candidate.project.brandKit || {}) };
    candidate.project.content = { ...defaultContent(), ...(candidate.project.content || {}) };
    candidate.project.brief = currentBrief(candidate);
    if (isPlaceholderName(candidate.project.name)) candidate.project.name = "";
    if (isPlaceholderService(candidate.project.service)) candidate.project.service = "";
    if (typeof candidate.project.hasWireframe !== "boolean") candidate.project.hasWireframe = true;
    if (typeof candidate.project.hasVisualDesign !== "boolean") candidate.project.hasVisualDesign = true;
    if (typeof candidate.project.isActive !== "boolean") candidate.project.isActive = true;
    if (!Array.isArray(candidate.milestones) || !candidate.milestones.length) {
      const completed = Array.isArray(candidate.milestones) ? candidate.milestones.filter((item) => item.status === "complete").length : 0;
      candidate.milestones = defaultMilestones(Math.min(completed, 6), candidate.project.service);
    }
    candidate.milestones = candidate.milestones.filter((item) => window.GeeslaneAPI.milestoneIsIncluded(item, candidate.project));
    if (!candidate.milestones.length) candidate.milestones = defaultMilestones(0, candidate.project.service);
    candidate.requests = Array.isArray(candidate.requests) ? candidate.requests : [];
    candidate.resources = Array.isArray(candidate.resources) ? candidate.resources : [];
    candidate.activity = (Array.isArray(candidate.activity) ? candidate.activity : []).filter((item) => !isBootstrapActivity(item, candidate));
    candidate.messages = Array.isArray(candidate.messages) ? candidate.messages : [];
    candidate.invoices = Array.isArray(candidate.invoices) ? candidate.invoices : [];
    candidate.receipts = Array.isArray(candidate.receipts) ? candidate.receipts : [];
    candidate.agreement = candidate.agreement && typeof candidate.agreement === "object" ? candidate.agreement : null;
    candidate.project.progress = calculateProgress(candidate.milestones, candidate);
    candidate.project.stage = candidate.milestones.find((item) => item.status === "current" || item.status === "review" || item.status === "admin_review")?.title || candidate.project.stage || "Discovery";
    return candidate;
  }

  function clientContribution(milestones, workspace = state) {
    const project = workspace?.project || {};
    const resources = Array.isArray(workspace?.resources) ? workspace.resources : [];
    const brandDone = hasCustomBrand(project.brandKit);
    const contentDone = hasCustomContent(project.content);
    const briefDone = hasCustomBrief(project.brief);
    const filesDone = resources.some((item) => item && !item.archivedAt);
    if (!brandDone && !contentDone && !filesDone && !briefDone) return 0;

    let extra = 0;
    const discovery = milestones.find((item) => /discovery/i.test(item.title || ""));
    const brandStage = milestones.find((item) => /brand/i.test(item.title || ""));
    if (discovery && (discovery.status === "current" || discovery.status === "upcoming")) {
      extra += Number(discovery.weight || 0) * (briefDone ? 0.5 : 0.4);
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
    const list = Array.isArray(milestones) ? milestones : [];
    const totalWeight = list.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (!totalWeight) return 0;
    const weighted = list.reduce((total, item) => total + Number(item.weight || 0) * (factor[item.status] ?? 0), 0);
    return Math.max(0, Math.min(100, Math.round(100 * (weighted + clientContribution(list, workspace)) / totalWeight)));
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
    const nextParams = new URLSearchParams(params || "");
    if (state.project?.id) nextParams.set("project", state.project.id);
    else nextParams.delete("project");
    const query = String(nextParams) ? `?${nextParams}` : "";
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
    const requested = page;
    const next = page === "chooser" ? "chooser" : resolvePage(page);
    if (!pageNames[next]) return;
    currentPage = next;
    applyTrackUi();
    closeProjectSwitcher();
    document.querySelectorAll("[data-page-view]").forEach((view) => view.classList.toggle("is-visible", view.dataset.pageView === next));
    document.querySelectorAll(".nav-item[data-page], .mobile-nav [data-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.page === next));
    document.getElementById("page-title").textContent = pageNames[next];
    closeSidebar();
    closeAccountMenu();
    if (options.keepHash) writeHash(next, parsePortalHash().params);
    else writeHash(next);
    if (!options.silent) window.scrollTo({ top: 0, behavior: "smooth" });
    if (next === "chooser") renderProjectChooser();
    if (next === "requests") renderRequests();
    if (next === "brand") {
      showBrandTab(requested === "files" ? "media" : (parsePortalHash().params.get("tab") || defaultMaterialsTab()));
      renderBrandWorkspace();
    }
    if (next === "profile") renderProfile();
    if (next === "project") renderMilestones();
    if (next === "agreement") renderAgreement();
    if (next === "payments") renderPayments();
    renderProjectSwitcher();
    fillPageProjectNames();
  }

  function closeAccountMenu() {
    const menu = document.getElementById("account-menu");
    const button = document.getElementById("top-account-button");
    if (menu) menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function toggleAccountMenu() {
    const menu = document.getElementById("account-menu");
    const button = document.getElementById("top-account-button");
    if (!menu || !button) return;
    const open = menu.hidden;
    document.getElementById("notification-popover").hidden = true;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function usesOverlayNav() {
    return window.matchMedia("(max-width: 760px)").matches;
  }
  function openSidebar() { document.getElementById("sidebar").classList.add("is-open"); document.getElementById("sidebar-scrim").classList.add("is-visible"); }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("sidebar-scrim").classList.remove("is-visible");
  }
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
    setText("top-account-avatar", initialsText);
    setText("profile-avatar-large", initialsText);
    setText("sidebar-account-name", clientPortalName("Client account"));
    setText("sidebar-account-business", state.profile.business || "Geeslane client");
    setText("project-large-icon", projectLetter);
    setText("welcome-name", firstName(state.profile.name));
    setText("hero-project-name", displayProjectName());
    fillPageProjectNames();
    setText("hero-service", displayProjectService());
    setText("hero-project-status", statusLabel);
    setText("project-page-status", statusLabel);
    setText("progress-value", `${state.project.progress}%`);
    document.getElementById("progress-bar").style.width = `${state.project.progress}%`;
    const stages = document.getElementById("progress-stages");
    if (stages) {
      const labels = window.GeeslaneAPI?.progressStageLabels?.(state.project.service) || ["Discovery", "Design", "Development", "Launch"];
      stages.innerHTML = labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
    }
    setText("start-date", formatDate(state.project.startDate));
    setText("target-date", formatDate(state.project.targetDate));
    setText("current-stage", state.project.stage || "Discovery");
    setText("milestone-ratio", `${completed} of ${state.milestones.length}`);
    setText("project-page-name", displayProjectName());
    setText("milestone-percent", `${state.project.progress}% Complete`);
    setText("request-nav-count", state.requests.length);
    renderProjectSwitcher();
    applyTrackUi();
    renderOverviewProjects();
    renderMilestones();
    renderProjectDetails();
    renderActivity();
    renderNextAction();
    renderRequests();
    renderResources();
    renderBrandWorkspace();
    renderProfile();
    renderNotifications();
    renderAgreement();
    renderPayments();
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
      ? notes.map((note) => `<article class="thread-note is-${escapeHtml(note.role)} is-${escapeHtml(note.kind)}" id="note-${escapeHtml(note.id)}"><header><strong>${escapeHtml(window.GeeslaneMail?.portalName?.(note.name) || note.name || (note.role === "admin" ? "Geeslane" : "You"))}</strong><span>${escapeHtml(messageKindLabel(note.kind))} · ${relativeDate(note.createdAt)}</span></header><p>${noteHtml(note.body)}</p></article>`).join("")
      : `<p class="thread-empty">No comments yet.</p>`;
    const actions = !canTalk ? "" : `
      <form class="thread-compose" data-thread-form="${escapeHtml(milestone.id)}">
        <label class="field"><span>${inReview && isDiscovery ? "Your Reply" : "Your Note"}</span><textarea name="body" rows="3" maxlength="4000" placeholder="${escapeHtml(threadPlaceholder(milestone))}"></textarea></label>
        <div class="thread-actions">
          <button class="button ${inReview && !isDiscovery ? "button-secondary" : "button-primary"}" type="submit" data-thread-kind="comment">${inReview && isDiscovery ? "Send Reply" : "Send Note"}</button>
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
      const status = item.status === "complete" ? "Completed" : item.status === "review" ? "Your Review Needed" : item.status === "admin_review" ? "Geeslane Is Reviewing" : item.status === "current" ? "In Progress" : "Upcoming";
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
        ? `${milestone?.title || "A stage"} was approved`
        : kind === "changes"
        ? `${milestone?.title || "A stage"} needs changes`
        : `A new comment on ${milestone?.title || "the project"}`;
      notifyTeam(
        heading,
        `${clientFormal()} added a comment on ${milestone?.title || "the project"}. Open the link to read it.`,
        [["Stage", milestone?.title], ["Comment", text]],
        {
          subject: heading,
          ctaUrl: window.GeeslaneMail?.commentLink({
            audience: "team",
            projectId: state.project.id,
            milestoneId,
            noteId: savedNote?.id || ""
          }),
          ctaLabel: "View this comment"
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
      ["Project Type", displayProjectService()], ["Status", displayProjectStatus()],
      ["Workspace", isProjectActive(state.project) ? "Active" : "Paused"],
      ["Current Stage", state.project.stage || "Discovery"],
      ["Started", formatDate(state.project.startDate)], ["Projected completion", formatDate(state.project.targetDate)]
    ];
    const totals = currentProjectBalance();
    if (totals && totals.showSummary) {
      details.push(["Paid so far", totals.paidLabel], ["Remaining", totals.remainingLabel]);
    }
    document.getElementById("project-details").innerHTML = details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  }

  function currentAgreement() {
    return window.GeeslaneAgreement.resolve(state.project, state.profile, state.project.brief, state.agreement);
  }

  function renderAgreement() {
    const node = document.getElementById("agreement-document");
    if (!node || !window.GeeslaneAgreement) return;
    window.GeeslaneAgreement.renderInto(node, currentAgreement());
  }

  function currentProjectBalance() {
    return window.GeeslaneAPI.projectBalance({
      project: state.project,
      invoices: state.invoices,
      receipts: state.receipts,
      agreement: state.agreement
    });
  }

  function canPayOnline() {
    return window.GeeslaneAPI.paystackEnabled() && state.project.onlinePayments !== false;
  }

  function hasBankDetails() {
    return Boolean(portalSettings.accountNumber || portalSettings.accountName || portalSettings.bankName);
  }

  function canPayInvoice(invoice) {
    const status = String(invoice?.status || "");
    if (["Draft", "Cancelled", "Paid"].includes(status)) return false;
    const balance = window.GeeslaneAPI.invoiceBalance(invoice);
    return Boolean(balance && balance.remaining > 0);
  }

  function invoiceForDownload(invoice) {
    const balance = window.GeeslaneAPI.invoiceBalance(invoice) || {};
    return {
      ...invoice,
      projectName: displayProjectName(),
      business: state.profile.business || "",
      clientName: clientPortalName(),
      remainingLabel: balance.remainingLabel || "",
      paidLabel: balance.paidLabel || "",
      bank: hasBankDetails() ? portalSettings : null
    };
  }

  function paymentCallbackUrl() {
    try {
      const url = new URL(location.href);
      url.search = "";
      url.hash = "payments";
      return url.href;
    } catch (_) {
      return window.GEESLANE_CONFIG?.portalUrl || location.href;
    }
  }

  async function payInvoice(invoice, button) {
    if (!invoice?.id) return;
    if (!canPayOnline()) {
      document.getElementById("bank-transfer-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(hasBankDetails() ? "Pay online is not available. Use the bank details below." : "Pay online is not available yet. Contact Geeslane.");
      return;
    }
    window.GeeslaneAPI.setButtonBusy(button, true, "Opening payment…");
    try {
      const started = await window.GeeslaneAPI.startPayment({
        invoiceId: invoice.id,
        email: state.profile.email,
        callbackUrl: paymentCallbackUrl()
      });
      if (started.authorizationUrl) location.href = started.authorizationUrl;
      else toast("Paystack did not return a checkout link.");
    } catch (error) {
      toast(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Could not start online payment."));
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  async function confirmReturningPayment() {
    const reference = window.GeeslaneAPI.paymentReturnReference();
    if (!reference) return;
    try {
      const result = await window.GeeslaneAPI.verifyPayment(reference);
      window.GeeslaneAPI.clearPaymentReturn();
      if (result?.paid) {
        await hydrateRemoteProject(state.project.id);
        navigate("payments");
        toast("Payment received. Your receipt is ready in Payments.");
      }
    } catch (error) {
      window.GeeslaneAPI.clearPaymentReturn();
      toast(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Payment is still confirming. Refresh Payments in a moment."));
    }
  }

  function unpaidInvoices() {
    return (state.invoices || []).filter((invoice) => {
      const status = String(invoice?.status || "");
      if (["Draft", "Cancelled", "Paid"].includes(status)) return false;
      const balance = window.GeeslaneAPI.invoiceBalance(invoice);
      return !balance || balance.remaining > 0;
    });
  }

  function billingStatusClass(status) {
    const value = String(status || "").toLowerCase();
    if (value === "paid" || value === "issued") return "is-paid";
    if (value === "part paid") return "is-part";
    if (value === "overdue") return "is-overdue";
    if (value === "cancelled" || value === "rejected") return "is-cancelled";
    if (value === "draft") return "is-draft";
    if (value === "sent") return "is-sent";
    return "";
  }

  function renderPayments() {
    const invoiceList = document.getElementById("invoice-list");
    const receiptList = document.getElementById("receipt-list");
    const summary = document.getElementById("payment-summary");
    const invoices = (state.invoices || []).filter(Boolean);
    const totals = currentProjectBalance();
    if (summary) {
      if (totals && (totals.showSummary || unpaidInvoices().length)) {
        const dueInvoice = unpaidInvoices()[0];
        summary.hidden = false;
        const remainingLabel = totals.remainingLabel || window.GeeslaneAPI.invoiceBalance(dueInvoice)?.remainingLabel || "";
        const cleared = !(totals.remaining > 0 || dueInvoice);
        const stats = totals.showSummary
          ? `<div class="billing-strip-stats${cleared ? " is-cleared" : ""}"><div><span>Total</span><strong>${escapeHtml(totals.totalLabel)}</strong></div><div><span>Paid</span><strong>${escapeHtml(totals.paidLabel)}</strong></div><div><span>Balance</span><strong>${escapeHtml(totals.remainingLabel)}</strong></div></div>`
          : `<div class="billing-strip-copy"><h2>${escapeHtml(remainingLabel)}</h2></div>`;
        const action = dueInvoice && canPayOnline()
          ? `<div class="billing-strip-aside"><button class="button button-primary" type="button" data-pay-invoice="${escapeHtml(dueInvoice.id)}">Pay now</button></div>`
          : "";
        summary.innerHTML = `${stats}${action}`;
      } else {
        summary.hidden = true;
        summary.innerHTML = "";
      }
    }
    if (invoiceList) {
      const query = (document.getElementById("client-invoice-search")?.value || "").toLowerCase();
      const rows = invoices.filter((invoice) => `${invoice.reference} ${invoice.title} ${invoice.status}`.toLowerCase().includes(query));
      const slice = pagedRows("invoices", rows);
      invoiceList.innerHTML = slice.items.length
        ? slice.items.map((invoice) => {
          const due = unpaidInvoices().some((item) => item.id === invoice.id);
          const balance = window.GeeslaneAPI.invoiceBalance(invoice);
          const rowClass = due ? "is-due" : invoice.status === "Paid" ? "is-paid" : "";
          return `<tr class="${rowClass}"><td><strong>${escapeHtml(invoice.reference || "Invoice")}</strong><small>${escapeHtml(invoice.title || "Project invoice")}</small></td><td>${invoice.dueDate ? escapeHtml(formatDate(invoice.dueDate)) : "—"}</td><td class="num">${escapeHtml(balance?.totalLabel || moneyLabel(invoice))}</td><td class="num">${escapeHtml(balance?.remainingLabel || "—")}</td><td><span class="status-pill ${billingStatusClass(invoice.status)}${due ? " is-due" : ""}">${escapeHtml(invoice.status || "Draft")}</span></td><td>${rowActions([canPayInvoice(invoice) && canPayOnline() ? { label: "Pay", attrs: `data-pay-invoice="${escapeHtml(invoice.id)}"`, primary: true } : null, { label: "View", attrs: `data-view-invoice="${escapeHtml(invoice.id)}"` }, { label: "Download PDF", attrs: `data-print-invoice="${escapeHtml(invoice.id)}"` }])}</td></tr>`;
        }).join("")
        : `<tr><td class="table-empty" colspan="6">${invoices.length ? "No invoices match this search." : "No invoices yet."}</td></tr>`;
      drawPager("client-invoices-pager", "invoices", slice, renderPayments);
    }
    if (receiptList) {
      const receipts = (state.receipts || []).filter((item) => item && item.status !== "Draft" && item.status !== "Cancelled");
      const query = (document.getElementById("client-receipt-search")?.value || "").toLowerCase();
      const rows = receipts.filter((receipt) => `${receipt.reference} ${receipt.title} ${receipt.method} ${receipt.invoiceReference}`.toLowerCase().includes(query));
      const slice = pagedRows("receipts", rows);
      receiptList.innerHTML = slice.items.length
        ? slice.items.map((receipt) => `<tr class="is-paid"><td><strong>${escapeHtml(receipt.reference || "Receipt")}</strong><small>${escapeHtml(receipt.title || "Payment receipt")}${receipt.invoiceReference ? ` · ${escapeHtml(receipt.invoiceReference)}` : ""}</small></td><td>${receipt.paidOn ? escapeHtml(formatDate(receipt.paidOn)) : "—"}</td><td>${escapeHtml(receipt.method || "—")}</td><td class="num">${escapeHtml(moneyLabel(receipt))}</td><td><div class="billing-row-actions"><button class="button button-secondary" type="button" data-view-receipt="${escapeHtml(receipt.id)}">View</button><button class="button button-secondary" type="button" data-print-receipt="${escapeHtml(receipt.id)}">Download PDF</button></div></td></tr>`).join("")
        : `<tr><td class="table-empty" colspan="5">${receipts.length ? "No receipts match this search." : "No receipts yet."}</td></tr>`;
      drawPager("client-receipts-pager", "receipts", slice, renderPayments);
    }
    const bankCard = document.getElementById("bank-transfer-card");
    const bankBody = document.getElementById("bank-transfer-body");
    const showBank = hasBankDetails() && unpaidInvoices().length > 0 && !canPayOnline();
    if (bankCard) bankCard.hidden = !showBank;
    if (bankBody && showBank) {
      bankBody.innerHTML = `<dl class="invoice-meta bank-facts"><div><span>Bank</span><strong>${escapeHtml(portalSettings.bankName || "—")}</strong></div><div><span>Account name</span><strong>${escapeHtml(portalSettings.accountName || "—")}</strong></div><div><span>Account number</span><strong>${escapeHtml(portalSettings.accountNumber || "—")}</strong></div></dl>${portalSettings.bankNotes ? `<p>${escapeHtml(portalSettings.bankNotes)}</p>` : ""}`;
    }
  }

  function receiptForDownload(receipt) {
    return {
      ...receipt,
      projectName: displayProjectName(),
      business: state.profile.business || "",
      clientName: clientPortalName(),
      invoiceReference: receipt.invoiceReference || (state.invoices || []).find((item) => item.id === receipt.invoiceId)?.reference || ""
    };
  }

  function activityMarkup(items) {
    if (!items.length) return '<div class="request-empty">Nothing here yet.</div>';
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
    if (eyebrow) eyebrow.textContent = needed ? "Needs Your Attention" : "Where Things Stand";
  }

  function renderNextAction() {
    const reviewItem = state.milestones.find((item) => item.status === "review");
    const adminReview = state.milestones.find((item) => item.status === "admin_review");
    const current = state.milestones.find((item) => item.status === "current");
    const body = document.getElementById("next-action-body");
    const due = unpaidInvoices();

    if (due.length) {
      const first = due[0];
      const balance = window.GeeslaneAPI.invoiceBalance(first);
      setNextActionChrome(true);
      body.innerHTML = `<span class="action-icon is-alert">${icons.request}</span><h3>Payment due</h3><p>${escapeHtml(balance?.remainingLabel || moneyLabel(first))} outstanding.</p><button class="button button-primary" type="button">Pay now</button>`;
      body.querySelector("button").addEventListener("click", () => navigate("payments"));
      return;
    }

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
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>Geeslane Is Reviewing ${escapeHtml(adminReview.title)}</h3><p>${escapeHtml(meta.adminCopy)}</p><button class="button button-secondary" type="button">Open ${escapeHtml(adminReview.title)}</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = adminReview.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    if (current && /discover/i.test(current.title)) {
      if (!hasCustomBrief()) {
        setNextActionChrome(true);
        body.innerHTML = `<span class="action-icon is-alert">${icons.request}</span><h3>Tell Us About This Project</h3><p>Add the goal, who it is for, and what should be included.</p><button class="button button-secondary" type="button">Fill in the Brief</button>`;
        body.querySelector("button").addEventListener("click", () => openNextSteps("brief"));
        return;
      }
      const meta = phaseMeta(current);
      setNextActionChrome(false);
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>Discovery Is in Progress</h3><p>${escapeHtml(meta.currentCopy)}</p><button class="button button-secondary" type="button">Open Discovery</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = current.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    if (!hasCustomBrand() || !hasCustomContent()) {
      setNextActionChrome(true);
      body.innerHTML = `<span class="action-icon">${icons.file}</span><h3>Share Brand Details</h3><p>Add colours, logos, and copy so design can start.</p><button class="button button-secondary" type="button">Open Brief &amp; Brand</button>`;
      body.querySelector("button").addEventListener("click", () => openNextSteps("identity"));
      return;
    }

    if (current) {
      const meta = phaseMeta(current);
      setNextActionChrome(false);
      body.innerHTML = `<span class="action-icon">${icons.milestone}</span><h3>${escapeHtml(current.title)} Is in Progress</h3><p>${escapeHtml(meta.currentCopy)}</p><button class="button button-secondary" type="button">Open ${escapeHtml(current.title)}</button>`;
      body.querySelector("button").addEventListener("click", () => {
        openMilestoneId = current.id;
        navigate("project");
        renderMilestones();
      });
      return;
    }

    setNextActionChrome(false);
    body.innerHTML = '<p class="empty-action">Your milestones are complete. Start a new request if you need more work.</p><button class="button button-secondary" type="button" data-open-request>Start a Request</button>';
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
    if (!items.length) return '<div class="request-empty">No requests match this view. Use “New Request” to add one.</div>';
    return items.map((item) => `<div class="request-row" role="button" tabindex="0" data-request-id="${escapeHtml(item.id)}"><span class="request-kind-icon ${requestTypeClass(item.type)}">${requestIcon(item.type)}</span><span class="request-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(requestSnippet(item))}</small></span><span class="request-id">${escapeHtml(item.id)}</span><span class="request-date">${formatDate(item.createdAt, true)}</span><span class="request-status ${requestStatusClass(item.status)}">${escapeHtml(requestStatusLabel(item.status))}</span></div>`).join("");
  }

  function renderRequests() {
    const query = (document.getElementById("request-search")?.value || "").toLowerCase();
    const filtered = state.requests.filter((item) => (currentFilter === "all" || item.type === currentFilter) && `${item.title} ${item.id} ${item.status} ${requestSnippet(item)}`.toLowerCase().includes(query));
    const slice = pagedRows("requests", filtered);
    document.getElementById("request-history").innerHTML = requestRows(slice.items);
    drawPager("client-requests-pager", "requests", slice, renderRequests);
    document.getElementById("overview-requests").innerHTML = requestRows(state.requests.slice(0, 3));
    document.querySelectorAll("[data-request-id]").forEach((row) => {
      const open = () => openRequestDetail(row.dataset.requestId);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
  }

  function renderResources() {
    const markup = state.resources.length
      ? state.resources.map((item) => {
        const pdf = /\.pdf($|\?)/i.test(item.name || item.url || "") || /pdf/i.test(item.type || "");
        const actions = item.url
          ? `<a class="button button-secondary" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">View</a><a class="button button-secondary" href="${safeUrl(item.url)}" download="${escapeHtml(item.name || "file")}">${pdf ? "Download PDF" : "Download"}</a>`
          : "";
        return `<div class="resource-row"><div class="resource-name"><span class="resource-icon">${icons.file}</span><strong>${escapeHtml(item.name)}</strong></div><span class="resource-type">${escapeHtml(item.type)}</span><span class="resource-date">${formatDate(item.createdAt, true)}</span><div class="resource-actions account-project-actions">${actions}<button class="icon-button" type="button" data-delete-resource="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">${icons.trash}</button></div></div>`;
      }).join("")
      : '<div class="resource-empty">No resources yet. Add links to documents, designs, previews, or shared folders.</div>';
    ["brand-resource-list"].forEach((id) => {
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
    const brief = currentBrief();
    state.project.brief = brief;
    const brandForm = document.getElementById("brand-form");
    const contentForm = document.getElementById("content-form");
    const briefForm = document.getElementById("brief-form");
    if (!brandForm || !contentForm || !briefForm) return;
    Object.keys(defaultBrief()).forEach((key) => {
      const nodes = briefForm.elements[key];
      if (!nodes) return;
      if (nodes.length && nodes[0] && nodes[0].type === "checkbox") {
        const selected = String(brief[key] || "").split(/\s*,\s*/).filter(Boolean);
        [...nodes].forEach((input) => { input.checked = selected.includes(input.value); });
        return;
      }
      nodes.value = brief[key] || "";
    });
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
    const values = Object.keys(defaultContent()).map((key) => content[key]);
    const completion = Math.round((values.filter((value) => String(value).trim()).length / values.length) * 100);
    setText("content-completion-value", `${completion}% Complete`);
    document.getElementById("content-completion-bar").style.width = `${completion}%`;
    setText("brand-save-status", window.GeeslaneAPI?.isConnected() ? "Synced with project storage" : "Not connected");
    syncOtherFeatureFields(briefForm);
    renderMaterialsConversation();
  }

  function syncOtherFeatureFields(root = document.getElementById("brief-form")) {
    if (!root) return;
    root.querySelectorAll("[data-other-for]").forEach((field) => {
      const name = field.dataset.otherFor;
      const nodes = root.elements[name];
      const list = !nodes ? [] : nodes.length !== undefined ? [...nodes] : [nodes];
      const show = list.some((input) => input.checked && /^other$/i.test(input.value));
      field.hidden = !show;
    });
  }

  function rememberedOpenProject() {
    try { return localStorage.getItem(LAST_PROJECT_KEY) || ""; } catch (_) { return ""; }
  }

  function rememberOpenProject(projectId) {
    try {
      if (projectId) localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } catch (_) { /* private browsing */ }
  }

  function fillProjectSelect(select, projects, currentId) {
    if (!select) return;
    select.innerHTML = projects.map((project) => `<option value="${escapeHtml(project.id)}"${project.id === currentId ? " selected" : ""}>${escapeHtml(displayProjectName(project))}${isProjectActive(project) ? "" : " (Paused)"}</option>`).join("");
    select.value = currentId || select.value;
  }

  function renderProjectSwitcher() {
    const select = document.getElementById("project-select");
    const projects = listedProjects();
    const currentId = state.project.id;
    fillProjectSelect(select, projects, currentId);
    const wrap = document.getElementById("sidebar-switcher");
    if (wrap) wrap.hidden = currentPage === "chooser" || projects.length < 1;
    setText("switcher-avatar", projectInitial(displayProjectName()));
    setText("switcher-project-name", displayProjectName());
    const list = document.getElementById("sidebar-project-list");
    if (list) {
      list.innerHTML = projects.map((project) => {
        const active = isProjectActive(project);
        const current = project.id === currentId;
        return `<button class="sidebar-project-item${current ? " is-current" : ""}" type="button" data-open-project="${escapeHtml(project.id)}" data-open-page="${currentPage === "profile" ? "overview" : currentPage}" aria-current="${current ? "true" : "false"}"><span class="project-avatar">${escapeHtml(projectInitial(displayProjectName(project)))}</span><span><small>${escapeHtml(displayProjectService(project))}</small><strong>${escapeHtml(displayProjectName(project))}</strong></span></button>`;
      }).join("") || '<p class="sidebar-projects-label">No projects yet</p>';
    }
  }

  function renderProjectChooser() {
    const list = document.getElementById("chooser-projects");
    if (!list) return;
    const projects = listedProjects();
    list.innerHTML = projects.map((project) => {
      const active = isProjectActive(project);
      const summary = project.summary || {};
      const progress = Number(project.progress || 0);
      const remaining = summary.remainingLabel
        ? (summary.remaining > 0 ? summary.remainingLabel : "Paid up")
        : "";
      const attention = [];
      if (summary.unpaidCount) attention.push(`${summary.unpaidCount} invoice${summary.unpaidCount === 1 ? "" : "s"} to pay`);
      if (summary.reviewTitle) attention.push(`${summary.reviewTitle} needs your review`);
      const nextPage = pendingWorkspacePage && pendingWorkspacePage !== "chooser" ? pendingWorkspacePage : "overview";
      return `<article class="account-project-card"><header><div><span class="project-flag${active ? "" : " is-paused"}">${active ? "Open" : "Paused"}</span><h3>${escapeHtml(displayProjectName(project))}</h3><p>${escapeHtml(displayProjectService(project))}</p></div><strong>${progress}%</strong></header><div class="progress-track"><span style="width:${Math.max(0, Math.min(100, progress))}%"></span></div><div class="account-project-facts"><div><small>Current stage</small><strong>${escapeHtml(project.stage || "Discovery")}</strong></div><div><small>Remaining</small><strong>${escapeHtml(remaining || "See Payments")}</strong></div></div>${attention.length ? `<p class="account-project-alert">${escapeHtml(attention.join(" · "))}</p>` : ""}<div class="account-project-actions"><button class="button button-primary" type="button" data-open-project="${escapeHtml(project.id)}" data-open-page="${escapeHtml(nextPage)}">Open</button></div></article>`;
    }).join("") || '<div class="request-empty">No projects yet.</div>';
  }

  function renderOverviewProjects() {
    const panel = document.getElementById("overview-projects-panel");
    if (panel) panel.hidden = true;
    const hero = document.getElementById("overview-single-hero");
    const extra = document.getElementById("overview-open-project-details");
    if (hero) hero.hidden = false;
    if (extra) extra.hidden = false;
    renderProjectChooser();
  }

  function safeUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#"; } catch (_) { return "#"; } }

  function renderProfile() {
    setText("profile-display-name", clientPortalName("Client account"));
    setText("profile-display-business", state.profile.business || "Geeslane client");
    setText("member-since", formatDate(state.createdAt, true));
    setText("profile-request-count", state.requests.length);
    const form = document.getElementById("profile-form");
    const person = window.GeeslaneMail?.parsePersonName(state.profile.name) || {};
    if (form.elements.title) form.elements.title.value = person.titleKey || "";
    if (form.elements.name) form.elements.name.value = person.bareName || state.profile.name || "";
    if (form.elements.business) form.elements.business.value = state.profile.business || "";
    if (form.elements.email) form.elements.email.value = state.profile.email || "";
    if (form.elements.contact) form.elements.contact.value = state.profile.contact || "Email";
    window.GeeslaneAPI?.fillPhoneField?.("profile-phone", state.profile.phone);
  }

  function renderNotifications() {
    const notes = [];
    listedProjects().forEach((project) => {
      const summary = project.summary || {};
      const name = displayProjectName(project);
      if (summary.unpaidCount) notes.push({ title: `${name}: ${summary.unpaidCount} invoice${summary.unpaidCount === 1 ? "" : "s"} to pay`, detail: "Open that project’s Payments to see remaining." });
      if (summary.reviewTitle) notes.push({ title: `${name}: ${summary.reviewTitle} needs review`, detail: "Open that project’s milestones to reply, approve, or ask for changes." });
    });
    if (!notes.length) notes.push({ title: "You’re up to date", detail: "New project updates will appear here." });
    document.getElementById("notification-list").innerHTML = notes.map((note) => `<div class="notification-item"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.detail)}</p></div>`).join("");
    document.getElementById("notification-dot").hidden = notes.length === 1 && notes[0].title === "You’re up to date";
  }

  function fieldHtml(field) {
    const required = field.required ? " required" : "";
    const requiredMark = field.required ? " <span>*</span>" : "";
    const wrap = `field${field.full ? " field-full" : ""}`;
    if (field.type === "textarea") return `<div class="${wrap}"><label for="req-${field.name}">${field.label}${requiredMark}</label><textarea id="req-${field.name}" name="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}"${required}></textarea></div>`;
    if (field.type === "select") {
      const options = field.name === "milestone"
        ? field.options.filter((option) => option === "Other" || window.GeeslaneAPI.milestoneIsIncluded({ title: option, id: option }, state.project))
        : field.options;
      return `<div class="${wrap}"><label for="req-${field.name}">${field.label}${requiredMark}</label><select id="req-${field.name}" name="${field.name}"${required}><option value="">Choose One</option>${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></div>`;
    }
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
    next.textContent = step === 3 ? "Add to Portal History" : "Continue →";
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
    if (type === "discovery") return values.projectName || "New Project Brief";
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

  async function submitRequest() {
    const nextNumber = state.requests.reduce((max, item) => Math.max(max, Number(String(item.id).replace(/\D/g, "")) || 100), 100) + 1;
    const request = { id: `GL-${nextNumber}`, type: requestFlow.type, title: requestTitle(requestFlow.type, requestFlow.values), status: "Received", createdAt: new Date().toISOString(), values: { ...requestFlow.values } };
    if (request.type === "discovery") {
      if (window.GeeslaneAPI?.isConnected()) {
        try {
          const created = await window.GeeslaneAPI.submit("createProject", {
            projectName: request.values.projectName,
            service: request.values.projectType,
            request
          });
          const newId = created?.id || created?.projectId || "";
          closeModal("request");
          await hydrateRemoteProject(newId);
          navigate("overview");
          toast("New project added. Your other projects are still in the list.");
          notifyTeam("New project opened", `${clientFormal()} opened a new project. The previous work is still in their portal.`, [
            ["Project", request.values.projectName],
            ["Type", request.values.projectType]
          ]);
          return;
        } catch (error) {
          toast(window.GeeslaneAPI.userFacingError(error, "Could not add another project. Run client_add_project.sql in Supabase, then try again."));
          return;
        }
      }
      toast("Connect to the portal to open a separate project. This request was not saved over your current work.");
      return;
    }
    state.requests.unshift(request);
    addActivity(`${requestConfigs[request.type].shortLabel} added`, request.title, request.type);
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
    if (requestFlow.step === 3 && document.getElementById("request-confirm").checked) { submitRequest(); return; }
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
    setText("project-progress-output", `${state.project.progress}%`);
    openModal("project");
  }

  function saveProject() {
    const form = document.getElementById("project-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    state.project = { ...state.project, name: String(data.get("name")).trim(), service: String(data.get("service")).trim() };
    addActivity("Project details updated", `${state.project.stage} · ${state.project.progress}% complete`, "milestone");
    saveState("updateProject", { project: state.project }); closeModal("project"); renderAll(); toast("Project updated");
    notifyTeam("Project details updated", `${clientFormal()} updated the project details.`, [
      ["Name", state.project.name],
      ["Type", state.project.service]
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
      phone: window.GeeslaneAPI?.readPhoneField?.("profile-phone") || String(data.get("phone") || "").trim(),
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

  function notifyTeam(heading, intro, rows, extras = {}) {
    window.GeeslaneMail?.notify({
      audience: "team",
      subject: extras.subject || `${heading} · ${extras.business || state.profile.business || displayProjectName()}`,
      heading,
      intro,
      rows: extras.skipIdentity ? (rows || []) : [
        ["Client", extras.client || clientFormal()],
        ["Business", extras.business || state.profile.business],
        ["Project", extras.project || displayProjectName()],
        ...(rows || [])
      ],
      fromName: extras.client || clientFormal(),
      replyTo: extras.email || state.profile.email || window.GEESLANE_CONFIG?.supportEmail,
      ctaPage: extras.ctaPage || "admin",
      ctaUrl: extras.ctaUrl,
      ctaLabel: extras.ctaLabel || "Open admin portal"
    });
  }

  function defaultMaterialsTab() {
    const features = trackFeatures();
    const current = state.milestones.find((item) => item.status === "current" || item.status === "review" || item.status === "admin_review");
    if (current && /discover/i.test(current.title)) return "brief";
    if (features.identity && current && /brand/i.test(current.title)) return "identity";
    if (features.identity && hasCustomBrief()) return "identity";
    return "brief";
  }

  function openNextSteps(tab) {
    navigate("brand");
    showBrandTab(tab || defaultMaterialsTab());
  }

  function activeMaterialsTab() {
    return document.querySelector("[data-brand-tab].is-active")?.dataset.brandTab || defaultMaterialsTab();
  }

  function renderMaterialsConversation() {
    const talk = document.getElementById("brand-conversation");
    if (!talk) return;
    const tab = activeMaterialsTab();
    const stage = state.milestones.find((item) => tab === "brief" ? /discover/i.test(item.title || "") : /brand/i.test(item.title || ""));
    if (!stage) { talk.hidden = true; return; }
    talk.hidden = false;
    const lead = tab === "brief"
      ? "Questions about goals, audience, and what to include stay here."
      : "Questions about colours, logos, and copy stay here.";
    talk.innerHTML = `<p class="eyebrow">Conversation</p><h2>Talk with Geeslane</h2><p class="thread-lead">${lead}</p>${threadMarkup(stage)}`;
    bindThreadForms(talk, sendClientMilestoneNote);
  }

  function saveBrief(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const brief = { ...defaultBrief() };
    Object.keys(brief).forEach((key) => {
      const nodes = event.currentTarget.elements[key];
      if (nodes && nodes.length && nodes[0] && nodes[0].type === "checkbox") {
        brief[key] = [...nodes].filter((input) => input.checked).map((input) => input.value).join(", ");
        return;
      }
      brief[key] = String(data.get(key) || "").trim();
    });
    if (!brief.goal || !brief.audience) {
      toast("Please answer the goal and audience questions.");
      return;
    }
    if (/\bother\b/i.test(brief.features) && !brief.featuresOther) {
      toast("Please describe the other features you need.");
      return;
    }
    brief.scope = brief.visitorDetails;
    state.project.brief = brief;
    addActivity("Project brief updated", "Goals, audience, and first-version notes changed.", "request");
    saveState("saveBrief", { brief });
    notifyTeam("Project brief saved", `${clientFormal()} answered the Discovery questions.`, [
      ["Goal", brief.goal],
      ["Audience", brief.audience],
      ["Features", brief.features],
      ["Other features", brief.featuresOther],
      ["Visitor details", brief.visitorDetails]
    ]);
    renderAll();
    toast("Project brief saved. Geeslane has been notified.");
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

  function visibleBrandTabs() {
    return [...document.querySelectorAll("#page-brand [data-brand-tab]")].filter((tab) => !tab.hidden);
  }

  function updateBrandStepNav() {
    const tabs = visibleBrandTabs();
    const index = tabs.findIndex((tab) => tab.dataset.brandTab === activeMaterialsTab());
    const prevTab = index > 0 ? tabs[index - 1] : null;
    const nextTab = index >= 0 && index < tabs.length - 1 ? tabs[index + 1] : null;
    document.querySelectorAll("[data-brand-prev]").forEach((button) => {
      button.hidden = !prevTab;
      if (prevTab) button.textContent = `Previous: ${prevTab.textContent.trim()}`;
    });
    document.querySelectorAll("[data-brand-next]").forEach((button) => {
      button.hidden = !nextTab;
      if (nextTab) button.textContent = `Next: ${nextTab.textContent.trim()}`;
    });
  }

  function moveBrandTab(direction) {
    const tabs = visibleBrandTabs();
    const index = tabs.findIndex((tab) => tab.dataset.brandTab === activeMaterialsTab());
    const next = tabs[index + direction];
    if (!next) return;
    showBrandTab(next.dataset.brandTab, { scroll: true });
  }

  function showBrandTab(tab, options = {}) {
    const features = trackFeatures();
    let next = tab || defaultMaterialsTab();
    if (next === "identity" && !features.identity) next = "brief";
    if (next === "content" && !features.content) next = "brief";
    if (next === "media" && !features.media) next = "brief";
    document.querySelectorAll("[data-brand-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.brandTab === next));
    document.querySelectorAll("[data-brand-section]").forEach((section) => section.classList.toggle("is-visible", section.dataset.brandSection === next));
    const params = parsePortalHash().params;
    if (next === "brief") params.delete("tab");
    else params.set("tab", next);
    writeHash("brand", params);
    renderMaterialsConversation();
    updateBrandStepNav();
    if (options.scroll) {
      const tabs = document.querySelector("#page-brand .section-tabs");
      if (tabs) {
        const top = window.scrollY + tabs.getBoundingClientRect().top - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
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
    const focusId = name === "access" ? "access-name" : "signin-email";
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

  function tourStorageKey() {
    return `${TOUR_KEY}:${String(state.profile?.email || "").trim().toLowerCase()}`;
  }
  function hasSeenTour() {
    try { return localStorage.getItem(tourStorageKey()) === "1"; }
    catch (_) { return true; }
  }
  function markTourSeen() {
    try { localStorage.setItem(tourStorageKey(), "1"); }
    catch (_) { /* private mode */ }
  }
  function isNewPortalUser() {
    const created = Date.parse(state.createdAt || "");
    if (!Number.isFinite(created)) return true;
    return Date.now() - created < 14 * 86400000;
  }
  function tourSteps() {
    return [
      { page: "overview", title: "Overview", copy: "Your home. Progress, what to do next, and recent updates sit here." },
      { page: "project", title: "My Project", copy: "Milestones and comments live here. Reply when a stage is ready for you." },
      { page: "brand", title: brandPageLabel(), copy: "Add the brief, brand details, and files Geeslane needs to start." },
      { page: "agreement", title: "Agreement", copy: "The project agreement is here. Download a PDF when you need a copy." },
      { page: "payments", title: "Payments", copy: "Invoices, receipts, and account details for this project sit here." },
      { page: "requests", title: "Requests", copy: "Approvals, change requests, and anything you have sent." },
      { page: "profile", title: "Profile", copy: "Your name, business, and how Geeslane should reach you." }
    ].filter((step) => allowedPages().includes(step.page));
  }
  function clearTourTarget() {
    document.querySelectorAll(".is-tour-target").forEach((node) => node.classList.remove("is-tour-target"));
  }
  function placeTourCard() {
    const card = document.getElementById("portal-tour-card");
    const steps = tourSteps();
    const step = steps[tourIndex];
    if (!card || !step) return;
    if (usesOverlayNav()) return;
    const target = document.querySelector(`.sidebar .nav-item[data-page="${step.page}"]`);
    const rect = target?.getBoundingClientRect();
    const top = rect ? Math.min(Math.max(24, rect.top), window.innerHeight - card.offsetHeight - 24) : 120;
    card.style.left = "255px";
    card.style.top = `${top}px`;
  }
  function renderTourStep() {
    const steps = tourSteps();
    const step = steps[tourIndex];
    const root = document.getElementById("portal-tour");
    if (!root || !step) { stopTour(); return; }
    const last = tourIndex === steps.length - 1;
    setText("tour-title", step.title);
    setText("tour-copy", step.copy);
    setText("tour-step-label", `${tourIndex + 1} of ${steps.length}`);
    const next = document.getElementById("tour-next");
    if (next) next.textContent = last ? "Done" : "Next";
    clearTourTarget();
    closeSidebar();
    const scope = usesOverlayNav() ? ".mobile-nav" : ".sidebar";
    document.querySelectorAll(`${scope} [data-page="${step.page}"]`).forEach((node) => node.classList.add("is-tour-target"));
    navigate(step.page, { silent: true });
    requestAnimationFrame(placeTourCard);
  }
  function startTour() {
    const root = document.getElementById("portal-tour");
    if (!root || !tourSteps().length) return;
    tourActive = true;
    tourIndex = 0;
    document.body.classList.add("is-touring");
    root.hidden = false;
    renderTourStep();
  }
  function stopTour() {
    const root = document.getElementById("portal-tour");
    tourActive = false;
    document.body.classList.remove("is-touring");
    clearTourTarget();
    if (root) root.hidden = true;
    markTourSeen();
    closeSidebar();
  }
  function advanceTour() {
    if (tourIndex >= tourSteps().length - 1) { stopTour(); return; }
    tourIndex += 1;
    renderTourStep();
  }
  function maybeStartTour() {
    if (tourActive || hasSeenTour()) return;
    if (!isNewPortalUser()) { markTourSeen(); return; }
    if (currentPage === "chooser") return;
    startTour();
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
    accountProjects = (Array.isArray(response?.projects) ? response.projects : accountProjects).map((item) => {
      if (item.id !== remote.project.id) return item;
      return { ...item, name: remote.project.name, service: remote.project.service, status: remote.project.status, stage: remote.project.stage, progress: remote.project.progress, isActive: remote.project.isActive };
    });
    if (remote.project?.id && !accountProjects.some((item) => item.id === remote.project.id)) {
      accountProjects.unshift({ ...remote.project, summary: {} });
    }
    state = normalizeState({ ...createEmptyState(), ...remote });
    state.initialized = true;
    rememberOpenProject(state.project.id);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { portalSettings = await window.GeeslaneAPI.readPortalSettings() || portalSettings; } catch (_) { /* bank details optional */ }
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
      authFeedback("We are reviewing your account. You will get an email when your portal is ready.", "notice");
      return false;
    }
    const wanted = parsePortalHash().params.get("project") || rememberedOpenProject();
    const openId = wanted && accountProjects.some((item) => item.id === wanted) ? wanted : "";
    await hydrateRemoteProject(openId);
    showPortal();
    restoreCommentRoute();
    const route = parsePortalHash();
    const nextPage = new URLSearchParams(location.search).get("next") || "";
    const many = listedProjects().length > 1;
    const hashPage = pageNames[route.page] ? route.page : "";
    const knownProject = Boolean(openId);
    const startHint = hashPage && hashPage !== "chooser" ? hashPage : (pageNames[nextPage] ? nextPage : "");
    if (many && !knownProject && !route.params.get("milestone")) {
      pendingWorkspacePage = startHint || "overview";
      navigate("chooser", { keepHash: true });
    } else {
      pendingWorkspacePage = "";
      const startPage = startHint || (!many && unpaidInvoices().length ? "payments" : "overview");
      navigate(resolvePage(startPage), { keepHash: true });
    }
    applyCommentLink();
    await confirmReturningPayment();
    maybeStartTour();
    const delay = document.getElementById("portal-tour") && !document.getElementById("portal-tour").hidden ? 12000 : 1500;
    setTimeout(() => window.GeeslanePWA?.enableNotifications?.("client"), delay);
    return true;
  }

  async function sendClientCode(email, button) {
    const address = String(email || "").trim();
    if (!address) { authFeedback("Enter a valid email address.", "error"); return; }
    window.GeeslaneAPI.setButtonBusy(button, true, "Sending code…");
    try {
      await window.GeeslaneAPI.requestMagicLink(address, "client", new URLSearchParams(location.search).get("next") || "");
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
      email: String(data.get("email") || "").trim(),
      phone: window.GeeslaneAPI?.readPhoneField?.("access-phone") || String(data.get("phone") || "").trim(),
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
      ], { client: details.name, business: details.business, email: details.email, project: details.business, subject: `Access request: ${details.business}` });
      form.reset();
      authFeedback("Your request has been sent. We will email you after we approve it.");
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
      navigate(resolvePage(currentPage === "overview" || currentPage === "chooser" ? "overview" : currentPage));
      toast(`Opened ${displayProjectName()}`);
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not switch project."));
      renderProjectSwitcher();
    } finally {
      event.target.disabled = false;
    }
  }

  async function openAccountProject(projectId, page = "project") {
    try {
      if (projectId && projectId !== state.project.id) await hydrateRemoteProject(projectId);
      pendingWorkspacePage = "";
      navigate(resolvePage(pageNames[page] ? page : "overview"));
      closeProjectSwitcher();
      maybeStartTour();
    } catch (error) {
      toast(window.GeeslaneAPI.userFacingError(error, "Could not open that project."));
    }
  }

  function wireEvents() {
    ui.wireRowMenus();
    document.getElementById("tour-skip")?.addEventListener("click", stopTour);
    document.getElementById("tour-next")?.addEventListener("click", advanceTour);
    addEventListener("resize", () => {
      if (!tourActive) return;
      if (usesOverlayNav()) closeSidebar();
      const step = tourSteps()[tourIndex];
      if (!step) return;
      clearTourTarget();
      const scope = usesOverlayNav() ? ".mobile-nav" : ".sidebar";
      document.querySelectorAll(`${scope} [data-page="${step.page}"]`).forEach((node) => node.classList.add("is-tour-target"));
      placeTourCard();
    });
    document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
    document.querySelectorAll("[data-go-page]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.goPage)));
    document.querySelectorAll("[data-open-request]").forEach((button) => button.addEventListener("click", () => openRequestModal()));
    document.getElementById("top-new-request").addEventListener("click", () => openRequestModal());
    document.getElementById("menu-button").addEventListener("click", openSidebar);
    document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
    document.getElementById("sidebar-scrim").addEventListener("click", closeSidebar);
    document.getElementById("notification-button").addEventListener("click", () => {
      closeAccountMenu();
      const popover = document.getElementById("notification-popover");
      popover.hidden = !popover.hidden;
    });
    document.getElementById("notification-close").addEventListener("click", () => { document.getElementById("notification-popover").hidden = true; });
    document.getElementById("top-account-button").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAccountMenu();
    });
    document.getElementById("account-menu-profile").addEventListener("click", () => navigate("profile"));
    document.getElementById("account-menu-signout").addEventListener("click", signOut);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".top-account-wrap")) closeAccountMenu();
      if (!event.target.closest(".sidebar-switcher")) closeProjectSwitcher();
    });
    document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) closeModal(backdrop.id.replace("-modal", "")); }));
    document.querySelectorAll("[data-request-type]").forEach((button) => button.addEventListener("click", () => chooseRequestType(button.dataset.requestType, true)));
    document.querySelectorAll("[data-request-back]").forEach((button) => button.addEventListener("click", () => showRequestStep(Number(button.dataset.requestBack))));
    document.getElementById("request-next-button").addEventListener("click", handleRequestNext);
    document.getElementById("request-confirm").addEventListener("change", (event) => { document.getElementById("request-next-button").disabled = !event.target.checked; });
    document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { currentFilter = button.dataset.filter; tablePages.requests = 1; document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("is-active", tab === button)); renderRequests(); }));
    document.getElementById("request-search").addEventListener("input", () => { tablePages.requests = 1; renderRequests(); });
    document.getElementById("client-invoice-search")?.addEventListener("input", () => { tablePages.invoices = 1; renderPayments(); });
    document.getElementById("client-receipt-search")?.addEventListener("input", () => { tablePages.receipts = 1; renderPayments(); });
    document.getElementById("add-resource-button")?.addEventListener("click", openResourceModal);
    document.getElementById("brand-add-resource").addEventListener("click", openResourceModal);
    document.getElementById("save-resource-button").addEventListener("click", saveResource);
    document.getElementById("edit-project-button").addEventListener("click", openProjectModal);
    document.getElementById("manage-brand-button").addEventListener("click", () => openNextSteps());
    document.getElementById("project-edit-progress").addEventListener("input", (event) => setText("project-progress-output", `${event.target.value}%`));
    document.getElementById("save-project-button").addEventListener("click", saveProject);
    document.getElementById("profile-form").addEventListener("submit", saveProfile);
    document.getElementById("brief-form").addEventListener("submit", saveBrief);
    document.getElementById("brief-form").addEventListener("change", () => syncOtherFeatureFields());
    document.getElementById("brand-form").addEventListener("submit", saveBrand);
    document.getElementById("content-form").addEventListener("submit", saveContent);
    document.getElementById("brand-form").addEventListener("input", previewBrandForm);
    document.querySelectorAll("[data-brand-tab]").forEach((button) => button.addEventListener("click", () => showBrandTab(button.dataset.brandTab, { scroll: true })));
    document.querySelectorAll("[data-brand-prev]").forEach((button) => button.addEventListener("click", () => moveBrandTab(-1)));
    document.querySelectorAll("[data-brand-next]").forEach((button) => button.addEventListener("click", () => moveBrandTab(1)));
    connectColourPair("brand-primary-picker", "brand-primary", "#0B6B45");
    connectColourPair("brand-secondary-picker", "brand-secondary", "#FFFFFF");
    connectColourPair("brand-accent-picker", "brand-accent", "#C83B3B");
    document.getElementById("open-upload-form").addEventListener("click", openUploadForm);
    document.getElementById("brand-file-input").addEventListener("change", uploadSelectedFiles);
    window.GeeslaneAPI?.bindPhoneFields?.();
    document.getElementById("download-agreement-pdf").addEventListener("click", () => window.GeeslaneAgreement.downloadPdf(currentAgreement()));
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
    document.getElementById("project-switcher-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = document.getElementById("project-switcher-menu");
      const button = event.currentTarget;
      if (!menu) return;
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    const openProjectClick = (event) => {
      const button = event.target.closest("[data-open-project]");
      if (!button) return;
      openAccountProject(button.dataset.openProject, button.dataset.openPage || pendingWorkspacePage || "overview");
    };
    document.getElementById("chooser-projects")?.addEventListener("click", openProjectClick);
    document.getElementById("overview-projects")?.addEventListener("click", openProjectClick);
    document.getElementById("sidebar-project-list")?.addEventListener("click", openProjectClick);
    document.getElementById("invoice-list")?.addEventListener("click", (event) => {
      const payBtn = event.target.closest("[data-pay-invoice]");
      if (payBtn) {
        const invoice = (state.invoices || []).find((item) => item.id === payBtn.dataset.payInvoice);
        if (invoice) payInvoice(invoice, payBtn);
        return;
      }
      const viewBtn = event.target.closest("[data-view-invoice]");
      const printBtn = event.target.closest("[data-print-invoice]");
      const invoice = (state.invoices || []).find((item) => item.id === (viewBtn?.dataset.viewInvoice || printBtn?.dataset.printInvoice));
      if (!invoice) return;
      if (viewBtn) window.GeeslaneInvoice?.view(invoiceForDownload(invoice));
      else window.GeeslaneInvoice?.downloadPdf(invoiceForDownload(invoice));
    });
    document.getElementById("payment-summary")?.addEventListener("click", (event) => {
      const payBtn = event.target.closest("[data-pay-invoice]");
      if (!payBtn) return;
      const invoice = (state.invoices || []).find((item) => item.id === payBtn.dataset.payInvoice);
      if (invoice) payInvoice(invoice, payBtn);
    });
    document.getElementById("receipt-list")?.addEventListener("click", (event) => {
      const printBtn = event.target.closest("[data-print-receipt]");
      const viewBtn = event.target.closest("[data-view-receipt]");
      const id = printBtn?.dataset.printReceipt || viewBtn?.dataset.viewReceipt;
      const receipt = (state.receipts || []).find((item) => item.id === id);
      if (!receipt) return;
      if (viewBtn) window.GeeslaneReceipt?.view(receiptForDownload(receipt));
      else window.GeeslaneReceipt?.downloadPdf(receiptForDownload(receipt));
    });
    window.addEventListener("hashchange", () => {
      const route = parsePortalHash();
      navigate(route.page === "chooser" ? "chooser" : (pageNames[route.page] ? route.page : "overview"), { keepHash: true, silent: true });
      applyCommentLink();
    });
    window.addEventListener("popstate", () => {
      if (document.getElementById("auth-screen").hidden) return;
      showAuthPanel("signin", { updateUrl: false });
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { document.querySelectorAll(".modal-backdrop:not([hidden])").forEach((modal) => closeModal(modal.id.replace("-modal", ""))); document.getElementById("notification-popover").hidden = true; closeAccountMenu(); closeProjectSwitcher(); closeSidebar(); } });
  }

  async function init() {
    rememberCommentRoute();
    loadState();
    wireEvents();
    const supportEmail = window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com";
    document.getElementById("support-link").href = `mailto:${supportEmail}`;
    showSignedOut();
    if (isAccessRoute()) {
      window.location.replace("./request.html");
      return;
    }
    const savedEmail = rememberedEmail();
    if (savedEmail) {
      pendingSignInEmail = savedEmail.toLowerCase();
      const emailInput = document.getElementById("signin-email");
      if (emailInput) emailInput.value = savedEmail;
    }
    showAuthPanel("signin", { updateUrl: false });
    if (window.GEESLANE_ENV_READY) await window.GEESLANE_ENV_READY;
    if (!window.GeeslaneAPI.backendConfigured()) {
      authFeedback("Portal sign-in is not connected on this host yet. Publish the latest client-portal/config.js, then refresh.", "notice");
      return;
    }
    const signingIn = window.GeeslaneAPI.hasIncomingMagicLink();
    if (signingIn) window.GeeslaneAPI.showLoader("Signing you in…");
    try {
      const authSession = await window.GeeslaneAPI.consumeMagicLink();
      if (authSession) await completeClientSignIn();
    } catch (error) {
      const arriving = window.GeeslaneAPI.hasIncomingMagicLink();
      if (!arriving) {
        try {
          const existing = await window.GeeslaneAPI.getSession();
          if (existing?.user) {
            await completeClientSignIn();
            return;
          }
        } catch (_) { /* stay signed out below */ }
      }
      try { await window.GeeslaneAPI.logout(); } catch (_) { /* signed-out UI still continues */ }
      sessionStorage.removeItem(STORAGE_KEY);
      showSignedOut();
      showAuthPanel("signin", { updateUrl: false });
      authFeedback(error.userMessage || window.GeeslaneAPI.userFacingError(error, "Sign-in could not be completed. Enter a new code from your email."), "error");
    } finally {
      if (signingIn) window.GeeslaneAPI.hideLoader();
    }
  }

  init();
})();
