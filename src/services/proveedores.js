import { supabase } from '../lib/supabase';

export function validateProveedorPayload(payload) {
  const errors = {};

  if (!payload?.razon_social?.trim()) {
    errors.razon_social = 'La razón social es obligatoria.';
  }

  if (!payload?.identificacion_fiscal?.trim()) {
    errors.identificacion_fiscal =
      'La identificación fiscal (CUIT) es obligatoria.';
  }

  if (!payload?.datos_comerciales?.trim()) {
    errors.datos_comerciales =
      'Los datos comerciales son obligatorios.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Nombre de la constraint UNIQUE definida en el schema SQL 
const DUPLICATE_FIELD_BY_CONSTRAINT = {
  proveedor_identificacion_fiscal_key: 'identificacion_fiscal',
};

/**
 * Traduce un error de Postgres/Supabase a un mensaje entendible en español,
 * e identifica a qué campo del formulario corresponde (para marcarlo en rojo).
 *
 * @param {import('@supabase/supabase-js').PostgrestError} error
 * @returns {{ field: string|null, message: string }}
 */
function parseSupabaseError(error) {
  if (!error) {
    return {
      field: null,
      message: 'Ocurrió un error inesperado.',
    };
  }

  // 23505 = unique_violation
  if (error.code === '23505') {
    const constraint = Object.keys(DUPLICATE_FIELD_BY_CONSTRAINT).find(
      (c) => error.message?.includes(c)
    );

    const field = constraint
      ? DUPLICATE_FIELD_BY_CONSTRAINT[constraint]
      : null;

    if (field === 'identificacion_fiscal') {
      return {
        field,
        message:
          'Ya existe un proveedor registrado con esa identificación fiscal.',
      };
    }

    return {
      field: null,
      message: 'El proveedor ya existe (dato duplicado).',
    };
  }

  // 23514 = check_violation (por ejemplo un valor de estado fuera de dominio)
  if (error.code === '23514') {
    return {
      field: null,
      message:
        'Alguno de los valores ingresados no cumple las reglas de negocio.',
    };
  }

  return {
    field: null,
    message:
      error.message || 'Ocurrió un error al guardar el proveedor.',
  };
}

/**
 * Trae todos los proveedores NO anulados.
 *
 * Se utiliza para las tablas/listados de proveedores.
 * Los proveedores anulados se mantienen en la base de datos,
 * pero no se muestran.
 *
 * @returns {Promise<{
 *   data: Array,
 *   error: import('@supabase/supabase-js').PostgrestError | null
 * }>}
 */
export async function getProveedores() {
  const { data, error } = await supabase
    .from('proveedor')
    .select(
      'id_proveedor, razon_social, identificacion_fiscal, datos_comerciales, datos_contacto, estado, anulado, fecha_registro'
    )
    .eq('anulado', false)
    .order('razon_social', { ascending: true });

  return {
    data: data ?? [],
    error,
  };
}

/**
 * Verifica si una identificación fiscal ya está en uso
 * (para validación en vivo, ej. al perder foco el input).
 * Opcional: mejora la UX pero no reemplaza
 * la validación de la base de datos.
 *
 * @param {string} identificacionFiscal
 * @returns {Promise<boolean>} true si la identificación fiscal YA existe
 */
export async function existeIdentificacionFiscal(
  identificacionFiscal
) {
  if (!identificacionFiscal?.trim()) return false;

  const { data, error } = await supabase
    .from('proveedor')
    .select('id_proveedor')
    .eq(
      'identificacion_fiscal',
      identificacionFiscal.trim()
    )
    .eq('anulado', false)
    .maybeSingle();

  if (error) return false; // ante un error de red no bloqueamos al usuario, lo valida igual el insert

  return Boolean(data);
}

/**
 * Da de alta un nuevo proveedor (HU23).
 * No es necesario enviar "estado": la base lo asigna en 'Activo' por DEFAULT,
 * cumpliendo el criterio "el proveedor queda Activo y disponible para compras y pagos".
 *
 * El campo "anulado" se establece explícitamente en false.
 *
 * @param {ProveedorInput} payload
 * @returns {Promise<{
 *   data: object|null,
 *   error: { field: string|null, message: string, fieldErrors?: Object<string,string> } | null
 * }>}
 */
export async function createProveedor(payload) {
  const { valid, errors } = validateProveedorPayload(payload);

  if (!valid) {
    return {
      data: null,
      error: {
        field: null,
        message: 'Revisá los campos marcados.',
        fieldErrors: errors,
      },
    };
  }

  const insertPayload = {
    razon_social: payload.razon_social.trim(),
    identificacion_fiscal: payload.identificacion_fiscal.trim(),
    datos_comerciales: payload.datos_comerciales.trim(),
    datos_contacto: payload.datos_contacto?.trim() || null,

    // Todo proveedor nuevo comienza como NO anulado.
    anulado: false,
  };

  const { data, error } = await supabase
    .from('proveedor')
    .insert(insertPayload)
    .select(
      'id_proveedor, razon_social, identificacion_fiscal, datos_comerciales, datos_contacto, estado, anulado, fecha_registro'
    )
    .single();

  if (error) {
    return {
      data: null,
      error: parseSupabaseError(error),
    };
  }

  return {
    data,
    error: null,
  };
}

/**
 * Modifica un proveedor existente en la base de datos.
 *
 * No permite modificar proveedores que ya fueron anulados.
 *
 * @param {number} idProveedor - El ID único del proveedor a editar.
 * @param {ProveedorInput} payload - Los datos del formulario.
 */
export async function updateProveedor(idProveedor, payload) {
  const { valid, errors } = validateProveedorPayload(payload);

  if (!valid) {
    return {
      data: null,
      error: {
        field: null,
        message: 'Revisá los campos marcados.',
        fieldErrors: errors,
      },
    };
  }

  const updatePayload = {
    razon_social: payload.razon_social.trim(),
    identificacion_fiscal: payload.identificacion_fiscal.trim(),
    datos_comerciales: payload.datos_comerciales.trim(),
    datos_contacto: payload.datos_contacto?.trim() || null,
  };

  const { data, error } = await supabase
    .from('proveedor')
    .update(updatePayload)
    .eq('id_proveedor', idProveedor)
    .eq('anulado', false)
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error: parseSupabaseError(error),
    };
  }

  return {
    data,
    error: null,
  };
}

