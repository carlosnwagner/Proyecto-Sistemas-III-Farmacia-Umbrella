import { supabase } from '../lib/supabase';

/**
 * HU27 - Orden de compra (Responsable Administrativo / Encargado de Compras)
 * "Orden de compra con proveedor, detalle de artículos, seguimiento de
 * recepción y vinculación con factura."
 *
 * Criterios de aceptación cubiertos en este archivo:
 *  - Debe crear la orden con proveedor, artículos, cantidades y precios.
 *  - Debe permitir registrar las cantidades recibidas.
 *  - Debe diferenciar cantidades solicitadas, recibidas y facturadas.
 *  - Debe permitir vincular la factura asociada.
 *  - Debe manejar los estados emitida, recibida, facturada y cerrada.
 *
 * ⚠️ Este archivo depende de sql/004_alter_orden_compra_hu27.sql, que agrega
 * lo que el schema actual no tenía: el estado 'Facturada' y la columna
 * detalle_orden_compra.cantidad_facturada. Sin correr esa migración en
 * Supabase, las funciones de este servicio van a fallar.
 *
 * Decisión de diseño - por qué todo pasa por funciones SQL (RPC) y no por
 * insert/update directos, igual que en pagos.js:
 * crear una orden implica insertar el encabezado Y cada renglón de detalle
 * juntos; recibir o facturar puede tocar varios renglones a la vez y decide
 * si la orden cambia de estado. Si eso se hiciera como varias llamadas
 * sueltas desde acá y una fallara a mitad de camino, quedaría la orden
 * inconsistente. Cada operación multi-tabla vive en una función SQL
 * (ver sql/005_fn_ordenes_compra.sql), probada de punta a punta contra
 * Postgres antes de escribir este archivo. Este servicio es una capa fina
 * que valida el formulario y llama a esas funciones por RPC.
 *
 * Ciclo de vida de una orden: Emitida -> Recibida -> Facturada -> Cerrada.
 * (Cancelada existe como estado alternativo en la base, pero esta HU no pide
 * un flujo de cancelación, así que no se expone acá todavía.)
 */

/**
 * @typedef {Object} DetalleOrdenInput
 * @property {number} id_articulo
 * @property {number} cantidad_solicitada
 * @property {number|string} precio_unitario
 */

/**
 * @typedef {Object} OrdenCompraInput
 * @property {number} id_proveedor
 * @property {number} [id_condicion_pago]
 * @property {number} [id_medio_pago]
 * @property {number} [plazo_dias]
 * @property {DetalleOrdenInput[]} detalle - uno o más artículos, obligatorio
 */

// Prefijos definidos en las RAISE EXCEPTION de sql/005_fn_ordenes_compra.sql
const ERROR_MESSAGES = {
  PROVEEDOR_REQUERIDO: { field: 'id_proveedor', message: 'Debe seleccionar un proveedor.' },
  PROVEEDOR_INEXISTENTE: { field: 'id_proveedor', message: 'El proveedor seleccionado no existe.' },
  SIN_DETALLE: { field: 'detalle', message: 'Debe agregar al menos un artículo.' },
  ARTICULO_INEXISTENTE: { field: 'detalle', message: 'Uno de los artículos seleccionados no existe.' },
  CANTIDAD_INVALIDA: { field: 'detalle', message: 'Una de las cantidades ingresadas no es válida.' },
  PRECIO_INVALIDO: { field: 'detalle', message: 'Uno de los precios ingresados no es válido.' },
  ORDEN_INEXISTENTE: { field: null, message: 'La orden de compra no existe.' },
  ORDEN_NO_MODIFICABLE: { field: null, message: 'Esta orden ya está cerrada o cancelada y no admite cambios.' },
  SIN_RECEPCIONES: { field: 'recepciones', message: 'Debe indicar al menos un renglón a recibir.' },
  RENGLON_INEXISTENTE: { field: null, message: 'Uno de los renglones indicados no pertenece a esta orden.' },
  CANTIDAD_EXCEDE_SOLICITADO: { field: 'recepciones', message: 'La cantidad a recibir supera lo solicitado en ese renglón.' },
  FACTURA_INEXISTENTE: { field: 'id_factura_proveedor', message: 'La factura indicada no existe.' },
  FACTURA_ORDEN_DISTINTA: { field: 'id_factura_proveedor', message: 'Esa factura no corresponde a esta orden de compra.' },
  CANTIDAD_EXCEDE_RECIBIDO: { field: 'detalle', message: 'La cantidad facturada supera lo efectivamente recibido en ese renglón.' },
  ESTADO_INVALIDO_PARA_CERRAR: { field: null, message: 'Solo se puede cerrar una orden que ya fue Recibida o Facturada.' },
};

