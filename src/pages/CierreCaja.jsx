import { useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import CajaTurnoSelector from '../components/CajaTurnoSelector.jsx';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';
import { cerrarTurnoReal } from '../services/cajaTurnos.js';
import './MovimientosCaja.css';

export default function CierreCaja() {
  const caja = useCajaTurnos();
  const [observacion, setObservacion] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ocupado = useRef(false);
  const arqueo = caja.detalle?.arqueos.find(a => a.vigente);
  const totales = caja.detalle?.turno.resumen_cierre || caja.detalle?.totales;
  async function cerrar(e) {
    e.preventDefault();
    if (ocupado.current || (!pendiente && !arqueo)) return;
    if (!pendiente && Number(arqueo.diferencia) !== 0 && !observacion.trim()) { setMensaje('Indicá el motivo de la diferencia.'); return; }
    ocupado.current = true; setGuardando(true);
    // Captura la versión ANTES de abrir el diálogo: el servidor detectará cambios posteriores.
    const p = pendiente || { turno: caja.detalle.turno.id, arqueo: arqueo.id_arqueo, version: caja.detalle.turno.version_movimientos, observacion: observacion.trim(), clave: crypto.randomUUID() };
    try {
      if (!pendiente) {
        const decision = await Swal.fire({ title: '¿Cerrar este turno?', text: `${caja.turno.caja_nombre} · Turno #${p.turno} · Esperado ${monedaCaja(totales.efectivo_esperado)} · Contado ${monedaCaja(arqueo.efectivo_contado)} · Diferencia ${monedaCaja(arqueo.diferencia)}`, icon: 'question', showCancelButton: true, confirmButtonText: 'Cerrar turno', cancelButtonText: 'Volver' });
        if (!decision.isConfirmed) return;
      }
      setPendiente(p);
      await cerrarTurnoReal(p);
      setPendiente(null); setObservacion(''); setMensaje('Turno cerrado. La caja está disponible para una nueva apertura.'); caja.actualizar();
    } catch (err) {
      if (/^[0-9A-Z]{5}$/.test(err.code || '')) setPendiente(null);
      setMensaje(err.message);
    } finally { ocupado.current = false; setGuardando(false); }
  }
  return <section className="caja-page">
    <header className="caja-header"><div><span className="caja-eyebrow">GESTIÓN DE CAJA</span><h1>Cierre de caja</h1><p>Revisá el resumen y finalizá el turno con un arqueo vigente.</p></div><button className="caja-button secondary" disabled={guardando || !!pendiente || caja.cargando} onClick={caja.actualizar}>Actualizar</button></header>
    <CajaTurnoSelector caja={caja} disabled={guardando || !!pendiente} />
    {mensaje && <p role="status" className="caja-demo">{mensaje}</p>}
    {caja.detalle?.turno.estado === 'Cerrado' && !caja.detalle.turno.resumen_cierre && <p className="caja-demo">Este turno se cerró antes de incorporar el resumen histórico. Sus movimientos siguen disponibles para consulta.</p>}
    {totales && <>
      <div className="caja-summary">{Object.entries({ 'Efectivo inicial': totales.saldo_inicial, 'Ingresos en efectivo': totales.ingresos_efectivo, 'Egresos en efectivo': totales.egresos_efectivo, 'Efectivo esperado': totales.efectivo_esperado, 'Tarjeta neto': totales.tarjeta_neto, 'Transferencia neto': totales.transferencia_neto }).map(([titulo,valor]) => <article className="caja-stat" key={titulo}><span>{titulo}</span><strong>{monedaCaja(valor)}</strong></article>)}</div>
      <div className="caja-panel caja-form">
      {caja.detalle.turno.estado === 'Cerrado' ? <><h2>Turno cerrado</h2><p>{fechaCaja(caja.detalle.turno.fecha_hora_cierre)} · Usuario #{caja.detalle.turno.usuario_cierre_id}</p><p>Contado: {monedaCaja(totales.efectivo_contado)} · Diferencia: {monedaCaja(totales.diferencia)}</p><p>{totales.observacion || 'Sin observaciones'}</p></> : !arqueo ? <><h2>Necesitás un arqueo vigente</h2><p>Si hubo movimientos después del último arqueo, realizá uno nuevo.</p><Link to="/caja/arqueo">Ir a arqueo de caja</Link></> : <form onSubmit={cerrar}>
        <h2>Arqueo #{arqueo.id_arqueo}</h2><p>Contado: {monedaCaja(arqueo.efectivo_contado)} · Diferencia: {monedaCaja(arqueo.diferencia)} · {Number(arqueo.diferencia) < 0 ? 'Faltante' : Number(arqueo.diferencia) > 0 ? 'Sobrante' : 'Sin diferencia'}</p>
        <label style={{ marginTop: 20 }}>Motivo u observación {Number(arqueo.diferencia) !== 0 && '(obligatorio)'}<input required={Number(arqueo.diferencia) !== 0} value={observacion} disabled={guardando || !!pendiente} onChange={e => setObservacion(e.target.value)} /></label>
        {!pendiente && <button className="caja-button" style={{ marginTop: 20 }} disabled={guardando}>Revisar y cerrar turno</button>}
      </form>}
      </div>
    </>}
    {pendiente && <div className="caja-demo"><p>La respuesta del cierre está pendiente de verificar. Reintentá sin duplicar la operación.</p><button className="caja-button" disabled={guardando} onClick={cerrar}>Reintentar cierre</button></div>}
  </section>;
}
