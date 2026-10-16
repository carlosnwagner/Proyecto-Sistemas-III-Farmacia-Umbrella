import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const configuredSite = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowedOrigin = origin === configuredSite || isLocalDev ? origin : configuredSite;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders(request), "Content-Type": "application/json" },
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;
const siteUrl = Deno.env.get("SITE_URL")!;

async function mpRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? `Mercado Pago respondió ${response.status}`);
  return body;
}

async function obtenerPago(paymentId: string) {
  return await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

async function buscarPagosAprobadosPorReferencia(attemptId: string) {
  const query = new URLSearchParams({
    external_reference: attemptId,
    status: "approved",
    sort: "date_created",
    criteria: "desc",
    limit: "50",
  });
  const result = await mpRequest(`/v1/payments/search?${query.toString()}`);
  return (Array.isArray(result.results) ? result.results : []).filter((payment: Record<string, unknown>) =>
    String(payment.external_reference ?? "") === attemptId &&
    String(payment.status ?? "") === "approved" &&
    String(payment.currency_id ?? "") === "ARS"
  );
}

async function verificarPagoRetorno(id: string) {
  const { data: current, error: currentError } = await supabase.rpc("hu66_mp_estado_intento", { p_id_intento: id });
  if (currentError) throw currentError;
  if (current?.status !== "PendientePago") return current;

  const payments = await buscarPagosAprobadosPorReferencia(id);
  if (payments.length === 0) return current;
  if (payments.length > 1) throw new Error("Hay más de un pago aprobado para este intento; requiere revisión manual");

  await procesarPago(payments[0]);
  const { data: updated, error: updatedError } = await supabase.rpc("hu66_mp_estado_intento", { p_id_intento: id });
  if (updatedError) throw updatedError;
  return updated;
}

async function solicitarReembolsoCompleto(paymentId: string, idempotencyKey: string) {
  const payment = await obtenerPago(paymentId);
  if (Number(payment.amount_refunded ?? 0) >= Number(payment.transaction_amount ?? Infinity)) return { status: "approved" };
  return await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({}),
  });
}

async function procesarPago(payment: Record<string, unknown>) {
  const attemptId = String(payment.external_reference ?? "");
  const paymentId = String(payment.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !paymentId) throw new Error("Referencia de pago inválida");
  const { data, error } = await supabase.rpc("hu66_mp_confirmar_pago", {
    p_id_intento: attemptId,
    p_payment_id: paymentId,
    p_status: String(payment.status ?? ""),
    p_transaction_amount: Number(payment.transaction_amount),
    p_currency: String(payment.currency_id ?? ""),
  });
  if (error) throw error;
  if (data?.status === "ReembolsoPendiente") {
    try {
      const refund = await solicitarReembolsoCompleto(paymentId, `hu66-refund-${attemptId}`);
      await supabase.rpc("hu66_mp_marcar_reembolso", {
        p_id_intento: attemptId, p_payment_id: paymentId, p_status: String(refund.status ?? "pending"),
      });
    } catch (refundError) {
      console.error("No se pudo completar el reembolso automático", refundError);
      await supabase.rpc("hu66_mp_marcar_reembolso", {
        p_id_intento: attemptId, p_payment_id: paymentId, p_status: "pending",
      });
    }
  }
  return data;
}

