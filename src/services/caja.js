import { supabase } from '../lib/supabase.js';

// La identidad viaja en la sesión de Supabase. Nunca se envía un cajero elegido
// desde el formulario: las RPC resuelven auth.uid() y validan la sucursal.
export async function getContextoCaja() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('Iniciá sesión para registrar movimientos de caja.');
  const result = await supabase.rpc('hu50_contexto_caja');
  if (result.error) throw result.error;
  return result.data;
}

export async function getMovimientosCaja(turnoId) {
  const { data, error } = await supabase.rpc('hu50_consultar_movimientos', { p_turno_id: turnoId });
  if (error) throw error;
  return data || [];
}

export async function registrarMovimientoCaja(payload) {
  const { data, error } = await supabase.rpc('hu50_registrar_movimiento', {
    p_turno_id: payload.turnoId,
    p_tipo: payload.tipo || null,
    p_concepto: payload.concepto,
    p_importe: payload.importe ?? null,
    p_medio_pago_id: payload.medioPagoId || null,
    p_idempotency_key: payload.clave,
    p_movimiento_original_id: payload.originalId || null,
  });
  if (error) throw error;
  return data;
}
