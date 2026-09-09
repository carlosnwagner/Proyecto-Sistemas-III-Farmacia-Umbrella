import { supabase } from '../lib/supabase';

/**
 * HU33 - Registrar un pago a proveedor (Responsable de Tesorería)
 * "Pago total/parcial asociado a comprobantes."
 *
 * Criterios de aceptación cubiertos en este archivo:
 *  - El pago se asocia a proveedor y comprobantes pendientes.
 *  - Registra fecha, importe y medio de pago.
 *  - Permite cancelación total o parcial y actualiza saldo.
 *  - Al confirmar genera el egreso financiero.
 *
 * Decisión de diseño: a diferencia de articulos.js / proveedores.js, acá NO se hace
 * un simple `insert`. Un pago puede aplicarse a varias facturas a la vez y necesita
 * actualizar el estado de cada una según cuánto le quede pendiente — eso son varias
 * escrituras relacionadas que tienen que ocurrir todas juntas o ninguna (atomicidad).
 * Por eso la escritura real vive en la función SQL `registrar_pago_proveedor`
 * (ver sql/002_fn_registrar_pago_proveedor.sql) y este archivo es una capa fina que:
 *   1) valida el formulario antes de pegarle a la red,
 *   2) llama a esa función por RPC,
 *   3) traduce los mensajes de error de negocio (RAISE EXCEPTION) a algo mostrable.
 *
 * IMPORTANTE: el importe_total del pago NO se pide como input separado. Se calcula
 * siempre como la suma de las aplicaciones, así no puede haber un pago cuyo total
 * no coincida con lo que realmente se aplicó a las facturas.
 *
 * FIX: el saldo pendiente de una factura no depende solo de los pagos aplicados
 * (detalle_pago). También lo modifican las notas de crédito/débito
 * (nota_credito_debito_proveedor): una nota de Crédito reduce el saldo, una de
 * Débito lo aumenta. Antes esta función solo restaba los pagos y por eso una nota
 * registrada no se reflejaba acá. Ver getFacturasPendientesPorProveedor.
 */

/**
 * @typedef {Object} AplicacionPago
 * @property {number} id_factura_proveedor
 * @property {number|string} importe_aplicado
 */

/**
 * @typedef {Object} PagoProveedorInput
 * @property {number} id_proveedor
 * @property {string} fecha_pago     - YYYY-MM-DD
 * @property {string} medio_pago     - ej. 'Transferencia', 'Cheque', 'Efectivo'
 * @property {AplicacionPago[]} aplicaciones - una o más facturas a cancelar, total o parcialmente
 */

/**
 * Trae las facturas con saldo pendiente de un proveedor, para que el formulario
 * las muestre como checklist ("aplicar $X a la factura F-0001, saldo $Y").
 * Pablo: usar esto al elegir el proveedor, para poblar la lista de comprobantes.
 *
 * El saldo pendiente ahora contempla: importe_total - pagos aplicados +/- notas
 * de crédito/débito (crédito resta, débito suma), igual que en
 * RegistrarNotaCreditoDebito.jsx y en notasCreditoDebito.js.
 *
 * @param {number} idProveedor
 * @returns {Promise<{
 *   data: Array<{
 *     id_factura_proveedor: number,
 *     numero_comprobante: string,
 *     fecha: string,
 *     importe_total: number,
 *     estado: string,
 *     saldo_pendiente: number
 *   }>,
 *   error: import('@supabase/supabase-js').PostgrestError | null
 * }>}
 */
export async function getFacturasPendientesPorProveedor(idProveedor) {
  const { data: facturas, error: facturasError } = await supabase
    .from('factura_proveedor')
    .select('id_factura_proveedor, numero_comprobante, fecha, importe_total, estado')
    .eq('id_proveedor', idProveedor)
    .in('estado', ['Pendiente', 'Pagada Parcial'])
    .order('fecha', { ascending: true });

  if (facturasError) return { data: [], error: facturasError };
  if (!facturas.length) return { data: [], error: null };

  const ids = facturas.map((f) => f.id_factura_proveedor);

  const [{ data: aplicaciones, error: aplicacionesError }, { data: notas, error: notasError }] = await Promise.all([
    supabase
      .from('detalle_pago')
      .select('id_factura_proveedor, importe_aplicado')
      .in('id_factura_proveedor', ids),
    supabase
      .from('nota_credito_debito_proveedor')
      .select('id_factura_proveedor, tipo_nota, importe')
      .in('id_factura_proveedor', ids),
  ]);

  if (aplicacionesError) return { data: [], error: aplicacionesError };
  if (notasError) return { data: [], error: notasError };

  const pagadoPorFactura = new Map();
  for (const a of aplicaciones) {
    const acumulado = pagadoPorFactura.get(a.id_factura_proveedor) || 0;
    pagadoPorFactura.set(a.id_factura_proveedor, acumulado + Number(a.importe_aplicado));
  }

  const impactoNotasPorFactura = new Map();
  for (const n of notas || []) {
    const importe = Number(n.importe) || 0;
    const esCredito = n.tipo_nota === 'Crédito';
    const acumulado = impactoNotasPorFactura.get(n.id_factura_proveedor) || 0;
    impactoNotasPorFactura.set(n.id_factura_proveedor, acumulado + (esCredito ? -importe : importe));
  }

  const data = facturas
    .map((f) => {
      const totalPagado = pagadoPorFactura.get(f.id_factura_proveedor) || 0;
      const impactoNotas = impactoNotasPorFactura.get(f.id_factura_proveedor) || 0;
      const saldo = Number(f.importe_total) + impactoNotas - totalPagado;
      return {
        ...f,
        saldo_pendiente: Number(Math.max(0, saldo).toFixed(2)),
      };
    })
    // Una nota de crédito puede haber cancelado completamente una factura que
    // seguía marcada como 'Pendiente'/'Pagada Parcial' por una desactualización
    // puntual del campo estado; no la mostramos como aplicable si ya no tiene saldo.
    .filter((f) => f.saldo_pendiente > 0);

  return { data, error: null };
}