/**
 * Traduce un error de Postgres/Supabase (incluidos los RAISE EXCEPTION de las
 * funciones SQL) a un mensaje entendible en español.
 *
 * @param {import('@supabase/supabase-js').PostgrestError} error
 * @returns {{ field: string|null, message: string }}
 */
function parseSupabaseError(error) {
  if (!error) return { field: null, message: 'Ocurrió un error inesperado.' };

  const prefijo = Object.keys(ERROR_MESSAGES).find((p) => error.message?.includes(p));
  if (prefijo) return ERROR_MESSAGES[prefijo];

  return { field: null, message: error.message || 'Ocurrió un error al procesar la orden de compra.' };
}

/**
 * Valida los datos del formulario de alta ANTES de intentar guardarlos.
 *
 * @param {OrdenCompraInput} payload
 * @returns {{ valid: boolean, errors: Object<string,string> }}
 */
export function validateOrdenCompraPayload(payload) {
  const errors = {};

  if (!payload?.id_proveedor) {
    errors.id_proveedor = 'Debe seleccionar un proveedor.';
  }
  if (!Array.isArray(payload?.detalle) || payload.detalle.length === 0) {
    errors.detalle = 'Debe agregar al menos un artículo.';
  } else {
    const conDatoInvalido = payload.detalle.some(
      (d) =>
        !d.id_articulo ||
        !Number.isFinite(Number(d.cantidad_solicitada)) ||
        Number(d.cantidad_solicitada) <= 0 ||
        !Number.isFinite(Number(d.precio_unitario)) ||
        Number(d.precio_unitario) <= 0
    );
    if (conDatoInvalido) {
      errors.detalle = 'Cada artículo debe tener cantidad y precio unitario mayores a 0.';
    }
  }
  if (payload?.plazo_dias !== undefined && payload.plazo_dias !== null && Number(payload.plazo_dias) <= 0) {
    errors.plazo_dias = 'El plazo en días debe ser mayor a 0.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Crea una nueva orden de compra con su detalle de artículos (HU27).
 * El número de orden se genera automáticamente (formato OC-000001); no se pide
 * como input. El estado inicial queda en 'Emitida' (DEFAULT de la tabla).
 *
 * @param {OrdenCompraInput} payload
 * @returns {Promise<{
 *   data: { id_orden_compra: number }|null,
 *   error: { field: string|null, message: string, fieldErrors?: Object<string,string> } | null
 * }>}
 */
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

/**
 * Trae el listado de órdenes de compra con datos del proveedor, para la
 * pantalla principal del módulo.
 *
 * @returns {Promise<{ data: Array<object>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getOrdenesCompra() {
  const { data, error } = await supabase
    .from('orden_compra')
    .select(
      'id_orden_compra, numero_orden, fecha_emision, estado, plazo_dias, proveedor(id_proveedor, razon_social), condicion_pago(nombre), medio_pago(nombre)'
    )
    .order('fecha_emision', { ascending: false });

  return { data: data ?? [], error };
}

/**
 * Trae una orden de compra puntual con su detalle completo (solicitado,
 * recibido y facturado por artículo), para la pantalla de detalle/seguimiento.
 *
 * @param {number} idOrdenCompra
 * @returns {Promise<{ data: object|null, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getOrdenCompraPorId(idOrdenCompra) {
  const { data: orden, error: ordenError } = await supabase
    .from('orden_compra')
    .select(
      'id_orden_compra, numero_orden, fecha_emision, estado, plazo_dias, proveedor(id_proveedor, razon_social), condicion_pago(nombre), medio_pago(nombre)'
    )
    .eq('id_orden_compra', idOrdenCompra)
    .single();

  if (ordenError) return { data: null, error: ordenError };

  const { data: detalle, error: detalleError } = await supabase
    .from('detalle_orden_compra')
    .select(
      'id_detalle_orden, id_articulo, cantidad_solicitada, cantidad_recibida, cantidad_facturada, precio_unitario, articulo(codigo, nombre)'
    )
    .eq('id_orden_compra', idOrdenCompra)
    .order('id_detalle_orden', { ascending: true });

  if (detalleError) return { data: null, error: detalleError };

  return { data: { ...orden, detalle }, error: null };
}

/**
 * Registra la recepción de mercadería de una o varias líneas de la orden.
 * Pasa la orden a 'Recibida' automáticamente la primera vez que se recibe algo.
 *
 * @param {number} idOrdenCompra
 * @param {Array<{id_detalle_orden: number, cantidad: number}>} recepciones
 * @returns {Promise<{ data: boolean, error: { field: string|null, message: string } | null }>}
 */
export async function registrarRecepcion(idOrdenCompra, recepciones) {
  if (!Array.isArray(recepciones) || recepciones.length === 0) {
    return {
      data: false,
      error: { field: 'recepciones', message: 'Debe indicar al menos un renglón a recibir.' },
    };
  }

  const { error } = await supabase.rpc('registrar_recepcion_orden_compra', {
    p_id_orden_compra: idOrdenCompra,
    p_recepciones: recepciones.map((r) => ({
      id_detalle_orden: r.id_detalle_orden,
      cantidad: Number(r.cantidad),
    })),
  });

  if (error) {
    return { data: false, error: parseSupabaseError(error) };
  }

  return { data: true, error: null };
}

/**
 * Vincula una factura de proveedor YA CREADA (ver el futuro servicio de HU30)
 * a esta orden, distribuyendo cuánto de cada renglón cubre. Pasa la orden a
 * 'Facturada'. La factura debe haber sido creada con id_orden_compra apuntando
 * a esta misma orden (factura_proveedor.id_orden_compra es NOT NULL en la base).
 *
 * @param {number} idOrdenCompra
 * @param {number} idFacturaProveedor
 * @param {Array<{id_detalle_orden: number, cantidad: number}>} detalle
 * @returns {Promise<{ data: boolean, error: { field: string|null, message: string } | null }>}
 */
export async function registrarFacturacion(idOrdenCompra, idFacturaProveedor, detalle) {
  if (!idFacturaProveedor) {
    return {
      data: false,
      error: { field: 'id_factura_proveedor', message: 'Debe indicar la factura a vincular.' },
    };
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return {
      data: false,
      error: { field: 'detalle', message: 'Debe indicar qué renglones cubre la factura.' },
    };
  }

  const { error } = await supabase.rpc('registrar_facturacion_orden_compra', {
    p_id_orden_compra: idOrdenCompra,
    p_id_factura_proveedor: idFacturaProveedor,
    p_detalle: detalle.map((d) => ({
      id_detalle_orden: d.id_detalle_orden,
      cantidad: Number(d.cantidad),
    })),
  });

  if (error) {
    return { data: false, error: parseSupabaseError(error) };
  }

  return { data: true, error: null };
}

/**
 * Cierra una orden de compra. Solo permitido si está en estado Recibida o
 * Facturada (acción administrativa manual, no automática).
 *
 * @param {number} idOrdenCompra
 * @returns {Promise<{ data: boolean, error: { field: string|null, message: string } | null }>}
 */
export async function cerrarOrdenCompra(idOrdenCompra) {
  const { error } = await supabase.rpc('cerrar_orden_compra', { p_id_orden_compra: idOrdenCompra });

  if (error) {
    return { data: false, error: parseSupabaseError(error) };
  }

  return { data: true, error: null };
}
