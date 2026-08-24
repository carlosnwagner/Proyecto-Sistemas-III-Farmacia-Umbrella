import { supabase } from '../lib/supabase';

/**
 * HU31 - Registrar notas de crédito y débito (Responsable Administrativo)
 * "NC/ND asociadas a factura y proveedor."
 *
 * Criterios de aceptación cubiertos en este archivo:
 *  - La NC/ND identifica proveedor, tipo, número, fecha e importe.
 *  - Debe asociarse al comprobante que modifica.
 *  - Se conserva la relación con la factura original.
 *
 * Decisión de diseño: el formulario NO le pide el proveedor al usuario por separado.
 * Se elige la factura a corregir (getFacturasParaNota) y el proveedor se toma
 * automáticamente de esa factura, para que sea imposible cargar una nota con un
 * proveedor distinto al de la factura que dice estar modificando.
 */

/**
 * @typedef {Object} NotaCreditoDebitoInput
 * @property {number} id_factura_proveedor - factura que la nota modifica, obligatoria
 * @property {'Crédito'|'Débito'} tipo_nota - tipo de nota, obligatorio
 * @property {string} numero_comprobante   - número de comprobante de la nota, obligatorio
 * @property {string} fecha                - fecha de emisión (YYYY-MM-DD), obligatoria
 * @property {number|string} importe       - importe de la nota, debe ser > 0
 */

/**
 * @typedef {Object} NotaValidationResult
 * @property {boolean} valid
 * @property {Object<string,string>} errors
 */

export const TIPOS_NOTA = ['Crédito', 'Débito'];

/**
 * Trae las facturas de proveedor disponibles para asociar una NC/ND, con el
 * nombre del proveedor ya resuelto para mostrar en el combo del formulario.
 * Pablo: usar esto para poblar el <select> de "Factura a corregir"
 * (mostrar algo como `${numero_comprobante} - ${proveedor.razon_social}`).
 *
 * @returns {Promise<{
 *   data: Array<{
 *     id_factura_proveedor: number,
 *     numero_comprobante: string,
 *     importe_total: number,
 *     id_proveedor: number,
 *     proveedor: { razon_social: string }
 *   }>,
 *   error: import('@supabase/supabase-js').PostgrestError | null
 * }>}
 */
export async function getFacturasParaNota() {
  const { data, error } = await supabase
    .from('factura_proveedor')
    .select('id_factura_proveedor, numero_comprobante, importe_total, id_proveedor, proveedor(razon_social)')
    .order('fecha', { ascending: false });

  return { data: data ?? [], error };
}

/**
 * Valida los datos del formulario ANTES de intentar guardarlos.
 *
 * @param {NotaCreditoDebitoInput} payload
 * @returns {NotaValidationResult}
 */
export function validateNotaPayload(payload) {
  const errors = {};

  if (!payload?.id_factura_proveedor) {
    errors.id_factura_proveedor = 'Debe seleccionar la factura que la nota modifica.';
  }
  if (!payload?.tipo_nota || !TIPOS_NOTA.includes(payload.tipo_nota)) {
    errors.tipo_nota = 'Debe indicar si la nota es de Crédito o de Débito.';
  }
  if (!payload?.numero_comprobante?.trim()) {
    errors.numero_comprobante = 'El número de comprobante es obligatorio.';
  }
  if (!payload?.fecha) {
    errors.fecha = 'La fecha es obligatoria.';
  } else if (Number.isNaN(new Date(payload.fecha).getTime())) {
    errors.fecha = 'La fecha ingresada no es válida.';
  }

  const importe = Number(payload?.importe);
  if (!Number.isFinite(importe) || importe <= 0) {
    errors.importe = 'El importe debe ser un número mayor a 0.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Traduce un error de Postgres/Supabase a un mensaje entendible en español,
 * e identifica a qué campo del formulario corresponde.
 *
 * @param {import('@supabase/supabase-js').PostgrestError} error
 * @returns {{ field: string|null, message: string }}
 */
function parseSupabaseError(error) {
  if (!error) return { field: null, message: 'Ocurrió un error inesperado.' };

  // 23503 = foreign_key_violation (la factura elegida no existe, borrada entre que se listó y se guardó)
  if (error.code === '23503') {
    return { field: 'id_factura_proveedor', message: 'La factura seleccionada ya no existe. Actualizá el listado e intentá de nuevo.' };
  }

  // 23514 = check_violation (importe <= 0, o tipo_nota fuera de 'Crédito'/'Débito')
  if (error.code === '23514') {
    if (error.message?.includes('importe')) {
      return { field: 'importe', message: 'El importe debe ser mayor a 0.' };
    }
    if (error.message?.includes('tipo_nota')) {
      return { field: 'tipo_nota', message: "El tipo de nota debe ser 'Crédito' o 'Débito'." };
    }
    return { field: null, message: 'Alguno de los valores ingresados no cumple las reglas de negocio.' };
  }

  return { field: null, message: error.message || 'Ocurrió un error al guardar la nota.' };
}

/**
 * Da de alta una nota de crédito o débito asociada a una factura de proveedor (HU31).
 * El id_proveedor NO se recibe por parámetro: se resuelve automáticamente a partir
 * de la factura seleccionada, para garantizar que la nota siempre quede asociada
 * al proveedor correcto (el mismo de la factura que dice modificar).
 *
 * @param {NotaCreditoDebitoInput} payload
 * @returns {Promise<{
 *   data: object|null,
 *   error: { field: string|null, message: string, fieldErrors?: Object<string,string> } | null
 * }>}
 */
export async function createNotaCreditoDebito(payload) {
  const { valid, errors } = validateNotaPayload(payload);
  if (!valid) {
    return {
      data: null,
      error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors },
    };
  }

  // Resolvemos el proveedor a partir de la factura elegida (ver comentario de diseño arriba).
  const { data: factura, error: facturaError } = await supabase
    .from('factura_proveedor')
    .select('id_factura_proveedor, id_proveedor')
    .eq('id_factura_proveedor', payload.id_factura_proveedor)
    .maybeSingle();

  if (facturaError) {
    return { data: null, error: parseSupabaseError(facturaError) };
  }
  if (!factura) {
    return {
      data: null,
      error: {
        field: 'id_factura_proveedor',
        message: 'La factura seleccionada no existe o fue eliminada.',
        fieldErrors: { id_factura_proveedor: 'Seleccioná una factura válida.' },
      },
    };
  }

  const insertPayload = {
    id_proveedor: factura.id_proveedor,
    id_factura_proveedor: factura.id_factura_proveedor,
    tipo_nota: payload.tipo_nota,
    numero_comprobante: payload.numero_comprobante.trim(),
    fecha: payload.fecha,
    importe: Number(payload.importe),
  };

  const { data, error } = await supabase
    .from('nota_credito_debito_proveedor')
    .insert(insertPayload)
    .select('id_nota, id_proveedor, id_factura_proveedor, tipo_nota, numero_comprobante, fecha, importe')
    .single();

  if (error) {
    return { data: null, error: parseSupabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Trae las notas de crédito/débito ya registradas para una factura puntual,
 * útil para mostrar el historial de correcciones de esa factura.
 *
 * @param {number} idFacturaProveedor
 * @returns {Promise<{ data: Array<object>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getNotasPorFactura(idFacturaProveedor) {
  const { data, error } = await supabase
    .from('nota_credito_debito_proveedor')
    .select('id_nota, tipo_nota, numero_comprobante, fecha, importe')
    .eq('id_factura_proveedor', idFacturaProveedor)
    .order('fecha', { ascending: false });

  return { data: data ?? [], error };
}