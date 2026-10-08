import { useRef, useState } from 'react';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import CajaTurnoSelector from '../components/CajaTurnoSelector.jsx';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';
import { registrarArqueoReal } from '../services/cajaTurnos.js';
import './MovimientosCaja.css';

export default function ArqueoCaja() {
  const caja = useCajaTurnos();
  const [contado, setContado] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const ocupado = useRef(false);
  const diferencia = contado !== '' && caja.detalle ? Number(contado) - Number(caja.detalle.totales.efectivo_esperado) : null;
  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current || (!pendiente && !caja.detalle)) return;
    if (!pendiente && (!Number.isFinite(Number(contado)) || !/^\d+(\.\d{1,2})?$/.test(contado))) { setMensaje('Ingresá un importe no negativo de hasta dos decimales.'); return; }
    ocupado.current = true;
    setGuardando(true);
    const p = pendiente || { turno: caja.detalle.turno.id, contado: Number(contado), version: caja.detalle.turno.version_movimientos, clave: crypto.randomUUID() };
    setPendiente(p);
    try {
      await registrarArqueoReal(p);
      setPendiente(null); setContado(''); setMensaje('Arqueo registrado correctamente.'); caja.actualizar();
    } catch (err) {
      if (/^[0-9A-Z]{5}$/.test(err.code || '')) setPendiente(null);
      setMensaje(err.message);
    } finally { ocupado.current = false; setGuardando(false); }
  }
  return <section className="caja-page">
    <header className="caja-header"><div><span className="caja-eyebrow">GESTIÓN DE CAJA</span><h1>Arqueo de caja</h1><p>Registrá el efectivo contado sin alterar el saldo.</p></div><button className="caja-button secondary" disabled={guardando || !!pendiente || caja.cargando} onClick={caja.actualizar}>Actualizar</button></header>
    <CajaTurnoSelector caja={caja} disabled={guardando || !!pendiente} />
    {mensaje && <p role="status" className="caja-demo">{mensaje}</p>}
    {caja.detalle && <>
      <div className="caja-panel caja-form"><h2>{caja.turno?.caja_nombre} · Turno #{caja.turnoId}</h2><p>Efectivo esperado: <strong>{monedaCaja(caja.detalle.totales.efectivo_esperado)}</strong></p>
      {caja.detalle.turno.estado === 'Abierto' ? <form onSubmit={guardar}><label style={{ marginTop: 20 }}>Efectivo contado<input type="number" min="0" max="999999999999.99" step="0.01" required value={contado} disabled={guardando || !!pendiente} onChange={e => setContado(e.target.value)} /></label>
        {diferencia !== null && <p>{diferencia < 0 ? 'Faltante' : diferencia > 0 ? 'Sobrante' : 'Sin diferencia'}: {monedaCaja(diferencia)}</p>}
        {!pendiente && <button className="caja-button" style={{ marginTop: 20 }} disabled={guardando}>Registrar arqueo</button>}
      </form> : <p>El turno está cerrado y no admite nuevos arqueos.</p>}</div>
      <section className="caja-panel caja-form"><h2>Historial de arqueos</h2>{caja.detalle.arqueos.map(a => <p key={a.id_arqueo}>#{a.id_arqueo} · {fechaCaja(a.fecha_hora)} · Usuario #{a.usuario_id} · Esperado {monedaCaja(a.efectivo_esperado)} · Contado {monedaCaja(a.efectivo_contado)} · Diferencia {monedaCaja(a.diferencia)} · {a.vigente ? 'Vigente' : 'Histórico'}</p>)}{!caja.detalle.arqueos.length && <p>Todavía no hay arqueos.</p>}</section>
    </>}
    {pendiente && <div className="caja-demo"><p>Hay una confirmación pendiente. El reintento conserva la misma operación.</p><button className="caja-button" disabled={guardando} onClick={guardar}>Reintentar confirmación</button></div>}
  </section>;
}
