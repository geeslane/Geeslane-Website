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

function moneyAmount(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function remaining(invoice: Record<string, unknown>) {
  const status = String(invoice.status || "");
  if (status === "Paid" || status === "Cancelled" || status === "Draft") return 0;
  const total = moneyAmount(invoice.amount);
  const paid = Math.min(total, Math.max(0, moneyAmount(invoice.paid_amount)));
  return Math.max(0, total - paid);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const publicKey = Deno.env.get("PAYSTACK_PUBLIC_KEY") || "";
  if (!secret) return json({ error: "Online payments are not configured yet." }, 503);

  try {
    const payload = await req.json();
    const invoiceId = String(payload.invoiceId || "").trim();
    const reference = String(payload.reference || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const callbackUrl = String(payload.callbackUrl || "").trim();
    if (!invoiceId && reference.length < 4) return json({ error: "Choose an invoice to pay." }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    let invoiceQuery = service.from("project_invoices").select("*");
    invoiceQuery = invoiceId ? invoiceQuery.eq("id", invoiceId) : invoiceQuery.ilike("reference", reference);
    const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();
    if (invoiceError || !invoice) return json({ error: "That invoice could not be found." }, 404);

    const { data: project } = await service.from("projects").select("id, name, client_id, online_payments").eq("id", invoice.project_id).maybeSingle();
    if (!project) return json({ error: "That invoice could not be found." }, 404);
    if (project.online_payments === false) return json({ error: "Online payment is not enabled for this project." }, 403);

    const { data: clientRow } = await service.from("clients").select("id, email, name, business").eq("id", project.client_id).maybeSingle();
    const clientEmail = String(clientRow?.email || "").trim().toLowerCase();

    const authHeader = req.headers.get("Authorization") || "";
    let allowed = false;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: visible } = await userClient.from("project_invoices").select("id").eq("id", invoice.id).maybeSingle();
      if (visible?.id) allowed = true;
    }
    if (!allowed && (!email || email !== clientEmail)) {
      return json({ error: "Enter the email on this invoice to pay." }, 403);
    }

    const due = remaining(invoice);
    if (due <= 0) return json({ error: "Nothing is remaining on this invoice." }, 400);
    const kobo = Math.round(due * 100);
    if (kobo < 10000) return json({ error: "This remaining amount is too small to collect online." }, 400);

    const payEmail = clientEmail || email;
    const payReference = `gls_${String(invoice.id).replace(/-/g, "").slice(0, 18)}_${Date.now()}`;
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: payEmail,
        amount: kobo,
        currency: String(invoice.currency || "NGN").trim() || "NGN",
        reference: payReference,
        callback_url: callbackUrl || undefined,
        metadata: {
          project_id: project.id,
          invoice_id: invoice.id,
          invoice_reference: invoice.reference,
          project_name: project.name,
          cancel_action: callbackUrl || undefined
        }
      })
    });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    const data = (result.data || {}) as Record<string, unknown>;
    if (!response.ok || !data.authorization_url) {
      return json({ error: String(result.message || "Paystack could not start this payment.") }, 502);
    }

    return json({
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference || payReference,
      publicKey,
      email: payEmail,
      amount: due,
      currency: invoice.currency || "NGN",
      invoiceId: invoice.id,
      invoiceReference: invoice.reference
    });
  } catch (_) {
    return json({ error: "Could not start online payment." }, 500);
  }
});
