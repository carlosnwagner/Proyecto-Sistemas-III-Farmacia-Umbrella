// ==============================================================================
// BACKEND INTERMEDIO DE CAJA Y ARQUEO (src/services/caja.js)
// Centraliza el ciclo de vida de turnos de caja:
// - Consulta de sucursales y disponibilidad de cajas
// - Verificación de turno activo de cajero
// - Apertura transaccional de caja (HU49)
// - Contexto y arqueo previo al cierre (HU50 / Cierre)
// ==============================================================================

import { supabase } from '../lib/supabase.js';

/**
 * Obtiene las sucursales autorizadas para el usuario.
 * Para administradores devuelve todas las sucursales activas.
 * Para cajeros consulta las sucursales asignadas en usuario_sucursal_caja.
 */
export async function getSucursalesAutorizadas(usuario) {
  try {
    if (!usuario) return { data: [], error: 'Sin sesión de usuario' };

    // Si es administrador, tiene acceso a todas las sucursales
    if (usuario.rol === 'administrador') {
      const { data, error } = await supabase
        .from('sucursal')
        .select('*')
        .eq('estado', true)
        .order('id_sucursal', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    }

    // Si es cajero, consultamos sus sucursales en usuario_sucursal_caja
    try {
      const { data: asignaciones, error: errAsig } = await supabase
        .from('usuario_sucursal_caja')
        .select('sucursal_id')
        .eq('usuario_id', usuario.id_usuario);

      if (!errAsig && asignaciones && asignaciones.length > 0) {
        const ids = asignaciones.map((a) => a.sucursal_id);
        const { data: sucursales, error: errSuc } = await supabase
          .from('sucursal')
          .select('*')
          .in('id_sucursal', ids)
          .eq('estado', true);

        if (!errSuc && sucursales && sucursales.length > 0) {
          return { data: sucursales, error: null };
        }
      }
    } catch (e) {
      console.warn('No se pudo consultar usuario_sucursal_caja, aplicando fallback:', e);
    }

    // Fallback para cajero si aún no tiene asignación en la tabla intermedia
    if (usuario.sucursal_id) {
      const { data: sucUser } = await supabase
        .from('sucursal')
        .select('*')
        .eq('id_sucursal', usuario.sucursal_id);

      if (sucUser && sucUser.length > 0) {
        return { data: sucUser, error: null };
      }
    }

    // Si no tiene sucursal_id explícita, traemos las sucursales activas del sistema
    const { data: todas, error } = await supabase
      .from('sucursal')
      .select('*')
      .eq('estado', true)
      .limit(3);

    return { data: todas || [], error };
  } catch (err) {
    console.error('Error en getSucursalesAutorizadas:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Consulta las cajas de una sucursal junto con su estado de disponibilidad en tiempo real.
 * CA1: Disponibilidad calculada según si existe un turno Abierto en turno_caja.
 */
export async function getCajasSucursalConDisponibilidad(sucursalId) {
  try {
    if (!sucursalId) return { data: [], error: 'ID de sucursal requerido' };

    // 1. Cajas de la sucursal
    const { data: cajas, error: errCajas } = await supabase
      .from('caja')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('id', { ascending: true });

    if (errCajas) throw errCajas;

    // 2. Turnos abiertos actualmente en esa sucursal
    const { data: turnosAbiertos, error: errTurnos } = await supabase
      .from('turno_caja')
      .select(`
        id,
        caja_id,
        sucursal_id,
        cajero_id,
        saldo_inicial,
        estado,
        fecha_hora_apertura
      `)
      .eq('sucursal_id', sucursalId)
      .eq('estado', 'Abierto');

    if (errTurnos) throw errTurnos;

    // 3. Traer nombres de los cajeros involucrados
    const cajeroIds = [...new Set((turnosAbiertos || []).map((t) => t.cajero_id))];
    let mapaCajeros = {};
    if (cajeroIds.length > 0) {
      const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_usuario, nombre_completo, usuario')
        .in('id_usuario', cajeroIds);

      (usuarios || []).forEach((u) => {
        mapaCajeros[u.id_usuario] = u.nombre_completo || u.usuario;
      });
    }

    // 4. Cruzar cajas con su disponibilidad
    const cajasConEstado = (cajas || []).map((caja) => {
      const turnoActivo = (turnosAbiertos || []).find((t) => t.caja_id === caja.id);
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
    console.error('Error en getCajasSucursalConDisponibilidad:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Consulta si un cajero específico posee actualmente un turno abierto activo.
 */
export async function getTurnoActivoCajero(cajeroId) {
  try {
    if (!cajeroId) return { tieneTurno: false, turno: null, error: null };

    const { data, error } = await supabase
      .from('turno_caja')
      .select(`
        id,
        caja_id,
        sucursal_id,
        cajero_id,
        saldo_inicial,
        estado,
        fecha_hora_apertura,
        caja:caja_id(id, nombre),
        sucursal:sucursal_id(id_sucursal, codigo, descripcion)
      `)
      .eq('cajero_id', cajeroId)
      .eq('estado', 'Abierto')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return { tieneTurno: true, turno: data[0], error: null };
    }

    return { tieneTurno: false, turno: null, error: null };
  } catch (err) {
    console.error('Error en getTurnoActivoCajero:', err);
    return { tieneTurno: false, turno: null, error: err.message };
  }
}

/**
 * Apertura de Turno de Caja (HU49).
 * Invoca la función RPC atómica 'abrir_turno_caja'.
 * Incluye fallback directo en caso de que la RPC no haya sido creada aún en Supabase.
 */
export async function abrirTurnoCaja({ cajaId, sucursalId, cajeroId, saldoInicial }) {
  try {
    const saldoNum = Number(saldoInicial);
    if (isNaN(saldoNum) || saldoNum < 0) {
      return { success: false, error: 'El importe inicial debe ser un número mayor o igual a cero' };
    }

    // 1. Intento primario: Función RPC transaccional
    const { data, error } = await supabase.rpc('abrir_turno_caja', {
      p_caja_id: Number(cajaId),
      p_sucursal_id: Number(sucursalId),
      p_cajero_id: Number(cajeroId),
      p_saldo_inicial: saldoNum
    });

    if (!error) {
      return { success: true, data, error: null };
    }

    // Si la RPC devolvió un error de validación o concurrencia conocido
    if (error.code !== 'PGRST202') {
      return { success: false, error: error.message || 'Error al abrir caja' };
    }

    // 2. Fallback transaccional de seguridad si la RPC no está instalada aún en Supabase
    console.warn('RPC abrir_turno_caja no detectada. Ejecutando fallback directo...');

    // Chequeo de concurrencia caja
    const { data: turnoCajaExistente } = await supabase
      .from('turno_caja')
      .select('id')
      .eq('caja_id', cajaId)
      .eq('estado', 'Abierto')
      .limit(1);

    if (turnoCajaExistente && turnoCajaExistente.length > 0) {
      return { success: false, error: 'La caja ya fue abierta por otro cajero' };
    }

    // Chequeo de concurrencia cajero
    const { data: turnoCajeroExistente } = await supabase
      .from('turno_caja')
      .select('id')
      .eq('cajero_id', cajeroId)
      .eq('estado', 'Abierto')
      .limit(1);

    if (turnoCajeroExistente && turnoCajeroExistente.length > 0) {
      return { success: false, error: 'Ya posees un turno abierto activo en otra caja' };
    }

    // Inserción en turno_caja
    const { data: nuevoTurno, error: errInsert } = await supabase
      .from('turno_caja')
      .insert([
        {
          caja_id: Number(cajaId),
          sucursal_id: Number(sucursalId),
          cajero_id: Number(cajeroId),
          saldo_inicial: saldoNum,
          estado: 'Abierto',
          fecha_hora_apertura: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (errInsert) {
      if (errInsert.code === '23505') {
        return { success: false, error: 'La caja ya fue abierta por otro operador en simultáneo' };
      }
      throw errInsert;
    }

    return { success: true, data: nuevoTurno, error: null };
  } catch (err) {
    console.error('Error al abrir turno de caja:', err);
    return { success: false, error: err.message || 'Ocurrió un error inesperado al abrir la caja' };
  }
}

/**
 * Obtiene el contexto consolidado del turno para operaciones posteriores (HU50 - Arqueo previo al cierre).
 */
export async function getContextoCaja(turnoId) {
  try {
    const { data, error } = await supabase
      .from('turno_caja')
      .select(`
        id,
        caja_id,
        sucursal_id,
        cajero_id,
        saldo_inicial,
        estado,
        fecha_hora_apertura,
        caja:caja_id(nombre),
        sucursal:sucursal_id(descripcion, punto_venta),
        usuario:cajero_id(nombre_completo)
      `)
      .eq('id', turnoId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('Error en getContextoCaja:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Placeholder para cálculo de arqueo previo al cierre (siguiente HU).
 */
export async function getArqueoPrevioCierre(turnoId) {
  try {
    const { data: contexto, error: errCtx } = await getContextoCaja(turnoId);
    if (errCtx) throw new Error(errCtx);

    return {
      data: {
        turno_id: turnoId,
        saldo_inicial: contexto?.saldo_inicial || 0,
        total_efectivo_ventas: 0,
        total_esperado_en_caja: contexto?.saldo_inicial || 0,
        estado: contexto?.estado
      },
      error: null
    };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * HU51 - Registrar Arqueo de Caja
 * Registra el efectivo contado y su diferencia respecto al esperado, sin alterar 
 * el saldo real ni generar movimientos contables.
 * 
 * @param {Object} payload 
 * @param {number} payload.turno_id - ID del turno de caja abierto
 * @param {number} payload.usuario_id - ID del usuario/cajero que realiza el arqueo
 * @param {number|string} payload.efectivo_esperado - Lo que el sistema dice que debería haber
 * @param {number|string} payload.efectivo_contado - Lo que el cajero contó físicamente
 * @param {number|string} payload.diferencia - Resultado de (contado - esperado)
 * 
 * @returns {Promise<{ data: object|null, error: Error|null }>}
 */
export async function registrarArqueoBackend(payload) {
  try {
    // armado de objeto asegurando que los valores monetarios sean números
    const insertPayload = {
      turno_id: payload.turno_id,
      usuario_id: payload.usuario_id,
      efectivo_esperado: Number(payload.efectivo_esperado),
      efectivo_contado: Number(payload.efectivo_contado),
      diferencia: Number(payload.diferencia)
      // Nota: 'fecha_hora' y 'valido_para_cierre' se autogeneran en la base de datos
    };

    // 2. Insertamos en Supabase
    const { data, error } = await supabase
      .from('arqueo_caja')
      .insert([insertPayload])
      .select()
      .single();

    // 3. Manejamos los errores de red o restricciones de PostgreSQL
    if (error) {
      console.error("Error en Supabase al registrar arqueo:", error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };

  } catch (err) {
    // Capturamos cualquier error inesperado de ejecución
    console.error("Excepción en registrarArqueoBackend:", err);
    return { data: null, error: err };
  }
}import { supabase } from '../lib/supabase.js';

// La identidad viaja en la sesión de Supabase. Nunca se envía un cajero elegido
// desde el formulario: las RPC resuelven auth.uid() y validan la sucursal.
export async function getContextoMovimientosCaja() {
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
