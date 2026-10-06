// Datos en memoria: la demo no consulta ni escribe en Supabase.
export function crearCajaDemo() {
  const medios = ['Efectivo', 'Tarjeta', 'Transferencia'].map((nombre, i) => ({ id_medio_pago: i + 1, nombre }));
  let movimientos = [];
  let abierto = true;
  const saldo = () => 1000 + movimientos.filter(m => m.medio === 'Efectivo').reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0);
  const rechazar = mensaje => { throw Object.assign(new Error(mensaje), { code: 'P0001' }); };
  return {
    getMediosPago: async () => ({ data: medios, error: null }),
    getContextoMovimientosCaja: async () => ({ turnos: abierto ? [{ id: 1, caja: 'Caja 01', sucursal_id: 1, saldo_inicial: 1000, efectivo_esperado: saldo() }] : [] }),
    getMovimientosCaja: async () => [...movimientos].reverse(),
    registrarMovimientoCaja: async p => {
      const existente = movimientos.find(m => m.idempotency_key === p.clave);
      if (existente) {
        if (existente.solicitud !== JSON.stringify(p)) rechazar('La confirmación ya fue utilizada para otra operación');
        return existente;
      }
      if (!abierto) rechazar('El turno está cerrado');
      if (Number(p.turnoId) !== 1) rechazar('El turno no existe');
      if (!p.clave || !p.concepto?.trim()) rechazar('El concepto y la clave de confirmación son obligatorios');
      const original = p.originalId ? movimientos.find(m => m.id === p.originalId) : null;
      if (p.originalId && (!original || original.origen !== 'Manual' || movimientos.some(m => m.movimiento_original_id === original.id))) rechazar('El movimiento no se puede revertir');
      const tipo = original ? (original.tipo === 'Ingreso' ? 'Egreso' : 'Ingreso') : p.tipo;
      const importe = original ? original.importe : Number(p.importe);
      const medio = original ? medios.find(m => m.id_medio_pago === original.medio_pago_id) : medios.find(m => m.id_medio_pago === Number(p.medioPagoId));
      if (!['Ingreso', 'Egreso'].includes(tipo) || !Number.isFinite(importe) || importe <= 0 || importe >= 1000000000000 || Math.abs(importe * 100 - Math.round(importe * 100)) > 0.001 || !medio) rechazar('Revisá tipo, importe positivo de hasta dos decimales y medio de pago');
      if (medio.nombre === 'Efectivo' && tipo === 'Egreso' && importe > saldo()) rechazar('El egreso supera el efectivo disponible');
      const movimiento = { id: movimientos.length + 1, turno_id: 1, caja_id: 1, usuario_id: 1, fecha_hora: new Date().toISOString(), tipo, concepto: p.concepto.trim(), importe, medio: medio.nombre, medio_pago_id: medio.id_medio_pago, origen: original ? 'Reversion' : 'Manual', movimiento_original_id: original?.id || null, idempotency_key: p.clave, solicitud: JSON.stringify(p) };
      movimientos = [...movimientos, movimiento];
      return movimiento;
    },
    cerrar: () => { abierto = false; },
    reiniciar: () => { movimientos = []; abierto = true; },
  };
}
