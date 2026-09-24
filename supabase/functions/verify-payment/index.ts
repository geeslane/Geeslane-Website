import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPaymentEmails } from "../_shared/geeslane-mail.ts";

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

async function mailContext(service: ReturnType<typeof createClient>, receipt: Record<string, unknown>, emailHint = "") {
  const projectId = String(receipt.projectId || receipt.project_id || "");
  const { data: project } = projectId
    ? await service.from("projects").select("id, name, client_id").eq("id", projectId).maybeSingle()
    : { data: null };
  const { data: client } = project?.client_id
    ? await service.from("clients").select("name, email, business").eq("id", project.client_id).maybeSingle()
    : { data: null };
  return {
    clientEmail: String(client?.email || emailHint || "").trim(),
    clientName: String(client?.name || ""),
    business: String(client?.business || ""),
    projectName: String(project?.name || ""),
    receipt: {
      ...receipt,
      invoiceReference: receipt.invoiceReference || receipt.invoice_reference || ""
    }
  };
}

async function recordPayment(transaction: Record<string, unknown>) {
  const metadata = (transaction.metadata || {}) as Record<string, unknown>;
  const kobo = Number(transaction.amount || 0);
  const naira = kobo / 100;
  const service = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const { data, error } = await service.rpc("record_online_payment", {
    p_payload: {
      paystackReference: String(transaction.reference || ""),
      projectId: metadata.project_id,
      invoiceId: metadata.invoice_id,
      amount: Math.round(naira).toLocaleString("en-NG"),
      currency: String(transaction.currency || "NGN"),
      title: "Online payment",
      description: String(metadata.invoice_reference || "Invoice payment"),
      method: "Card / Paystack",
      notes: `Paystack ${transaction.channel || "checkout"}`
    }
  });
  if (error) throw error;
  return { receipt: data as Record<string, unknown>, service };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!secret) return json({ error: "Online payments are not configured yet." }, 503);

  try {
    const payload = await req.json();
    const reference = String(payload.reference || payload.trxref || "").trim();
    if (reference.length < 6) return json({ error: "Missing payment reference." }, 400);

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    const transaction = (result.data || {}) as Record<string, unknown>;
    if (!response.ok || transaction.status !== "success") {
      return json({ error: "This payment has not been confirmed yet." }, 409);
    }

    const { receipt, service } = await recordPayment(transaction);
    if (receipt?.created) {
      const customer = (transaction.customer || {}) as Record<string, unknown>;
      await sendPaymentEmails(await mailContext(service, receipt, String(customer.email || payload.email || "")));
    }
    return json({ paid: true, receipt });
  } catch (_) {
    return json({ error: "Could not confirm this payment." }, 500);
  }
});
