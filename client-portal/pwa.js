(function () {
  "use strict";
  const ASKED_KEY = "geeslane-push-asked";
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || window.navigator.standalone === true;
  }

  function isLikelyMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
      || window.matchMedia("(max-width: 820px)").matches;
  }

  function canInstall() {
    return Boolean(deferredPrompt);
  }

  async function promptInstall() {
    if (!deferredPrompt) return false;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
    return choice?.outcome === "accepted";
  }

  function vapidKey() {
    return String(window.GEESLANE_CONFIG?.vapidPublicKey || "").trim();
  }

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function enableNotifications(audience = "client") {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return false;
    const publicKey = vapidKey();
    if (!publicKey || !window.GeeslaneAPI?.savePushSubscription) return false;
    if (Notification.permission === "denied") return false;
    if (Notification.permission !== "granted") {
      if (sessionStorage.getItem(ASKED_KEY)) return false;
      sessionStorage.setItem(ASKED_KEY, "1");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    const json = subscription.toJSON();
    return window.GeeslaneAPI.savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      audience
    });
  }

  const host = location.hostname;
  const secure = location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
  if ("serviceWorker" in navigator && secure) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    });
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      window.dispatchEvent(new Event("geeslane-install-available"));
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      window.dispatchEvent(new Event("geeslane-app-installed"));
    });
  }

  window.GeeslanePWA = Object.freeze({
    enableNotifications,
    isStandalone,
    isLikelyMobile,
    canInstall,
    promptInstall
  });
})();
