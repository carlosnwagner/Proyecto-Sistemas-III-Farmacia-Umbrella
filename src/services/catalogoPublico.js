import { supabase } from "../lib/supabase.js";

export async function getSucursalesCatalogoPublico() {
  const { data, error } = await supabase.rpc("catalogo_sucursales_publicas");
  return { data: data || [], error };
}

export async function getProductosCatalogoPublico(idSucursal) {
  if (!idSucursal) return { data: [], error: null };

  const { data, error } = await supabase.rpc("catalogo_productos_sucursal_publicos", {
    p_id_sucursal: Number(idSucursal),
  });

  return { data: data || [], error };
}

export async function iniciarPagoPedidoOnline(payload) {
  const { data, error } = await supabase.functions.invoke("hu66-mercado-pago", {
    body: { action: "crear", ...payload },
  });
  if (error?.context instanceof Response) {
    const respuesta = await error.context.clone().json().catch(() => null);
    if (respuesta?.error) return { data: null, error: new Error(respuesta.error) };
  }
  return { data, error };
}

export async function consultarPagoPedidoOnline(idIntento) {
  const { data, error } = await supabase.functions.invoke("hu66-mercado-pago", {
    body: { action: "estado", id_intento: idIntento },
  });
  return { data, error };
}

export async function verificarRetornoPagoPedidoOnline(idIntento) {
  const { data, error } = await supabase.functions.invoke("hu66-mercado-pago", {
    body: { action: "verificar-retorno", id_intento: idIntento },
  });
  if (error?.context instanceof Response) {
    const respuesta = await error.context.clone().json().catch(() => null);
    if (respuesta?.error) return { data: null, error: new Error(respuesta.error) };
  }
  return { data, error };
}

export async function reembolsarPedidoOnline(idPedido, motivo) {
  const { data, error } = await supabase.functions.invoke("hu66-mercado-pago", {
    body: { action: "cancelar-y-reembolsar", id_pedido: Number(idPedido), motivo },
  });
  return { data, error };
}

export async function listarPedidosOnline() {
  const { data, error } = await supabase.rpc("hu66_listar_pedidos");
  return { data: data || [], error };
}

export async function actualizarEstadoPedidoOnline(idPedido, estado, motivo = null) {
  const { data, error } = await supabase.rpc("hu66_actualizar_estado_pedido", {
    p_id_pedido: Number(idPedido),
    p_estado: estado,
    p_motivo: motivo,
  });
  return { data, error };
}

export async function consultarEstadoPedidoOnline(referencia) {
  const { data, error } = await supabase.rpc("hu66_consultar_estado_pedido", {
    p_referencia: referencia,
  });
  return { data: data?.[0] || null, error };
}

export async function solicitarCodigoCliente(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/pedido`,
    },
  });
  return { error };
}

export async function listarMisPedidosOnline() {
  const { data, error } = await supabase.rpc("hu66_mis_pedidos_cliente");
  return { data: data || [], error };
}
