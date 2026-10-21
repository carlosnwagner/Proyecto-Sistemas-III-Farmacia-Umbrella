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
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const sucursal = filtros.sucursal ? Number(filtros.sucursal) : null;
  const anio = Number(filtros.anioGrafico || desde.slice(0, 4));
  return Promise.all([rpc('finanzas_resumen', {
    p_desde: desde, p_hasta: hasta, p_sucursal: sucursal,
    p_anio_grafico: filtros.anioGrafico ? anio : null,
  }), rpc('hu66_mp_movimientos_reporte', {
    p_desde: desde, p_hasta: hasta, p_sucursal: sucursal, p_anio: anio,
  })]).then(([resumen, online]) => {
    const movimientosOnline = online?.movimientos || [];
    const movimientos = [...(resumen.movimientos || []), ...movimientosOnline]
      .sort((a, b) => new Date(b.fecha_efectiva) - new Date(a.fecha_efectiva));
    const sumar = (a, b) => (Number(a || 0) + Number(b || 0)).toFixed(2);
    let totales = resumen.totales;
    if (totales) {
      for (const movimiento of movimientosOnline) {
        if (movimiento.tipo === 'Ingreso') totales.ingresos = sumar(totales.ingresos, movimiento.importe);
        else totales.egresos = sumar(totales.egresos, movimiento.importe);
      }
      totales.flujo_neto = (Number(totales.ingresos) - Number(totales.egresos)).toFixed(2);
    }
    const mensualOnline = new Map((online?.mensual || []).map(item => [item.mes, item]));
    const mensual = (resumen.mensual || []).map(item => {
      const extra = mensualOnline.get(item.mes);
      if (!extra) return item;
      const ingresos = sumar(item.ingresos, extra.ingresos);
      const egresos = sumar(item.egresos, extra.egresos);
      return { ...item, ingresos, egresos, flujo_neto: (Number(ingresos) - Number(egresos)).toFixed(2) };
    });
    return { ...resumen, movimientos, totales, mensual };
  });
}

export async function consultarMediosPagoFinanzas(filtros) {
  // Filtros
  const diaSiguiente = new Date(`${filtros.hasta}T00:00:00Z`);
  diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
  const desde = `${filtros.desde}T00:00:00-03:00`;
  const hasta = `${diaSiguiente.toISOString().slice(0, 10)}T00:00:00-03:00`;

  const filasVentas = [];
  const tamanoPagina = 1000;

  for (let inicio = 0; ; inicio += tamanoPagina) {

    let consulta = supabase.from('venta')
      .select('medio_pago, importe_total, fecha, id_sucursal')
      .eq('estado', 'Confirmada')
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: true })
      .order('id_venta', { ascending: true })
      .range(inicio, inicio + tamanoPagina - 1);

    if (filtros.sucursal) consulta = consulta.eq('id_sucursal', Number(filtros.sucursal));

    const { data, error } = await consulta;
    if (error) throw error;
    filasVentas.push(...(data || []));
    if (!data || data.length < tamanoPagina) break;
  }

  const filasPagosEmitidos = [];

  for (let inicio = 0; ; inicio += tamanoPagina) {
    let consultaPagos = supabase.from('pago_proveedor')
      .select('importe_total, fecha_pago, id_sucursal, medio_pago(nombre)')
      .gte('fecha_pago', filtros.desde)
      .lte('fecha_pago', filtros.hasta)
      .order('fecha_pago', { ascending: true })
      .order('id_pago', { ascending: true })
      .range(inicio, inicio + tamanoPagina - 1);
      
    if (filtros.sucursal) consultaPagos = consultaPagos.eq('id_sucursal', Number(filtros.sucursal));
    
    const { data, error } = await consultaPagos;
    if (error) throw error;
    filasPagosEmitidos.push(...(data || []));
    if (!data || data.length < tamanoPagina) break;
  }

  return {
    pagos: filasVentas,
    pagosEmitidos: filasPagosEmitidos
  };
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
