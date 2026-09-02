import { supabase } from '../lib/supabase.js';

export const getArticulos = async () => {
  const { data, error } = await supabase
    .from('articulo')
    .select(`
      id_articulo,
      codigo,
      codigo_barras,
      nombre,
      descripcion,
      id_rubro,
      id_unidad,
      precio_costo,
      precio_venta,
      estado,
      rubro:id_rubro (nombre),
      unidad_medida:id_unidad (nombre)
    `)
    .order('id_articulo', { ascending: false });

  return { data, error };
};

export const createArticulo = async (articuloData) => {
  const { data, error } = await supabase
    .from('articulo')
    .insert([articuloData])
    .select()
    .single();

  return { data, error };
};

export const updateArticulo = async (idArticulo, articuloData) => {
  const { data, error } = await supabase
    .from('articulo')
    .update(articuloData)
    .eq('id_articulo', idArticulo)
    .select()
    .single();

  return { data, error };
};