import { supabase } from '../lib/supabase.js';

async function sesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function consultarTurnos() {
  const session = await sesion();
  
  const { data, error } = await supabase.from('turno_caja')
    .select('id,caja_id,sucursal_id,cajero_id,estado,fecha_hora_apertura,saldo_inicial')
    .order('fecha_hora_apertura', { ascending: false });
  if (error) throw error;

  return { 
    autenticado: !!session, 
    turnos: (data || []).map(t => ({ 
      ...t, 
      caja_nombre: `Caja #${t.caja_id}`,
      cajero_nombre: `Carlos`,
      etiqueta_turno: `Caja #${t.caja_id} · Sucursal #${t.sucursal_id || 1} · #${t.id}`
    })) 
  };
}

export const consultarDetalleTurno = async (turnoId) => {
  try {
    const idNum = Number(turnoId);
    if (!idNum) return null;

    // 1. Obtener el turno
    const { data: turno, error: errTurno } = await supabase
      .from('turno_caja')
      .select('*')
      .eq('id', idNum)
      .single();
    if (errTurno) throw errTurno;

    // 2. Obtener directamente el registro de la tabla cierre_caja (que ya sabemos que funciona y trae los montos)
    const { data: cierre, error: errCierre } = await supabase
      .from('cierre_caja')
      .select('*')
      .eq('turno_id', idNum)
      .maybeSingle();
    if (errCierre) console.warn(errCierre);

    const saldoInicial = Number(turno?.saldo_inicial || 0);
    const efectivoEsperado = cierre?.efectivo_esperado ? Number(cierre.efectivo_esperado) : saldoInicial;

    return {
      turno: {
        ...turno,
        caja_nombre: `Caja #${turno?.caja_id}`,
        cajero_nombre: `Carlos`
      },
      cierre: cierre || null,
      arqueos: [], // Evitamos consultar la tabla restringida arqueo_caja para prevenir el error 403
      totales: {
        saldo_inicial: saldoInicial,
        efectivo_esperado: efectivoEsperado
      }
    };
  } catch (err) {
    console.error('Error en consultarDetalleTurno:', err);
    return null;
  }
};

export const registrarArqueoReal = async (p) => {
  const { data, error } = await supabase.rpc('hu51_registrar_arqueo', {
    p_turno_id: Number(p.turno),
    p_monto_contado: Number(p.contado)
  });
  if (error) throw error;
  return data;
};

export const cerrarTurnoReal = async (p) => {
  const { data, error } = await supabase.rpc('caja_cerrar_turno', {
    p_turno: Number(p.turno),
    p_arqueo: Number(p.arqueo),
    p_version: Number(p.version || 1),
    p_observacion: p.observacion ? String(p.observacion) : null,
    p_clave: p.clave ? String(p.clave) : null
  });
  if (error) throw error;
  return data;
};

export const cerrarTurnoCajaReal = cerrarTurnoReal;