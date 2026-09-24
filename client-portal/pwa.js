(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  const host = location.hostname;
  const secure = location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
  if (!secure) return;

  const ASKED_KEY = "geeslane-push-asked";

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

  function registerWorker() {
    return navigator.serviceWorker.register("./sw.js", { scope: "./" });
  }

  async function enableNotifications(audience = "client") {
    if (!("Notification" in window) || !("PushManager" in window)) return false;
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

  window.addEventListener("load", () => {
    registerWorker().catch(() => {});
  });

  window.GeeslanePWA = Object.freeze({ enableNotifications });
})();