/**
 * Anula un proveedor de forma lógica.
 *
 * NO se elimina físicamente de la base de datos.
 * Simplemente se actualiza el campo "anulado" a true.
 *
 * Los proveedores anulados no deben aparecer en los listados
 * ni en los datos utilizados por otros módulos.
 *
 * @param {number} idProveedor - El ID único del proveedor a anular.
 */
export async function deleteProveedor(idProveedor) {
  const { data, error } = await supabase
    .from('proveedor')
    .update({ anulado: true })
    .eq('id_proveedor', idProveedor)
    .eq('anulado', false)
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error: parseSupabaseError(error),
    };
  }

  return {
    data,
    error: null,
  };
}

/**
 * Trae los proveedores activos y NO anulados,
 * útil para combos en Compras y Pagos (fuera de alcance
 * directo de HU23, pero se deja listo ya que el criterio dice
 * "disponible para compras y pagos").
 *
 * @returns {Promise<{
 *   data: Array<{id_proveedor:number, razon_social:string}>,
 *   error: import('@supabase/supabase-js').PostgrestError | null
 * }>}
 */
export async function getProveedoresActivos() {
  const { data, error } = await supabase
    .from('proveedor')
    .select('id_proveedor, razon_social')
    .eq('estado', true)
    .eq('anulado', false)
    .order('razon_social', { ascending: true });

  return {
    data: data ?? [],
    error,
  };
}
