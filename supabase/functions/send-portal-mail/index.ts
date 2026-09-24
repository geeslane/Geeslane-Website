import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (digits.length < 10 || digits.length > 15) return "";
  return digits;
}

function smsReady() {
  const termii = Boolean(Deno.env.get("TERMII_API_KEY"));
  const twilio = Boolean(Deno.env.get("TWILIO_ACCOUNT_SID") && Deno.env.get("TWILIO_AUTH_TOKEN") && Deno.env.get("TWILIO_FROM"));
  return termii || twilio;
}

function smsText(payload: Record<string, unknown>) {
  const heading = oneLine(payload.heading || payload.subject, 80);
  const intro = oneLine(payload.intro, 140);
  const link = String(payload.ctaUrl || "").trim();
  const core = [heading, intro].filter(Boolean).join(". ");
  return `Geeslane: ${core}${link ? ` ${link}` : ""}`.slice(0, 480);
}

async function sendSms(to: string, body: string) {
  if (!to || !body) return false;
  const termiiKey = Deno.env.get("TERMII_API_KEY") || "";
  if (termiiKey) {
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: termiiKey,
        to,
        from: Deno.env.get("TERMII_SENDER_ID") || "Geeslane",
        sms: body,
        type: "plain",
        channel: Deno.env.get("TERMII_CHANNEL") || "generic"
      })
    });
    if (!response.ok) return false;
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (result.message_id) return true;
    return /success/i.test(String(result.message || ""));
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const from = Deno.env.get("TWILIO_FROM") || "";
  if (!sid || !token || !from) return false;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: `+${to}`, From: from, Body: body })
  });
  return response.ok;
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
    if (!subject || (!html && !text)) return json({ error: "Missing mail" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const signedIn = Boolean(authData?.user) && !authError;
    if (!signedIn && !isServiceRequest) return json({ error: "Sign in required" }, 401);

    const { data: profile } = signedIn
      ? await supabase.from("profiles").select("role,status,email").eq("user_id", authData.user.id).maybeSingle()
      : { data: null };
    const isAdmin = profile?.role === "admin" && profile?.status === "active";

    const clientEmail = String(payload.clientEmail || payload.replyTo || "").trim().toLowerCase();
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

    let clientPhone = "";
    if ((audience === "client" || audience === "both") && isAdmin && canSms) {
      clientPhone = smsNumber(payload.clientPhone, defaultCountry);
      if (validEmail(clientEmail)) {
        const { data: clientProfile } = await supabase.from("profiles").select("phone").ilike("email", clientEmail).maybeSingle();
        clientPhone = smsNumber(clientProfile?.phone, defaultCountry) || clientPhone;
      }
    }

    if (!recipients.size && !clientPhone) return json({ error: "No recipients" }, 400);
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
    if (clientPhone && canSms) {
      try {
        sms = await sendSms(clientPhone, smsText(payload));
      } catch (_) {
        sms = false;
      }
    }

    if (!emailed && !sms) return json({ error: "Send failed" }, 502);
    return json({ sent: true, email: emailed, sms });
  } catch (_) {
    return json({ error: "Send failed" }, 500);
  }
});
