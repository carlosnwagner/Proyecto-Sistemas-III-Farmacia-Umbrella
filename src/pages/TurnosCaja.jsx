import { useState } from 'react';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import CajaTurnoSelector from '../components/CajaTurnoSelector.jsx';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';

export default function TurnosCaja() {
  const caja = useCajaTurnos();
  const [filtros, setFiltros] = useState({ caja: '', desde: '', hasta: '', tipo: '', medio: '' });
  
  const filtrar = e => setFiltros(f => ({ ...f, [e.target.name]: e.target.value }));
  
  const dia = valor => {
    const d = new Date(valor);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  
  const enPeriodo = fecha => (!filtros.desde || dia(fecha) >= filtros.desde) && (!filtros.hasta || dia(fecha) <= filtros.hasta);
  const lista = caja.turnos.filter(t => (!filtros.caja || String(t.caja_id) === filtros.caja) && enPeriodo(t.fecha_hora_apertura));
  const visible = lista.some(t => String(t.id) === caja.turnoId);
  const detalle = visible ? caja.detalle : null;
  const totales = detalle?.turno.estado === 'Cerrado' && detalle.turno.resumen_cierre ? detalle.turno.resumen_cierre : detalle?.totales;
  const movimientos = (detalle?.movimientos || []).filter(m => (!filtros.tipo || m.tipo === filtros.tipo) && (!filtros.medio || m.medio === filtros.medio) && enPeriodo(m.fecha_hora));

  return (
    <section className="caja-page">
      <header className="caja-header">
        <div>
          <span className="caja-eyebrow">GESTIÓN DE CAJA</span>
          <h1>Saldo y movimientos</h1>
          <p>Consultá las operaciones reales de cada turno.</p>
        </div>
        <button className="caja-button secondary" onClick={caja.actualizar} disabled={caja.cargando}>Actualizar</button>
      </header>
      
      <div className="caja-panel caja-form">
        <div className="caja-fields">
          <label>Caja
            <select name="caja" value={filtros.caja} onChange={filtrar}>
              <option value="">Todas</option>
              {[...new Map(caja.turnos.map(t => [t.caja_id, t])).values()].map(t => (
                <option key={t.caja_id} value={t.caja_id}>{t.caja_nombre}</option>
              ))}
            </select>
          </label>
          <label>Desde<input type="date" name="desde" value={filtros.desde} onChange={filtrar} max={filtros.hasta || undefined} /></label>
          <label>Hasta<input type="date" name="hasta" value={filtros.hasta} onChange={filtrar} min={filtros.desde || undefined} /></label>
        </div>
      </div>

      <CajaTurnoSelector caja={{ ...caja, turnos: lista, turno: visible ? caja.turno : null, turnoId: visible ? caja.turnoId : '' }} />
      
      {detalle && <>
        <p>Estado: {detalle.turno.estado} · Cierre: {fechaCaja(detalle.turno.fecha_hora_cierre)}</p>
        
        <div className="caja-summary">
          {Object.entries({ 
            'Efectivo inicial': totales.saldo_inicial, 
            'Ingresos en efectivo': totales.ingresos_efectivo, 
            'Egresos en efectivo': totales.egresos_efectivo, 
            'Efectivo esperado': totales.efectivo_esperado, 
            'Tarjeta neto': totales.tarjeta_neto, 
            'Transferencia neto': totales.transferencia_neto 
          }).map(([titulo, valor]) => (
            <article className="caja-stat" key={titulo}>
              <span>{titulo}</span>
              <strong>{monedaCaja(valor)}</strong>
            </article>
          ))}
        </div>

        {detalle.turno.resumen_cierre && (
          <div className="caja-panel caja-form">
            <h2>Cierre conservado</h2>
            <p>Contado: {monedaCaja(totales.efectivo_contado)} · Diferencia: {monedaCaja(totales.diferencia)} · Usuario #{totales.usuario_id} · Arqueo #{totales.arqueo_id}</p>
            <p>{totales.observacion || 'Sin observaciones'}</p>
          </div>
        )}

        <section className="caja-panel caja-form">
          <h2>Movimientos del turno</h2>
          <div className="caja-fields" style={{ margin: '20px 0' }}>
            <label>Tipo
              <select name="tipo" value={filtros.tipo} onChange={filtrar}>
                <option value="">Todos</option>
                <option>Ingreso</option>
                <option>Egreso</option>
              </select>
            </label>
            <label>Medio
              <select name="medio" value={filtros.medio} onChange={filtrar}>
                <option value="">Todos</option>
                <option>Efectivo</option>
                <option>Tarjeta</option>
                <option>Transferencia</option>
              </select>
            </label>
          </div>

          <div className="caja-table-wrap">
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>{['Fecha', 'Tipo', 'Concepto', 'Importe', 'Medio', 'Usuario', 'Origen / referencia'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td>{fechaCaja(m.fecha_hora)}</td>
                    <td>{m.tipo}</td>
                    <td>{m.concepto}</td>
                    <td>{monedaCaja(m.importe)}</td>
                    <td>{m.medio}</td>
                    <td>#{m.usuario_id}</td>
                    <td>{m.origen}{m.movimiento_original_id && ` del movimiento #${m.movimiento_original_id}`}{m.referencia_venta && ` · Venta ${m.referencia_venta}`}{detalle.movimientos.some(r => r.movimiento_original_id === m.id) && ' · Revertido'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!movimientos.length && <p>No hay movimientos para estos filtros.</p>}
        </section>
      </>}
    </section>
  );
}