import { supabase } from '../lib/supabase';

/**
 * HU03 - Registrar un nuevo producto (Administrador)
 * "Alta con identificación, código de barras, categoría, unidad, precios y estado."
 *
 * Criterios de aceptación cubiertos en este archivo:
 *  - Permite cargar código, código de barras, nombre, categoría, unidad, costo y precio de venta.
 *  - Código y código de barras no pueden duplicarse.
 *  - Los precios deben ser valores válidos.
 *  - Al confirmar queda Activo y disponible.
 */

/**
 * @typedef {Object} ArticuloInput
 * @property {number} id_rubro        - id del rubro seleccionado (combo Rubro)
 * @property {number} id_unidad       - id de la unidad de medida seleccionada (combo Unidad)
 * @property {string} codigo          - código identificatorio interno, obligatorio y único
 * @property {string} [codigo_barras] - código de barras, opcional pero único si se carga
 * @property {string} nombre          - nombre comercial del artículo, obligatorio
 * @property {string} [descripcion]   - descripción ampliada, opcional
 * @property {number|string} precio_costo - precio de costo, debe ser > 0
 * @property {number|string} precio_venta - precio de venta, debe ser > 0
 */

/**
 * @typedef {Object} ArticuloValidationResult
 * @property {boolean} valid
 * @property {Object<string,string>} errors - mapa campo -> mensaje, solo si valid es false
 */

/**
 * Valida los datos del formulario ANTES de intentar guardarlos.
 * @param {ArticuloInput} payload
 * @returns {ArticuloValidationResult}
 */
