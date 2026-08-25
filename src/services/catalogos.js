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
