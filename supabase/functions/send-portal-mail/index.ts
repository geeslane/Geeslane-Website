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

function oneLine(value: unknown, max = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, max);
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
    const html = String(payload.html || "").trim().slice(0, 120000);
    const text = String(payload.text || "").trim().slice(0, 40000);
    const audience = payload.audience === "client" || payload.audience === "both" ? payload.audience : "team";
    const kind = String(payload.kind || "").trim();
    const isServiceRequest = kind === "service-request";
    const isEnsureUser = kind === "ensure-user";
    if (!isEnsureUser && (!subject || (!html && !text))) return json({ error: "Missing mail" }, 400);

    const accessToken = authHeader.slice(7).trim();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const signedIn = Boolean(authData?.user) && !authError;
    if (!signedIn && !isServiceRequest) return json({ error: "Sign in required" }, 401);

    const { data: profile } = signedIn
      ? await supabase.from("profiles").select("role,status,email").eq("user_id", authData.user.id).maybeSingle()
      : { data: null };
    const isAdmin = profile?.role === "admin" && profile?.status === "active";

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

    const recipients = new Set<string>();
    if (audience === "team" || audience === "both") recipients.add(teamTo.toLowerCase());
    if ((audience === "client" || audience === "both") && validEmail(clientEmail) && (isAdmin || isServiceRequest)) {
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
      const attachments = (Array.isArray(payload.attachments) ? payload.attachments : [])
        .slice(0, 3)
        .map((item) => {
          const filename = String(item?.filename || "document.pdf").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "document.pdf";
          const content = String(item?.content || "").replace(/\s+/g, "");
          if (!content || content.length > 7000000) return null;
          return { filename, content, content_type: "application/pdf" };
        })
        .filter(Boolean);
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
