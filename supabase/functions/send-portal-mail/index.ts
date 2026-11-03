import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function communityManagerRecipients() {
  const seen = new Map<string, string>();
  for (const item of String(Deno.env.get("COMMUNITY_MANAGER_EMAIL") || "").split(/[,;]+/)) {
    const email = item.trim();
    if (validEmail(email)) seen.set(email.toLowerCase(), email);
  }
  return [...seen.values()];
}

function oneLine(value: unknown, max = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function looksLikeHtml(value: string) {
  return /<!doctype html/i.test(value) || /<\/?[a-z][\s\S]*>/i.test(value);
}

function htmlToText(value: string) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function smsNumber(raw: unknown, defaultCountry = "234") {
  let digits = String(raw || "").trim();
  if (!digits) return "";
  digits = digits.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0") && defaultCountry) digits = `${defaultCountry}${digits.slice(1)}`;
  if (defaultCountry === "234" && digits.length === 10 && /^[789]/.test(digits)) digits = `234${digits}`;
  if (digits.length < 10 || digits.length > 15) return "";
  return digits;
}

function smsReady() {
  const termii = Boolean(Deno.env.get("TERMII_API_KEY"));
  const twilio = Boolean(Deno.env.get("TWILIO_ACCOUNT_SID") && Deno.env.get("TWILIO_AUTH_TOKEN") && Deno.env.get("TWILIO_FROM"));
  return termii || twilio;
}

function teamSmsNumbers(defaultCountry: string) {
  const unique = new Set<string>();
  for (const part of String(Deno.env.get("NOTIFY_TEAM_PHONE") || "").split(/[,;]+/)) {
    const n = smsNumber(part, defaultCountry);
    if (n) unique.add(n);
  }
  return [...unique];
}

function smsErrorText(raw: unknown) {
  return oneLine(raw, 180);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

async function mailAttachment(item: { filename?: string; path?: string; url?: string; content?: string }) {
  const filename = String(item?.filename || "document.pdf").replace(/[^\w.\- ]+/g, "").slice(0, 120) || "document.pdf";
  let content = String(item?.content || "").replace(/\s+/g, "");
  if (content.length > 7000000) content = "";
  const path = String(item?.path || item?.url || "").trim();
  if (!content && /^https:\/\//i.test(path)) {
    try {
      const file = await fetch(path);
      if (!file.ok) return null;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.length || bytes.length > 5000000) return null;
      content = bytesToBase64(bytes);
    } catch (_) {
      return null;
    }
  }
  if (!content) return null;
  return { filename, content };
}

function smsText(payload: Record<string, unknown>) {
  const heading = oneLine(payload.heading || payload.subject, 80);
  const intro = oneLine(payload.intro, 140);
  const link = String(payload.ctaUrl || "").trim();
  const core = [heading, intro].filter(Boolean).join(". ");
  return `Geeslane: ${core}${link ? ` ${link}` : ""}`.slice(0, 480);
}

function pushReady() {
  return Boolean(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY"));
}

function pushNote(payload: Record<string, unknown>) {
  return {
    title: oneLine(payload.heading || payload.subject, 60) || "Geeslane",
    body: oneLine(payload.intro, 140) || "You have a new portal update.",
    url: String(payload.ctaUrl || "").trim() || "https://geeslane.com/client-portal/"
  };
}

async function sendWebPush(audience: string, clientEmail: string, payload: Record<string, unknown>) {
  if (!pushReady()) return false;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceKey) return false;
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:contact@geeslane.com",
    Deno.env.get("VAPID_PUBLIC_KEY") || "",
    Deno.env.get("VAPID_PRIVATE_KEY") || ""
  );
  const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey);
  const { data: rows } = await adminClient
    .from("portal_push_subscriptions")
    .select("id,endpoint,p256dh,auth,audience,user_id");
  let targets = rows || [];
  if (audience === "team") targets = targets.filter((row) => row.audience === "team");
  else if (audience === "client") {
    if (!validEmail(clientEmail)) return false;
    const { data: profile } = await adminClient.from("profiles").select("user_id").ilike("email", clientEmail).maybeSingle();
    const uid = profile?.user_id;
    targets = uid ? targets.filter((row) => row.user_id === uid) : [];
  } else {
    const { data: profile } = validEmail(clientEmail)
      ? await adminClient.from("profiles").select("user_id").ilike("email", clientEmail).maybeSingle()
      : { data: null };
    const uid = profile?.user_id;
    targets = targets.filter((row) => row.audience === "team" || (uid && row.user_id === uid));
  }
  if (!targets.length) return false;
  const note = JSON.stringify(pushNote(payload));
  const results = await Promise.all(targets.map(async (row) => {
    try {
      await webpush.sendNotification({
        endpoint: String(row.endpoint),
        keys: { p256dh: String(row.p256dh), auth: String(row.auth) }
      }, note);
      return true;
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode || 0);
      if (status === 404 || status === 410) {
        await adminClient.from("portal_push_subscriptions").delete().eq("id", row.id);
      } else {
        console.error("portal-push-fail", JSON.stringify({ status, endpointLast: String(row.endpoint).slice(-24) }));
      }
      return false;
    }
  }));
  return results.some(Boolean);
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!to || !body) return { ok: false, error: "Missing number" };
  const termiiKey = Deno.env.get("TERMII_API_KEY") || "";
  if (termiiKey) {
    const sender = String(Deno.env.get("TERMII_SENDER_ID") || "Geeslane").replace(/\s+/g, "").slice(0, 11);
    const channel = String(Deno.env.get("TERMII_CHANNEL") || "generic").trim().toLowerCase() || "generic";
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: termiiKey,
        to,
        from: sender,
        sms: body,
        type: "plain",
        channel
      })
    });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    const message = smsErrorText(result.message || result.error || result.msg);
    const code = String(result.code || "");
    if (result.message_id || /success/i.test(message) || code.toLowerCase() === "ok") return { ok: true };
    const error = message || `Termii HTTP ${response.status}`;
    console.error("termii-sms-fail", JSON.stringify({
      status: response.status,
      channel,
      sender,
      toLast4: to.slice(-4),
      code,
      error
    }));
    return { ok: false, error };
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const from = Deno.env.get("TWILIO_FROM") || "";
  if (!sid || !token || !from) return { ok: false, error: "SMS is not configured" };
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: `+${to}`, From: from, Body: body })
  });
  if (response.ok) return { ok: true };
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: false, error: smsErrorText(result.message || result.error) || `Twilio HTTP ${response.status}` };
}

