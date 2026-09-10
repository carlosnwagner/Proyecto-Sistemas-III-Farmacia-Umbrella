import { supabase } from '../lib/supabase';

const ERROR_MESSAGES = {
  PROVEEDOR_REQUERIDO: { field: 'id_proveedor', message: 'Debe seleccionar un proveedor.' },
  PROVEEDOR_INEXISTENTE: { field: 'id_proveedor', message: 'El proveedor seleccionado no existe.' },
  SIN_DETALLE: { field: 'detalle', message: 'Debe agregar al menos un artículo o concepto.' },
  CANTIDAD_INVALIDA: { field: 'detalle', message: 'Una de las cantidades ingresadas no es válida.' },
  PRECIO_INVALIDO: { field: 'detalle', message: 'Uno de los precios ingresados no es válido.' },
};

function parseSupabaseError(error) {
  if (!error) return { field: null, message: 'Ocurrió un error inesperado.' };
  const prefijo = Object.keys(ERROR_MESSAGES).find((p) => error.message?.includes(p));
  if (prefijo) return ERROR_MESSAGES[prefijo];
  return { field: null, message: error.message || 'Ocurrió un error al procesar la orden de compra.' };
}

export function validateOrdenCompraPayload(payload) {
  const errors = {};
  if (!payload?.id_proveedor) {
    errors.id_proveedor = 'Debe seleccionar un proveedor.';
  }
  if (!Array.isArray(payload?.detalle) || payload.detalle.length === 0) {
    errors.detalle = 'Debe agregar al menos un artículo o concepto.';
  } else {
    const conDatoInvalido = payload.detalle.some(
      (d) =>
        !d.id_articulo ||
        !Number.isFinite(Number(d.cantidad_solicitada)) ||
        Number(d.cantidad_solicitada) <= 0 ||
        !Number.isFinite(Number(d.precio_unitario)) ||
        Number(d.precio_unitario) < 0
    );
    if (conDatoInvalido) {
      errors.detalle = 'Cada ítem debe tener cantidad mayor a 0 y precio válido.';
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export async function createOrdenCompra(payload) {
  const { valid, errors } = validateOrdenCompraPayload(payload);
  if (!valid) {
    return {
      data: null,
      error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors },
    };
  }

  const { data: idOrdenCompra, error } = await supabase.rpc('crear_orden_compra', {
    p_id_proveedor: payload.id_proveedor,
    p_id_condicion_pago: payload.id_condicion_pago ?? null,
    p_id_medio_pago: payload.id_medio_pago ?? null,
    p_plazo_dias: payload.plazo_dias ?? null,
    p_detalle: payload.detalle.map((d) => ({
      id_articulo: d.id_articulo,
      cantidad_solicitada: Number(d.cantidad_solicitada),
      precio_unitario: Number(d.precio_unitario),
    })),
  });

  if (error) {
    return { data: null, error: parseSupabaseError(error) };
  }

  return { data: { id_orden_compra: idOrdenCompra }, error: null };
}

export async function getOrdenesCompra() {
  const { data, error } = await supabase
    .from('orden_compra')
    .select('id_orden_compra, numero_orden, fecha_emision, estado, plazo_dias, proveedor(id_proveedor, razon_social), condicion_pago(nombre), medio_pago(nombre)')
    .order('fecha_emision', { ascending: false });

  return { data: data ?? [], error };
}

export async function getOrdenCompraPorId(idOrdenCompra) {
  const { data: orden, error: ordenError } = await supabase
    .from('orden_compra')
    .select('id_orden_compra, numero_orden, fecha_emision, estado, plazo_dias, proveedor(id_proveedor, razon_social), condicion_pago(nombre), medio_pago(nombre)')
    .eq('id_orden_compra', idOrdenCompra)
    .single();

  if (ordenError) return { data: null, error: ordenError };

  const { data: detalle, error: detalleError } = await supabase
    .from('detalle_orden_compra')
    .select('id_detalle_orden, id_articulo, cantidad_solicitada, cantidad_recibida, precio_unitario, articulo(codigo, nombre)')
    .eq('id_orden_compra', idOrdenCompra)
    .order('id_detalle_orden', { ascending: true });

  if (detalleError) return { data: null, error: detalleError };

  return { data: { ...orden, detalle }, error: null };
}

export async function registrarRecepcion(idOrdenCompra, recepciones) {
  if (!Array.isArray(recepciones) || recepciones.length === 0) {
    return { data: false, error: { field: 'recepciones', message: 'Debe indicar al menos un renglón a recibir.' } };
  }

  const { error } = await supabase.rpc('registrar_recepcion_orden_compra', {
    p_id_orden_compra: idOrdenCompra,
    p_recepciones: recepciones.map((r) => ({
      id_detalle_orden: r.id_detalle_orden,
      cantidad: Number(r.cantidad),
    })),
  });

  if (error) return { data: false, error: parseSupabaseError(error) };
  return { data: true, error: null };
}