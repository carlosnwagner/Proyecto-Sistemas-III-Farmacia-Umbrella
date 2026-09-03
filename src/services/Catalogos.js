import { supabase } from '../lib/supabase';

/**
 * Catálogos de apoyo usados por el formulario de alta de Artículo (HU03).
 * Pablo: usar estas funciones para poblar los <select> de "Rubro" y "Unidad de medida".
 */

/**
 * Trae los rubros disponibles para el combo de categoría.
 * @returns {Promise<{ data: Array<{id_rubro: number, nombre: string}>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getRubros() {
  const { data, error } = await supabase
    .from('rubro')
    .select('id_rubro, nombre')
    .order('nombre', { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Trae las unidades de medida disponibles para el combo de unidad.
 * @returns {Promise<{ data: Array<{id_unidad: number, nombre: string, abreviatura: string|null}>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getUnidadesMedida() {
  const { data, error } = await supabase
    .from('unidad_medida')
    .select('id_unidad, nombre, abreviatura')
    .order('nombre', { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Catálogos usados por el formulario de Orden de Compra (HU27): condición de
 * pago (ej. "30 días", "Contado") y medio de pago (ej. "Transferencia").
 * Solo se traen las activas (estado = true) para no ofrecer opciones dadas de baja.
 */

/**
 * @returns {Promise<{ data: Array<{id_condicion_pago: number, nombre: string}>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getCondicionesPago() {
  const { data, error } = await supabase
    .from('condicion_pago')
    .select('id_condicion_pago, nombre')
    .eq('estado', true)
    .order('nombre', { ascending: true });

  return { data: data ?? [], error };
}

/**
 * @returns {Promise<{ data: Array<{id_medio_pago: number, nombre: string}>, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function getMediosPago() {
  const { data, error } = await supabase
    .from('medio_pago')
    .select('id_medio_pago, nombre')
    .eq('estado', true)
    .order('nombre', { ascending: true });

  return { data: data ?? [], error };
}
