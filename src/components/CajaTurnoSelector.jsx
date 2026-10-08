import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';

export default function CajaTurnoSelector({ caja, disabled = false }) {
  return <>
    {caja.error && <p className="caja-error" role="alert">{caja.error}</p>}
    {!caja.autenticado && <p className="caja-demo">Estás viendo cajas y turnos reales en modo de consulta. Los saldos, movimientos, arqueos y cierres requieren una sesión autorizada.</p>}
    <div className="caja-panel caja-form">
      <label>Turno<select value={caja.turnoId} disabled={disabled || caja.cargando} onChange={e => caja.setTurnoId(e.target.value)}>
        <option value="">Seleccioná un turno</option>
        {caja.turnos.map(t => <option key={t.id} value={t.id}>#{t.id} · {t.caja_nombre} · Sucursal #{t.sucursal_id} · {t.estado}</option>)}
      </select></label>
      {caja.turno && <p>Cajero #{caja.turno.cajero_id} · Apertura: {fechaCaja(caja.turno.fecha_hora_apertura)} · Base inicial: {monedaCaja(caja.turno.saldo_inicial)}</p>}
      {caja.cargando && <p role="status">Cargando datos…</p>}
      {!caja.cargando && !caja.turnos.length && <p>No hay turnos disponibles.</p>}
    </div>
  </>;
}
