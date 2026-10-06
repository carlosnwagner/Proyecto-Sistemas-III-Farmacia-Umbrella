import { supabase } from '../lib/supabase.js';

async function sesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
async function rpc(nombre, parametros) {
  if (!await sesion()) throw new Error('Necesitás una sesión válida para consultar movimientos y operar la caja.');
  const { data, error } = await supabase.rpc(nombre, parametros);
  if (error) throw error;
  return data;
}
export async function consultarTurnos() {
  const session = await sesion();
  if (session) return { autenticado: true, turnos: await rpc('caja_listar_turnos') };
  // Lectura ya habilitada en la base actual: no simula una identidad ni un saldo.
  const { data, error } = await supabase.from('turno_caja')
    .select('id,caja_id,sucursal_id,cajero_id,estado,fecha_hora_apertura,saldo_inicial')
    .order('fecha_hora_apertura', { ascending: false });
  if (error) throw error;
  const { data: cajas, error: errorCajas } = await supabase.from('caja').select('id,nombre');
  if (errorCajas) throw errorCajas;
  return { autenticado: false, turnos: (data || []).map(t => ({ ...t, caja_nombre: cajas?.find(c => c.id === t.caja_id)?.nombre || `Caja #${t.caja_id}` })) };
}
export const consultarDetalleTurno = turno => rpc('caja_resumen', { p_turno: turno });
export const registrarArqueoReal = p => rpc('caja_registrar_arqueo', {
  p_turno: p.turno, p_contado: p.contado, p_version: p.version, p_clave: p.clave,
});
export const cerrarTurnoReal = p => rpc('caja_cerrar_turno', {
  p_turno: p.turno, p_arqueo: p.arqueo, p_version: p.version,
  p_observacion: p.observacion, p_clave: p.clave,
});
