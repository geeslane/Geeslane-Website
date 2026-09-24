(function () {
  "use strict";

  const SERVICES = {
    "website-new": "New Website",
    "website-revamp": "Website Revamp / Fixes",
    "domain-hosting": "Domain or Hosting Support",
    monitoring: "Monitoring & Support",
    automation: "AI Automation",
    strategy: "Digital Strategy / Advice"
  };

  const CHOICES = {
    features: ["Contact / enquiry form", "Blog / articles", "Online payments", "E-commerce / product sales", "Booking / appointments", "Newsletter signup", "User accounts / login", "WhatsApp integration", "Portfolio / gallery", "Other"],
    availableAssets: ["Logo", "Brand colours / fonts", "Website copy / written content", "Professional photos", "Product / service information", "Testimonials", "Privacy / legal content", "None yet"],
    improvementTypes: ["Visual / design improvement", "Mobile responsiveness", "Performance / speed", "Content updates", "Functionality fixes", "SEO / discoverability basics", "Complete redesign", "Not sure"],
    hostingHelp: ["Domain purchase", "Domain renewal", "DNS / configuration", "Hosting setup", "Hosting migration", "SSL / security certificate", "Business email", "Website / domain not working", "Not sure"],
    supportNeeds: ["Website updates", "Backups", "Security monitoring", "Performance monitoring", "Content updates", "Technical troubleshooting", "Ongoing maintenance", "Other"]
  };

  const STEP_REQUIRED = {
    1: ["business", "name", "email", "phone", "location", "industry", "businessDescription"],
    2: ["service"],
    3: {
      "website-new": ["purpose", "audience", "hasDomain", "hasHosting"],
      "website-revamp": ["existingUrl", "notWorking", "changesWanted", "adminAccess"],
      "domain-hosting": ["domainName", "hostingHelp", "issue"],
      monitoring: ["supportUrl", "supportNeeds", "urgent"],
      automation: ["automationNeed"],
      strategy: ["businessProblem", "notWorkingWell", "successLookLike"]
    },
    4: ["confirmAccurate", "confirmNoContract", "confirmFollowUp"]
  };

  const DETAIL_LABELS = [
    ["business", "Business / Organisation"],
    ["name", "Contact Person"],
    ["email", "Email Address"],
    ["phone", "Phone / WhatsApp"],
    ["location", "Business Location"],
    ["industry", "Industry / Business Type"],
    ["websiteUrl", "Website URL"],
    ["socialLinks", "Social Media Links"],
    ["businessDescription", "Business Description"],
    ["heardAbout", "How They Heard About Geeslane"],
    ["serviceLabel", "Service"],
    ["purpose", "Primary Purpose"],
    ["audience", "Who the Website Should Serve"],
    ["features", "Features Needed"],
    ["featuresOther", "Other Features"],
    ["visitorDetails", "Anything Else Visitors Should Be Able to Do"],
    ["hasDomain", "Has a Domain Name"],
    ["hasHosting", "Has Website Hosting"],
    ["availableAssets", "Assets Available"],
    ["references", "Reference Websites"],
    ["websiteNotes", "Website Notes"],
    ["existingUrl", "Existing Website URL"],
    ["notWorking", "What Is Not Working"],
    ["changesWanted", "Changes Wanted"],
    ["improvementTypes", "Kind of Improvement"],
    ["prompted", "What Prompted This"],
    ["platform", "Current Platform / CMS"],
    ["revampHosting", "Current Hosting Provider"],
    ["adminAccess", "Administrator Access"],
    ["revampNotes", "Existing Website Notes"],
    ["domainName", "Domain Name"],
    ["registrar", "Current Registrar"],
    ["hostingProvider", "Hosting Provider"],
    ["hostingHelp", "Help Needed"],
    ["issue", "Issue or Request"],
    ["issueStarted", "When the Issue Started"],
    ["supportUrl", "Website URL"],
    ["supportNeeds", "Support Needed"],
    ["urgent", "Urgent or Broken Issues"],
    ["currentSupport", "Current Support Arrangement"],
    ["automationNeed", "What Should Be Automated"],
    ["automationTools", "Tools or Systems Involved"],
    ["automationSuccess", "What Success Looks Like"],
    ["businessProblem", "Business Problem"],
    ["digitalChannels", "Digital Channels"],
    ["notWorkingWell", "What Is Not Working Well"],
    ["successLookLike", "What Success Looks Like"],
    ["alreadyTried", "What They Have Already Tried"],
    ["timing", "Preferred Timing"],
    ["anythingElse", "Anything Else"]
  ];

  const DRAFT_KEY = "geeslane.serviceRequest.draft";
  const CONFIRM_FIELDS = new Set(["confirmAccurate", "confirmNoContract", "confirmFollowUp"]);

  let step = 1;
  let service = "";
  let saveTimer = 0;
  let submitted = false;

  function form() { return document.getElementById("service-request-form"); }
  function valueOf(name) {
    const node = form().elements[name];
    if (!node) return "";
    if (typeof node.length === "number" && node[0] && node[0].type === "checkbox") {
      return [...node].filter((item) => item.checked).map((item) => item.value).join(", ");
    }
    if (node.type === "checkbox") return node.checked ? "Yes" : "";
    return String(node.value || "").trim();
  }

  function setError(message) {
    const node = document.getElementById("request-error");
    node.hidden = !message;
    node.textContent = message || "";
  }

  function fillChoices() {
    Object.entries(CHOICES).forEach(([name, options]) => {
      document.querySelectorAll(`[data-choice-group="${name}"]`).forEach((root) => {
        root.innerHTML = options.map((option) => `<label class="choice-item"><input type="checkbox" name="${name}" value="${option.replace(/"/g, "&quot;")}" /><span>${option}</span></label>`).join("");
      });
    });
  }

  function syncOtherFields() {
    document.querySelectorAll("[data-other-for]").forEach((field) => {
      const name = field.dataset.otherFor;
      const selected = String(valueOf(name) || "").split(/\s*,\s*/);
      const show = selected.some((item) => /^other$/i.test(item));
      field.hidden = !show;
      if (!show) {
        const input = field.querySelector("input, textarea");
        if (input) input.value = "";
      }
    });
  }

  function collectDraft() {
    const fields = {};
    const checks = {};
    [...form().elements].forEach((el) => {
      if (!el.name || CONFIRM_FIELDS.has(el.name)) return;
      if (el.type === "checkbox") {
        if (!checks[el.name]) checks[el.name] = [];
        if (el.checked) checks[el.name].push(el.value);
        return;
      }
      if (el.type === "button" || el.type === "submit") return;
      fields[el.name] = el.value;
    });
    return { step, service, fields, checks };
  }

  function saveDraft() {
    if (submitted) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
    } catch (_) {}
  }

  function scheduleDraftSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 200);
  }

  function clearDraft() {
    clearTimeout(saveTimer);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }

  function restoreDraft() {
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "");
    } catch (_) {
      return false;
    }
    if (!draft || typeof draft !== "object") return false;
    step = Math.min(4, Math.max(1, Number(draft.step) || 1));
    service = draft.service || "";
    if (step >= 3 && !service) step = 2;
    if (form().elements.service) form().elements.service.value = service;
    document.querySelectorAll("[data-service]").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.service === service);
    });
    Object.entries(draft.fields || {}).forEach(([name, value]) => {
      const node = form().elements[name];
      if (!node || node.type === "checkbox") return;
      node.value = value == null ? "" : String(value);
    });
    Object.entries(draft.checks || {}).forEach(([name, values]) => {
      const nodes = form().elements[name];
      if (!nodes) return;
      const wanted = new Set(Array.isArray(values) ? values : []);
      const list = nodes.length !== undefined ? [...nodes] : [nodes];
      list.forEach((item) => {
        if (item.type === "checkbox") item.checked = wanted.has(item.value);
      });
    });
    return true;
  }

  function showStep(next) {
    step = next;
    document.querySelectorAll(".request-step").forEach((panel) => panel.classList.toggle("is-visible", Number(panel.dataset.step) === step));
    document.querySelectorAll("[data-step-indicator]").forEach((item) => item.classList.toggle("is-active", Number(item.dataset.stepIndicator) <= step));
    document.getElementById("request-back").hidden = step === 1;
    document.getElementById("request-next").textContent = step === 4 ? "Send Request" : "Continue";
    document.getElementById("request-actions").hidden = false;
    setError("");
    if (step === 3) {
      document.querySelectorAll("[data-service-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.servicePanel !== service;
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    saveDraft();
  }

  function missingOnStep() {
    if (step === 1) {
      const email = valueOf("email");
      if (valueOf("business").length < 2) return "Enter the business or organisation name.";
      if (valueOf("name").length < 2) return "Enter the contact person’s name.";
      if (email.indexOf("@") < 1) return "Enter a valid email address.";
      if ((window.GeeslaneAPI?.readPhoneField?.("phone") || valueOf("phone")).replace(/\D/g, "").length < 7) return "Enter a phone or WhatsApp number.";
      if (!valueOf("location")) return "Enter the business location.";
      if (!valueOf("industry")) return "Enter the industry or business type.";
      if (valueOf("businessDescription").length < 5) return "Describe the business in a few sentences.";
      return "";
    }
    if (step === 2) return service ? "" : "Choose what you would like Geeslane to help with.";
    if (step === 3) {
      const required = STEP_REQUIRED[3][service] || [];
      for (const name of required) {
        if (!valueOf(name)) return "Please complete the highlighted details for this service.";
      }
      if (/\bother\b/i.test(valueOf("features")) && !valueOf("featuresOther")) {
        return "Please describe the other features you need.";
      }
      return "";
    }
    if (step === 4) {
      if (!form().elements.confirmAccurate.checked || !form().elements.confirmNoContract.checked || !form().elements.confirmFollowUp.checked) {
        return "Please confirm the three statements before sending.";
      }
    }
    return "";
  }

  function payload() {
    const discovery = {
      business: valueOf("business"),
      name: valueOf("name"),
      email: valueOf("email"),
      phone: window.GeeslaneAPI?.readPhoneField?.("phone") || valueOf("phone"),
      location: valueOf("location"),
      industry: valueOf("industry"),
      websiteUrl: valueOf("websiteUrl"),
      socialLinks: valueOf("socialLinks"),
      businessDescription: valueOf("businessDescription"),
      heardAbout: valueOf("heardAbout"),
      service,
      serviceLabel: SERVICES[service] || service,
      purpose: valueOf("purpose"),
      audience: valueOf("audience"),
      features: valueOf("features"),
      featuresOther: valueOf("featuresOther"),
      visitorDetails: valueOf("visitorDetails"),
      hasDomain: valueOf("hasDomain"),
      hasHosting: valueOf("hasHosting"),
      availableAssets: valueOf("availableAssets"),
      references: valueOf("references"),
      websiteNotes: valueOf("websiteNotes"),
      existingUrl: valueOf("existingUrl"),
      notWorking: valueOf("notWorking"),
      changesWanted: valueOf("changesWanted"),
      improvementTypes: valueOf("improvementTypes"),
      prompted: valueOf("prompted"),
      platform: valueOf("platform"),
      revampHosting: valueOf("revampHosting"),
      adminAccess: valueOf("adminAccess"),
      revampNotes: valueOf("revampNotes"),
      domainName: valueOf("domainName"),
      registrar: valueOf("registrar"),
      hostingProvider: valueOf("hostingProvider"),
      hostingHelp: valueOf("hostingHelp"),
      issue: valueOf("issue"),
      issueStarted: valueOf("issueStarted"),
      supportUrl: valueOf("supportUrl"),
      supportNeeds: valueOf("supportNeeds"),
      urgent: valueOf("urgent"),
      currentSupport: valueOf("currentSupport"),
      automationNeed: valueOf("automationNeed"),
      automationTools: valueOf("automationTools"),
      automationSuccess: valueOf("automationSuccess"),
      businessProblem: valueOf("businessProblem"),
      digitalChannels: valueOf("digitalChannels"),
      notWorkingWell: valueOf("notWorkingWell"),
      successLookLike: valueOf("successLookLike"),
      alreadyTried: valueOf("alreadyTried"),
      timing: valueOf("timing"),
      anythingElse: valueOf("anythingElse")
    };
    const description = discovery.businessDescription
      || discovery.purpose
      || discovery.changesWanted
      || discovery.issue
      || discovery.automationNeed
      || discovery.businessProblem
      || discovery.urgent
      || SERVICES[service];
    return {
      name: discovery.name,
      business: discovery.business,
      email: discovery.email,
      phone: discovery.phone,
      contact: "WhatsApp",
      service: SERVICES[service] || service,
      description,
      discovery
    };
  }

  function detailRows(discovery) {
    return DETAIL_LABELS
      .map(([key, label]) => [label, String(discovery?.[key] || "").trim()])
      .filter(([, value]) => value);
  }

  function websiteUrl() {
    try {
      return new URL("../", location.href).href;
    } catch (_) {
      return "https://geeslane.com/";
    }
  }

  function showRequestReceived() {
    submitted = true;
    clearDraft();
    try {
      form().reset();
      service = "";
      step = 1;
    } catch (_) {}
    const card = document.getElementById("request-card");
    if (card) card.hidden = true;
    const title = document.getElementById("request-title");
    if (title) title.textContent = "Request Received";
    const lead = document.getElementById("request-lead");
    if (lead) {
      lead.hidden = false;
      lead.textContent = "Thank you. Geeslane will review this and email you.";
    }
    const note = document.querySelector(".request-note");
    if (note) note.hidden = true;
    const followup = document.getElementById("request-followup");
    if (followup) followup.hidden = false;
  }

  async function submitRequest() {
    const details = payload();
    const button = document.getElementById("request-next");
    window.GeeslaneAPI.setButtonBusy(button, true);
    try {
      await window.GeeslaneAPI.requestAccess(details);
      const who = window.GeeslaneMail?.respectfulName(details.name) || details.name;
      const rows = detailRows(details.discovery);
      try {
        await Promise.all([
          window.GeeslaneMail?.notify({
            audience: "team",
            kind: "service-request",
            subject: `Service Request · ${details.business}`,
            heading: "Service Request Received",
            intro: `${who} from ${details.business} submitted a service request. Every answer they provided is below.`,
            rows,
            clientEmail: details.email,
            fromName: details.name,
            replyTo: details.email,
            ctaPage: "admin",
            ctaLabel: "Open Admin Portal"
          }),
          window.GeeslaneMail?.notify({
            audience: "client",
            kind: "service-request",
            subject: `We Received Your Request · ${details.business}`,
            heading: "We Received Your Request",
            intro: "Thank you. Geeslane will review this and email you. A copy of what you sent is below.",
            rows,
            greetingName: details.name,
            clientEmail: details.email,
            replyTo: window.GEESLANE_CONFIG?.supportEmail || "contact@geeslane.com",
            ctaUrl: websiteUrl(),
            ctaLabel: "Visit Geeslane"
          })
        ]);
      } catch (_) { /* the request is already saved */ }
      clearDraft();
      showRequestReceived();
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const message = error.userMessage || window.GeeslaneAPI.userFacingError(error, "The request could not be sent. Please try again.");
      if (/already has a Geeslane|sign in instead/i.test(`${message} ${error?.message || ""}`)) {
        setError("This email already has a Geeslane portal account. Sign in instead of sending another request.");
      } else {
        setError(message);
      }
    } finally {
      window.GeeslaneAPI.setButtonBusy(button, false);
    }
  }

  function goNext() {
    const missing = missingOnStep();
    if (missing) { setError(missing); return; }
    if (step === 4) { submitRequest(); return; }
    showStep(step + 1);
  }

  document.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", () => {
      service = button.dataset.service;
      form().elements.service.value = service;
      document.querySelectorAll("[data-service]").forEach((item) => item.classList.toggle("is-selected", item === button));
      setError("");
      saveDraft();
    });
  });
  document.querySelectorAll("[data-go-step]").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.goStep))));
  document.getElementById("request-back").addEventListener("click", () => showStep(Math.max(1, step - 1)));
  document.getElementById("request-next").addEventListener("click", goNext);
  form().addEventListener("submit", (event) => { event.preventDefault(); goNext(); });
  form().addEventListener("input", scheduleDraftSave);
  form().addEventListener("change", () => {
    syncOtherFields();
    scheduleDraftSave();
  });
  window.addEventListener("pagehide", saveDraft);

  fillChoices();
  window.GeeslaneAPI?.bindPhoneFields?.(form());
  const restored = restoreDraft();
  window.GeeslaneAPI?.fillPhoneField?.("phone", valueOf("phone"));
  syncOtherFields();
  showStep(restored ? step : 1);
  if (window.GEESLANE_ENV_READY) {
    window.GEESLANE_ENV_READY.then(() => {
      if (!window.GeeslaneAPI?.backendConfigured()) {
        setError("This form is not connected on this host yet. Publish the latest client-portal/config.js, then refresh.");
      }
    });
  }
})();