/**
 * Valida los datos del formulario ANTES de intentar guardarlos.
 *
 * @param {PagoProveedorInput} payload
 * @returns {{ valid: boolean, errors: Object<string,string> }}
 */
export function validatePagoPayload(payload) {
  const errors = {};

  if (!payload?.id_proveedor) {
    errors.id_proveedor = 'Debe seleccionar un proveedor.';
  }
  if (!payload?.fecha_pago) {
    errors.fecha_pago = 'La fecha de pago es obligatoria.';
  } else if (Number.isNaN(new Date(payload.fecha_pago).getTime())) {
    errors.fecha_pago = 'La fecha ingresada no es válida.';
  }
  if (!payload?.medio_pago?.trim()) {
    errors.medio_pago = 'El medio de pago es obligatorio.';
  }
  if (!Array.isArray(payload?.aplicaciones) || payload.aplicaciones.length === 0) {
    errors.aplicaciones = 'Debe seleccionar al menos un comprobante a cancelar.';
  } else {
    const conImporteInvalido = payload.aplicaciones.some(
      (a) => !a.id_factura_proveedor || !Number.isFinite(Number(a.importe_aplicado)) || Number(a.importe_aplicado) <= 0
    );
    if (conImporteInvalido) {
      errors.aplicaciones = 'Cada comprobante seleccionado debe tener un importe mayor a 0.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Prefijos definidos en las RAISE EXCEPTION de sql/002_fn_registrar_pago_proveedor.sql
const ERROR_MESSAGES = {
  SIN_APLICACIONES: { field: 'aplicaciones', message: 'Debe indicar al menos un comprobante a cancelar.' },
  IMPORTE_INVALIDO: { field: 'aplicaciones', message: 'Uno de los importes aplicados no es válido.' },
  FACTURA_INEXISTENTE: { field: 'aplicaciones', message: 'Una de las facturas seleccionadas ya no existe.' },
  FACTURA_PROVEEDOR_DISTINTO: { field: 'aplicaciones', message: 'Una de las facturas seleccionadas no pertenece a este proveedor.' },
  FACTURA_YA_PAGADA: { field: 'aplicaciones', message: 'Una de las facturas seleccionadas ya está pagada en su totalidad.' },
  SALDO_INSUFICIENTE: { field: 'aplicaciones', message: 'Uno de los importes aplicados supera el saldo pendiente de esa factura.' },
};

/**
 * Traduce un error de Postgres/Supabase (incluidos los RAISE EXCEPTION de negocio
 * de la función SQL) a un mensaje entendible en español.
 *
 * @param {import('@supabase/supabase-js').PostgrestError} error
 * @returns {{ field: string|null, message: string }}
 */
function parseSupabaseError(error) {
  if (!error) return { field: null, message: 'Ocurrió un error inesperado.' };

  const prefijo = Object.keys(ERROR_MESSAGES).find((p) => error.message?.includes(p));
  if (prefijo) return ERROR_MESSAGES[prefijo];

  return { field: null, message: error.message || 'Ocurrió un error al registrar el pago.' };
}

/**
 * Registra un pago a proveedor y sus aplicaciones a una o más facturas (HU33).
 * Toda la operación es atómica: se ejecuta en la función SQL registrar_pago_proveedor.
 *
 * ATENCIÓN: la validación SALDO_INSUFICIENTE ocurre dentro de esa función SQL, del
 * lado del servidor. Si esa función calcula el saldo de la misma forma en que lo
 * hacía esta función (solo importe_total - pagos, sin considerar notas), puede
 * seguir permitiendo pagos por encima del saldo real cuando hay una nota de por
 * medio, o rechazar pagos válidos. Convendría revisar/actualizar también
 * sql/002_fn_registrar_pago_proveedor.sql para que reste/sume el impacto de
 * nota_credito_debito_proveedor igual que acá. Pasame ese archivo si querés que
 * lo revise.
 *
 * @param {PagoProveedorInput} payload
 * @returns {Promise<{
 *   data: object|null,
 *   error: { field: string|null, message: string, fieldErrors?: Object<string,string> } | null
 * }>}
 */
export async function createPagoProveedor(payload) {
  const { valid, errors } = validatePagoPayload(payload);
  if (!valid) {
    return {
      data: null,
      error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors },
    };
  }

  const { data: idPago, error: rpcError } = await supabase.rpc('registrar_pago_proveedor', {
    p_id_proveedor: payload.id_proveedor,
    p_fecha_pago: payload.fecha_pago,
    p_medio_pago: payload.medio_pago.trim(),
    p_aplicaciones: payload.aplicaciones.map((a) => ({
      id_factura_proveedor: a.id_factura_proveedor,
      importe_aplicado: Number(a.importe_aplicado),
    })),
  });

  if (rpcError) {
    return { data: null, error: parseSupabaseError(rpcError) };
  }

  // La función devuelve solo el id; traemos el registro completo para confirmarle al usuario qué quedó guardado.
  const { data: pago, error: fetchError } = await supabase
    .from('pago_proveedor')
    .select('id_pago, id_proveedor, fecha_pago, importe_total, medio_pago, tipo_cancelacion')
    .eq('id_pago', idPago)
    .single();

  if (fetchError) {
    // El pago SÍ se registró (la función ya hizo commit); esto es solo un problema al releerlo.
    return { data: { id_pago: idPago }, error: null };
  }

  return { data: pago, error: null };
}