function escapeHtmlMail(value: string) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
}

async function sendFixedMail(apiKey: string, mailFrom: string, to: string | string[], subject: string, text: string) {
  const seen = new Map<string, string>();
  for (const item of Array.isArray(to) ? to : [to]) {
    const email = String(item || "").trim();
    if (validEmail(email)) seen.set(email.toLowerCase(), email);
  }
  const recipients = [...seen.values()];
  if (!apiKey || !recipients.length) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: mailFrom,
      to: recipients,
      subject,
      text,
      html: `<div style="font-family:sans-serif;line-height:1.5">${escapeHtmlMail(text).replace(/\n/g, "<br>")}</div>`
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("resend-fail", JSON.stringify({ status: response.status, error: oneLine(errText, 400).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"), kind: "partner-fixed" }));
    return false;
  }
  return true;
}

function lagosWhen(value: unknown, withTime: boolean) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", withTime
    ? { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" }
  ).format(date);
}

function nairaMail(value: unknown) {
  return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function deliverPartnerNotification(serviceKey: string, apiKey: string, mailFrom: string, notificationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) return json({ sent: false, skipped: true });
  const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const claimed = await adminClient.rpc("claim_partner_notification", { p_id: notificationId });
  if (claimed.error) {
    console.error("partner-notification-claim", JSON.stringify({ id: notificationId, error: oneLine(claimed.error.message, 180) }));
    return json({ sent: false, recorded: true });
  }
  let mail = claimed.data as Record<string, unknown> | string | null;
  if (typeof mail === "string") {
    try { mail = JSON.parse(mail) as Record<string, unknown>; } catch { mail = null; }
  }
  if (!mail) return json({ sent: false, skipped: true });

  const role = String(mail.role || "");
  const eventType = String(mail.eventType || "");
  const partnerName = String(mail.partnerName || "A Geeslane partner");
  const lines = Array.isArray(mail.lines) ? mail.lines as Array<Record<string, unknown>> : [];
  const projects = lines.map((item) => String(item.project || "")).filter(Boolean);
  const projectLabel = projects.join(", ") || "Project";
  const breakdown = lines.map((item) => `- ${String(item.project || "Project")}: ${nairaMail(item.commission)}`).join("\n");
  let to: string | string[] = "";
  let subject = "";
  let text = "";

  if (eventType === "referral_received" && role === "community_manager") {
    to = communityManagerRecipients();
    subject = `🎉 New Client Referral – ${partnerName}`;
    text = [
      "Hello,",
      "",
      "We have a new client referral!",
      "",
      "One of our Geeslane Partners has successfully referred a potential client to Geeslane.",
      "",
      "Partner Details",
      `- Partner Name: ${partnerName}`,
      `- Partner Phone Number: ${String(mail.partnerPhone || "")}`,
      `- Referral Code: ${String(mail.code || "")}`,
      "",
      "Referral Details",
      `- Business/Client Name: ${String(mail.business || "")}`,
      `- Service Requested: ${String(mail.service || "")}`,
      `- Date Registered: ${lagosWhen(mail.registeredAt, true)} (Africa/Lagos)`,
      "",
      "This is a great opportunity to recognise the partner's effort.",
      "",
      "Community Manager Action:",
      `Please celebrate ${partnerName} in the existing Geeslane Partners WhatsApp group and encourage other partners to keep sharing their referral links.`,
      "",
      "This notification means a referral request has been registered. It does not mean the client has paid, the referral is qualified, or commission has been earned.",
      "",
      `Congratulations to ${partnerName}! 💚`
    ].join("\n");
  } else if (eventType === "payout_paid" && role === "partner") {
    to = String(mail.partnerEmail || "").trim();
    subject = "💚 Your Geeslane Partner Commission Has Been Paid!";
    text = [
      `Hello ${partnerName},`,
      "",
      "Good news! Your Geeslane Partner commission has been successfully transferred. 🎉",
      "",
      "Here are your payment details:",
      "",
      `- Project: ${projectLabel}`,
      ...(breakdown ? [breakdown] : []),
      `- Commission Amount: ${nairaMail(mail.amount)}`,
      `- Payment Date: ${lagosWhen(mail.paidOn, false)}`,
      `- Payment Reference: ${String(mail.reference || "")}`,
      "",
      "Thank you for connecting businesses to Geeslane and participating in our November Refer & Earn programme.",
      "",
      "We appreciate your contribution and look forward to more successful connections!",
      "",
      "Geeslane",
      "Scale your business with technology & AI."
    ].join("\n");
  } else if (eventType === "payout_paid" && role === "community_manager") {
    to = communityManagerRecipients();
    subject = `🎉 Partner Commission Paid – ${partnerName}`;
    text = [
      "Hello,",
      "",
      "A Geeslane Partner has received a commission payment!",
      "",
      `Partner: ${partnerName}`,
      `Phone: ${String(mail.partnerPhone || "")}`,
      `Project: ${projectLabel}`,
      ...(breakdown ? [breakdown] : []),
      `Commission Paid: ${nairaMail(mail.amount)}`,
      `Payment Date: ${lagosWhen(mail.paidOn, false)}`,
      `Payment Reference: ${String(mail.reference || "")}`,
      "",
      "Community Manager Action:",
      "",
      `Please celebrate ${partnerName} in the existing Geeslane Partners WhatsApp group.`,
      "",
      "Only announce the payment publicly if the partner has given permission for their payment achievement to be shared. Otherwise, use a general appreciation message without revealing their payment amount or other private details.",
      "",
      `Congratulations to ${partnerName}! 💚`
    ].join("\n");
  } else {
    await adminClient.rpc("fail_partner_notification", { p_id: notificationId, p_error: "This notification could not be prepared." });
    console.error("partner-notification-skip", JSON.stringify({ id: notificationId, reason: "unprepared" }));
    return json({ sent: false, recorded: true });
  }

  const ready = (Array.isArray(to) ? to : [to]).some((item) => validEmail(String(item || "").trim()));
  if (!ready) {
    const reason = role === "community_manager" ? "COMMUNITY_MANAGER_EMAIL is not configured." : "The partner email is missing.";
    await adminClient.rpc("fail_partner_notification", { p_id: notificationId, p_error: reason });
    console.error("partner-notification-skip", JSON.stringify({ id: notificationId, role, reason: role === "community_manager" ? "community-manager-email-missing" : "partner-email-missing" }));
    return json({ sent: false, recorded: true });
  }

  const emailed = await sendFixedMail(apiKey, mailFrom, to, subject, text);
  if (!emailed) {
    await adminClient.rpc("fail_partner_notification", { p_id: notificationId, p_error: "The email service did not accept the message." });
    console.error("partner-notification-fail", JSON.stringify({ id: notificationId, role, eventType }));
    return json({ sent: false, recorded: true });
  }
  await adminClient.rpc("complete_partner_notification", { p_id: notificationId });
  console.log("partner-notification-sent", JSON.stringify({ id: notificationId, role, eventType }));
  return json({ sent: true, email: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const teamTo = Deno.env.get("NOTIFY_TEAM_EMAIL") || "contact@geeslane.com";
  const mailFrom = Deno.env.get("MAIL_FROM") || "Geeslane <no-reply@auth.geeslane.com>";
  const defaultCountry = Deno.env.get("SMS_DEFAULT_COUNTRY") || "234";
  const canSms = smsReady();

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in required" }, 401);

    const payload = await req.json();
    const subject = String(payload.subject || "").trim().slice(0, 180);
    let html = String(payload.html || "").trim().slice(0, 120000);
    let text = String(payload.text || "").trim().slice(0, 40000);
    if (!html && looksLikeHtml(text)) {
      html = text.slice(0, 120000);
      text = htmlToText(html).slice(0, 40000);
    } else if (text && looksLikeHtml(text)) {
      text = htmlToText(text).slice(0, 40000);
    }
    const audience = payload.audience === "client" || payload.audience === "both" ? payload.audience : "team";
    const kind = String(payload.kind || "").trim();
    const isServiceRequest = kind === "service-request";
    const isPartnerWelcome = kind === "partner-welcome";
    const isPartnerAdminAlert = kind === "partner-admin-alert";
    const isPartnerReferralAlert = kind === "partner-referral-alert";
    const isPartnerNotification = kind === "partner-notification";
    const isEnsureUser = kind === "ensure-user";
    if (!isEnsureUser && !isPartnerAdminAlert && !isPartnerReferralAlert && !isPartnerNotification && (!subject || (!html && !text))) return json({ error: "Missing mail" }, 400);

    const accessToken = authHeader.slice(7).trim();
    if (isPartnerNotification) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceKey || accessToken !== serviceKey) return json({ error: "Sign in required" }, 401);
      return await deliverPartnerNotification(serviceKey, apiKey, mailFrom, String(payload.notificationId || ""));
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const signedIn = Boolean(authData?.user) && !authError;
    if (!signedIn && !isServiceRequest && !isPartnerWelcome && !isPartnerAdminAlert && !isPartnerReferralAlert) return json({ error: "Sign in required" }, 401);

    const { data: profile } = signedIn
      ? await supabase.from("profiles").select("role,status,email").eq("user_id", authData.user.id).maybeSingle()
      : { data: null };
    const isAdmin = profile?.role === "admin" && profile?.status === "active";

    if (isPartnerAdminAlert || isPartnerReferralAlert) {
      if (isPartnerReferralAlert && !isPartnerAdminAlert) return json({ sent: false, email: false, skipped: true });
      const alertEmail = String(payload.clientEmail || payload.replyTo || "").trim().toLowerCase();
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceKey) {
        console.error("partner-alert-skip", "Mail is not configured");
        return json({ error: "Mail is not configured" }, 503);
      }
      const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      if (!validEmail(alertEmail)) return json({ error: "Missing email" }, 400);
      if (isPartnerAdminAlert) {
        let query = adminClient.from("partners").select("id, full_name, email, phone, code, created_at").ilike("email", alertEmail).limit(1);
        if (!isAdmin) query = query.gte("created_at", new Date(Date.now() - 20 * 60 * 1000).toISOString());
        const { data: partnerRows } = await query;
        const partner = partnerRows?.[0];
        if (!partner) return json({ error: "Partner not found" }, 403);
        const when = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
        }).format(new Date(partner.created_at));
        const link = `https://geeslane.com/client-portal/admin.html#partners?partner=${partner.id}`;
        const text = [
          "A new Geeslane partner registered.",
          "",
          `Name: ${partner.full_name}`,
          `Email: ${partner.email}`,
          `Phone: ${partner.phone || ""}`,
          `Referral code: ${partner.code}`,
          `Registered: ${when} (Africa/Lagos)`,
          "",
          `Open the partner record: ${link}`
        ].join("\n");
        const emailed = await sendFixedMail(apiKey, mailFrom, teamTo, "New Geeslane partner registration", text);
        if (!emailed) console.error("partner-admin-alert-fail", JSON.stringify({ partnerId: partner.id }));
        return json(emailed ? { sent: true, email: true } : { error: "Send failed" }, emailed ? 200 : 502);
      }
      return json({ sent: false, email: false, skipped: true });
    }

    const clientEmail = String(payload.clientEmail || payload.replyTo || "").trim().toLowerCase();
    if (isEnsureUser) {
      if (!isAdmin) return json({ error: "Administrator access required" }, 403);
      if (!validEmail(clientEmail)) return json({ error: "Missing email" }, 400);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceKey) return json({ error: "Mail is not configured" }, 503);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const name = oneLine(payload.name || payload.full_name, 80);
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: clientEmail,
        email_confirm: true,
        user_metadata: {
          name,
          full_name: name,
          business: oneLine(payload.business, 80)
        }
      });
      if (createError && !/already|registered|exists/i.test(String(createError.message || ""))) {
        console.error("ensure-user", createError.message);
        return json({ error: "Could not prepare the client login" }, 502);
      }
      return json({ sent: true, email: false, sms: false, user: true });
    }
    if (isServiceRequest && !signedIn) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (serviceKey && validEmail(clientEmail)) {
        const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey);
        const { data: rows } = await adminClient
          .from("registrations")
          .select("id")
          .ilike("email", clientEmail)
          .eq("status", "Pending")
          .limit(1);
        if (!rows?.length) return json({ error: "Request not found" }, 403);
      }
    }
    if (isPartnerWelcome && !isAdmin) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceKey || !validEmail(clientEmail)) return json({ error: "Missing email" }, 400);
      const adminClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: partnerRows } = await adminClient.from("partners").select("id").ilike("email", clientEmail).gte("created_at", since).limit(1);
      if (!partnerRows?.length) return json({ error: "Partner not found" }, 403);
    }

    const recipients = new Set<string>();
    if (audience === "team" || audience === "both") recipients.add(teamTo.toLowerCase());
    if ((audience === "client" || audience === "both") && validEmail(clientEmail) && (isAdmin || isServiceRequest || isPartnerWelcome)) {
      recipients.add(clientEmail);
    }

    const smsTargets = new Set<string>();
    if ((audience === "client" || audience === "both") && isAdmin && canSms) {
      let clientPhone = smsNumber(payload.clientPhone, defaultCountry);
      if (validEmail(clientEmail)) {
        const { data: clientProfile } = await supabase.from("profiles").select("phone,client_id").ilike("email", clientEmail).maybeSingle();
        clientPhone = smsNumber(clientProfile?.phone, defaultCountry) || clientPhone;
        if (!clientPhone && clientProfile?.client_id) {
          const { data: clientRow } = await supabase.from("clients").select("phone").eq("id", clientProfile.client_id).maybeSingle();
          clientPhone = smsNumber(clientRow?.phone, defaultCountry) || clientPhone;
        }
        if (!clientPhone) {
          const { data: clientRow } = await supabase.from("clients").select("phone").ilike("email", clientEmail).maybeSingle();
          clientPhone = smsNumber(clientRow?.phone, defaultCountry) || clientPhone;
        }
      }
      if (clientPhone) smsTargets.add(clientPhone);
    }
    if ((audience === "team" || audience === "both") && canSms) {
      for (const n of teamSmsNumbers(defaultCountry)) smsTargets.add(n);
    }

    if (!recipients.size && !smsTargets.size) return json({ error: "No recipients" }, 400);
    if (!apiKey && !canSms) return json({ error: "Mail is not configured" }, 503);

    let emailed = false;
    if (recipients.size && apiKey) {
      const replyTo = validEmail(String(payload.replyTo || "")) ? String(payload.replyTo).trim() : teamTo;
      const requested = (Array.isArray(payload.attachments) ? payload.attachments : []).slice(0, 3);
      const attachments = (await Promise.all(requested.map((item) => mailAttachment(item)))).filter(Boolean);
      if (requested.length && attachments.length !== requested.length) {
        return json({ error: "The PDF could not be attached." }, 502);
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: mailFrom,
          to: [...recipients],
          reply_to: replyTo,
          subject,
          html: html || undefined,
          text: text || undefined,
          attachments: attachments.length ? attachments : undefined
        })
      });
      emailed = response.ok;
      if (!emailed) {
        const errText = await response.text().catch(() => "");
        console.error("resend-fail", JSON.stringify({ status: response.status, error: oneLine(errText, 400), attached: attachments.length }));
      }
    }

    let sms = false;
    let smsError = "";
    if ((audience === "team" || audience === "both") && canSms && !smsTargets.size) {
      smsError = "No valid admin number. Set NOTIFY_TEAM_PHONE as one number, for example +2348012345678.";
      console.error("portal-sms-skip", smsError);
    }
    if (smsTargets.size && canSms) {
      const body = smsText(payload);
      const results = await Promise.all([...smsTargets].map(async (to) => {
        try {
          return await sendSms(to, body);
        } catch (error) {
          return { ok: false, error: smsErrorText(error instanceof Error ? error.message : "Send failed") };
        }
      }));
      sms = results.some((item) => item.ok);
      smsError = sms ? "" : (results.find((item) => item.error)?.error || "");
      console.log("portal-sms", JSON.stringify({
        ok: sms,
        count: smsTargets.size,
        toLast4: [...smsTargets].map((n) => n.slice(-4)),
        error: smsError || undefined
      }));
    }

    let pushed = false;
    try {
      pushed = await sendWebPush(audience, clientEmail, payload);
    } catch (error) {
      console.error("portal-push", smsErrorText(error instanceof Error ? error.message : "Push failed"));
      pushed = false;
    }

    if (!emailed && !sms && !pushed) return json({ error: smsError || "Send failed" }, 502);
    return json({ sent: true, email: emailed, sms, push: pushed, smsError: sms ? "" : smsError });
  } catch (_) {
    return json({ error: "Send failed" }, 500);
  }
});
