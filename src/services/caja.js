// ==============================================================================
// BACKEND INTERMEDIO DE CAJA Y ARQUEO (src/services/caja.js)
// ==============================================================================

import { supabase } from '../lib/supabase.js';
import { crearConfirmacionMovimiento } from '../lib/confirmacionMovimiento.js';

const confirmaciones = new Map();

export async function getSucursalesAutorizadas(usuario) {
  try {
    if (!usuario) return { data: [], error: 'Sin sesión de usuario' };
    if (usuario.rol === 'administrador') {
      const { data, error } = await supabase.from('sucursal').select('*').eq('estado', true).order('codigo', { ascending: true });
      if (error) throw error;
      return { data: data || [], error: null };
    }
    try {
      // Reemplazamos la consulta directa bloqueada por el RPC seguro
      const { data: asignaciones } = await supabase.rpc('verificar_usuario_sucursal_caja', { p_usuario_id: usuario.id_usuario });
      if (asignaciones && asignaciones.length > 0) {
        const ids = asignaciones.map((a) => a.sucursal_id);
        const { data: sucursales } = await supabase.from('sucursal').select('*').in('id_sucursal', ids).eq('estado', true).order('codigo', { ascending: true });
        if (sucursales && sucursales.length > 0) return { data: sucursales, error: null };
      }
    } catch (e) {
      console.warn('Fallback sucursales:', e);
    }
    if (usuario.sucursal_id) {
      const { data: sucUser } = await supabase.from('sucursal').select('*').eq('id_sucursal', usuario.sucursal_id);
      if (sucUser && sucUser.length > 0) return { data: sucUser, error: null };
    }
    const { data: todas, error } = await supabase.from('sucursal').select('*').eq('estado', true).order('codigo', { ascending: true }).limit(3);
    return { data: todas || [], error };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function getCajasSucursalConDisponibilidad(sucursalId) {
  try {
    if (!sucursalId) return { data: [], error: 'ID requerido' };
    const { data: cajas } = await supabase.from('caja').select('*').eq('sucursal_id', sucursalId).order('nombre', { ascending: true });
    const { data: turnosAbiertos } = await supabase.from('turno_caja').select('id, caja_id, cajero_id, saldo_inicial, estado, fecha_hora_apertura').eq('sucursal_id', sucursalId).eq('estado', 'Abierto');
    
    const cajeroIds = [...new Set((turnosAbiertos || []).map((t) => t.cajero_id))];
    let mapaCajeros = {};
    if (cajeroIds.length > 0) {
      const { data: usuarios } = await supabase.from('usuario').select('id_usuario, nombre_completo, usuario').in('id_usuario', cajeroIds);
      (usuarios || []).forEach((u) => { mapaCajeros[u.id_usuario] = u.nombre_completo || u.usuario; });
    }

    const cajasConEstado = (cajas || []).map((caja) => {
      const turnoActivo = (turnosAbiertos || []).find((t) => Number(t.caja_id) === Number(caja.id));
      const enUso = !!turnoActivo;
      return {
        ...caja,
        disponible: caja.activa && !enUso,
        en_uso: enUso,
        turno_activo: turnoActivo || null,
        cajero_nombre: enUso ? mapaCajeros[turnoActivo.cajero_id] || 'Otro operador' : null,
        fecha_hora_apertura: turnoActivo ? turnoActivo.fecha_hora_apertura : null,
        saldo_inicial: turnoActivo ? turnoActivo.saldo_inicial : null
      };
    });
    return { data: cajasConEstado, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function getTurnoActivoCajero(cajeroId) {
  try {
    if (!cajeroId) return { tieneTurno: false, turno: null, error: null };
    const { data, error } = await supabase.from('turno_caja').select('id, caja_id, sucursal_id, cajero_id, saldo_inicial, estado, fecha_hora_apertura, caja:caja_id(id, nombre), sucursal:sucursal_id(id_sucursal, codigo, descripcion)').eq('cajero_id', Number(cajeroId)).eq('estado', 'Abierto').limit(1);
    if (error) throw error;
    if (data && data.length > 0) return { tieneTurno: true, turno: data[0], error: null };
    return { tieneTurno: false, turno: null, error: null };
  } catch (err) {
    return { tieneTurno: false, turno: null, error: err.message };
  }
}

export async function abrirTurnoCaja({ cajaId, sucursalId, cajeroId, saldoInicial }) {
  try {
    const saldoNum = Number(saldoInicial);
    const { data, error } = await supabase.rpc('abrir_turno_caja', {
      p_caja_id: Number(cajaId),
      p_sucursal_id: Number(sucursalId),
      p_cajero_id: Number(cajeroId),
      p_saldo_inicial: saldoNum
    });
    if (!error) return { success: true, data, error: null };
    return { success: false, error: error.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function crearCaja({ nombre, sucursalId, activa = true }) {
  try {
    const { data, error } = await supabase.from('caja').insert([{ nombre, sucursal_id: Number(sucursalId), activa }]).select().single();
    if (error) throw error;
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getContextoCaja(param) {
  try {
    if (param && (typeof param === 'number' || !isNaN(Number(param)))) {
      const usuarioId = Number(param);
      const { data, error } = await supabase.from('turno_caja').select('id, caja_id, sucursal_id, cajero_id, saldo_inicial, estado, fecha_hora_apertura, caja:caja_id(nombre), sucursal:sucursal_id(descripcion, punto_venta)').eq('cajero_id', usuarioId).eq('estado', 'Abierto');
      if (error) throw error;
      const turnosMapeados = (data || []).map(t => ({
        ...t,
        caja: t.caja?.nombre || `Caja #${t.caja_id}`,
        efectivo_esperado: Number(t.saldo_inicial || 0)
      }));
      return { turnos: turnosMapeados, error: null };
    }
    const turnoId = param;
    const { data, error } = await supabase.from('turno_caja').select('id, caja_id, sucursal_id, cajero_id, saldo_inicial, estado, fecha_hora_apertura, caja:caja_id(nombre), sucursal:sucursal_id(descripcion, punto_venta), usuario:cajero_id(nombre_completo)').eq('id', turnoId).single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getArqueoPrevioCierre(turnoId) {
  try {
    const { data: contexto, error: errCtx } = await getContextoCaja(turnoId);
    if (errCtx) throw new Error(errCtx);
    return { data: { turno_id: turnoId, saldo_inicial: contexto?.saldo_inicial || 0, total_efectivo_ventas: 0, total_esperado_en_caja: contexto?.saldo_inicial || 0, estado: contexto?.estado }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getMovimientosCaja(turnoId) {
  try {
    const { data, error } = await supabase.rpc('hu50_consultar_movimientos', { p_turno_id: Number(turnoId) });
    if (error) throw error;
    
    return (data || []).map(m => ({
      ...m,
      medio: m.medio_pago_nombre || m.medio || 'Efectivo',
      medio_pago_nombre: m.medio_pago_nombre || m.medio || 'Efectivo'
    }));
  } catch (err) {
    console.error('Error en getMovimientosCaja:', err);
    throw err;
  }
}

export async function registrarMovimientoCaja(payload) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Iniciá sesión para registrar movimientos.');
  const usuario = session.user.id;
  if (!confirmaciones.has(usuario)) confirmaciones.set(usuario, crearConfirmacionMovimiento());
  return confirmaciones.get(usuario)(payload, ejecutarMovimientoCaja);
}

async function ejecutarMovimientoCaja(payload) {
  try {
    const valorImporte = Number(payload.importe ?? 0);
    const medioPagoIdNum = payload.medioPagoId && !isNaN(Number(payload.medioPagoId)) ? Number(payload.medioPagoId) : null;

    const { data, error } = await supabase.rpc('hu50_registrar_movimiento', {
      p_turno_id: Number(payload.turnoId),
      p_tipo: payload.tipo || 'Ingreso',
      p_concepto: payload.concepto,
      p_importe: valorImporte,
      p_medio_pago_id: medioPagoIdNum,
      p_idempotency_key: payload.clave || null,
      p_movimiento_original_id: payload.originalId ? Number(payload.originalId) : null,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error en registrarMovimientoCaja:', err);
    throw err;
  }
}
