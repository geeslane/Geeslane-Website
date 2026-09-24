import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPaymentEmails } from "../_shared/geeslane-mail.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hex(signed) === String(signature || "").toLowerCase();
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!secret) return json({ error: "Online payments are not configured yet." }, 503);

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  if (!(await validSignature(body, signature, secret))) return json({ error: "Invalid signature" }, 401);

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch (_) {
    return json({ error: "Invalid payload" }, 400);
  }
  if (event.event !== "charge.success") return json({ received: true });

  const transaction = (event.data || {}) as Record<string, unknown>;
  const metadata = (transaction.metadata || {}) as Record<string, unknown>;
  const kobo = Number(transaction.amount || 0);
  const service = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const { data, error } = await service.rpc("record_online_payment", {
    p_payload: {
      paystackReference: String(transaction.reference || ""),
      projectId: metadata.project_id,
      invoiceId: metadata.invoice_id,
      amount: Math.round(kobo / 100).toLocaleString("en-NG"),
      currency: String(transaction.currency || "NGN"),
      title: "Online payment",
      description: String(metadata.invoice_reference || "Invoice payment"),
      method: "Card / Paystack",
      notes: `Paystack ${transaction.channel || "checkout"}`
    }
  });
  if (error) return json({ error: error.message || "Could not record payment" }, 500);
  const receipt = (data || {}) as Record<string, unknown>;
  if (receipt.created) {
    const customer = (transaction.customer || {}) as Record<string, unknown>;
    await sendPaymentEmails(await mailContext(service, receipt, String(customer.email || "")));
  }
  return json({ received: true, receipt });
});