async function crear(body: Record<string, unknown>) {
  if (!mpToken) throw new Error("Falta MP_ACCESS_TOKEN en Supabase → Edge Functions → Secrets.");
  if (!siteUrl) throw new Error("Falta SITE_URL en Supabase → Edge Functions → Secrets.");
  const emailCliente = String(body.contacto ?? "").trim().toLowerCase();
  if (emailCliente.length > 160 || !/^\S+@\S+\.\S+$/.test(emailCliente)) {
    throw new Error("Ingresá un correo válido para identificarte y consultar tus pedidos después de la compra");
  }
  const medioPago = String(body.medio_pago ?? body.tipo_tarjeta ?? "");
  if (!["credito", "debito", "mercado_pago"].includes(medioPago)) throw new Error("Elegí tarjeta de crédito, tarjeta de débito o Mercado Pago");
  const key = String(body.clave_idempotencia ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Clave de compra inválida");
  const { data: attempt, error } = await supabase.rpc("hu66_mp_crear_intento", {
    p_clave: key,
    p_id_sucursal: Number(body.id_sucursal),
    p_nombre: String(body.nombre ?? ""),
    p_apellido: String(body.apellido ?? ""),
    p_contacto: emailCliente,
    p_items: body.items,
  });
  if (error) throw error;
  const row = Array.isArray(attempt) ? attempt[0] : attempt;
  if (!row?.id_intento || !Number(row.importe) || !Array.isArray(row.items)) throw new Error("No se pudo preparar el pago");
  const attemptId = String(row.id_intento);
  let configuracionPago: Record<string, unknown>;
  if (medioPago === "mercado_pago") {
    // La billetera fuerza el inicio de sesión del comprador en su cuenta de Mercado Pago.
    configuracionPago = { purpose: "wallet_purchase" };
  } else {
    const tipoTarjeta = medioPago === "debito" ? "debit_card" : "credit_card";
    const metodosDisponibles = await mpRequest("/v1/payment_methods");
    const listaMetodos = Array.isArray(metodosDisponibles) ? metodosDisponibles : [];
    if (!listaMetodos.some((metodo: Record<string, unknown>) => metodo.payment_type_id === tipoTarjeta)) {
      throw new Error(`Mercado Pago no tiene habilitada la tarjeta de ${medioPago} para la cuenta configurada`);
    }
    const tiposExcluidos = [...new Set(listaMetodos
      .map((metodo: Record<string, unknown>) => String(metodo.payment_type_id ?? ""))
      .filter((tipo: string) => tipo && tipo !== tipoTarjeta))]
      .map((id) => ({ id }));
    configuracionPago = {
      payment_methods: {
        installments: medioPago === "debito" ? 1 : 12,
        excluded_payment_types: tiposExcluidos,
      },
    };
  }
  const preference = await mpRequest("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": `hu66-${attemptId}` },
    body: JSON.stringify({
      external_reference: attemptId,
      items: row.items.map((item: Record<string, unknown>) => ({
        id: String(item.id_articulo),
        title: String(item.titulo).slice(0, 250),
        quantity: Number(item.cantidad),
        unit_price: Number(item.precio_unitario),
        currency_id: "ARS",
      })),
      payer: { name: String(body.nombre).slice(0, 80), surname: String(body.apellido).slice(0, 80), email: /^\S+@\S+\.\S+$/.test(String(body.contacto)) ? String(body.contacto) : undefined },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/hu66-mercado-pago?source_news=webhooks`,
      back_urls: {
        success: `${siteUrl}/pago-resultado?resultado=success&intento=${attemptId}`,
        pending: `${siteUrl}/pago-resultado?resultado=pending&intento=${attemptId}`,
        failure: `${siteUrl}/pago-resultado?resultado=failure&intento=${attemptId}`,
      },
      auto_return: "approved",
      statement_descriptor: "FARMACIA UMBRELLA",
      ...configuracionPago,
    }),
  });
  const initPoint = String(preference.init_point ?? "");
  if (!/^https:\/\/(www\.|sandbox\.)?mercadopago\.[a-z.]+(?:\/|$)/i.test(initPoint)) throw new Error("Mercado Pago no devolvió una URL de pago segura");
  const { error: saveError } = await supabase.rpc("hu66_mp_guardar_preferencia", {
    p_id_intento: attemptId, p_preference_id: String(preference.id), p_init_point: initPoint,
  });
  if (saveError) throw saveError;
  return { url: initPoint, id_intento: attemptId, importe: row.importe };
}

async function cancelarYReembolsar(request: Request, body: Record<string, unknown>) {
  const bearer = request.headers.get("authorization") ?? "";
  const token = bearer.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Iniciá sesión como administrador para cancelar el pedido");
  const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Sesión inválida");
  const { data: user, error: userError } = await supabase.from("usuario").select("rol,estado")
    .eq("auth_id", authData.user.id).maybeSingle();
  if (userError || user?.estado !== true || user?.rol !== "administrador") throw new Error("Solo un administrador puede cancelar pedidos");

  const orderId = Number(body.id_pedido);
  const reason = String(body.motivo ?? "").trim();
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !reason || reason.length > 500) throw new Error("Pedido o motivo inválido");
  const { data: order, error: orderError } = await supabase.from("pedido_online")
    .select("id_pedido,estado,estado_pago,mp_payment_id").eq("id_pedido", orderId).maybeSingle();
  if (orderError || !order) throw new Error("No encontramos ese pedido");
  if (!["Pendiente", "Preparado"].includes(order.estado) || order.estado_pago !== "Aprobado" || !order.mp_payment_id) {
    throw new Error("El pedido no tiene un pago aprobado que pueda reembolsarse");
  }
  const refund = await solicitarReembolsoCompleto(order.mp_payment_id, `hu66-cancel-${order.id_pedido}`);
  if (refund.status !== "approved") return { status: "ReembolsoPendiente" };
  const { data: cancelled, error: cancelError } = await supabase.rpc("hu66_mp_cancelar_reembolsado", {
    p_id_pedido: order.id_pedido,
    p_auth_uid: authData.user.id,
    p_motivo: reason,
    p_payment_id: order.mp_payment_id,
  });
  if (cancelError) throw cancelError;
  return { status: "Cancelado", pedido: cancelled };
}

async function validarWebhook(request: Request, paymentId: string) {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) throw new Error("Falta MP_WEBHOOK_SECRET");
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=", 2)));
  if (!parts.ts || !parts.v1 || !requestId || !paymentId) throw new Error("Firma incompleta");
  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest)));
  const expected = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== parts.v1.length) throw new Error("Firma inválida");
  const supplied = new TextEncoder().encode(parts.v1);
  const computed = new TextEncoder().encode(expected);
  let mismatch = 0;
  for (let index = 0; index < computed.length; index++) mismatch |= computed[index] ^ supplied[index];
  if (mismatch !== 0) throw new Error("Firma inválida");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(request) });
  if (request.method === "GET" || request.headers.has("x-signature")) {
    // Mercado Pago webhook: nunca se confía en el estado enviado por el navegador.
    try {
      const url = new URL(request.url);
      const paymentId = url.searchParams.get("data.id") ?? "";
      await validarWebhook(request, paymentId);
      const payment = await obtenerPago(paymentId);
      if (payment.status === "approved") await procesarPago(payment);
      return json(request, { received: true });
    } catch (error) {
      console.error("Webhook de Mercado Pago rechazado", error);
      return json(request, { error: "Notificación inválida" }, 400);
    }
  }
  if (request.method !== "POST") return json(request, { error: "Método no permitido" }, 405);
  try {
    const body = await request.json();
    if (body.action === "crear") return json(request, await crear(body));
    if (body.action === "cancelar-y-reembolsar") return json(request, await cancelarYReembolsar(request, body));
    if (body.action === "estado") {
      const id = String(body.id_intento ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(request, { error: "Identificador inválido" }, 400);
      const { data, error } = await supabase.rpc("hu66_mp_estado_intento", { p_id_intento: id });
      if (error) throw error;
      return json(request, data);
    }
    if (body.action === "verificar-retorno") {
      const id = String(body.id_intento ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(request, { error: "Identificador inválido" }, 400);
      return json(request, await verificarPagoRetorno(id));
    }
    return json(request, { error: "Acción inválida" }, 400);
  } catch (error) {
    console.error("Error en checkout Mercado Pago", error);
    return json(request, { error: error instanceof Error ? error.message : "No se pudo procesar el pago" }, 400);
  }
});
