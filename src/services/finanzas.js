import { supabase } from '../lib/supabase.js';
import { validarPeriodo } from '../lib/finanzas.js';

async function rpc(nombre, parametros) {
  const { data, error } = await supabase.rpc(nombre, parametros);
  if (error) throw error;
  return data;
}
export const contextoFinanzas = () => rpc('finanzas_contexto');
export function consultarFinanzas(filtros) {
  const error = validarPeriodo(filtros.desde, filtros.hasta);
  if (error) throw new Error(error);
  return rpc('finanzas_resumen', {
    p_desde: filtros.desde, p_hasta: filtros.hasta,
    p_sucursal: filtros.sucursal ? Number(filtros.sucursal) : null,
    p_anio_grafico: filtros.anioGrafico ? Number(filtros.anioGrafico) : null,
  });
}
export const clasificarMovimientoFinanciero = (id, clase, pago) => rpc('hu61_clasificar_movimiento', {
  p_movimiento: id, p_clase: clase, p_pago: pago ? Number(pago) : null,
});
export async function asignarSucursalPago(id, sucursal) {
  const { data, error } = await supabase.from('pago_proveedor').update({ id_sucursal: Number(sucursal) })
    .eq('id_pago', id).select('id_pago').single();
  if (error) throw error;
  return data;
}