export function validateArticuloPayload(payload) {
  const errors = {};

  if (!payload?.id_rubro) {
    errors.id_rubro = 'Debe seleccionar un rubro.';
  }
  if (!payload?.id_unidad) {
    errors.id_unidad = 'Debe seleccionar una unidad de medida.';
  }
  if (!payload?.codigo?.trim()) {
    errors.codigo = 'El código es obligatorio.';
  }
  if (!payload?.nombre?.trim()) {
    errors.nombre = 'El nombre es obligatorio.';
  }

  const costo = Number(payload?.precio_costo);
  if (!Number.isFinite(costo) || costo <= 0) {
    errors.precio_costo = 'El precio de costo debe ser un número mayor a 0.';
  }

  const venta = Number(payload?.precio_venta);
  if (!Number.isFinite(venta) || venta <= 0) {
    errors.precio_venta = 'El precio de venta debe ser un número mayor a 0.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Nombres de las constraints UNIQUE definidas en el schema SQL (ver schema_farmacia_umbrella_sprint1.sql).
// Postgres los genera automáticamente como "<tabla>_<columna>_key".
const DUPLICATE_FIELD_BY_CONSTRAINT = {
  articulo_codigo_key: 'codigo',
  articulo_codigo_barras_key: 'codigo_barras',
};

/**
 * Traduce un error de Postgres/Supabase a un mensaje entendible en español,
 * e identifica a qué campo del formulario corresponde (para marcarlo en rojo).
 *
 * @param {import('@supabase/supabase-js').PostgrestError} error
 * @returns {{ field: string|null, message: string }}
 */
function parseSupabaseError(error) {
  if (!error) return { field: null, message: 'Ocurrió un error inesperado.' };

  // 23505 = unique_violation
  if (error.code === '23505') {
    const constraint = Object.keys(DUPLICATE_FIELD_BY_CONSTRAINT).find((c) =>
      error.message?.includes(c)
    );
    const field = constraint ? DUPLICATE_FIELD_BY_CONSTRAINT[constraint] : null;

    if (field === 'codigo') {
      return { field, message: 'Ya existe un artículo registrado con ese código.' };
    }
    if (field === 'codigo_barras') {
      return { field, message: 'Ya existe un artículo registrado con ese código de barras.' };
    }
    return { field: null, message: 'El artículo ya existe (dato duplicado).' };
  }

  // 23514 = check_violation (por ejemplo precio_costo <= 0, ver CHECK en la tabla)
  if (error.code === '23514') {
    return {
      field: null,
      message: 'Alguno de los valores ingresados no cumple las reglas de negocio (revisar precios).',
    };
  }

  return { field: null, message: error.message || 'Ocurrió un error al guardar el artículo.' };
}

/**
 * Verifica si un código ya está en uso (para validación en vivo, ej. al perder foco el input).
 * Opcional: mejora la UX pero no reemplaza la validación de la base de datos.
 *
 * @param {string} codigo
 * @returns {Promise<boolean>} true si el código YA existe
 */
export async function existeCodigo(codigo) {
  if (!codigo?.trim()) return false;
  const { data, error } = await supabase
    .from('articulo')
    .select('id_articulo')
    .eq('codigo', codigo.trim())
    .maybeSingle();

  if (error) return false; // ante un error de red no bloqueamos al usuario, lo valida igual el insert
  return Boolean(data);
}

/**
 * Verifica si un código de barras ya está en uso (para validación en vivo).
 *
 * @param {string} codigoBarras
 * @returns {Promise<boolean>} true si el código de barras YA existe
 */
export async function existeCodigoBarras(codigoBarras) {
  if (!codigoBarras?.trim()) return false;
  const { data, error } = await supabase
    .from('articulo')
    .select('id_articulo')
    .eq('codigo_barras', codigoBarras.trim())
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

/**
 * Da de alta un nuevo artículo en el catálogo (HU03).
 * No es necesario enviar "estado": la base lo asigna en 'Activo' por DEFAULT,
 * cumpliendo el criterio "Al confirmar queda Activo y disponible".
 *
 * @param {ArticuloInput} payload
 * @returns {Promise<{
 *   data: object|null,
 *   error: { field: string|null, message: string, fieldErrors?: Object<string,string> } | null
 * }>}
 */
export async function createArticulo(payload) {
  const { valid, errors } = validateArticuloPayload(payload);
  if (!valid) {
    return {
      data: null,
      error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors },
    };
  }

  const insertPayload = {
    id_rubro: payload.id_rubro,
    id_unidad: payload.id_unidad,
    codigo: payload.codigo.trim(),
    codigo_barras: payload.codigo_barras?.trim() || null,
    nombre: payload.nombre.trim(),
    descripcion: payload.descripcion?.trim() || null,
    precio_costo: Number(payload.precio_costo),
    precio_venta: Number(payload.precio_venta),
  };

  const { data, error } = await supabase
    .from('articulo')
    .insert(insertPayload)
    .select('id_articulo, codigo, codigo_barras, nombre, descripcion, precio_costo, precio_venta, estado, fecha_registro')
    .single();

  if (error) {
    return { data: null, error: parseSupabaseError(error) };
  }

  return { data, error: null };
}


/**
 * Modifica un artículo existente en la base de datos.
 *
 * @param {number} idArticulo - El ID único (primary key) del artículo a editar.
 * @param {ArticuloInput} payload - Los datos del formulario.
 */
export async function updateArticulo(idArticulo, payload) {
  // Reutilizacion de las validaciones
  const { valid, errors } = validateArticuloPayload(payload);
  if (!valid) {
    return {
      data: null,
      error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors },
    };
  }

  const updatePayload = {
    id_rubro: payload.id_rubro,
    id_unidad: payload.id_unidad,
    codigo: payload.codigo.trim(),
    codigo_barras: payload.codigo_barras?.trim() || null,
    nombre: payload.nombre.trim(),
    descripcion: payload.descripcion?.trim() || null,
    precio_costo: Number(payload.precio_costo),
    precio_venta: Number(payload.precio_venta),
  };

  // UPDATE en Supabase 
  const { data, error } = await supabase
    .from('articulo')
    .update(updatePayload)
    .eq('id_articulo', idArticulo)
    .select()
    .single();

  if (error) {
    return { data: null, error: parseSupabaseError(error) };
  }

  return { data, error: null };
}
