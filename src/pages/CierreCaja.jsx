import { useRef, useState } from 'react';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import CajaTurnoSelector from '../components/CajaTurnoSelector.jsx';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';
import { cerrarTurnoReal } from '../services/cajaTurnos.js';

export default function CierreCaja() {
  const caja = useCajaTurnos();
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ocupado = useRef(false);

  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current || (!pendiente && !caja.detalle)) return;
    if (!pendiente && (!Number.isFinite(Number(efectivoContado)) || !/^\d+(\.\d{1,2})?$/.test(efectivoContado))) { 
      setMensaje('Ingresá un importe válido de hasta dos decimales.'); 
      return; 
    }
    ocupado.current = true;
    setGuardando(true);
    const p = pendiente || { 
      turno: caja.detalle.turno.id, 
      efectivoContado: Number(efectivoContado), 
      observaciones: observaciones.trim(), 
      version: caja.detalle.turno.version_movimientos, 
      clave: crypto.randomUUID() 
    };
    setPendiente(p);
    try {
      await cerrarTurnoReal(p);
      setPendiente(null); 
      setEfectivoContado(''); 
      setObservaciones(''); 
      setMensaje('Turno cerrado correctamente.'); 
      caja.actualizar();
    } catch (err) {
      if (/^[0-9A-Z]{5}$/.test(err.code || '')) setPendiente(null);
      setMensaje(err.message);
    } finally { 
      ocupado.current = false; 
      setGuardando(false); 
    }
  }

  return (
    <section className="caja-page">
      <header className="caja-header">
        <div>
          <span className="caja-eyebrow">GESTIÓN DE CAJA</span>
          <h1>Cierre de caja</h1>
          <p>Realizá el cierre definitivo de tu turno de trabajo.</p>
        </div>
        <button className="caja-button secondary" disabled={guardando || !!pendiente || caja.cargando} onClick={caja.actualizar}>Actualizar</button>
      </header>
      <CajaTurnoSelector caja={caja} disabled={guardando || !!pendiente} />
      {mensaje && <p role="status" className="caja-demo">{mensaje}</p>}
      {caja.detalle && <>
        <div className="caja-panel caja-form">
          <h2>{caja.turno?.caja_nombre} · Turno #{caja.turnoId}</h2>
          <p>Efectivo esperado: <strong>{monedaCaja(caja.detalle.totales.efectivo_esperado)}</strong></p>
          {caja.detalle.turno.estado === 'Abierto' ? (
            <form onSubmit={guardar}>
              <label style={{ marginTop: 20 }}>
                Efectivo contado para el cierre
                <input type="number" min="0" max="999999999999.99" step="0.01" required value={efectivoContado} disabled={guardando || !!pendiente} onChange={e => setEfectivoContado(e.target.value)} />
              </label>
              <label style={{ marginTop: 15 }}>
                Observaciones (opcional)
                <input type="text" value={observaciones} disabled={guardando || !!pendiente} onChange={e => setObservaciones(e.target.value)} placeholder="Motivo de diferencias, etc." />
              </label>
              {!pendiente && <button className="caja-button" style={{ marginTop: 20 }} disabled={guardando}>Cerrar turno</button>}
            </form>
          ) : <p>El turno ya se encuentra cerrado.</p>}
        </div>
      </>}
      {pendiente && (
        <div className="caja-demo">
          <p>Hay una confirmación pendiente de cierre. El reintento conserva la misma operación.</p>
          <button className="caja-button" disabled={guardando} onClick={guardar}>Reintentar cierre</button>
        </div>
      )}
    </section>
  );
}